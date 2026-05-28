import { Router } from 'express';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { FinanceLoanBillEntity } from '../finance/entities/finance-loan-bill.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { HealthCheckupRecordEntity } from '../health/entities/health-checkup-record.entity';
import { HealthFitnessDietRecordEntity } from '../health/entities/health-fitness-diet-record.entity';
import { HealthFitnessExerciseRecordEntity } from '../health/entities/health-fitness-exercise-record.entity';
import { HealthFitnessWeightRecordEntity } from '../health/entities/health-fitness-weight-record.entity';
import { HealthMedicationPurchaseEntity } from '../health/entities/health-medication-purchase.entity';
import { HealthMedicationRecordEntity } from '../health/entities/health-medication-record.entity';
import { HealthMedicationThresholdEntity } from '../health/entities/health-medication-threshold.entity';
import { HealthStepRecordEntity } from '../health/entities/health-step-record.entity';
import { InvestmentForexCapitalFlowEntity } from '../investment/entities/investment-forex-capital-flow.entity';
import { InvestmentForexTradeRecordEntity } from '../investment/entities/investment-forex-trade-record.entity';
import { LifeCardRecordEntity } from '../life/entities/life-card-record.entity';
import { LifeStorageItemEntity } from '../life/entities/life-storage-item.entity';
import { LifeTodoTaskEntity } from '../life/entities/life-todo-task.entity';
import { NotificationCenterChannelEntity } from '../notifications/entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import { NotificationCenterSceneEntity } from '../notifications/entities/notification-center-scene.entity';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const dashboardCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30000;

