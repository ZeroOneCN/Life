import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import type {
  SleepRecord,
  SleepRecordDraft,
  SleepTrend,
  SleepOverview,
  PaginatedSleepRecords,
} from '../types/sleep';

/**
 * 睡眠记录 API 服务。
 * 封装睡眠记录的增删改查、概览、趋势分析等接口。
 */
export const sleepApi = {
  /**
   * 获取睡眠概览统计。
   * @returns 近 7 天平均时长、质量、总记录数等
   */
  getOverview() {
    return apiGet<SleepOverview>('/health/sleep/overview');
  },

  /**
   * 获取睡眠记录列表。
   * @param params - 查询参数
   * @returns 分页记录
   */
  listRecords(params: {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const search = new URLSearchParams();
    if (params.startDate) search.set('startDate', params.startDate);
    if (params.endDate) search.set('endDate', params.endDate);
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
    return apiGet<PaginatedSleepRecords>(`/health/sleep/records?${search.toString()}`);
  },

  /**
   * 新增睡眠记录。
   * @param draft - 记录入参
   * @returns 新创建的记录
   */
  createRecord(draft: SleepRecordDraft) {
    return apiPost<SleepRecord>('/health/sleep/records', draft);
  },

  /**
   * 更新睡眠记录。
   * @param id - 记录 ID
   * @param draft - 更新入参
   * @returns 更新后的记录
   */
  updateRecord(id: string, draft: Partial<SleepRecordDraft>) {
    return apiPatch<SleepRecord>(`/health/sleep/records/${id}`, draft);
  },

  /**
   * 删除睡眠记录。
   * @param id - 记录 ID
   * @returns 删除结果
   */
  deleteRecord(id: string) {
    return apiDelete<{ ok: boolean }>(`/health/sleep/records/${id}`);
  },

  /**
   * 获取睡眠趋势数据。
   * @param period - 周期（week/month/year）
   * @param date - 基准日期
   * @returns 趋势数据
   */
  getTrend(period: 'week' | 'month' | 'year', date?: string) {
    const search = new URLSearchParams();
    search.set('period', period);
    if (date) search.set('date', date);
    return apiGet<SleepTrend>(`/health/sleep/trend?${search.toString()}`);
  },
};
