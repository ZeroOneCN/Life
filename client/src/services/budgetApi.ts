import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import type {
  BudgetCategory,
  Budget,
  BudgetProgressOverview,
  BudgetDetailProgress,
  BudgetHistory,
  BudgetYearlyComparison,
  BudgetAlertTriggerResult,
  BudgetType,
  BudgetPeriodType,
  BudgetListResponse,
  BudgetCategoryListResponse,
  BudgetHistoryListResponse,
} from '../types/budget';

const BASE = '/finance/budget';

/**
 * 预算管理 API 服务。
 * 封装预算分类、预算、进度、对比分析、调整历史等接口。
 */
export const budgetApi = {
  /**
   * 获取预算分类列表。
   *
   * @param type 分类类型（income/expense），不传则返回全部
   * @returns 分类列表
   */
  getCategories(type?: string) {
    const search = new URLSearchParams();
    if (type && type !== 'all') search.set('type', type);
    const qs = search.toString();
    return apiGet<BudgetCategoryListResponse>(`${BASE}/categories${qs ? `?${qs}` : ''}`);
  },

  /**
   * 创建预算分类。
   *
   * @param data 分类数据
   * @returns 创建后的分类
   */
  createCategory(data: {
    name: string;
    description?: string;
    type?: BudgetType;
    sortOrder?: number;
  }) {
    return apiPost<BudgetCategory>(`${BASE}/categories`, data);
  },

  /**
   * 更新预算分类。
   *
   * @param id 分类 ID
   * @param data 更新数据
   * @returns 更新后的分类
   */
  updateCategory(id: string, data: Partial<{
    name: string;
    description: string;
    type: BudgetType;
    sortOrder: number;
  }>) {
    return apiPatch<BudgetCategory>(`${BASE}/categories/${id}`, data);
  },

  /**
   * 删除预算分类。
   *
   * @param id 分类 ID
   * @returns 操作结果
   */
  deleteCategory(id: string) {
    return apiDelete<{ ok: boolean }>(`${BASE}/categories/${id}`);
  },

  /**
   * 获取预算列表（分页）。
   *
   * @param params 查询参数
   * @returns 预算分页列表
   */
  listBudgets(params: {
    page?: number;
    pageSize?: number;
    type?: string;
    periodType?: string;
    active?: string;
    keyword?: string;
  } = {}) {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
    if (params.type && params.type !== 'all') search.set('type', params.type);
    if (params.periodType && params.periodType !== 'all') search.set('periodType', params.periodType);
    if (params.active && params.active !== 'all') search.set('active', params.active);
    if (params.keyword) search.set('keyword', params.keyword);
    const qs = search.toString();
    return apiGet<BudgetListResponse>(`${BASE}/budgets${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取单个预算详情。
   *
   * @param id 预算 ID
   * @returns 预算详情
   */
  getBudget(id: string) {
    return apiGet<Budget>(`${BASE}/budgets/${id}`);
  },

  /**
   * 创建预算。
   *
   * @param data 预算数据
   * @returns 创建后的预算
   */
  createBudget(data: {
    name: string;
    description?: string;
    categoryId: string;
    categoryName?: string;
    amount: number;
    periodType?: BudgetPeriodType;
    type?: BudgetType;
    startDate?: string;
    endDate?: string;
    warningThresholdPercent?: number;
    isActive?: boolean;
    alertEnabled?: boolean;
    changeReason?: string;
  }) {
    return apiPost<Budget>(`${BASE}/budgets`, data);
  },

  /**
   * 更新预算。
   *
   * @param id 预算 ID
   * @param data 更新数据
   * @returns 更新后的预算
   */
  updateBudget(id: string, data: Partial<{
    name: string;
    description: string;
    categoryId: string;
    categoryName: string;
    amount: number;
    periodType: BudgetPeriodType;
    type: BudgetType;
    startDate: string;
    endDate: string;
    warningThresholdPercent: number;
    isActive: boolean;
    alertEnabled: boolean;
    changeReason: string;
  }>) {
    return apiPatch<Budget>(`${BASE}/budgets/${id}`, data);
  },

  /**
   * 删除预算。
   *
   * @param id 预算 ID
   * @returns 操作结果
   */
  deleteBudget(id: string) {
    return apiDelete<{ ok: boolean }>(`${BASE}/budgets/${id}`);
  },

  /**
   * 获取预算执行进度总览。
   *
   * @param month 月份 YYYY-MM，默认当月
   * @param year 年份
   * @returns 进度总览
   */
  getProgress(month?: string, year?: number) {
    const search = new URLSearchParams();
    if (month) search.set('month', month);
    if (year !== undefined) search.set('year', String(year));
    const qs = search.toString();
    return apiGet<BudgetProgressOverview>(`${BASE}/progress${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取单个预算的详细进度。
   *
   * @param id 预算 ID
   * @param month 参考月份
   * @returns 详细进度（含趋势和历史）
   */
  getBudgetProgress(id: string, month?: string) {
    const search = new URLSearchParams();
    if (month) search.set('month', month);
    const qs = search.toString();
    return apiGet<BudgetDetailProgress>(`${BASE}/budgets/${id}/progress${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取年度预算 vs 实际对比。
   *
   * @param year 年份
   * @returns 年度对比数据
   */
  getYearlyComparison(year?: number) {
    const search = new URLSearchParams();
    if (year !== undefined) search.set('year', String(year));
    const qs = search.toString();
    return apiGet<BudgetYearlyComparison>(`${BASE}/comparison/yearly${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取预算调整历史。
   *
   * @param params 查询参数
   * @returns 历史记录分页
   */
  listHistory(params: {
    page?: number;
    pageSize?: number;
    budgetId?: string;
  } = {}) {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
    if (params.budgetId) search.set('budgetId', params.budgetId);
    const qs = search.toString();
    return apiGet<BudgetHistoryListResponse>(`${BASE}/history${qs ? `?${qs}` : ''}`);
  },

  /**
   * 手动触发预算超支预警检查。
   *
   * @returns 触发结果（日志列表 + 数量）
   */
  triggerAlerts() {
    return apiPost<BudgetAlertTriggerResult>(`${BASE}/actions/trigger-alerts`, {});
  },
};
