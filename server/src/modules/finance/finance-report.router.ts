import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';
import { Between } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { normalizeMonth } from '../../shared/utils/date';
import { normalizeText } from '../../shared/utils/text';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { FinanceShoppingRecordEntity } from '../finance/entities/finance-shopping-record.entity';
import { FinanceTravelExpenseRecordEntity } from '../finance/entities/finance-travel-expense-record.entity';
import { FinanceLoanRepaymentEntity } from '../finance/entities/finance-loan-repayment.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { FinanceRentRecordEntity } from '../finance/entities/finance-rent-record.entity';
import { startFinanceMonthlyReportScheduler } from './finance-report.scheduler';
import { startFinanceFollowupScheduler } from './finance-followup.scheduler';

const monthQuerySchema = z.object({
  month: z.string().optional(),
});

const monthlyReportQuerySchema = z.object({
  month: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  monthIndex: z.coerce.number().int().min(1).max(12).optional(),
});

const notifySchema = z.object({
  month: z.string().optional(),
  title: z.string().trim().min(1).max(255).optional(),
});

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

interface TopExpense {
  module: 'shopping' | 'travel' | 'loan' | 'subscription' | 'rent';
  title: string;
  date: string;
  amount: number;
  category?: string;
}

interface ModuleBreakdown {
  module: 'shopping' | 'travel' | 'loan' | 'subscription' | 'rent';
  amount: number;
  count: number;
  percentage: number;
}

interface MonthlyReportSummary {
  month: string;
  startDate: string;
  endDate: string;
  totalExpense: number;
  previousMonthExpense: number;
  monthOverMonthChange: number;
  monthOverMonthChangePercent: number;
  lastYearSameMonthExpense: number;
  yearOverYearChange: number;
  yearOverYearChangePercent: number;
  moduleBreakdown: ModuleBreakdown[];
  categoryBreakdown: CategoryBreakdown[];
  topExpenses: TopExpense[];
  generatedAt: string;
}

const MODULE_LABELS: Record<ModuleBreakdown['module'], string> = {
  shopping: '购物',
  travel: '旅行',
  loan: '贷款',
  subscription: '订阅',
  rent: '房租',
};

