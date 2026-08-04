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
import { sumShoppingAmount, createShoppingRecord } from '../finance/shopping.service';
import { sumTravelNetAmount } from '../finance/travel.service';
import { sumLoanRepaymentAmount } from '../finance/loan.service';
import { getDailyMaxSteps, createStepRecord } from '../health/step.service';
import { createWeightRecord } from '../health/fitness.service';
import { buildTodoOverview, createTodoTask } from '../life/todo.service';
import { buildScheduleOverview } from '../life/schedule.service';

dayjs.extend(isBetween);

export type AssistantModule = 'finance' | 'health' | 'investment' | 'life';
export type AssistantTool =
  | 'query_finance'
  | 'query_health'
  | 'query_investment'
  | 'query_life'
  | 'create_shopping'
  | 'create_subscription'
  | 'create_step'
  | 'create_weight'
  | 'create_medication'
  | 'create_todo';

interface QueryFilters {
  startDate?: string;
  endDate?: string;
  module?: string;
  limit?: number;
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
    case 'create_shopping':
      return createShopping(userId, args);
    case 'create_subscription':
      return createSubscription(userId, args);
    case 'create_step':
      return createStep(userId, args);
    case 'create_weight':
      return createWeight(userId, args);
    case 'create_medication':
      return createMedication(userId, args);
    case 'create_todo':
      return createTodo(userId, args);
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

async function queryHealth(userId: string, filters: QueryFilters) {
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

async function queryLife(userId: string, filters: QueryFilters) {
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

// ==================== 写入工具：create_* ====================

/**
 * 安全取字符串字段，失败返回默认值。
 */
function pickString(value: unknown, field: string, defaultValue = ''): string {
  if (typeof value !== 'object' || value === null) return defaultValue;
  const v = (value as Record<string, unknown>)[field];
  return typeof v === 'string' ? v : defaultValue;
}

/**
 * 安全取数字字段，失败返回默认值。
 */
function pickNumber(value: unknown, field: string, defaultValue = 0): number {
  if (typeof value !== 'object' || value === null) return defaultValue;
  const v = (value as Record<string, unknown>)[field];
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * 安全取布尔字段，失败返回 false。
 */
function pickBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return Boolean((value as Record<string, unknown>)[field]);
}

/**
 * 安全取字符串数组字段，失败返回空数组。
 */
function pickStringArray(value: unknown, field: string): string[] {
  if (typeof value !== 'object' || value === null) return [];
  const v = (value as Record<string, unknown>)[field];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * 创建购物记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（ledgerId/date/platform/itemName/price 必填）
 * @returns 创建结果（含 id 和写入字段摘要）
 */
async function createShopping(userId: string, args: Record<string, unknown>) {
  try {
    const saved = await createShoppingRecord(userId, {
      ledgerId: pickString(args, 'ledgerId'),
      date: pickString(args, 'date'),
      platform: pickString(args, 'platform'),
      itemName: pickString(args, 'itemName'),
      price: pickNumber(args, 'price'),
      spec: pickString(args, 'spec') || undefined,
      unitPrice: args.unitPrice !== undefined ? pickNumber(args, 'unitPrice') : null,
      orderNo: pickString(args, 'orderNo') || undefined,
      note: pickString(args, 'note') || undefined,
    });
    return { id: saved.id, message: `已创建购物记录：${saved.item_name} ¥${saved.price}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建购物记录失败' };
  }
}

/**
 * 创建订阅记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（serviceName/categoryId/startDate/endDate/billingCycle/cyclePrice 必填）
 * @returns 创建结果
 */
async function createSubscription(userId: string, args: Record<string, unknown>) {
  const serviceName = pickString(args, 'serviceName');
  const categoryId = pickString(args, 'categoryId');
  const startDate = pickString(args, 'startDate');
  const endDate = pickString(args, 'endDate');
  const billingCycle = pickString(args, 'billingCycle', 'monthly');
  const cyclePrice = pickNumber(args, 'cyclePrice');
  if (!serviceName || !categoryId || !startDate || !endDate) {
    return { error: '缺少必填字段：serviceName/categoryId/startDate/endDate' };
  }
  const repo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
  const record = repo.create({
    user_id: userId,
    service_name: serviceName,
    plan_name: pickString(args, 'planName'),
    category_id: categoryId,
    category_name: pickString(args, 'categoryName'),
    start_date: startDate,
    end_date: endDate,
    billing_cycle: billingCycle,
    cycle_price: cyclePrice,
    auto_renew: pickBoolean(args, 'autoRenew'),
    notes: pickString(args, 'notes'),
  });
  const saved = await repo.save(record);
  return { id: saved.id, message: `已创建订阅：${serviceName} ¥${cyclePrice}/${billingCycle}` };
}

/**
 * 创建步数记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（steps/recordTime 必填）
 * @returns 创建结果
 */
async function createStep(userId: string, args: Record<string, unknown>) {
  const steps = pickNumber(args, 'steps');
  const recordTime = pickString(args, 'recordTime');
  if (!steps || !recordTime) {
    return { error: '缺少必填字段：steps/recordTime' };
  }
  try {
    const saved = await createStepRecord(userId, {
      steps,
      recordTime,
      hour: args.hour === undefined || args.hour === null ? null : pickNumber(args, 'hour'),
    });
    return { id: saved.id, message: `已记录步数：${saved.steps} 步（${dayjs(saved.record_time).format('YYYY-MM-DD HH:mm')}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建步数记录失败' };
  }
}

/**
 * 创建体重记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（date/weight 必填，其余身体成分指标可选）
 * @returns 创建结果
 */
async function createWeight(userId: string, args: Record<string, unknown>) {
  const date = pickString(args, 'date');
  const weight = pickNumber(args, 'weight');
  if (!date || !weight) {
    return { error: '缺少必填字段：date/weight' };
  }
  try {
    const saved = await createWeightRecord(userId, {
      date,
      weight,
      height: args.height !== undefined && args.height !== null ? pickNumber(args, 'height') : undefined,
      bodyFat: args.bodyFat !== undefined && args.bodyFat !== null ? pickNumber(args, 'bodyFat') : undefined,
      visceralFat: args.visceralFat !== undefined && args.visceralFat !== null ? pickNumber(args, 'visceralFat') : undefined,
      fatMass: args.fatMass !== undefined && args.fatMass !== null ? pickNumber(args, 'fatMass') : undefined,
      muscleRate: args.muscleRate !== undefined && args.muscleRate !== null ? pickNumber(args, 'muscleRate') : undefined,
      muscleMass: args.muscleMass !== undefined && args.muscleMass !== null ? pickNumber(args, 'muscleMass') : undefined,
      bodyWaterRate: args.bodyWaterRate !== undefined && args.bodyWaterRate !== null ? pickNumber(args, 'bodyWaterRate') : undefined,
      bodyWaterMass: args.bodyWaterMass !== undefined && args.bodyWaterMass !== null ? pickNumber(args, 'bodyWaterMass') : undefined,
      proteinRate: args.proteinRate !== undefined && args.proteinRate !== null ? pickNumber(args, 'proteinRate') : undefined,
      proteinMass: args.proteinMass !== undefined && args.proteinMass !== null ? pickNumber(args, 'proteinMass') : undefined,
      boneRate: args.boneRate !== undefined && args.boneRate !== null ? pickNumber(args, 'boneRate') : undefined,
      boneMass: args.boneMass !== undefined && args.boneMass !== null ? pickNumber(args, 'boneMass') : undefined,
      skeletalMuscleRate: args.skeletalMuscleRate !== undefined && args.skeletalMuscleRate !== null ? pickNumber(args, 'skeletalMuscleRate') : undefined,
      skeletalMuscleMass: args.skeletalMuscleMass !== undefined && args.skeletalMuscleMass !== null ? pickNumber(args, 'skeletalMuscleMass') : undefined,
      subcutaneousFatRate: args.subcutaneousFatRate !== undefined && args.subcutaneousFatRate !== null ? pickNumber(args, 'subcutaneousFatRate') : undefined,
      subcutaneousFatMass: args.subcutaneousFatMass !== undefined && args.subcutaneousFatMass !== null ? pickNumber(args, 'subcutaneousFatMass') : undefined,
    });
    return { id: saved.id, message: `已记录体重：${saved.weight} kg（${saved.date}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建体重记录失败' };
  }
}

/**
 * 创建用药记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（date/medicineName 必填，breakfast/lunch/dinner 可选）
 * @returns 创建结果
 */
async function createMedication(userId: string, args: Record<string, unknown>) {
  const date = pickString(args, 'date');
  const medicineName = pickString(args, 'medicineName');
  if (!date || !medicineName) {
    return { error: '缺少必填字段：date/medicineName' };
  }
  const repo = appDataSource.getRepository(HealthMedicationRecordEntity);
  const record = repo.create({
    user_id: userId,
    date,
    medicine_name: medicineName,
    breakfast: Math.max(0, pickNumber(args, 'breakfast')),
    lunch: Math.max(0, pickNumber(args, 'lunch')),
    dinner: Math.max(0, pickNumber(args, 'dinner')),
  });
  const saved = await repo.save(record);
  return { id: saved.id, message: `已记录用药：${medicineName}（${date}）` };
}

/**
 * 创建待办任务。
 * @param userId - 用户 ID
 * @param args - 工具参数（title 必填，其余可选）
 * @returns 创建结果
 */
async function createTodo(userId: string, args: Record<string, unknown>) {
  const title = pickString(args, 'title');
  if (!title) {
    return { error: '缺少必填字段：title' };
  }
  try {
    const saved = await createTodoTask(userId, {
      title,
      descriptionMarkdown: pickString(args, 'descriptionMarkdown') || undefined,
      dueDate: pickString(args, 'dueDate') || undefined,
      priority: (pickString(args, 'priority', 'medium') as 'high' | 'medium' | 'low') || undefined,
      tags: pickStringArray(args, 'tags').length ? pickStringArray(args, 'tags') : undefined,
      isDaily: pickBoolean(args, 'isDaily') || undefined,
      recurrenceType: (pickString(args, 'recurrenceType', 'none') as 'none' | 'daily' | 'weekly' | 'monthly') || undefined,
      recurrenceConfig: null,
    });
    return { id: saved.id, message: `已创建待办：${saved.title}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建待办任务失败' };
  }
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
      description: '查询用户生活数据：待办、物品追踪、号卡、日程。',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['todo', 'storage', 'card', 'schedule'], description: '指定模块' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_shopping',
      description: '创建一条购物记录。需先通过 query_finance 或其他方式获取有效的 ledgerId（账本 ID）。',
      parameters: {
        type: 'object',
        properties: {
          ledgerId: { type: 'string', description: '账本 ID（必填）' },
          date: { type: 'string', description: '购买日期 YYYY-MM-DD（必填）' },
          platform: { type: 'string', description: '购买平台，如「淘宝」「京东」（必填）' },
          itemName: { type: 'string', description: '商品名称（必填）' },
          price: { type: 'number', description: '商品价格（元，必填）' },
          spec: { type: 'string', description: '规格' },
          orderNo: { type: 'string', description: '订单号' },
          note: { type: 'string', description: '备注' },
        },
        required: ['ledgerId', 'date', 'platform', 'itemName', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_subscription',
      description: '创建一条订阅记录（如流媒体、会员服务）。',
      parameters: {
        type: 'object',
        properties: {
          serviceName: { type: 'string', description: '服务名称，如「Netflix」「Spotify」（必填）' },
          categoryId: { type: 'string', description: '分类 ID（必填）' },
          categoryName: { type: 'string', description: '分类名称' },
          planName: { type: 'string', description: '套餐名称' },
          startDate: { type: 'string', description: '开始日期 YYYY-MM-DD（必填）' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD（必填）' },
          billingCycle: { type: 'string', enum: ['monthly', 'quarterly', 'yearly', 'one_time'], description: '计费周期' },
          cyclePrice: { type: 'number', description: '周期价格（元）' },
          autoRenew: { type: 'boolean', description: '是否自动续费' },
          notes: { type: 'string', description: '备注' },
        },
        required: ['serviceName', 'categoryId', 'startDate', 'endDate', 'billingCycle', 'cyclePrice'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_step',
      description: '创建一条步数记录。同一日期同一小时不可重复。',
      parameters: {
        type: 'object',
        properties: {
          steps: { type: 'integer', description: '步数（必填，≥0）' },
          recordTime: { type: 'string', description: '记录时间，ISO 字符串或 YYYY-MM-DD HH:mm（必填）' },
          hour: { type: 'integer', description: '小时 0-23，可省略' },
        },
        required: ['steps', 'recordTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_weight',
      description: '创建一条体重记录（支持身体成分指标）。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD（必填）' },
          weight: { type: 'number', description: '体重 kg（必填）' },
          height: { type: 'number', description: '身高 cm' },
          bodyFat: { type: 'number', description: '体脂率 %' },
          visceralFat: { type: 'number', description: '内脏脂肪等级' },
          fatMass: { type: 'number', description: '脂肪量 kg' },
          muscleRate: { type: 'number', description: '肌肉率 %' },
          muscleMass: { type: 'number', description: '肌肉量 kg' },
        },
        required: ['date', 'weight'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_medication',
      description: '创建一条用药记录（三餐剂量可选）。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD（必填）' },
          medicineName: { type: 'string', description: '药品名称（必填）' },
          breakfast: { type: 'number', description: '早餐剂量' },
          lunch: { type: 'number', description: '午餐剂量' },
          dinner: { type: 'number', description: '晚餐剂量' },
        },
        required: ['date', 'medicineName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_todo',
      description: '创建一条待办任务。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题（必填）' },
          descriptionMarkdown: { type: 'string', description: '任务描述（Markdown）' },
          dueDate: { type: 'string', description: '截止日期 YYYY-MM-DD' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
          isDaily: { type: 'boolean', description: '是否每日重复' },
          recurrenceType: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'], description: '重复类型' },
        },
        required: ['title'],
      },
    },
  },
];
