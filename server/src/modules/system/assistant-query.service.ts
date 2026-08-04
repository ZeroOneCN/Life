import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Between } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { FinanceShoppingRecordEntity } from '../finance/entities/finance-shopping-record.entity';
import { FinanceTravelExpenseRecordEntity } from '../finance/entities/finance-travel-expense-record.entity';
import { FinanceLoanRepaymentEntity } from '../finance/entities/finance-loan-repayment.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { FinanceRentRecordEntity } from '../finance/entities/finance-rent-record.entity';
import { HealthFitnessWeightRecordEntity } from '../health/entities/health-fitness-weight-record.entity';
import { HealthFitnessExerciseRecordEntity } from '../health/entities/health-fitness-exercise-record.entity';
import { HealthMedicationRecordEntity } from '../health/entities/health-medication-record.entity';
import { InvestmentForexTradeRecordEntity } from '../investment/entities/investment-forex-trade-record.entity';
import { InvestmentForexCapitalFlowEntity } from '../investment/entities/investment-forex-capital-flow.entity';
import { LifeTodoTaskEntity } from '../life/entities/life-todo-task.entity';
import { LifeStorageItemEntity } from '../life/entities/life-storage-item.entity';
import { LifeCardRecordEntity } from '../life/entities/life-card-record.entity';
import { LifeScheduleEventEntity } from '../life/entities/life-schedule-event.entity';
import { toNumber } from '../../shared/utils/number';
import { sumShoppingAmount } from '../finance/shopping.service';
import { sumTravelNetAmount } from '../finance/travel.service';
import { sumLoanRepaymentAmount } from '../finance/loan.service';
import { getDailyMaxSteps } from '../health/step.service';
import { buildTodoOverview } from '../life/todo.service';
import { buildScheduleOverview } from '../life/schedule.service';

dayjs.extend(isBetween);

/** 助手查询过滤条件 */
export interface QueryFilters {
  startDate?: string;
  endDate?: string;
  module?: string;
  limit?: number;
}

/**
 * 解析查询区间：缺省 endDate 取今天，缺省 startDate 取 end 前 30 天。
 * @param filters 查询过滤条件
 * @returns 规整后的起止日期（YYYY-MM-DD）
 */
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

/**
 * 查询用户财务数据：购物 / 旅行 / 贷款 / 订阅 / 房租。
 * @param userId 用户 ID
 * @param filters 查询过滤条件
 * @returns 财务汇总与近期条目
 */
export async function queryFinance(userId: string, filters: QueryFilters) {
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

  const shoppingSum = sumShoppingAmount(shopping);
  const travelSum = sumTravelNetAmount(travel);
  const loanSum = sumLoanRepaymentAmount(loan);
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

/**
 * 查询用户健康数据：步数 / 体重 / 运动 / 用药。
 * @param userId 用户 ID
 * @param filters 查询过滤条件
 * @returns 健康汇总
 */
export async function queryHealth(userId: string, filters: QueryFilters) {
  const { start, end } = resolveRange(filters);
  const type = filters.module;

  const stepDailyTotals = await getDailyMaxSteps(userId, start, end);
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
        recordCount: stepDailyTotals.reduce((sum, row) => sum + row.recordCount, 0),
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

/**
 * 查询用户外汇交易记录 / 资金流水。
 * @param userId 用户 ID
 * @param filters 查询过滤条件
 * @returns 投资汇总与近期交易
 */
export async function queryInvestment(userId: string, filters: QueryFilters) {
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
      instrumentCounts: inRangeTrades.reduce((counts, row) => {
        const code = String(row.instrument ?? '').toUpperCase();
        if (code) {
          counts[code] = (counts[code] ?? 0) + 1;
        }
        return counts;
      }, {} as Record<string, number>),
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

/**
 * 查询用户生活数据：待办 / 物品追踪 / 号卡 / 日程。
 * @param userId 用户 ID
 * @param filters 查询过滤条件
 * @returns 生活汇总
 */
export async function queryLife(userId: string, filters: QueryFilters) {
  const { start, end } = resolveRange(filters);
  const moduleFilter = filters.module;
  const [todos, items, cards, schedules] = await Promise.all([
    appDataSource.getRepository(LifeTodoTaskEntity).find({ where: { user_id: userId } }),
    appDataSource.getRepository(LifeStorageItemEntity).find({ where: { user_id: userId } }),
    appDataSource.getRepository(LifeCardRecordEntity).find({ where: { user_id: userId } }),
    appDataSource.getRepository(LifeScheduleEventEntity).find({ where: { user_id: userId } }),
  ]);

  const todoOverview = buildTodoOverview(todos);
  // 额外统计：overdue / dueSoon / inRange（buildTodoOverview 不含这些）
  const activeTodos = todos.filter((row) => !row.trashed_at && !row.completed);
  const overdueCount = activeTodos.filter((row) => row.due_date && dayjs(row.due_date).isBefore(dayjs(), 'day')).length;
  const dueSoonCount = activeTodos.filter((row) => {
    if (!row.due_date) return false;
    const diff = dayjs(row.due_date).startOf('day').diff(dayjs().startOf('day'), 'day');
    return diff >= 0 && diff <= 7;
  }).length;
  const inRangeTodoCount = todos.filter((row) => row.due_date && dayjs(row.due_date).isBetween(start, end, 'day', '[]')).length;

  const storedItems = items.filter((row) => !row.retired_at);
  const retiredItems = items.filter((row) => row.retired_at);

  const recentActivationCards = cards.filter((row) => {
    if (!row.activation_date) return false;
    return dayjs(row.activation_date).isAfter(dayjs().subtract(30, 'day'), 'day');
  });

  // 日程统计：使用 service 层 buildScheduleOverview（口径与 router 一致）
  const scheduleOverview = buildScheduleOverview(schedules);
  // 额外统计：inRange（buildScheduleOverview 不含此字段）
  const inRangeScheduleCount = schedules.filter((row) => {
    if (row.trashed_at) return false;
    if (row.recurrence_type === 'none') {
      return dayjs(row.start_at).isBetween(start, end, 'day', '[]');
    }
    return true;
  }).length;

  return {
    range: { start, end },
    summary: {
      todo: {
        ...todoOverview,
        overdue: overdueCount,
        dueSoon: dueSoonCount,
        inRange: inRangeTodoCount,
      },
      storage: {
        active: storedItems.length,
        retired: retiredItems.length,
      },
      card: {
        total: cards.length,
        recentlyActivated: recentActivationCards.length,
      },
      schedule: {
        ...scheduleOverview,
        inRange: inRangeScheduleCount,
      },
    },
    hint: '待办统计使用 buildTodoOverview（重复任务不计入 completed）；日程统计使用 buildScheduleOverview（使用 isScheduleRecurringType 判定重复）；物品追踪区分在用 / 停用；卡片仅给出 30 天内新激活数量。',
    moduleFilter,
  };
}
