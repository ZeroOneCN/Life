import { Router } from 'express';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { LifeTodoTaskEntity } from '../life/entities/life-todo-task.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { FinanceLoanBillEntity } from '../finance/entities/finance-loan-bill.entity';
import { LifeCardRecordEntity } from '../life/entities/life-card-record.entity';
import { LifeStorageItemEntity } from '../life/entities/life-storage-item.entity';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import { NotificationCenterSceneEntity } from '../notifications/entities/notification-center-scene.entity';

export function createDashboardRouter() {
  const router = Router();

  router.get('/summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const todoRepo = appDataSource.getRepository(LifeTodoTaskEntity);
    const subscriptionRepo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const loanRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const storageRepo = appDataSource.getRepository(LifeStorageItemEntity);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
    const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);

    const [todos, subscriptions, loans, cards, storageItems, logs, scenes] = await Promise.all([
      todoRepo.find({ where: { user_id: userId } }),
      subscriptionRepo.find({ where: { user_id: userId } }),
      loanRepo.find({ where: { user_id: userId } }),
      cardRepo.find({ where: { user_id: userId } }),
      storageRepo.find({ where: { user_id: userId } }),
      logRepo.find({
        where: { user_id: userId },
        order: { created_at: 'DESC' },
        take: 8,
      }),
      sceneRepo.find({ where: { user_id: userId } }),
    ]);

    const now = dayjs();
    const pendingTodos = todos.filter((task) => !task.completed && !task.trashed_at).length;
    const dueTodayTodos = todos.filter((task) => !task.completed && !task.trashed_at && task.due_date && dayjs(task.due_date).isSame(now, 'day')).length;
    const upcomingSubscriptions = subscriptions.filter((record) => {
      const diff = dayjs(record.end_date).startOf('day').diff(now.startOf('day'), 'day');
      return diff >= 0 && diff <= 7;
    }).length;
    const overdueLoans = loans.filter((bill) => !bill.is_paid && dayjs(bill.due_date).isBefore(now, 'day')).length;
    const lowBalanceCards = cards.filter((card) => Number(card.balance) <= 10).length;

    const agenda = [
      ...todos
        .filter((task) => !task.completed && !task.trashed_at)
        .map((task) => ({
          id: `todo-${task.id}`,
          module: 'todo',
          title: task.title,
          summary: task.description_markdown || '待处理任务',
          severity: task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : 'low',
          targetDate: task.due_date ?? '',
          href: '/life/todo?todoTab=tasks',
        })),
      ...subscriptions.map((record) => ({
        id: `subscription-${record.id}`,
        module: 'subscription',
        title: record.service_name,
        summary: '订阅到期关注项',
        severity: dayjs(record.end_date).isBefore(now, 'day') ? 'high' : 'medium',
        targetDate: record.end_date,
        href: '/finance/subscription?subscriptionTab=records',
      })),
      ...loans.filter((bill) => !bill.is_paid).map((bill) => ({
        id: `loan-${bill.id}`,
        module: 'loan',
        title: bill.platform_name,
        summary: '贷款账单待处理',
        severity: dayjs(bill.due_date).isBefore(now, 'day') ? 'high' : 'medium',
        targetDate: bill.due_date,
        href: '/finance/loan?loanTab=bills',
      })),
      ...cards.filter((card) => Number(card.balance) <= 10).map((card) => ({
        id: `card-${card.id}`,
        module: 'card',
        title: card.phone_number,
        summary: '号卡低余额提醒',
        severity: 'medium',
        targetDate: '',
        href: '/life/card?cardTab=cards',
      })),
    ].sort((left, right) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      const severityDiff = order[left.severity as keyof typeof order] - order[right.severity as keyof typeof order];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      if (!left.targetDate) {
        return 1;
      }
      if (!right.targetDate) {
        return -1;
      }
      return dayjs(left.targetDate).valueOf() - dayjs(right.targetDate).valueOf();
    }).slice(0, 20);

    response.json(successResponse({
      overviewCards: [
        { key: 'modules', label: '已接入模块数', value: 14 },
        { key: 'scenes', label: '启用通知场景数', value: scenes.filter((scene) => scene.enabled).length },
        { key: 'logs', label: '最近通知日志数', value: logs.length },
        { key: 'agenda', label: '统一待处理总数', value: agenda.length },
        { key: 'health', label: '健康中心今日关注数', value: 0 },
        { key: 'finance', label: '财务中心待还摘要', value: overdueLoans + loans.filter((bill) => !bill.is_paid).length },
        { key: 'life', label: '生活中心活跃事项数', value: pendingTodos + storageItems.filter((item) => item.status === 'active').length + lowBalanceCards },
        { key: 'investment', label: '投资中心净收益摘要', value: 0 },
      ],
      agenda,
      health: {
        title: '健康中心摘要',
        stats: {
          todayFocusCount: 0,
          checkupPendingCount: 0,
          medicationLowStockCount: 0,
        },
        trend: [],
      },
      finance: {
        title: '财务中心摘要',
        stats: {
          upcomingSubscriptionCount: upcomingSubscriptions,
          overdueLoanCount: overdueLoans,
          activeSubscriptionCount: subscriptions.length,
        },
        trend: [],
      },
      life: {
        title: '生活中心摘要',
        stats: {
          pendingTodoCount: pendingTodos,
          dueTodayTodoCount: dueTodayTodos,
          activeStorageCount: storageItems.filter((item) => item.status === 'active').length,
          lowBalanceCardCount: lowBalanceCards,
        },
        trend: [],
      },
      investment: {
        title: '投资中心摘要',
        stats: {
          netPnl: 0,
          winRate: 0,
          activeTradeCount: 0,
        },
        trend: [],
      },
      notifications: {
        enabledSceneCount: scenes.filter((scene) => scene.enabled).length,
        recentLogs: logs,
        hottestSceneId: logs[0]?.scene_id ?? '',
      },
    }));
  }));

  router.get('/agenda', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const todoRepo = appDataSource.getRepository(LifeTodoTaskEntity);
    const tasks = await todoRepo.find({ where: { user_id: userId } });
    const items = tasks
      .filter((task) => !task.completed && !task.trashed_at)
      .map((task) => ({
        id: task.id,
        module: 'todo',
        title: task.title,
        summary: task.description_markdown || '待处理任务',
        severity: task.priority,
        targetDate: task.due_date ?? '',
        href: '/life/todo?todoTab=tasks',
      }));
    response.json(successResponse(items));
  }));

  router.get('/health-snapshot', (_request, response) => {
    response.json(successResponse({
      title: '健康中心摘要',
      stats: {
        todayFocusCount: 0,
      },
      trend: [],
    }));
  });

  router.get('/finance-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const loanRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const subscriptionRepo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const [loans, subscriptions] = await Promise.all([
      loanRepo.find({ where: { user_id: userId } }),
      subscriptionRepo.find({ where: { user_id: userId } }),
    ]);
    response.json(successResponse({
      title: '财务中心摘要',
      stats: {
        loanCount: loans.length,
        subscriptionCount: subscriptions.length,
      },
      trend: [],
    }));
  }));

  router.get('/life-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const todoRepo = appDataSource.getRepository(LifeTodoTaskEntity);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const storageRepo = appDataSource.getRepository(LifeStorageItemEntity);
    const [todos, cards, storageItems] = await Promise.all([
      todoRepo.find({ where: { user_id: userId } }),
      cardRepo.find({ where: { user_id: userId } }),
      storageRepo.find({ where: { user_id: userId } }),
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

  router.get('/investment-snapshot', (_request, response) => {
    response.json(successResponse({
      title: '投资中心摘要',
      stats: {
        netPnl: 0,
        activeTradeCount: 0,
      },
      trend: [],
    }));
  });

  router.get('/notification-snapshot', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
    const [scenes, logs] = await Promise.all([
      sceneRepo.find({ where: { user_id: userId } }),
      logRepo.find({ where: { user_id: userId }, order: { created_at: 'DESC' }, take: 8 }),
    ]);
    response.json(successResponse({
      enabledSceneCount: scenes.filter((scene) => scene.enabled).length,
      recentLogs: logs,
      hottestSceneId: logs[0]?.scene_id ?? '',
    }));
  }));

  return router;
}
