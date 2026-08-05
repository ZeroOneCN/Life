import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';
import { Between } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { deepseek } from '../../shared/services/deepseek.client';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { normalizeMonth } from '../../shared/utils/date';
import { normalizeText } from '../../shared/utils/text';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { convertCurrency } from './exchange-rate.service';
import { FinanceShoppingRecordEntity } from '../finance/entities/finance-shopping-record.entity';
import { FinanceTravelExpenseRecordEntity } from '../finance/entities/finance-travel-expense-record.entity';
import { FinanceLoanRepaymentEntity } from '../finance/entities/finance-loan-repayment.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { FinanceRentRecordEntity } from '../finance/entities/finance-rent-record.entity';
import { FinanceLoanBillEntity } from '../finance/entities/finance-loan-bill.entity';
import { InvestmentForexTradeRecordEntity } from '../investment/entities/investment-forex-trade-record.entity';
import { InvestmentForexCapitalFlowEntity } from '../investment/entities/investment-forex-capital-flow.entity';
import { recordAssistantUsage, estimateTokens } from '../system/assistant-usage.service';
import { startFinanceMonthlyReportScheduler } from './finance-report.scheduler';
import { startFinanceFollowupScheduler } from './finance-followup.scheduler';
import { toNumber, round2 } from '../../shared/utils/number';

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

interface InvestmentBreakdownItem {
  instrument: string;
  tradeCount: number;
  netPnl: number;
  commission: number;
  overnightFee: number;
}

interface InvestmentSummary {
  netPnl: number;
  grossPnl: number;
  totalCommission: number;
  totalOvernightFee: number;
  tradeCount: number;
  deposits: number;
  withdrawals: number;
  netCapital: number;
  equity: number;
  roi: number;
  breakdown: InvestmentBreakdownItem[];
  /** 投资账户的展示币种（forex 账户为 USD） */
  currency: string;
  /** 将投资金额换算为人民币（reportCurrency）时使用的汇率 */
  exchangeRate: number;
  /** 汇率来源：exchangerate-api 实时 或 fallback 降级 */
  exchangeRateSource: 'exchangerate-api' | 'fallback';
  /** 汇率获取时间（ISO 字符串） */
  exchangeRateFetchedAt: string;
  /** 投资净值换算为人民币后的等值金额 */
  equityInReportCurrency: number;
  /** 净收益换算为人民币后的等值金额 */
  netPnlInReportCurrency: number;
}

interface NetWorthSummary {
  /** 投资账户原币种净值（USD） */
  investmentEquity: number;
  /** 未还贷款（CNY） */
  unpaidLoanTotal: number;
  /** 净资产：投资净值按汇率换算为人民币后减去未还贷款（CNY） */
  netWorth: number;
  /** 报告统一币种（人民币 CNY） */
  reportCurrency: string;
  /** 投资原币种换算为报告币种使用的汇率 */
  exchangeRate: number;
  /** 汇率来源 */
  exchangeRateSource: 'exchangerate-api' | 'fallback';
  /** 汇率获取时间（ISO 字符串） */
  exchangeRateFetchedAt: string;
  /** 投资净值换算为人民币后的等值金额 */
  investmentEquityInReportCurrency: number;
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
  investment: InvestmentSummary;
  netWorth: NetWorthSummary;
  generatedAt: string;
}

const MODULE_LABELS: Record<ModuleBreakdown['module'], string> = {
  shopping: '购物',
  travel: '旅行',
  loan: '贷款',
  subscription: '订阅',
  rent: '房租',
};

