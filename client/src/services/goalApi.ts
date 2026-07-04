import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import type {
  FinanceGoal,
  GoalSummary,
  GoalDraft,
  GoalContribution,
  ContributionDraft,
  GoalStatus,
  GoalType,
} from '../types/goal';
import type { PaginatedResponse } from '../types/api';

const BASE = '/finance/goal';

export const goalApi = {
  /**
   * 获取目标列表。
   *
   * @param params - 筛选参数（状态、类型、分页）
   * @returns 分页目标列表
   */
  list(params?: {
    status?: GoalStatus | 'all';
    type?: GoalType | 'all';
    page?: number;
    pageSize?: number;
  }) {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.type) search.set('type', params.type);
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const qs = search.toString();
    return apiGet<PaginatedResponse<FinanceGoal>>(`${BASE}${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取目标概览统计。
   *
   * @returns 目标概览数据
   */
  getSummary() {
    return apiGet<GoalSummary>(`${BASE}/overview/summary`);
  },

  /**
   * 获取目标详情。
   *
   * @param id - 目标ID
   * @returns 目标详情
   */
  get(id: string) {
    return apiGet<FinanceGoal>(`${BASE}/${id}`);
  },

  /**
   * 创建财务目标。
   *
   * @param data - 目标数据
   * @returns 创建后的目标
   */
  create(data: GoalDraft) {
    return apiPost<FinanceGoal>(BASE, data);
  },

  /**
   * 更新财务目标。
   *
   * @param id - 目标ID
   * @param data - 更新数据
   * @returns 更新后的目标
   */
  update(id: string, data: Partial<GoalDraft>) {
    return apiPatch<FinanceGoal>(`${BASE}/${id}`, data);
  },

  /**
   * 删除财务目标。
   *
   * @param id - 目标ID
   * @returns 操作结果
   */
  remove(id: string) {
    return apiDelete<{ ok: boolean }>(`${BASE}/${id}`);
  },

  /**
   * 获取目标贡献记录列表。
   *
   * @param goalId - 目标ID
   * @param params - 分页参数
   * @returns 分页贡献记录列表
   */
  listContributions(goalId: string, params?: { page?: number; pageSize?: number }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const qs = search.toString();
    return apiGet<PaginatedResponse<GoalContribution>>(`${BASE}/${goalId}/contributions${qs ? `?${qs}` : ''}`);
  },

  /**
   * 添加贡献记录。
   *
   * @param data - 贡献记录数据
   * @returns 贡献记录和更新后的目标
   */
  addContribution(data: ContributionDraft) {
    return apiPost<{ contribution: GoalContribution; goal: FinanceGoal }>(`${BASE}/contributions`, data);
  },

  /**
   * 删除贡献记录。
   *
   * @param contributionId - 贡献记录ID
   * @returns 操作结果
   */
  removeContribution(contributionId: string) {
    return apiDelete<{ ok: boolean }>(`${BASE}/contributions/${contributionId}`);
  },
};
