import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Between } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { FinanceShoppingRecordEntity } from '../finance/entities/finance-shopping-record.entity';
import { FinanceTravelExpenseRecordEntity } from '../finance/entities/finance-travel-expense-record.entity';
import { FinanceLoanRepaymentEntity } from '../finance/entities/finance-loan-repayment.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { FinanceRentRecordEntity } from '../finance/entities/finance-rent-record.entity';
import { HealthStepRecordEntity } from '../health/entities/health-step-record.entity';
import { HealthFitnessWeightRecordEntity } from '../health/entities/health-fitness-weight-record.entity';
import { HealthFitnessExerciseRecordEntity } from '../health/entities/health-fitness-exercise-record.entity';
import { HealthMedicationRecordEntity } from '../health/entities/health-medication-record.entity';
import { InvestmentForexTradeRecordEntity } from '../investment/entities/investment-forex-trade-record.entity';
import { InvestmentForexCapitalFlowEntity } from '../investment/entities/investment-forex-capital-flow.entity';
import { LifeTodoTaskEntity } from '../life/entities/life-todo-task.entity';
import { LifeStorageItemEntity } from '../life/entities/life-storage-item.entity';
import { LifeCardRecordEntity } from '../life/entities/life-card-record.entity';

dayjs.extend(isBetween);

export type AssistantModule = 'finance' | 'health' | 'investment' | 'life';
export type AssistantTool = 'query_finance' | 'query_health' | 'query_investment' | 'query_life';

