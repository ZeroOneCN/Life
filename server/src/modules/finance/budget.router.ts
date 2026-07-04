import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { FinanceBudgetEntity } from './entities/finance-budget.entity';
import { FinanceBudgetCategoryEntity } from './entities/finance-budget-category.entity';
import { FinanceBudgetHistoryEntity } from './entities/finance-budget-history.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { startBudgetAlertScheduler } from './budget-alert.scheduler';
import { calculateCategoryActualExpenses } from './budget-calculator';

const categorySchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
  type: z.enum(['income', 'expense']).optional().default('expense'),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const budgetSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
  categoryId: z.string().trim().min(1),
  categoryName: z.string().trim().optional().default(''),
  amount: z.number().min(0),
  periodType: z.enum(['monthly', 'yearly', 'custom']).optional().default('monthly'),
  type: z.enum(['income', 'expense']).optional().default('expense'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  warningThresholdPercent: z.number().min(0).max(200).optional().default(80),
  isActive: z.boolean().optional().default(true),
  alertEnabled: z.boolean().optional().default(true),
  changeReason: z.string().optional().default(''),
});

const budgetProgressQuerySchema = z.object({
  month: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function mapCategory(entity: FinanceBudgetCategoryEntity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    type: entity.type,
    sortOrder: entity.sort_order,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapBudget(entity: FinanceBudgetEntity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    categoryId: entity.category_id,
    categoryName: entity.category_name,
    amount: toNumber(entity.amount),
    periodType: entity.period_type,
    type: entity.type,
    startDate: entity.start_date ?? '',
    endDate: entity.end_date ?? '',
    warningThresholdPercent: toNumber(entity.warning_threshold_percent),
    isActive: entity.is_active,
    alertEnabled: entity.alert_enabled,
    lastWarningMarker: entity.last_warning_marker,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapHistory(entity: FinanceBudgetHistoryEntity) {
  return {
    id: entity.id,
    budgetId: entity.budget_id,
    budgetName: entity.budget_name,
    categoryId: entity.category_id,
    categoryName: entity.category_name,
    previousAmount: toNumber(entity.previous_amount),
    newAmount: toNumber(entity.new_amount),
    periodType: entity.period_type,
    changeReason: entity.change_reason,
    effectiveDate: entity.effective_date,
    createdAt: entity.created_at.toISOString(),
  };
}

/**
 * 计算单个预算的执行进度。
 *
 * 根据预算的 period_type 确定统计范围：
 * - monthly：指定月份
 * - yearly：指定年份的 1-12 月累加
 * - custom：start_date 到 end_date 范围内累加
 *
 * @param budget 预算实体
 * @param categoryActualMap 分类实际支出 Map
 * @param month 当前参考月份（YYYY-MM）
 * @returns 预算进度对象（预算金额、实际金额、进度百分比、剩余金额、状态）
 */
function calculateBudgetProgress(
  budget: FinanceBudgetEntity,
  categoryActualMap: Map<string, number>,
  month: string,
) {
  const budgetAmount = toNumber(budget.amount);
  const categoryKey = budget.category_name || budget.category_id;
  const actualAmount = toNumber(categoryActualMap.get(categoryKey) ?? 0);

  const percent = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;
  const remaining = round2(budgetAmount - actualAmount);

  let status: 'on_track' | 'warning' | 'over_budget' = 'on_track';
  const threshold = toNumber(budget.warning_threshold_percent);
  if (percent >= 100) {
    status = 'over_budget';
  } else if (percent >= threshold) {
    status = 'warning';
  }

  return {
    budgetId: budget.id,
    budgetName: budget.name,
    categoryId: budget.category_id,
    categoryName: budget.category_name,
    budgetAmount: round2(budgetAmount),
    actualAmount: round2(actualAmount),
    remainingAmount: remaining,
    progressPercent: round2(percent),
    warningThresholdPercent: round2(threshold),
    status,
    periodType: budget.period_type,
    type: budget.type,
  };
}

/**
 * 计算指定年份的各月实际总支出。
 *
 * @param userId 用户 ID
 * @param year 年份
 * @returns 按月份排序的 { month, total } 数组
 */
async function calculateMonthlyActuals(userId: string, year: number) {
  const results: Array<{ month: string; total: number }> = [];
  for (let m = 1; m <= 12; m += 1) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    const categoryMap = await calculateCategoryActualExpenses(userId, month);
    const total = [...categoryMap.values()].reduce((sum, val) => sum + val, 0);
    results.push({ month, total: round2(total) });
  }
  return results;
}

export function createBudgetRouter() {
  startBudgetAlertScheduler();
  const router = Router();

  // ==================== 分类 CRUD ====================

  router.get('/categories', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const type = String(request.query.type ?? 'all');
    const repository = appDataSource.getRepository(FinanceBudgetCategoryEntity);
    const where: Record<string, unknown> = { user_id: userId };
    if (type !== 'all') {
      where.type = type;
    }
    const items = await repository.find({
      where,
      order: { sort_order: 'ASC', name: 'ASC' },
    });
    response.json(successResponse(buildListData(items.map(mapCategory))));
  }));

  router.post('/categories', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(categorySchema, request.body);
    const repository = appDataSource.getRepository(FinanceBudgetCategoryEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      name: payload.name,
      description: payload.description,
      type: payload.type,
      sort_order: payload.sortOrder,
    }));
    response.json(successResponse(mapCategory(item), 'create_budget_category_success'));
  }));

  router.patch('/categories/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const categoryId = String(request.params.id ?? '');
    const payload = validateBody(categorySchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceBudgetCategoryEntity);
    const current = await repository.findOne({
      where: { id: categoryId, user_id: userId },
    });
    if (!current) {
      throw new AppError('budget_category_not_found', 404, 404);
    }
    const next = await repository.save({
      ...current,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
      type: payload.type ?? current.type,
      sort_order: payload.sortOrder ?? current.sort_order,
    });
    response.json(successResponse(mapCategory(next), 'update_budget_category_success'));
  }));

  router.delete('/categories/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const categoryId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceBudgetCategoryEntity);
    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const current = await repository.findOne({
      where: { id: categoryId, user_id: userId },
    });
    if (!current) {
      throw new AppError('budget_category_not_found', 404, 404);
    }
    const usedBudgets = await budgetRepo.count({
      where: { user_id: userId, category_id: categoryId },
    });
    if (usedBudgets > 0) {
      throw new AppError('budget_category_in_use', 400, 400, '该分类下存在预算，无法删除');
    }
    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_budget_category_success'));
  }));

  // ==================== 预算 CRUD ====================

  router.get('/budgets', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const type = String(request.query.type ?? 'all');
    const periodType = String(request.query.periodType ?? 'all');
    const active = String(request.query.active ?? 'all');
    const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
    const repository = appDataSource.getRepository(FinanceBudgetEntity);

    const allItems = await repository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    const filtered = allItems
      .filter((item) => type === 'all' || item.type === type)
      .filter((item) => periodType === 'all' || item.period_type === periodType)
      .filter((item) => active === 'all' || (active === 'active' ? item.is_active : !item.is_active))
      .filter((item) => !keyword || [item.name, item.category_name, item.description].some((v) => v.toLowerCase().includes(keyword)));

    response.json(successResponse(buildListData(
      filtered.slice(skip, skip + pageSize).map(mapBudget),
      page,
      pageSize,
      filtered.length,
    )));
  }));

  router.get('/budgets/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const budgetId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceBudgetEntity);
    const item = await repository.findOne({
      where: { id: budgetId, user_id: userId },
    });
    if (!item) {
      throw new AppError('budget_not_found', 404, 404);
    }
    response.json(successResponse(mapBudget(item)));
  }));

  router.post('/budgets', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(budgetSchema, request.body);
    const categoryRepo = appDataSource.getRepository(FinanceBudgetCategoryEntity);
    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const historyRepo = appDataSource.getRepository(FinanceBudgetHistoryEntity);

    const category = await categoryRepo.findOne({
      where: { id: payload.categoryId, user_id: userId },
    });

    const budget = await budgetRepo.save(budgetRepo.create({
      user_id: userId,
      name: payload.name,
      description: payload.description,
      category_id: payload.categoryId,
      category_name: payload.categoryName || category?.name || '',
      amount: payload.amount,
      period_type: payload.periodType,
      type: payload.type,
      start_date: payload.startDate ? normalizeDate(payload.startDate) : null,
      end_date: payload.endDate ? normalizeDate(payload.endDate) : null,
      warning_threshold_percent: payload.warningThresholdPercent,
      is_active: payload.isActive,
      alert_enabled: payload.alertEnabled,
      last_warning_marker: '',
    }));

    if (payload.amount > 0) {
      await historyRepo.save(historyRepo.create({
        user_id: userId,
        budget_id: budget.id,
        budget_name: budget.name,
        category_id: budget.category_id,
        category_name: budget.category_name,
        previous_amount: 0,
        new_amount: budget.amount,
        period_type: budget.period_type,
        change_reason: payload.changeReason || '新建预算',
        effective_date: dayjs().format('YYYY-MM-DD'),
      }));
    }

    response.json(successResponse(mapBudget(budget), 'create_budget_success'));
  }));

  router.patch('/budgets/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const budgetId = String(request.params.id ?? '');
    const payload = validateBody(budgetSchema.partial(), request.body);
    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const categoryRepo = appDataSource.getRepository(FinanceBudgetCategoryEntity);
    const historyRepo = appDataSource.getRepository(FinanceBudgetHistoryEntity);

    const current = await budgetRepo.findOne({
      where: { id: budgetId, user_id: userId },
    });
    if (!current) {
      throw new AppError('budget_not_found', 404, 404);
    }

    const category = payload.categoryId
      ? await categoryRepo.findOne({ where: { id: payload.categoryId, user_id: userId } })
      : null;

    const oldAmount = toNumber(current.amount);
    const newAmount = payload.amount ?? oldAmount;
    const amountChanged = newAmount !== oldAmount;

    const next = await budgetRepo.save({
      ...current,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
      category_id: payload.categoryId ?? current.category_id,
      category_name: payload.categoryName ?? category?.name ?? current.category_name,
      amount: payload.amount !== undefined ? payload.amount : current.amount,
      period_type: payload.periodType ?? current.period_type,
      type: payload.type ?? current.type,
      start_date: payload.startDate ? normalizeDate(payload.startDate) : current.start_date,
      end_date: payload.endDate ? normalizeDate(payload.endDate) : current.end_date,
      warning_threshold_percent: payload.warningThresholdPercent ?? current.warning_threshold_percent,
      is_active: payload.isActive ?? current.is_active,
      alert_enabled: payload.alertEnabled ?? current.alert_enabled,
    });

    if (amountChanged) {
      await historyRepo.save(historyRepo.create({
        user_id: userId,
        budget_id: next.id,
        budget_name: next.name,
        category_id: next.category_id,
        category_name: next.category_name,
        previous_amount: oldAmount,
        new_amount: newAmount,
        period_type: next.period_type,
        change_reason: payload.changeReason || '调整预算金额',
        effective_date: dayjs().format('YYYY-MM-DD'),
      }));
    }

    response.json(successResponse(mapBudget(next), 'update_budget_success'));
  }));

  router.delete('/budgets/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const budgetId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceBudgetEntity);
    const current = await repository.findOne({
      where: { id: budgetId, user_id: userId },
    });
    if (!current) {
      throw new AppError('budget_not_found', 404, 404);
    }
    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_budget_success'));
  }));

  // ==================== 进度查询 ====================

  /**
   * 获取预算执行进度总览。
   *
   * 查询参数：
   * - month: 月份（YYYY-MM），默认当月
   * - year: 年份，当 period_type 为 yearly 时使用
   *
   * 返回所有活跃预算的执行进度，含状态（on_track/warning/over_budget）。
   */
  router.get('/progress', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const parsed = budgetProgressQuerySchema.parse(request.query);
    const month = parsed.month || dayjs().format('YYYY-MM');
    const year = parsed.year || dayjs().year();

    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const budgets = await budgetRepo.find({
      where: { user_id: userId, is_active: true },
      order: { created_at: 'DESC' },
    });

    const categoryActualMap = await calculateCategoryActualExpenses(userId, month);

    const progressList = budgets.map((budget) => calculateBudgetProgress(budget, categoryActualMap, month));

    const totalBudget = progressList
      .filter((b) => b.type === 'expense')
      .reduce((sum, b) => sum + b.budgetAmount, 0);
    const totalActual = progressList
      .filter((b) => b.type === 'expense')
      .reduce((sum, b) => sum + b.actualAmount, 0);
    const overBudgetCount = progressList.filter((b) => b.status === 'over_budget').length;
    const warningCount = progressList.filter((b) => b.status === 'warning').length;

    response.json(successResponse({
      month,
      year,
      totalBudget: round2(totalBudget),
      totalActual: round2(totalActual),
      totalRemaining: round2(totalBudget - totalActual),
      overallPercent: totalBudget > 0 ? round2((totalActual / totalBudget) * 100) : 0,
      overBudgetCount,
      warningCount,
      onTrackCount: progressList.length - overBudgetCount - warningCount,
      items: progressList,
    }));
  }));

  /**
   * 获取单个预算的详细进度与历史趋势。
   *
   * 返回：当前进度、近 6 个月实际支出趋势、调整历史记录。
   */
  router.get('/budgets/:id/progress', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const budgetId = String(request.params.id ?? '');
    const month = String(request.query.month ?? dayjs().format('YYYY-MM'));

    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const historyRepo = appDataSource.getRepository(FinanceBudgetHistoryEntity);

    const budget = await budgetRepo.findOne({
      where: { id: budgetId, user_id: userId },
    });
    if (!budget) {
      throw new AppError('budget_not_found', 404, 404);
    }

    const categoryActualMap = await calculateCategoryActualExpenses(userId, month);
    const progress = calculateBudgetProgress(budget, categoryActualMap, month);

    const trendMonths: Array<{ month: string; actual: number; budget: number }> = [];
    const currentMonthObj = dayjs(`${month}-01`);
    for (let i = 5; i >= 0; i -= 1) {
      const m = currentMonthObj.subtract(i, 'month').format('YYYY-MM');
      const catMap = await calculateCategoryActualExpenses(userId, m);
      const actual = toNumber(catMap.get(budget.category_name || budget.category_id) ?? 0);
      trendMonths.push({
        month: m,
        actual: round2(actual),
        budget: budget.period_type === 'monthly' ? toNumber(budget.amount) : 0,
      });
    }

    const historyRecords = await historyRepo.find({
      where: { user_id: userId, budget_id: budgetId },
      order: { effective_date: 'DESC', created_at: 'DESC' },
      take: 20,
    });

    response.json(successResponse({
      progress,
      trend: trendMonths,
      history: historyRecords.map(mapHistory),
    }));
  }));

  // ==================== 预算 vs 实际对比 ====================

  /**
   * 预算 vs 实际对比分析（年度视图）。
   *
   * 返回指定年份内每月的预算总额 vs 实际支出对比，以及各分类对比。
   */
  router.get('/comparison/yearly', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const rawYear = request.query.year as string | undefined;
    const year = rawYear ? Number(rawYear) : dayjs().year();

    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const monthlyBudgets = await budgetRepo.find({
      where: { user_id: userId, is_active: true, type: 'expense', period_type: 'monthly' },
    });
    const yearlyBudgets = await budgetRepo.find({
      where: { user_id: userId, is_active: true, type: 'expense', period_type: 'yearly' },
    });

    const monthlyActuals = await calculateMonthlyActuals(userId, year);

    const monthlyBudgetTotal = monthlyBudgets.reduce((sum, b) => sum + toNumber(b.amount), 0);
    const yearlyBudgetTotal = yearlyBudgets.reduce((sum, b) => sum + toNumber(b.amount), 0);
    const totalActual = monthlyActuals.reduce((sum, m) => sum + m.total, 0);

    const monthlyComparison = monthlyActuals.map((item) => {
      const budgeted = monthlyBudgetTotal;
      return {
        month: item.month,
        budgeted: round2(budgeted),
        actual: item.total,
        difference: round2(budgeted - item.total),
        percent: budgeted > 0 ? round2((item.total / budgeted) * 100) : 0,
      };
    });

    response.json(successResponse({
      year,
      totalBudgeted: round2(monthlyBudgetTotal * 12 + yearlyBudgetTotal),
      totalActual: round2(totalActual),
      totalDifference: round2(monthlyBudgetTotal * 12 + yearlyBudgetTotal - totalActual),
      monthly: monthlyComparison,
    }));
  }));

  // ==================== 调整历史 ====================

  router.get('/history', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const budgetId = String(request.query.budgetId ?? '');
    const repository = appDataSource.getRepository(FinanceBudgetHistoryEntity);

    const where: Record<string, unknown> = { user_id: userId };
    if (budgetId) {
      where.budget_id = budgetId;
    }

    const [items, total] = await repository.findAndCount({
      where,
      order: { effective_date: 'DESC', created_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapHistory), page, pageSize, total)));
  }));

  // ==================== 超支预警触发 ====================

  /**
   * 手动触发超支预警检查。
   *
   * 扫描所有活跃预算，若进度达到预警阈值且本月未发送过提醒，则发送通知。
   * 通知通过通知中心的 finance.budget.overspend 场景下发。
   */
  router.post('/actions/trigger-alerts', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const month = dayjs().format('YYYY-MM');
    const today = dayjs().format('YYYY-MM-DD');

    const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
    const budgets = await budgetRepo.find({
      where: { user_id: userId, is_active: true, alert_enabled: true, type: 'expense' },
    });

    const categoryActualMap = await calculateCategoryActualExpenses(userId, month);
    const logs = [];

    for (const budget of budgets) {
      const progress = calculateBudgetProgress(budget, categoryActualMap, month);
      const marker = `${budget.id}:${month}:${today}`;

      if (progress.status === 'over_budget' && budget.last_warning_marker !== marker) {
        const overAmount = Math.abs(progress.remainingAmount);
        const sent = await sendNotificationSceneLogs({
          userId,
          sceneId: 'finance.budget.overspend',
          title: `预算超支警告：${budget.name}`,
          message: `「${budget.name}」预算 ¥${progress.budgetAmount}，当前已支出 ¥${progress.actualAmount}（${progress.progressPercent}%），已超出预算 ¥${overAmount}。请关注支出情况。`,
          meta: {
            budgetId: budget.id,
            budgetName: budget.name,
            categoryName: budget.category_name,
            budgetAmount: progress.budgetAmount,
            actualAmount: progress.actualAmount,
            overAmount: round2(overAmount),
            progressPercent: progress.progressPercent,
            status: progress.status,
            month,
          },
        });
        logs.push(...sent);
        budget.last_warning_marker = marker;
        await budgetRepo.save(budget);
      } else if (progress.status === 'warning' && !budget.last_warning_marker.startsWith(`${budget.id}:${month}`)) {
        const sent = await sendNotificationSceneLogs({
          userId,
          sceneId: 'finance.budget.warning',
          title: `预算预警：${budget.name}`,
          message: `「${budget.name}」预算 ¥${progress.budgetAmount}，当前已支出 ¥${progress.actualAmount}（${progress.progressPercent}%），接近预警线 ${progress.warningThresholdPercent}%。请注意控制支出。`,
          meta: {
            budgetId: budget.id,
            budgetName: budget.name,
            categoryName: budget.category_name,
            budgetAmount: progress.budgetAmount,
            actualAmount: progress.actualAmount,
            progressPercent: progress.progressPercent,
            status: progress.status,
            month,
          },
        });
        logs.push(...sent);
        budget.last_warning_marker = marker;
        await budgetRepo.save(budget);
      }
    }

    response.json(successResponse({ logs, count: logs.length }, 'trigger_budget_alerts_success'));
  }));

  return router;
}