function round2(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function calculatePercent(part: number, total: number) {
  if (!total) {
    return 0;
  }
  return Math.round((part / total) * 10000) / 10000;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfMonth(month: string) {
  return dayjs(`${month}-01`).startOf('month');
}

function endOfMonth(month: string) {
  return dayjs(`${month}-01`).endOf('month');
}

function rangeOfMonth(month: string) {
  return {
    start: startOfMonth(month).format('YYYY-MM-DD'),
    end: endOfMonth(month).format('YYYY-MM-DD'),
  };
}

function diffPercent(current: number, previous: number) {
  if (!previous) {
    return current ? 1 : 0;
  }
  return (current - previous) / previous;
}

function describeMonth(month: string) {
  const [year, monthIndex] = month.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }
  return `${year} 年 ${monthIndex} 月`;
}

export async function buildMonthlyReport(
  userId: string,
  month: string,
): Promise<MonthlyReportSummary> {
  const { start, end } = rangeOfMonth(month);
  const dataSource = appDataSource;

  return dataSource.transaction(async (manager) => {
    const shoppingRepo = manager.getRepository(FinanceShoppingRecordEntity);
    const travelRepo = manager.getRepository(FinanceTravelExpenseRecordEntity);
    const loanRepo = manager.getRepository(FinanceLoanRepaymentEntity);
    const subscriptionRepo = manager.getRepository(FinanceSubscriptionRecordEntity);
    const rentRepo = manager.getRepository(FinanceRentRecordEntity);

    const [shoppingRows, travelRows, loanRows, subscriptionRows, rentRows] = await Promise.all([
      shoppingRepo.find({
        where: {
          user_id: userId,
          date: Between(start, end),
        },
      }),
      travelRepo.find({
        where: {
          user_id: userId,
          date: Between(start, end),
        },
      }),
      loanRepo.find({
        where: {
          user_id: userId,
          repayment_date: Between(start, end),
        },
      }),
      subscriptionRepo.find({
        where: {
          user_id: userId,
          start_date: Between(start, end),
        },
      }),
      rentRepo
        .createQueryBuilder('rent')
        .where('rent.user_id = :userId', { userId })
        .andWhere('rent.move_in_date <= :end', { end })
        .andWhere('(rent.move_out_date IS NULL OR rent.move_out_date >= :start)', { start })
        .getMany(),
    ]);

    // --- module breakdown
    const moduleTotals: Record<ModuleBreakdown['module'], { amount: number; count: number }> = {
      shopping: { amount: 0, count: 0 },
      travel: { amount: 0, count: 0 },
      loan: { amount: 0, count: 0 },
      subscription: { amount: 0, count: 0 },
      rent: { amount: 0, count: 0 },
    };

    // --- category aggregation
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const topCandidates: TopExpense[] = [];

    for (const row of shoppingRows) {
      const amount = toNumber(row.price);
      moduleTotals.shopping.amount += amount;
      moduleTotals.shopping.count += 1;
      const category = row.platform || '购物';
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += amount;
      current.count += 1;
      categoryMap.set(category, current);
      topCandidates.push({
        module: 'shopping',
        title: row.item_name || row.spec || '购物记录',
        date: dayjs(row.date).format('YYYY-MM-DD'),
        amount,
        category,
      });
    }

    for (const row of travelRows) {
      const amount = toNumber(row.amount) - toNumber(row.discount_amount);
      const finalAmount = amount > 0 ? amount : toNumber(row.amount);
      moduleTotals.travel.amount += finalAmount;
      moduleTotals.travel.count += 1;
      const category = row.category || '旅行';
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += finalAmount;
      current.count += 1;
      categoryMap.set(category, current);
      topCandidates.push({
        module: 'travel',
        title: row.title || '旅行消费',
        date: dayjs(row.date).format('YYYY-MM-DD'),
        amount: finalAmount,
        category,
      });
    }

    for (const row of loanRows) {
      const amount = toNumber(row.amount) + toNumber(row.interest);
      moduleTotals.loan.amount += amount;
      moduleTotals.loan.count += 1;
      const category = `贷款·${row.platform_name || '未知平台'}`;
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += amount;
      current.count += 1;
      categoryMap.set(category, current);
      topCandidates.push({
        module: 'loan',
        title: `${row.platform_name || '贷款'}还款`,
        date: dayjs(row.repayment_date).format('YYYY-MM-DD'),
        amount,
        category,
      });
    }

    for (const row of subscriptionRows) {
      const cycle = (row.billing_cycle || 'monthly').toLowerCase();
      const price = toNumber(row.cycle_price);
      const monthlyAllocation = cycle === 'yearly' ? price / 12 : cycle === 'quarterly' ? price / 3 : price;
      moduleTotals.subscription.amount += monthlyAllocation;
      moduleTotals.subscription.count += 1;
      const category = row.category_name || '订阅';
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += monthlyAllocation;
      current.count += 1;
      categoryMap.set(category, current);
      topCandidates.push({
        module: 'subscription',
        title: `${row.service_name}·${row.plan_name}`,
        date: dayjs(row.start_date).format('YYYY-MM-DD'),
        amount: monthlyAllocation,
        category,
      });
    }

    for (const row of rentRows) {
      const total = toNumber(row.rent)
        + toNumber(row.electricity_fee)
        + toNumber(row.water_fee)
        + toNumber(row.gas_fee)
        + toNumber(row.agency_fee)
        + toNumber(row.cleaning_fee)
        + toNumber(row.laundry_fee)
        + toNumber(row.service_fee);
      moduleTotals.rent.amount += total;
      moduleTotals.rent.count += 1;
      const category = `房租·${row.channel_name || '未知渠道'}`;
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += total;
      current.count += 1;
      categoryMap.set(category, current);
      topCandidates.push({
        module: 'rent',
        title: row.address || '房租',
        date: dayjs(row.move_in_date).format('YYYY-MM-DD'),
        amount: total,
        category,
      });
    }

    const totalExpense = Object.values(moduleTotals).reduce((sum, item) => sum + item.amount, 0);

    const moduleBreakdown: ModuleBreakdown[] = (Object.keys(moduleTotals) as ModuleBreakdown['module'][])
      .map((key) => ({
        module: key,
        amount: round2(moduleTotals[key].amount),
        count: moduleTotals[key].count,
        percentage: calculatePercent(moduleTotals[key].amount, totalExpense),
      }))
      .sort((left, right) => right.amount - left.amount);

    const categoryBreakdown: CategoryBreakdown[] = [...categoryMap.entries()]
      .map(([category, value]) => ({
        category,
        amount: round2(value.amount),
        count: value.count,
        percentage: calculatePercent(value.amount, totalExpense),
      }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 12);

    const topExpenses = topCandidates
      .filter((item) => item.amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3)
      .map((item) => ({ ...item, amount: round2(item.amount) }));

    // --- 同环比：计算前一个月 / 去年同月
    const prevMonth = startOfMonth(month).subtract(1, 'month').format('YYYY-MM');
    const lastYearMonth = startOfMonth(month).subtract(1, 'year').format('YYYY-MM');
    const previousMonthExpense = await totalExpenseForMonth(userId, prevMonth);
    const lastYearSameMonthExpense = await totalExpenseForMonth(userId, lastYearMonth);

    return {
      month,
      startDate: start,
      endDate: end,
      totalExpense: round2(totalExpense),
      previousMonthExpense: round2(previousMonthExpense),
      monthOverMonthChange: round2(totalExpense - previousMonthExpense),
      monthOverMonthChangePercent: round2(diffPercent(totalExpense, previousMonthExpense) * 100) / 100,
      lastYearSameMonthExpense: round2(lastYearSameMonthExpense),
      yearOverYearChange: round2(totalExpense - lastYearSameMonthExpense),
      yearOverYearChangePercent: round2(diffPercent(totalExpense, lastYearSameMonthExpense) * 100) / 100,
      moduleBreakdown,
      categoryBreakdown,
      topExpenses,
      generatedAt: dayjs().toISOString(),
    };
  });
}

/**
 * 仅计算某月总支出（用于同环比，无需明细 Top / 分类）。
 */
export function totalExpenseForMonth(userId: string, month: string) {
  const { start, end } = rangeOfMonth(month);
  const dataSource = appDataSource;

  return dataSource.transaction(async (manager) => {
    const shoppingRepo = manager.getRepository(FinanceShoppingRecordEntity);
    const travelRepo = manager.getRepository(FinanceTravelExpenseRecordEntity);
    const loanRepo = manager.getRepository(FinanceLoanRepaymentEntity);
    const subscriptionRepo = manager.getRepository(FinanceSubscriptionRecordEntity);
    const rentRepo = manager.getRepository(FinanceRentRecordEntity);

    const [shoppingRows, travelRows, loanRows, subscriptionRows, rentRows] = await Promise.all([
      shoppingRepo.find({ where: { user_id: userId, date: Between(start, end) } }),
      travelRepo.find({ where: { user_id: userId, date: Between(start, end) } }),
      loanRepo.find({ where: { user_id: userId, repayment_date: Between(start, end) } }),
      subscriptionRepo.find({ where: { user_id: userId, start_date: Between(start, end) } }),
      rentRepo
        .createQueryBuilder('rent')
        .where('rent.user_id = :userId', { userId })
        .andWhere('rent.move_in_date <= :end', { end })
        .andWhere('(rent.move_out_date IS NULL OR rent.move_out_date >= :start)', { start })
        .getMany(),
    ]);

    const shoppingSum = shoppingRows.reduce((sum, row) => sum + toNumber(row.price), 0);
    const travelSum = travelRows.reduce((sum, row) => {
      const net = toNumber(row.amount) - toNumber(row.discount_amount);
      return sum + (net > 0 ? net : toNumber(row.amount));
    }, 0);
    const loanSum = loanRows.reduce((sum, row) => sum + toNumber(row.amount) + toNumber(row.interest), 0);
    const subscriptionSum = subscriptionRows.reduce((sum, row) => {
      const cycle = (row.billing_cycle || 'monthly').toLowerCase();
      const price = toNumber(row.cycle_price);
      if (cycle === 'yearly') return sum + price / 12;
      if (cycle === 'quarterly') return sum + price / 3;
      return sum + price;
    }, 0);
    const rentSum = rentRows.reduce((sum, row) => sum
      + toNumber(row.rent)
      + toNumber(row.electricity_fee)
      + toNumber(row.water_fee)
      + toNumber(row.gas_fee)
      + toNumber(row.agency_fee)
      + toNumber(row.cleaning_fee)
      + toNumber(row.laundry_fee)
      + toNumber(row.service_fee), 0);
    return shoppingSum + travelSum + loanSum + subscriptionSum + rentSum;
  });
}

export function buildYearlyReport(userId: string, year: number) {
  // yearly 报告改成同步只做轻量包装（真实数据通过 yearly 接口 async 拼装）
  const months: Array<{ month: string; total: number }> = [];
  for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
    const month = `${year}-${String(monthIndex).padStart(2, '0')}`;
    months.push({ month, total: 0 });
  }
  return {
    year,
    yearTotal: 0,
    months,
  };
}

export async function buildYearlyReportAsync(userId: string, year: number) {
  const months: Array<{ month: string; total: number }> = [];
  for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
    const month = `${year}-${String(monthIndex).padStart(2, '0')}`;
    const total = await totalExpenseForMonth(userId, month);
    months.push({ month, total: round2(total) });
  }
  const yearTotal = round2(months.reduce((sum, item) => sum + item.total, 0));
  return {
    year,
    yearTotal,
    months,
  };
}