interface QueryFilters {
  startDate?: string;
  endDate?: string;
  module?: string;
  limit?: number;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRange(filters: QueryFilters) {
  const endDate = filters.endDate
    ? dayjs(filters.endDate, 'YYYY-MM-DD', true)
    : dayjs().endOf('day');
  const startDate = filters.startDate
    ? dayjs(filters.startDate, 'YYYY-MM-DD', true)
    : endDate.subtract(30, 'day').startOf('day');
  return {
    start: startDate.isValid() ? startDate.format('YYYY-MM-DD') : endDate.subtract(30, 'day').format('YYYY-MM-DD'),
    end: endDate.isValid() ? endDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
  };
}

export async function handleAssistantToolCall(
  tool: AssistantTool,
  userId: string,
  rawArgs: unknown,
): Promise<unknown> {
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  const filters: QueryFilters = {
    startDate: typeof args.startDate === 'string' ? args.startDate : undefined,
    endDate: typeof args.endDate === 'string' ? args.endDate : undefined,
    module: typeof args.module === 'string' ? args.module : undefined,
    limit: Number.isFinite(args.limit) ? Math.max(1, Math.min(20, Number(args.limit))) : undefined,
  };

  switch (tool) {
    case 'query_finance':
      return queryFinance(userId, filters);
    case 'query_health':
      return queryHealth(userId, filters);
    case 'query_investment':
      return queryInvestment(userId, filters);
    case 'query_life':
      return queryLife(userId, filters);
    default:
      return { error: `Unknown tool: ${tool}` };
  }
}

async function queryFinance(userId: string, filters: QueryFilters) {
  const { start, end } = resolveRange(filters);
  const moduleFilter = filters.module;

  const [shopping, travel, loan, subscription, rent] = await Promise.all([
    appDataSource.getRepository(FinanceShoppingRecordEntity).find({
      where: { user_id: userId, date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({
      where: { user_id: userId, date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceLoanRepaymentEntity).find({
      where: { user_id: userId, repayment_date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceSubscriptionRecordEntity).find({
      where: { user_id: userId, start_date: Between(start, end) },
    }),
    appDataSource
      .getRepository(FinanceRentRecordEntity)
      .createQueryBuilder('rent')
      .where('rent.user_id = :userId', { userId })
      .andWhere('rent.move_in_date <= :end', { end })
      .andWhere('(rent.move_out_date IS NULL OR rent.move_out_date >= :start)', { start })
      .getMany(),
  ]);

  const shoppingSum = shopping.reduce((sum, row) => sum + toNumber(row.price), 0);
  const travelSum = travel.reduce((sum, row) => {
    const net = toNumber(row.amount) - toNumber(row.discount_amount);
    return sum + (net > 0 ? net : toNumber(row.amount));
  }, 0);
  const loanSum = loan.reduce((sum, row) => sum + toNumber(row.amount) + toNumber(row.interest), 0);
  const subscriptionSum = subscription.reduce((sum, row) => {
    const cycle = (row.billing_cycle || 'monthly').toLowerCase();
    const price = toNumber(row.cycle_price);
    if (cycle === 'yearly') return sum + price / 12;
    if (cycle === 'quarterly') return sum + price / 3;
    return sum + price;
  }, 0);
  const rentSum = rent.reduce((sum, row) => sum
    + toNumber(row.rent)
    + toNumber(row.electricity_fee)
    + toNumber(row.water_fee)
    + toNumber(row.gas_fee)
    + toNumber(row.agency_fee)
    + toNumber(row.cleaning_fee)
    + toNumber(row.laundry_fee)
    + toNumber(row.service_fee), 0);

  const total = shoppingSum + travelSum + loanSum + subscriptionSum + rentSum;

  const summary: Record<string, { count: number; amount: number }> = {
    shopping: { count: shopping.length, amount: Number(shoppingSum.toFixed(2)) },
    travel: { count: travel.length, amount: Number(travelSum.toFixed(2)) },
    loan: { count: loan.length, amount: Number(loanSum.toFixed(2)) },
    subscription: { count: subscription.length, amount: Number(subscriptionSum.toFixed(2)) },
    rent: { count: rent.length, amount: Number(rentSum.toFixed(2)) },
  };

  const recent = [
    ...shopping.map((row) => ({ module: 'shopping', title: row.item_name, amount: toNumber(row.price), date: row.date })),
    ...travel.map((row) => ({ module: 'travel', title: row.title, amount: toNumber(row.amount), date: row.date })),
    ...loan.map((row) => ({ module: 'loan', title: row.platform_name, amount: toNumber(row.amount) + toNumber(row.interest), date: row.repayment_date })),
    ...subscription.map((row) => ({ module: 'subscription', title: `${row.service_name}·${row.plan_name}`, amount: toNumber(row.cycle_price), date: row.start_date })),
  ]
    .filter((row) => !moduleFilter || row.module === moduleFilter)
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .slice(0, filters.limit ?? 5);

  return {
    range: { start, end },
    summary,
    total: Number(total.toFixed(2)),
    recent,
    hint: '以上金额单位：¥ (CNY)；subscription 字段为周期折算后的月均；rent 为当前生效合同的月度费用。',
  };
}

async function queryHealth(userId: string, filters: QueryFilters) {
  const { start, end } = resolveRange(filters);
  const type = filters.module;

  const stepRepo = appDataSource.getRepository(HealthStepRecordEntity);
  const stepRows = await stepRepo
    .createQueryBuilder('s')
    .select('DATE(s.record_time)', 'date')
    .addSelect('MAX(s.steps)', 'dailyMaxSteps')
    .addSelect('COUNT(*)', 'recordCount')
    .where('s.user_id = :userId', { userId })
    .andWhere('s.record_time BETWEEN :startTs AND :endTs', {
      startTs: `${start} 00:00:00`,
      endTs: `${end} 23:59:59`,
    })
    .groupBy('DATE(s.record_time)')
    .orderBy('DATE(s.record_time)', 'ASC')
    .getRawMany<{ date: string; dailyMaxSteps: string | number; recordCount: string | number }>();

  const stepDailyTotals = stepRows.map((row) => ({
    date: typeof row.date === 'string' ? row.date : dayjs(row.date as unknown as Date).format('YYYY-MM-DD'),
    steps: Number(row.dailyMaxSteps) || 0,
    recordCount: Number(row.recordCount) || 0,
  }));
  const stepSum = stepDailyTotals.reduce((sum, row) => sum + row.steps, 0);

  const [weights, exercises, medications] = await Promise.all([
    type === undefined || type === 'weight'
      ? appDataSource.getRepository(HealthFitnessWeightRecordEntity).find({ where: { user_id: userId, date: Between(start, end) } })
      : Promise.resolve([] as HealthFitnessWeightRecordEntity[]),
    type === undefined || type === 'exercise'
      ? appDataSource.getRepository(HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId, date: Between(start, end) } })
      : Promise.resolve([] as HealthFitnessExerciseRecordEntity[]),
    type === undefined || type === 'medication'
      ? appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId, date: Between(start, end) } })
      : Promise.resolve([] as HealthMedicationRecordEntity[]),
  ]);

  const weightLatest = [...weights].sort((left, right) => String(right.date).localeCompare(String(left.date)))[0];
  const exerciseDuration = exercises.reduce((sum, row) => sum + toNumber(row.duration), 0);
  const exerciseCalorie = exercises.reduce((sum, row) => sum + toNumber(row.calories), 0);
  const medicationCount = medications.length;

  return {
    range: { start, end },
    summary: {
      step: {
        recordCount: stepRows.reduce((sum, row) => sum + (Number(row.recordCount) || 0), 0),
        activeDays: stepDailyTotals.length,
        totalSteps: Math.round(stepSum),
        averageDailySteps: stepDailyTotals.length ? Math.round(stepSum / stepDailyTotals.length) : 0,
        // 暴露每日 max(steps) 序列，方便模型解释单日峰值
        daily: stepDailyTotals,
      },
      weight: weightLatest
        ? {
          latest: Number(toNumber(weightLatest.weight).toFixed(2)),
          recordDate: weightLatest.date,
          records: weights.length,
        }
        : { latest: null, recordDate: null, records: 0 },
      exercise: {
        count: exercises.length,
        totalMinutes: Math.round(exerciseDuration),
        totalCalories: Math.round(exerciseCalorie),
      },
      medication: {
        count: medicationCount,
      },
    },
    hint: '步数每日取 MAX(steps) 后求和（与 /api/health/step/summary 一致口径），避免同一日多条记录重复累加；体重取区间内最新一次；运动 / 用药为区间累计。',
  };
}

async function queryInvestment(userId: string, filters: QueryFilters) {
  const { start, end } = resolveRange(filters);
  const [trades, capital] = await Promise.all([
    appDataSource.getRepository(InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
    appDataSource.getRepository(InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
  ]);

  // 与 /api/investment/forex/dashboard-summary 完全一致：先按区间筛选，再算汇总
  const inRangeTrades = trades.filter((row) => {
    if (!row.trade_date) return false;
    const parsed = dayjs(row.trade_date);
    if (!parsed.isValid()) return false;
    return (!start || !parsed.isBefore(start, 'day')) && (!end || !parsed.isAfter(end, 'day'));
  });
  const inRangeFlows = capital.filter((row) => {
    if (!row.flow_date) return false;
    const parsed = dayjs(row.flow_date);
    if (!parsed.isValid()) return false;
    return (!start || !parsed.isBefore(start, 'day')) && (!end || !parsed.isAfter(end, 'day'));
  });

  const winners = inRangeTrades.filter((row) => toNumber(row.pnl) > 0);
  const losers = inRangeTrades.filter((row) => toNumber(row.pnl) < 0);
  const grossPnl = inRangeTrades.reduce((sum, row) => sum + toNumber(row.pnl), 0);
  const totalCommission = inRangeTrades.reduce((sum, row) => sum + toNumber(row.commission), 0);
  const realizedNetPnl = grossPnl + totalCommission;
  const totalDeposit = inRangeFlows.filter((row) => row.flow_type === 'deposit').reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totalWithdraw = inRangeFlows.filter((row) => row.flow_type === 'withdrawal').reduce((sum, row) => sum + toNumber(row.amount), 0);
  const netCapital = totalDeposit - totalWithdraw;
  const avgWin = winners.length ? winners.reduce((sum, row) => sum + toNumber(row.pnl), 0) / winners.length : 0;
  const avgLoss = losers.length ? losers.reduce((sum, row) => sum + toNumber(row.pnl), 0) / losers.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (avgWin > 0 ? Infinity : 0);

  const recentTrades = [...inRangeTrades]
    .sort((left, right) => String(right.trade_date).localeCompare(String(left.trade_date)))
    .slice(0, 5)
    .map((row) => ({
      tradeDate: row.trade_date,
      instrument: row.instrument,
      orderType: row.order_type,
      lotSize: toNumber(row.lot_size),
      pnl: toNumber(row.pnl),
      commission: toNumber(row.commission),
    }));

  return {
    range: { start, end },
    summary: {
      tradeCount: inRangeTrades.length,
      winCount: winners.length,
      lossCount: losers.length,
      winRate: inRangeTrades.length ? Number((winners.length / inRangeTrades.length).toFixed(4)) : 0,
      longCount: inRangeTrades.filter((row) => row.order_type === 'buy').length,
      shortCount: inRangeTrades.filter((row) => row.order_type === 'sell').length,
      xauCount: inRangeTrades.filter((row) => row.instrument === 'XAUUSD').length,
      xagCount: inRangeTrades.filter((row) => row.instrument === 'XAGUSD').length,
      grossPnl: Number(grossPnl.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      realizedNetPnl: Number(realizedNetPnl.toFixed(2)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      profitFactor: Number.isFinite(profitFactor) ? Number(profitFactor.toFixed(2)) : profitFactor,
      totalDeposit: Number(totalDeposit.toFixed(2)),
      totalWithdrawal: Number(totalWithdraw.toFixed(2)),
      netCapital: Number(netCapital.toFixed(2)),
      equity: Number((netCapital + realizedNetPnl).toFixed(2)),
      roi: totalDeposit > 0 ? Number((realizedNetPnl / totalDeposit).toFixed(4)) : 0,
    },
    recentTrades,
    hint: '数据源与 /api/investment/forex/dashboard-summary 一致（数据库真实流水），盈亏 = 毛 pnl + 手续费（手续费为负数）；盈亏比 profitFactor = |avgWin / avgLoss|。',
  };
}

async function queryLife(userId: string, filters: QueryFilters) {
  const { start, end } = resolveRange(filters);
  const moduleFilter = filters.module;
  const [todos, items, cards] = await Promise.all([
    appDataSource.getRepository(LifeTodoTaskEntity).find({ where: { user_id: userId } }),
    appDataSource.getRepository(LifeStorageItemEntity).find({ where: { user_id: userId } }),
    appDataSource.getRepository(LifeCardRecordEntity).find({ where: { user_id: userId } }),
  ]);

  const activeTodos = todos.filter((row) => !row.trashed_at && !row.completed);
  const overdueTodos = activeTodos.filter((row) => row.due_date && dayjs(row.due_date).isBefore(dayjs(), 'day'));
  const dueSoonTodos = activeTodos.filter((row) => {
    if (!row.due_date) return false;
    const diff = dayjs(row.due_date).startOf('day').diff(dayjs().startOf('day'), 'day');
    return diff >= 0 && diff <= 7;
  });
  const dueRangeTodos = todos.filter((row) => row.due_date && dayjs(row.due_date).isBetween(start, end, 'day', '[]'));

  const storedItems = items.filter((row) => !row.archived_at);
  const archivedItems = items.filter((row) => row.archived_at);

  const recentActivationCards = cards.filter((row) => {
    if (!row.activation_date) return false;
    return dayjs(row.activation_date).isAfter(dayjs().subtract(30, 'day'), 'day');
  });

  return {
    range: { start, end },
    summary: {
      todo: {
        total: activeTodos.length,
        overdue: overdueTodos.length,
        dueSoon: dueSoonTodos.length,
        completed: todos.filter((row) => row.completed && !row.trashed_at).length,
        inRange: dueRangeTodos.length,
      },
      storage: {
        active: storedItems.length,
        archived: archivedItems.length,
      },
      card: {
        total: cards.length,
        recentlyActivated: recentActivationCards.length,
      },
    },
    hint: '待办仅统计未完成未删除；物品追踪区分在用 / 归档；卡片仅给出 30 天内新激活数量。',
    moduleFilter,
  };
}

export const ASSISTANT_TOOLS: Array<{
  type: 'function';
  function: {
    name: AssistantTool;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: 'function',
    function: {
      name: 'query_finance',
      description: '查询用户在购物、旅行、贷款、订阅、房租模块的财务数据，返回指定时间范围内的金额、笔数、近期条目。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD，可省略' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD，可省略' },
          module: { type: 'string', enum: ['shopping', 'travel', 'loan', 'subscription', 'rent'], description: '指定模块' },
          limit: { type: 'integer', description: '返回的近期记录条数（默认 5）' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_health',
      description: '查询用户健康数据：步数 / 体重 / 运动 / 用药。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
          module: { type: 'string', enum: ['step', 'weight', 'exercise', 'medication'], description: '类型' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_investment',
      description: '查询用户外汇交易记录 / 资金流水。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_life',
      description: '查询用户生活数据：待办、物品追踪、号卡。',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['todo', 'storage', 'card'], description: '指定模块' },
        },
      },
    },
  },
];
