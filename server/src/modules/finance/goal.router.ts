import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { FinanceGoalEntity } from './entities/finance-goal.entity';
import { FinanceGoalContributionEntity } from './entities/finance-goal-contribution.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { toNumber, round2 } from '../../shared/utils/number';

const goalSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
  type: z.enum(['saving', 'debt_repayment', 'investment', 'other']).optional().default('saving'),
  targetAmount: z.number().min(0),
  currentAmount: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('CNY'),
  startDate: z.string().optional(),
  targetDate: z.string().min(1),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional().default('active'),
  icon: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  warningThresholdPercent: z.number().min(0).max(200).optional().default(80),
  alertEnabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  notes: z.string().optional().default(''),
});

const contributionSchema = z.object({
  goalId: z.string().trim().min(1),
  amount: z.number().min(0),
  type: z.enum(['deposit', 'withdrawal']).optional().default('deposit'),
  contributionDate: z.string().optional(),
  description: z.string().optional().default(''),
  source: z.enum(['manual', 'auto_transfer', 'interest', 'other']).optional().default('manual'),
});

/**
 * 将目标实体映射为 API 响应格式，并计算进度数据。
 *
 * @param entity - 目标实体
 * @returns 包含进度计算的目标数据对象
 */
function mapGoal(entity: FinanceGoalEntity) {
  const targetAmount = toNumber(entity.target_amount);
  const currentAmount = toNumber(entity.current_amount);
  const startDate = entity.start_date;
  const targetDate = entity.target_date;
  const now = dayjs();

  const progressPercent = targetAmount > 0 ? round2((currentAmount / targetAmount) * 100) : 0;

  const totalDays = dayjs(targetDate).diff(dayjs(startDate), 'day');
  const daysPassed = now.diff(dayjs(startDate), 'day');
  const daysRemaining = Math.max(0, dayjs(targetDate).diff(now, 'day'));

  const timeProgressPercent = totalDays > 0 ? Math.min(100, Math.max(0, round2((daysPassed / totalDays) * 100))) : 100;

  const remainingAmount = Math.max(0, targetAmount - currentAmount);
  const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
  const monthlySavingsNeeded = daysRemaining > 0 ? round2(remainingAmount / monthsRemaining) : remainingAmount;

  const isOnTrack = progressPercent >= timeProgressPercent - 5;
  const warningThreshold = toNumber(entity.warning_threshold_percent);
  const isWarning = progressPercent < timeProgressPercent && progressPercent >= warningThreshold / 2;
  const isDanger = progressPercent < warningThreshold / 2 && daysRemaining > 0;

  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    type: entity.type,
    targetAmount: targetAmount,
    currentAmount: currentAmount,
    currency: entity.currency,
    startDate: startDate,
    targetDate: targetDate,
    status: entity.status,
    icon: entity.icon,
    color: entity.color,
    warningThresholdPercent: warningThreshold,
    alertEnabled: entity.alert_enabled,
    sortOrder: entity.sort_order,
    notes: entity.notes,
    progressPercent,
    timeProgressPercent,
    daysRemaining,
    remainingAmount,
    monthlySavingsNeeded,
    isOnTrack,
    isWarning,
    isDanger,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 将贡献记录实体映射为 API 响应格式。
 *
 * @param entity - 贡献记录实体
 * @returns 贡献记录数据对象
 */
function mapContribution(entity: FinanceGoalContributionEntity) {
  return {
    id: entity.id,
    goalId: entity.goal_id,
    amount: toNumber(entity.amount),
    type: entity.type,
    contributionDate: entity.contribution_date,
    description: entity.description,
    source: entity.source,
    createdAt: entity.created_at.toISOString(),
  };
}

/**
 * 创建财务目标路由。
 *
 * 提供目标 CRUD、进度计算、贡献记录管理等 API。
 *
 * @returns Express Router 实例
 */
export function createGoalRouter() {
  const router = Router();

  /**
   * GET /api/finance/goal
   * 获取目标列表，支持按状态和类型筛选。
   */
  router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);
    const status = String(req.query.status ?? 'all');
    const type = String(req.query.type ?? 'all');

    const repo = appDataSource.getRepository(FinanceGoalEntity);
    const allItems = await repo.find({
      where: { user_id: userId },
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });

    const filtered = allItems
      .filter((item) => status === 'all' || item.status === status)
      .filter((item) => type === 'all' || item.type === type);

    res.json(successResponse(buildListData(
      filtered.slice(skip, skip + pageSize).map(mapGoal),
      page,
      pageSize,
      filtered.length,
    )));
  }));

  /**
   * GET /api/finance/goal/overview/summary
   * 获取目标概览统计。
   */
  router.get('/overview/summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);

    const repo = appDataSource.getRepository(FinanceGoalEntity);
    const goals = await repo.find({ where: { user_id: userId } });

    const totalGoals = goals.length;
    const activeGoals = goals.filter((g) => g.status === 'active').length;
    const completedGoals = goals.filter((g) => g.status === 'completed').length;

    const totalTarget = goals.reduce((sum, g) => sum + toNumber(g.target_amount), 0);
    const totalCurrent = goals.reduce((sum, g) => sum + toNumber(g.current_amount), 0);
    const overallProgress = totalTarget > 0 ? round2((totalCurrent / totalTarget) * 100) : 0;

    const contribRepo = appDataSource.getRepository(FinanceGoalContributionEntity);
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const thisMonthContribs = await contribRepo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.type = :type', { type: 'deposit' })
      .andWhere('c.contribution_date >= :monthStart', { monthStart })
      .getMany();

    const thisMonthSaved = thisMonthContribs.reduce((sum, c) => sum + toNumber(c.amount), 0);

    res.json(successResponse({
      totalGoals,
      activeGoals,
      completedGoals,
      totalTarget: round2(totalTarget),
      totalCurrent: round2(totalCurrent),
      overallProgress,
      thisMonthSaved: round2(thisMonthSaved),
    }));
  }));

  /**
   * GET /api/finance/goal/:id
   * 获取目标详情。
   */
  router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const goalId = String(req.params.id ?? '');

    const repo = appDataSource.getRepository(FinanceGoalEntity);
    const entity = await repo.findOne({ where: { id: goalId, user_id: userId } });
    if (!entity) {
      throw new AppError('goal_not_found', 404, 404, '目标不存在');
    }

    res.json(successResponse(mapGoal(entity)));
  }));

  /**
   * POST /api/finance/goal
   * 创建财务目标。
   */
  router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const payload = validateBody(goalSchema, req.body);

    const repo = appDataSource.getRepository(FinanceGoalEntity);
    const entity = await repo.save(repo.create({
      user_id: userId,
      name: payload.name,
      description: payload.description,
      type: payload.type,
      target_amount: payload.targetAmount,
      current_amount: payload.currentAmount,
      currency: payload.currency,
      start_date: payload.startDate ? normalizeDate(payload.startDate) : dayjs().format('YYYY-MM-DD'),
      target_date: normalizeDate(payload.targetDate),
      status: payload.status,
      icon: payload.icon,
      color: payload.color,
      warning_threshold_percent: payload.warningThresholdPercent,
      alert_enabled: payload.alertEnabled,
      sort_order: payload.sortOrder,
      notes: payload.notes,
    }));

    res.json(successResponse(mapGoal(entity), 'create_goal_success'));
  }));

  /**
   * PATCH /api/finance/goal/:id
   * 更新财务目标。
   */
  router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const goalId = String(req.params.id ?? '');
    const payload = validateBody(goalSchema.partial(), req.body);

    const repo = appDataSource.getRepository(FinanceGoalEntity);
    const entity = await repo.findOne({ where: { id: goalId, user_id: userId } });
    if (!entity) {
      throw new AppError('goal_not_found', 404, 404, '目标不存在');
    }

    const wasCompleted = entity.status === 'completed';

    const next = await repo.save({
      ...entity,
      name: payload.name ?? entity.name,
      description: payload.description ?? entity.description,
      type: payload.type ?? entity.type,
      target_amount: payload.targetAmount ?? entity.target_amount,
      current_amount: payload.currentAmount ?? entity.current_amount,
      currency: payload.currency ?? entity.currency,
      start_date: payload.startDate ? normalizeDate(payload.startDate) : entity.start_date,
      target_date: payload.targetDate ? normalizeDate(payload.targetDate) : entity.target_date,
      status: payload.status ?? entity.status,
      icon: payload.icon ?? entity.icon,
      color: payload.color ?? entity.color,
      warning_threshold_percent: payload.warningThresholdPercent ?? entity.warning_threshold_percent,
      alert_enabled: payload.alertEnabled ?? entity.alert_enabled,
      sort_order: payload.sortOrder ?? entity.sort_order,
      notes: payload.notes ?? entity.notes,
    });

    const isNowCompleted = next.status === 'completed';
    if (!wasCompleted && isNowCompleted) {
      await sendNotificationSceneLogs({
        userId,
        sceneId: 'finance.goal.completed',
        title: '🎉 目标达成！',
        message: `恭喜你完成了「${next.name}」目标！`,
        meta: {
          goalId: next.id,
          goalName: next.name,
          targetAmount: toNumber(next.target_amount),
          currentAmount: toNumber(next.current_amount),
        },
      });
    }

    res.json(successResponse(mapGoal(next), 'update_goal_success'));
  }));

  /**
   * DELETE /api/finance/goal/:id
   * 删除财务目标及其贡献记录。
   */
  router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const goalId = String(req.params.id ?? '');

    const repo = appDataSource.getRepository(FinanceGoalEntity);
    const entity = await repo.findOne({ where: { id: goalId, user_id: userId } });
    if (!entity) {
      throw new AppError('goal_not_found', 404, 404, '目标不存在');
    }

    const contribRepo = appDataSource.getRepository(FinanceGoalContributionEntity);
    await contribRepo.delete({ goal_id: goalId, user_id: userId });

    await repo.remove(entity);
    res.json(successResponse({ ok: true }, 'delete_goal_success'));
  }));

  /**
   * GET /api/finance/goal/:id/contributions
   * 获取目标贡献记录列表。
   */
  router.get('/:id/contributions', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const goalId = String(req.params.id ?? '');
    const { page, pageSize, skip } = parsePagination(req.query as Record<string, unknown>);

    const goalRepo = appDataSource.getRepository(FinanceGoalEntity);
    const goal = await goalRepo.findOne({ where: { id: goalId, user_id: userId } });
    if (!goal) {
      throw new AppError('goal_not_found', 404, 404, '目标不存在');
    }

    const repo = appDataSource.getRepository(FinanceGoalContributionEntity);
    const allItems = await repo.find({
      where: { goal_id: goalId, user_id: userId },
      order: { contribution_date: 'DESC', created_at: 'DESC' },
    });

    res.json(successResponse(buildListData(
      allItems.slice(skip, skip + pageSize).map(mapContribution),
      page,
      pageSize,
      allItems.length,
    )));
  }));

  /**
   * POST /api/finance/goal/contributions
   * 添加目标贡献记录，并更新目标当前金额。
   */
  router.post('/contributions', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const payload = validateBody(contributionSchema, req.body);

    const goalRepo = appDataSource.getRepository(FinanceGoalEntity);
    const goal = await goalRepo.findOne({ where: { id: payload.goalId, user_id: userId } });
    if (!goal) {
      throw new AppError('goal_not_found', 404, 404, '目标不存在');
    }

    const contribRepo = appDataSource.getRepository(FinanceGoalContributionEntity);
    const contrib = await contribRepo.save(contribRepo.create({
      user_id: userId,
      goal_id: payload.goalId,
      amount: payload.amount,
      type: payload.type,
      contribution_date: payload.contributionDate ? normalizeDate(payload.contributionDate) : dayjs().format('YYYY-MM-DD'),
      description: payload.description,
      source: payload.source,
    }));

    const currentAmount = toNumber(goal.current_amount);
    const amountDelta = payload.type === 'deposit' ? payload.amount : -payload.amount;
    const newCurrentAmount = Math.max(0, currentAmount + amountDelta);

    const targetAmount = toNumber(goal.target_amount);
    const wasCompleted = goal.status === 'completed';
    let newStatus = goal.status;
    if (newCurrentAmount >= targetAmount && goal.status === 'active') {
      newStatus = 'completed';
    } else if (newCurrentAmount < targetAmount && goal.status === 'completed') {
      newStatus = 'active';
    }

    const savedGoal = await goalRepo.save({
      ...goal,
      current_amount: newCurrentAmount,
      status: newStatus,
    });

    const isNowCompleted = newStatus === 'completed';
    if (!wasCompleted && isNowCompleted) {
      await sendNotificationSceneLogs({
        userId,
        sceneId: 'finance.goal.completed',
        title: '🎉 目标达成！',
        message: `恭喜你完成了「${savedGoal.name}」目标！`,
        meta: {
          goalId: savedGoal.id,
          goalName: savedGoal.name,
          targetAmount: toNumber(savedGoal.target_amount),
          currentAmount: toNumber(savedGoal.current_amount),
        },
      });
    }

    res.json(successResponse({
      contribution: mapContribution(contrib),
      goal: mapGoal(savedGoal),
    }, 'add_contribution_success'));
  }));

  /**
   * DELETE /api/finance/goal/contributions/:contributionId
   * 删除贡献记录，并回滚目标当前金额。
   */
  router.delete('/contributions/:contributionId', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireAuthUser(req);
    const contribId = String(req.params.contributionId ?? '');

    const contribRepo = appDataSource.getRepository(FinanceGoalContributionEntity);
    const contrib = await contribRepo.findOne({ where: { id: contribId, user_id: userId } });
    if (!contrib) {
      throw new AppError('contribution_not_found', 404, 404, '贡献记录不存在');
    }

    const goalRepo = appDataSource.getRepository(FinanceGoalEntity);
    const goal = await goalRepo.findOne({ where: { id: contrib.goal_id, user_id: userId } });

    if (goal) {
      const currentAmount = toNumber(goal.current_amount);
      const amountDelta = contrib.type === 'deposit' ? -toNumber(contrib.amount) : toNumber(contrib.amount);
      const newCurrentAmount = Math.max(0, currentAmount + amountDelta);

      const targetAmount = toNumber(goal.target_amount);
      let newStatus = goal.status;
      if (newCurrentAmount >= targetAmount && goal.status === 'active') {
        newStatus = 'completed';
      } else if (newCurrentAmount < targetAmount && goal.status === 'completed') {
        newStatus = 'active';
      }

      await goalRepo.save({
        ...goal,
        current_amount: newCurrentAmount,
        status: newStatus,
      });
    }

    await contribRepo.remove(contrib);
    res.json(successResponse({ ok: true }, 'delete_contribution_success'));
  }));

  return router;
}