export function buildMonthlyReportMessage(report: MonthlyReportSummary) {
  const lines: string[] = [];
  lines.push(`📊 ${describeMonth(report.month)} 财务总结`);
  lines.push('');
  lines.push(`💸 总支出：¥${report.totalExpense.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
  lines.push(`环比上月：${report.monthOverMonthChange >= 0 ? '+' : ''}¥${report.monthOverMonthChange.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（${(report.monthOverMonthChangePercent * 100).toFixed(1)}%）`);
  lines.push(`同比去年：${report.yearOverYearChange >= 0 ? '+' : ''}¥${report.yearOverYearChange.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（${(report.yearOverYearChangePercent * 100).toFixed(1)}%）`);
  lines.push('');
  lines.push('📦 模块占比：');
  report.moduleBreakdown.forEach((item) => {
    lines.push(`- ${MODULE_LABELS[item.module]}：¥${item.amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} (${(item.percentage * 100).toFixed(1)}%, ${item.count} 笔)`);
  });
  if (report.topExpenses.length) {
    lines.push('');
    lines.push('🏷️ Top 3 支出：');
    report.topExpenses.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title} — ¥${item.amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} (${item.date})`);
    });
  }
  return lines.join('\n');
}

export function createFinanceReportRouter() {
  startFinanceMonthlyReportScheduler();
  startFinanceFollowupScheduler();
  const router = Router();

  router.get('/monthly', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { month: rawMonth } = monthQuerySchema.parse(request.query);
    const month = normalizeMonth(rawMonth || undefined);
    const report = await buildMonthlyReport(userId, month);
    response.json(successResponse(report));
  }));

  router.get('/yearly', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { year: rawYear } = request.query as Record<string, unknown>;
    const year = Number(rawYear);
    const safeYear = Number.isFinite(year) && year >= 2000 && year <= 2100
      ? Math.floor(year)
      : dayjs().year();
    response.json(successResponse(await buildYearlyReportAsync(userId, safeYear)));
  }));

  router.post('/notify', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(notifySchema, request.body);
    const month = normalizeMonth(payload.month || undefined);
    const report = await buildMonthlyReport(userId, month);
    const message = buildMonthlyReportMessage(report);
    const title = payload.title ?? `财务月报 · ${describeMonth(month)}`;

    // 真正下发到所有已绑定渠道（email / 企业微信 / 钉钉 / 飞书 / Telegram / Webhook）
    const logs = await sendNotificationSceneLogs({
      userId,
      sceneId: 'finance.report.monthly',
      title,
      message,
      meta: {
        month: report.month,
        startDate: report.startDate,
        endDate: report.endDate,
        totalExpense: report.totalExpense,
        monthOverMonthChange: report.monthOverMonthChange,
        monthOverMonthChangePercent: report.monthOverMonthChangePercent,
        yearOverYearChange: report.yearOverYearChange,
        yearOverYearChangePercent: report.yearOverYearChangePercent,
      },
    });

    response.json(successResponse({ logs, report }, 'push_finance_monthly_report_success'));
  }));

  return router;
}