function calculatePercent(part: number, total: number) {
  if (!total) {
    return 0;
  }
  return Math.round((part / total) * 10000) / 10000;
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

/**
 * 计算单条租房记录在指定月份的月度摊销费用。
 *
 * 公式：总可摊销成本 ÷ 总居住天数 × 当月在住天数
 * 其中总成本 = 房租 + 电费 + 水费 + 燃气 + 服务费 + 保洁费 + 洗衣费（不含押金和中介费）
 */
export function calculateRentMonthlyCost(
  row: FinanceRentRecordEntity,
  monthStart: dayjs.Dayjs,
  monthEnd: dayjs.Dayjs,
): number {
  const moveIn = dayjs(row.move_in_date);
  const moveOut = row.move_out_date ? dayjs(row.move_out_date) : null;

  // 租期与报告月的交集
  const overlapStart = moveIn.isAfter(monthStart) ? moveIn : monthStart;
  const overlapEnd = moveOut && moveOut.isBefore(monthEnd) ? moveOut : monthEnd;

  if (overlapEnd.isBefore(overlapStart, 'day')) {
    return 0;
  }

  const overlapDays = Math.max(1, overlapEnd.diff(overlapStart, 'day') + 1);

  // 整个租期的总居住天数
  const totalEnd = moveOut || dayjs();
  const totalStayDays = Math.max(1, totalEnd.diff(moveIn, 'day') + 1);

  // 可摊销总成本 = 房租+电费+水费+燃气+服务费+保洁费+洗衣费（不含押金、中介费）
  const totalCost = toNumber(row.rent)
    + toNumber(row.electricity_fee)
    + toNumber(row.water_fee)
    + toNumber(row.gas_fee)
    + toNumber(row.service_fee)
    + toNumber(row.cleaning_fee)
    + toNumber(row.laundry_fee);

  if (totalCost <= 0) {
    return 0;
  }

  // 日均成本 × 当月在住天数
  const dailyCost = totalCost / totalStayDays;
  return round2(dailyCost * overlapDays);
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
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const dataSource = appDataSource;

  return dataSource.transaction(async (manager) => {
    const shoppingRepo = manager.getRepository(FinanceShoppingRecordEntity);
    const travelRepo = manager.getRepository(FinanceTravelExpenseRecordEntity);
    const loanRepo = manager.getRepository(FinanceLoanRepaymentEntity);
    const subscriptionRepo = manager.getRepository(FinanceSubscriptionRecordEntity);
    const rentRepo = manager.getRepository(FinanceRentRecordEntity);
    const forexTradeRepo = manager.getRepository(InvestmentForexTradeRecordEntity);
    const forexFlowRepo = manager.getRepository(InvestmentForexCapitalFlowEntity);
    const loanBillRepo = manager.getRepository(FinanceLoanBillEntity);

    const [shoppingRows, travelRows, loanRows, subscriptionRows, rentRows, forexTradeRows, forexFlowRows, unpaidLoanBills] = await Promise.all([
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
      forexTradeRepo.find({
        where: {
          user_id: userId,
          trade_date: Between(start, end),
        },
      }),
      forexFlowRepo.find({
        where: {
          user_id: userId,
          flow_date: Between(start, end),
        },
      }),
      loanBillRepo.find({
        where: {
          user_id: userId,
          is_paid: false,
        },
      }),
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
      // 还款金额即 amount（利息已含在欠款内，还款记录 interest 恒为 0）
      const amount = toNumber(row.amount);
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
      const monthlyAmount = calculateRentMonthlyCost(row, monthStart, monthEnd);
      moduleTotals.rent.amount += monthlyAmount;
      moduleTotals.rent.count += 1;
      const category = `房租·${row.channel_name || '未知渠道'}`;
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += monthlyAmount;
      current.count += 1;
      categoryMap.set(category, current);
      topCandidates.push({
        module: 'rent',
        title: row.address || '房租',
        date: dayjs(row.move_in_date).format('YYYY-MM-DD'),
        amount: monthlyAmount,
        category,
      });
    }

    const totalExpense = Object.values(moduleTotals).reduce((sum, item) => sum + item.amount, 0);

    // --- 投资维度聚合（独立于 totalExpense）
    const investmentBreakdownMap = new Map<string, { tradeCount: number; grossPnl: number; commission: number; overnightFee: number }>();
    let investmentGrossPnl = 0;
    let investmentTotalCommission = 0;
    let investmentTotalOvernightFee = 0;

    for (const row of forexTradeRows) {
      const pnl = toNumber(row.pnl);
      const commission = toNumber(row.commission);
      const overnightFee = toNumber(row.overnight_fee);
      const instrument = row.instrument || 'unknown';

      investmentGrossPnl += pnl;
      investmentTotalCommission += commission;
      investmentTotalOvernightFee += overnightFee;

      const current = investmentBreakdownMap.get(instrument) ?? { tradeCount: 0, grossPnl: 0, commission: 0, overnightFee: 0 };
      current.tradeCount += 1;
      current.grossPnl += pnl;
      current.commission += commission;
      current.overnightFee += overnightFee;
      investmentBreakdownMap.set(instrument, current);
    }

    const investmentNetPnl = investmentGrossPnl + investmentTotalCommission + investmentTotalOvernightFee;
    const deposits = forexFlowRows.filter((r) => r.flow_type === 'deposit').reduce((sum, r) => sum + toNumber(r.amount), 0);
    const withdrawals = forexFlowRows.filter((r) => r.flow_type === 'withdrawal').reduce((sum, r) => sum + toNumber(r.amount), 0);
    const netCapital = deposits - withdrawals;
    const investmentEquity = netCapital + investmentNetPnl;
    const investmentRoi = netCapital > 0 ? investmentNetPnl / netCapital : 0;

    const investmentBreakdown: InvestmentBreakdownItem[] = [...investmentBreakdownMap.entries()]
      .map(([instrument, value]) => ({
        instrument,
        tradeCount: value.tradeCount,
        netPnl: round2(value.grossPnl + value.commission + value.overnightFee),
        commission: round2(value.commission),
        overnightFee: round2(value.overnightFee),
      }))
      .sort((a, b) => b.netPnl - a.netPnl);

    // --- 汇率转换：投资账户为美元（USD），需要换算为人民币（CNY）以参与净资产计算
    // 使用 Exchange Rate API 实时汇率（1 小时缓存，未配置 key 时降级为内置汇率）
    const investmentCurrency = 'USD';
    const reportCurrency = 'CNY';
    const exchangeRateResult = await convertCurrency(investmentCurrency, reportCurrency, 1);
    const usdToCnyRate = exchangeRateResult?.rate ?? 7.18; // 降级为内置汇率
    const exchangeRateSource = exchangeRateResult?.source ?? 'fallback';
    const exchangeRateFetchedAt = exchangeRateResult?.fetchedAt ?? new Date().toISOString();
    const equityInCny = round2(investmentEquity * usdToCnyRate);
    const netPnlInCny = round2(investmentNetPnl * usdToCnyRate);

    const investment: InvestmentSummary = {
      netPnl: round2(investmentNetPnl),
      grossPnl: round2(investmentGrossPnl),
      totalCommission: round2(investmentTotalCommission),
      totalOvernightFee: round2(investmentTotalOvernightFee),
      tradeCount: forexTradeRows.length,
      deposits: round2(deposits),
      withdrawals: round2(withdrawals),
      netCapital: round2(netCapital),
      equity: round2(investmentEquity),
      roi: round2(investmentRoi * 100) / 100,
      breakdown: investmentBreakdown,
      currency: investmentCurrency,
      exchangeRate: round2(usdToCnyRate * 10000) / 10000,
      exchangeRateSource,
      exchangeRateFetchedAt,
      equityInReportCurrency: equityInCny,
      netPnlInReportCurrency: netPnlInCny,
    };

    // --- 净资产计算：将投资净值按汇率换算为人民币后减去未还贷款（CNY）
    // 未还贷款 = 各未结清账单的剩余欠款（amount 已含利息）
    const unpaidLoanTotal = unpaidLoanBills.reduce(
      (sum, bill) => sum + Math.max(0, toNumber(bill.amount) - toNumber(bill.paid_amount)),
      0,
    );
    const netWorth: NetWorthSummary = {
      investmentEquity: round2(investmentEquity),
      unpaidLoanTotal: round2(unpaidLoanTotal),
      netWorth: round2(equityInCny - unpaidLoanTotal),
      reportCurrency,
      exchangeRate: round2(usdToCnyRate * 10000) / 10000,
      exchangeRateSource,
      exchangeRateFetchedAt,
      investmentEquityInReportCurrency: equityInCny,
    };

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
      investment,
      netWorth,
      generatedAt: dayjs().toISOString(),
    };
  });
}

/**
 * 仅计算某月总支出（用于同环比，无需明细 Top / 分类）。
 */
export function totalExpenseForMonth(userId: string, month: string) {
  const { start, end } = rangeOfMonth(month);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
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
    const loanSum = loanRows.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const subscriptionSum = subscriptionRows.reduce((sum, row) => {
      const cycle = (row.billing_cycle || 'monthly').toLowerCase();
      const price = toNumber(row.cycle_price);
      if (cycle === 'yearly') return sum + price / 12;
      if (cycle === 'quarterly') return sum + price / 3;
      return sum + price;
    }, 0);
    const rentSum = rentRows.reduce((sum, row) => sum + calculateRentMonthlyCost(row, monthStart, monthEnd), 0);
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
  // 投资维度：投资账户为美元（USD），展示原值 + 人民币等值
  if (report.investment && report.investment.tradeCount > 0) {
    const inv = report.investment;
    const rateText = `汇率 1 ${inv.currency} = ${inv.exchangeRate.toFixed(4)} CNY（${inv.exchangeRateSource === 'exchangerate-api' ? '实时' : '降级'}）`;
    lines.push('');
    lines.push(`📈 投资概览（${inv.currency}，${rateText}）：`);
    lines.push(`净收益：${inv.netPnl >= 0 ? '+' : ''}$${inv.netPnl.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ≈ ¥${inv.netPnlInReportCurrency.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（${inv.tradeCount} 笔交易，ROI ${inv.roi.toFixed(1)}%）`);
    lines.push(`账户净值：$${inv.equity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ≈ ¥${inv.equityInReportCurrency.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（净入金 $${inv.netCapital.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}）`);
    if (inv.breakdown.length > 0) {
      lines.push('品种明细：');
      inv.breakdown.forEach((item) => {
        lines.push(`- ${item.instrument}：${item.netPnl >= 0 ? '+' : ''}$${item.netPnl.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}（${item.tradeCount} 笔）`);
      });
    }
  }
  // 净资产：已按汇率将投资净值换算为人民币（CNY）后与未还贷款相减，统一以人民币展示
  if (report.netWorth) {
    const nw = report.netWorth;
    const rateText = `汇率 1 USD = ${nw.exchangeRate.toFixed(4)} CNY（${nw.exchangeRateSource === 'exchangerate-api' ? '实时' : '降级'}）`;
    lines.push('');
    lines.push(`💰 净资产（统一折算为 ${nw.reportCurrency}，${rateText}）：`);
    lines.push(`投资账户净值：$${nw.investmentEquity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ≈ ¥${nw.investmentEquityInReportCurrency.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
    lines.push(`未还贷款：¥${nw.unpaidLoanTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
    lines.push(`净资产：¥${nw.netWorth.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
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
      sceneId: NOTIFICATION_SCENE_IDS.FINANCE_REPORT_MONTHLY,
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

  /**
   * POST /ai-summary
   * 基于月报数据生成 AI 财务摘要（JSON mode）。
   * 返回结构化摘要：summary / suggestions / risks。
   */
  router.post('/ai-summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(notifySchema, request.body);
    const month = normalizeMonth(payload.month || undefined);

    if (!deepseek.enabled) {
      response.json(successResponse({
        enabled: false,
        summary: 'AI 摘要未启用（未配置 DEEPSEEK_API_KEY）',
        suggestions: [],
        risks: [],
      }));
      return;
    }

    const report = await buildMonthlyReport(userId, month);

    const systemPrompt = `你是一名专业的个人财务顾问。请根据用户的月度财务报告，生成结构化摘要与建议。
只返回 JSON，格式：
{
  "summary": string,  // 一句话总结本月财务状况（30字以内）
  "suggestions": Array<{ category: string, title: string, detail: string }>,  // 3-5 条具体建议
  "risks": Array<string>  // 识别到的财务风险（每项20字以内）
}
category 取值：expense / subscription / loan / rent / investment / budget
语气专业但友好。`;

    const userPrompt = `月份：${describeMonth(report.month)}
【总支出】¥${report.totalExpense.toFixed(2)}（环比 ${report.monthOverMonthChange >= 0 ? '+' : ''}${report.monthOverMonthChange.toFixed(2)} / ${report.monthOverMonthChangePercent >= 0 ? '+' : ''}${(report.monthOverMonthChangePercent * 100).toFixed(1)}%）
【同比】${report.yearOverYearChange >= 0 ? '+' : ''}${report.yearOverYearChange.toFixed(2)} / ${report.yearOverYearChangePercent >= 0 ? '+' : ''}${(report.yearOverYearChangePercent * 100).toFixed(1)}%
【模块拆解】${report.moduleBreakdown.map((m) => `${MODULE_LABELS[m.module]}: ¥${m.amount.toFixed(2)}`).join('；')}
【投资】净收益 $${report.investment.netPnl.toFixed(2)}（手续费 $${report.investment.totalCommission.toFixed(2)}）
【净资产】¥${report.netWorth.netWorth.toFixed(2)}（含未还贷款 ¥${report.netWorth.unpaidLoanTotal.toFixed(2)}）
【大额支出】${report.topExpenses.slice(0, 5).map((e) => `${e.title}: ¥${e.amount.toFixed(2)}`).join('；') || '无'}`;

    try {
      const { data, promptTokens, completionTokens } = await deepseek.chatJson<{
        summary: string;
        suggestions: Array<{ category: string; title: string; detail: string }>;
        risks: string[];
      }>(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.4, maxTokens: 1024 },
      );

      recordAssistantUsage({
        userId,
        scene: NOTIFICATION_SCENE_IDS.FINANCE_REPORT_MONTHLY,
        requestCount: 1,
        prompt: promptTokens,
        completion: completionTokens,
        status: 'success',
      });

      response.json(successResponse({
        enabled: true,
        ...data,
        generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }));
    } catch (error) {
      recordAssistantUsage({
        userId,
        scene: NOTIFICATION_SCENE_IDS.FINANCE_REPORT_MONTHLY,
        requestCount: 1,
        prompt: estimateTokens(systemPrompt + userPrompt),
        completion: 0,
        status: 'error',
      });
      response.json(successResponse({
        enabled: true,
        summary: `AI 摘要生成失败：${String(error)}`,
        suggestions: [],
        risks: [],
      }));
    }
  }));

  return router;
}