function getCachedData<T>(key: string): T | null {
  const entry = dashboardCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    dashboardCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedData<T>(key: string, data: T): void {
  dashboardCache.set(key, { data, timestamp: Date.now() });
}

function calculateMedicationLowStockCount(
  records: HealthMedicationRecordEntity[],
  purchases: HealthMedicationPurchaseEntity[],
  thresholds: HealthMedicationThresholdEntity[],
  defaultThreshold = 3,
) {
  const usedMap = new Map<string, number>();
  const purchasedMap = new Map<string, number>();
  const thresholdMap = new Map(thresholds.map((item) => [item.medicine_name, Number(item.threshold)]));

  records.forEach((record) => {
    usedMap.set(record.medicine_name, (usedMap.get(record.medicine_name) ?? 0) + Number(record.breakfast) + Number(record.lunch) + Number(record.dinner));
  });
  purchases.forEach((purchase) => {
    purchasedMap.set(purchase.medicine_name, (purchasedMap.get(purchase.medicine_name) ?? 0) + Number(purchase.quantity));
  });

  return Array.from(new Set([...usedMap.keys(), ...purchasedMap.keys()]))
    .filter((name) => {
      const remaining = (purchasedMap.get(name) ?? 0) - (usedMap.get(name) ?? 0);
      return remaining <= (thresholdMap.get(name) ?? defaultThreshold);
    }).length;
}

function buildForexSummary(trades: InvestmentForexTradeRecordEntity[], capitalFlows: InvestmentForexCapitalFlowEntity[]) {
  const validTrades = trades.filter((item) => {
    if (!item.trade_date) {
      return false;
    }

    const tradeDate = dayjs(item.trade_date);
    return tradeDate.isValid() && tradeDate.year() >= 2000 && tradeDate.year() <= 2100;
  });

  const grossPnl = validTrades.reduce((sum, item) => sum + Number(item.pnl), 0);
  const totalCommission = validTrades.reduce((sum, item) => sum + Number(item.commission), 0);
  const realizedNetPnl = grossPnl + totalCommission;
  const deposits = capitalFlows.filter((item) => item.flow_type === 'deposit').reduce((sum, item) => sum + Number(item.amount), 0);
  const withdrawals = capitalFlows.filter((item) => item.flow_type === 'withdrawal').reduce((sum, item) => sum + Number(item.amount), 0);
  const winners = validTrades.filter((item) => Number(item.pnl) > 0).length;

  return {
    netPnl: Number(realizedNetPnl.toFixed(2)),
    winRate: validTrades.length ? winners / validTrades.length : 0,
    activeTradeCount: validTrades.length,
    netCapital: Number((deposits - withdrawals).toFixed(2)),
  };
}

function buildAgendaItems(input: {
  todos: LifeTodoTaskEntity[];
  subscriptions: FinanceSubscriptionRecordEntity[];
  loans: FinanceLoanBillEntity[];
  cards: LifeCardRecordEntity[];
  checkups: HealthCheckupRecordEntity[];
  medicationRecords: HealthMedicationRecordEntity[];
  medicationPurchases: HealthMedicationPurchaseEntity[];
  medicationThresholds: HealthMedicationThresholdEntity[];
}) {
  const today = dayjs().startOf('day');
  const agenda: Array<{
    id: string;
    module: string;
    title: string;
    summary: string;
    severity: 'high' | 'medium' | 'low';
    targetDate: string;
    href: string;
  }> = [];

  input.todos
    .filter((task) => !task.completed && !task.trashed_at)
    .forEach((task) => {
      const targetDate = task.due_date ?? '';
      const due = targetDate && dayjs(targetDate).isValid() ? dayjs(targetDate).startOf('day') : null;
      let severity: 'high' | 'medium' | 'low' = task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : 'low';
      if (due && due.isBefore(today)) {
        severity = 'high';
      }

      agenda.push({
        id: `todo-${task.id}`,
        module: 'todo',
        title: task.title,
        summary: task.description_markdown || '待处理任务',
        severity,
        targetDate,
        href: '/life/todo?todoTab=tasks',
      });
    });

  input.subscriptions.forEach((record) => {
    if (!record.end_date || !dayjs(record.end_date).isValid()) return;
    const diff = dayjs(record.end_date).startOf('day').diff(today, 'day');
    if (diff <= 7) {
      agenda.push({
        id: `subscription-${record.id}`,
        module: 'subscription',
        title: record.service_name,
        summary: diff < 0 ? '订阅已逾期，请尽快处理。' : '订阅即将到期，请关注续费。',
        severity: diff < 0 ? 'high' : diff === 0 ? 'high' : 'medium',
        targetDate: record.end_date,
        href: '/finance/subscription?subscriptionTab=records',
      });
    }
  });

  input.loans
    .filter((bill) => !bill.is_paid)
    .forEach((bill) => {
      if (!bill.due_date || !dayjs(bill.due_date).isValid()) return;
      const diff = dayjs(bill.due_date).startOf('day').diff(today, 'day');
      if (diff <= 7) {
        agenda.push({
          id: `loan-${bill.id}`,
          module: 'loan',
          title: bill.platform_name,
          summary: diff < 0 ? '贷款账单已逾期。' : '贷款账单临近还款日。',
          severity: diff < 0 ? 'high' : diff === 0 ? 'high' : 'medium',
          targetDate: bill.due_date,
          href: '/finance/loan?loanTab=bills',
        });
      }
    });

  input.cards
    .filter((card) => Number(card.balance) <= 10)
    .forEach((card) => {
      agenda.push({
        id: `card-${card.id}`,
        module: 'card',
        title: card.phone_number,
        summary: '号卡余额已低于提醒阈值。',
        severity: 'medium',
        targetDate: '',
        href: '/life/card?cardTab=cards',
      });
    });

  input.checkups
    .filter((record) => record.follow_up_date && (record.status === 'abnormal' || record.status === 'attention'))
    .forEach((record) => {
      if (!record.follow_up_date || !dayjs(record.follow_up_date).isValid()) return;
      const diff = dayjs(record.follow_up_date).startOf('day').diff(today, 'day');
      if (diff <= 7) {
        agenda.push({
          id: `checkup-${record.id}`,
          module: 'checkup',
          title: record.test_name,
          summary: diff < 0 ? '体检复查已逾期。' : '体检项目进入复查窗口。',
          severity: diff < 0 ? 'high' : 'medium',
          targetDate: record.follow_up_date ?? '',
          href: '/health/checkup',
        });
      }
    });

  const lowStockCount = calculateMedicationLowStockCount(
    input.medicationRecords,
    input.medicationPurchases,
    input.medicationThresholds,
  );

  if (lowStockCount > 0) {
    agenda.push({
      id: 'medication-stock',
      module: 'medication',
      title: '药品库存提醒',
      summary: `当前有 ${lowStockCount} 种药品低于库存阈值。`,
      severity: 'medium',
      targetDate: '',
      href: '/health/medication',
    });
  }

  return agenda
    .sort((left, right) => {
      const severityOrder = { high: 0, medium: 1, low: 2 } as const;
      const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const leftDate = left.targetDate ? dayjs(left.targetDate).valueOf() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.targetDate ? dayjs(right.targetDate).valueOf() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    })
    .slice(0, 20);
}

export function createDashboardRouter() {
  const router = Router();

  router.get('/summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const cacheKey = `dashboard-summary-${userId}`;
    const cached = getCachedData<Record<string, unknown>>(cacheKey);

    if (cached) {
      response.json(successResponse(cached, 'dashboard_summary'));
      return;
    }

    const [
      todos,
      subscriptions,
      loans,
      cards,
      storageItems,
      logs,
      scenes,
      channels,
      stepRecords,
      fitnessDietRecords,
      fitnessExerciseRecords,
      fitnessWeightRecords,
      medicationRecords,
      medicationPurchases,
      medicationThresholds,
      checkups,
      forexTrades,
      forexCapitalFlows,
    ] = await Promise.all([
      appDataSource.getRepository(LifeTodoTaskEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceSubscriptionRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceLoanBillEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(LifeCardRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(LifeStorageItemEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(NotificationCenterLogEntity).find({ where: { user_id: userId }, order: { created_at: 'DESC' }, take: 8 }),
      appDataSource.getRepository(NotificationCenterSceneEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(NotificationCenterChannelEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthStepRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthCheckupRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
    ]);

    const pendingTodos = todos.filter((task) => !task.completed && !task.trashed_at).length;
    const dueTodayTodos = todos.filter((task) => !task.completed && !task.trashed_at && task.due_date && dayjs(task.due_date).isValid() && dayjs(task.due_date).isSame(dayjs(), 'day')).length;
    const activeStorageCount = storageItems.filter((item) => item.status === 'active').length;
    const lowBalanceCards = cards.filter((card) => Number(card.balance) <= 10).length;
    const overdueLoans = loans.filter((bill) => !bill.is_paid && bill.due_date && dayjs(bill.due_date).isValid() && dayjs(bill.due_date).isBefore(dayjs(), 'day')).length;
    const upcomingSubscriptions = subscriptions.filter((record) => {
      if (!record.end_date || !dayjs(record.end_date).isValid()) return false;
      const diff = dayjs(record.end_date).startOf('day').diff(dayjs().startOf('day'), 'day');
      return diff >= 0 && diff <= 7;
    }).length;
    const stepToday = stepRecords.filter((item) => {
      if (!item.record_time) return false;
      const recordDate = dayjs(item.record_time);
      return recordDate.isValid() && recordDate.isSame(dayjs(), 'day');
    }).reduce((max, item) => Math.max(max, item.steps || 0), 0);
    const lowMedicationCount = calculateMedicationLowStockCount(medicationRecords, medicationPurchases, medicationThresholds);
    const dueCheckups = checkups.filter((record) => record.follow_up_date && dayjs(record.follow_up_date).isValid() && dayjs(record.follow_up_date).diff(dayjs(), 'day') <= 7).length;
    const forexSummary = buildForexSummary(forexTrades, forexCapitalFlows);
    const agenda = buildAgendaItems({
      todos,
      subscriptions,
      loans,
      cards,
      checkups,
      medicationRecords,
      medicationPurchases,
      medicationThresholds,
    });

    const financeMonthSpend = subscriptions.reduce((sum, item) => {
      if (item.billing_cycle === 'monthly') return sum + Number(item.cycle_price);
      if (item.billing_cycle === 'quarterly') return sum + (Number(item.cycle_price) / 3);
      if (item.billing_cycle === 'yearly') return sum + (Number(item.cycle_price) / 12);
      return sum;
    }, 0);

    const result = {
      overviewCards: [
        { key: 'modules', label: '已接入模块数', value: 17 },
        { key: 'scenes', label: '启用通知场景数', value: scenes.filter((scene) => scene.enabled).length },
        { key: 'logs', label: '最近通知日志数', value: logs.length },
        { key: 'agenda', label: '统一待处理总数', value: agenda.length },
        { key: 'health', label: '健康中心今日关注数', value: dueCheckups + lowMedicationCount + (stepToday > 0 ? 1 : 0) },
        { key: 'finance', label: '财务中心本月支出/待还摘要', value: Number((financeMonthSpend + loans.filter((bill) => !bill.is_paid).reduce((sum, item) => sum + Number(item.amount), 0)).toFixed(2)) },
        { key: 'life', label: '生活中心活跃事项数', value: pendingTodos + activeStorageCount + lowBalanceCards },
        { key: 'investment', label: '投资中心净收益摘要', value: forexSummary.netPnl },
      ],
      agenda,
      health: {
        title: '健康中心摘要',
        stats: {
          todayStepCount: stepToday,
          latestWeight: fitnessWeightRecords.filter((item) => item.date && dayjs(item.date).isValid()).sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())[0]?.weight ?? null,
          todayCalorieNet: Number((
            fitnessDietRecords.filter((item) => item.date === dayjs().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories || 0), 0)
            - fitnessExerciseRecords.filter((item) => item.date === dayjs().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories || 0), 0)
          ).toFixed(1)),
          checkupPendingCount: dueCheckups,
          medicationLowStockCount: lowMedicationCount,
        },
        trend: Array.from({ length: 7 }, (_, index) => {
          const date = dayjs().subtract(6 - index, 'day');
          const dateStr = date.format('YYYY-MM-DD');
          const steps = stepRecords.filter((item) => {
            if (!item.record_time) return false;
            const recordDate = dayjs(item.record_time);
            return recordDate.isValid() && recordDate.format('YYYY-MM-DD') === dateStr;
          }).reduce((max, item) => Math.max(max, item.steps || 0), 0);
          return {
            date: dateStr,
            label: date.format('MM-DD'),
            steps,
          };
        }),
      },
      finance: {
        title: '财务中心摘要',
        stats: {
          upcomingSubscriptionCount: upcomingSubscriptions,
          overdueLoanCount: overdueLoans,
          activeSubscriptionCount: subscriptions.length,
          totalUnpaidLoanAmount: Number(loans.filter((bill) => !bill.is_paid).reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)),
        },
        trend: Array.from({ length: 6 }, (_, index) => {
          const month = dayjs().subtract(5 - index, 'month').format('YYYY-MM');
          return {
            month,
            label: dayjs(`${month}-01`).format('MM月'),
            subscriptionCount: subscriptions.filter((item) => item.end_date && dayjs(item.end_date).isValid() && dayjs(item.end_date).format('YYYY-MM') === month).length,
            loanAmount: Number(loans.filter((item) => item.billing_month === month).reduce((sum, bill) => sum + Number(bill.amount || 0), 0).toFixed(2)),
          };
        }),
      },
      life: {
        title: '生活中心摘要',
        stats: {
          pendingTodoCount: pendingTodos,
          dueTodayTodoCount: dueTodayTodos,
          activeStorageCount,
          lowBalanceCardCount: lowBalanceCards,
        },
        trend: [
          { key: 'todo', label: '未完成待办', value: pendingTodos },
          { key: 'storage', label: '使用中物品', value: activeStorageCount },
          { key: 'card', label: '低余额号卡', value: lowBalanceCards },
        ],
      },
      investment: {
        title: '投资中心摘要',
        stats: {
          netPnl: forexSummary.netPnl,
          winRate: forexSummary.winRate,
          netCapital: forexSummary.netCapital,
          activeTradeCount: forexSummary.activeTradeCount,
        },
        trend: Array.from({ length: 7 }, (_, index) => {
          const date = dayjs().subtract(6 - index, 'day');
          const dateStr = date.format('YYYY-MM-DD');
          const scoped = forexTrades.filter((item) => {
            if (!item.trade_date) return false;
            const tradeDate = dayjs(item.trade_date);
            return tradeDate.isValid() && tradeDate.year() >= 2000 && tradeDate.year() <= 2100 && tradeDate.format('YYYY-MM-DD') === dateStr;
          });
          return {
            date: dateStr,
            label: date.format('MM-DD'),
            netPnl: Number(scoped.reduce((sum, item) => sum + Number(item.pnl || 0) + Number(item.commission || 0), 0).toFixed(2)),
            tradeCount: scoped.length,
          };
        }),
      },
      notifications: {
        enabledChannelCount: channels.filter((channel) => channel.enabled).length,
        enabledSceneCount: scenes.filter((scene) => scene.enabled).length,
        recentLogs: logs,
        hottestSceneId: logs[0]?.scene_id ?? '',
      },
    };

    setCachedData(cacheKey, result);
    response.json(successResponse(result, 'dashboard_summary'));
  }));

  router.get('/agenda', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [
      todos,
      subscriptions,
      loans,
      cards,
      checkups,
      medicationRecords,
      medicationPurchases,
      medicationThresholds,
    ] = await Promise.all([
      appDataSource.getRepository(LifeTodoTaskEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceSubscriptionRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceLoanBillEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(LifeCardRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthCheckupRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse(buildAgendaItems({
      todos,
      subscriptions,
      loans,
      cards,
      checkups,
      medicationRecords,
      medicationPurchases,
      medicationThresholds,
    })));
  }));

  router.get('/health-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [stepRecords, weightRecords, dietRecords, exerciseRecords, checkups, medicationRecords, medicationPurchases, medicationThresholds] = await Promise.all([
      appDataSource.getRepository(HealthStepRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthCheckupRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse({
      title: '健康中心摘要',
      stats: {
        todayStepCount: stepRecords.filter((item) => dayjs(item.record_time).isSame(dayjs(), 'day')).reduce((sum, item) => sum + item.steps, 0),
        latestWeight: weightRecords.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())[0]?.weight ?? null,
        todayCalorieNet: Number((
          dietRecords.filter((item) => item.date === dayjs().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)
          - exerciseRecords.filter((item) => item.date === dayjs().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)
        ).toFixed(1)),
        checkupPendingCount: checkups.filter((record) => record.follow_up_date && dayjs(record.follow_up_date).diff(dayjs(), 'day') <= 7).length,
        medicationLowStockCount: calculateMedicationLowStockCount(medicationRecords, medicationPurchases, medicationThresholds),
      },
      trend: Array.from({ length: 7 }, (_, index) => {
        const date = dayjs().subtract(6 - index, 'day');
        return {
          date: date.format('YYYY-MM-DD'),
          label: date.format('MM-DD'),
          steps: stepRecords.filter((item) => dayjs(item.record_time).isSame(date, 'day')).reduce((sum, item) => sum + item.steps, 0),
        };
      }),
    }));
  }));

  router.get('/finance-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [loans, subscriptions] = await Promise.all([
      appDataSource.getRepository(FinanceLoanBillEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceSubscriptionRecordEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse({
      title: '财务中心摘要',
      stats: {
        loanCount: loans.length,
        unpaidLoanAmount: Number(loans.filter((bill) => !bill.is_paid).reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)),
        subscriptionCount: subscriptions.length,
      },
      trend: [],
    }));
  }));

  router.get('/life-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [todos, cards, storageItems] = await Promise.all([
      appDataSource.getRepository(LifeTodoTaskEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(LifeCardRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(LifeStorageItemEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse({
      title: '生活中心摘要',
      stats: {
        pendingTodoCount: todos.filter((task) => !task.completed && !task.trashed_at).length,
        activeStorageCount: storageItems.filter((item) => item.status === 'active').length,
        lowBalanceCardCount: cards.filter((card) => Number(card.balance) <= 10).length,
      },
      trend: [],
    }));
  }));

  router.get('/investment-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [trades, capitalFlows] = await Promise.all([
      appDataSource.getRepository(InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
    ]);
    const summary = buildForexSummary(trades, capitalFlows);

    response.json(successResponse({
      title: '投资中心摘要',
      stats: summary,
      trend: Array.from({ length: 7 }, (_, index) => {
        const date = dayjs().subtract(6 - index, 'day');
        const scoped = trades.filter((item) => {
          if (!item.trade_date) {
            return false;
          }

          const tradeDate = dayjs(item.trade_date);
          return tradeDate.isValid() && tradeDate.year() >= 2000 && tradeDate.year() <= 2100 && tradeDate.isSame(date, 'day');
        });
        return {
          date: date.format('YYYY-MM-DD'),
          label: date.format('MM-DD'),
          netPnl: Number(scoped.reduce((sum, item) => sum + Number(item.pnl) + Number(item.commission), 0).toFixed(2)),
        };
      }),
    }));
  }));

  router.get('/notification-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [scenes, channels, logs] = await Promise.all([
      appDataSource.getRepository(NotificationCenterSceneEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(NotificationCenterChannelEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(NotificationCenterLogEntity).find({ where: { user_id: userId }, order: { created_at: 'DESC' }, take: 8 }),
    ]);

    response.json(successResponse({
      enabledChannelCount: channels.filter((channel) => channel.enabled).length,
      enabledSceneCount: scenes.filter((scene) => scene.enabled).length,
      recentLogs: logs,
      hottestSceneId: logs[0]?.scene_id ?? '',
    }));
  }));

  return router;
}
