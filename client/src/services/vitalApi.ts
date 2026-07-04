import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import type {
  VitalMetricInfo,
  VitalOverview,
  VitalRecord,
  VitalRecordDraft,
  VitalTrend,
  PaginatedVitalRecords,
} from '../types/vital';

/**
 * 日常体征 API 服务。
 * 封装体征记录的增删改查、概览、趋势分析等接口。
 */
export const vitalApi = {
  /**
   * 获取内置体征指标列表。
   * @returns 指标定义数组
   */
  getMetrics() {
    return apiGet<VitalMetricInfo[]>('/health/vital/metrics');
  },

  /**
   * 获取体征概览统计。
   * @returns 各指标最新值、异常数、记录总数
   */
  getOverview() {
    return apiGet<VitalOverview>('/health/vital/overview');
  },

  /**
   * 获取体征记录列表。
   * @param params - 查询参数
   * @returns 分页记录
   */
  listRecords(params: {
    metric?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const search = new URLSearchParams();
    if (params.metric) search.set('metric', params.metric);
    if (params.startDate) search.set('startDate', params.startDate);
    if (params.endDate) search.set('endDate', params.endDate);
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
    return apiGet<PaginatedVitalRecords>(`/health/vital/records?${search.toString()}`);
  },

  /**
   * 新增体征记录。
   * @param draft - 记录入参
   * @returns 新创建的记录
   */
  createRecord(draft: VitalRecordDraft) {
    return apiPost<VitalRecord>('/health/vital/records', draft);
  },

  /**
   * 更新体征记录。
   * @param id - 记录 ID
   * @param draft - 更新入参
   * @returns 更新后的记录
   */
  updateRecord(id: string, draft: Partial<VitalRecordDraft>) {
    return apiPatch<VitalRecord>(`/health/vital/records/${id}`, draft);
  },

  /**
   * 删除体征记录。
   * @param id - 记录 ID
   * @returns 删除结果
   */
  deleteRecord(id: string) {
    return apiDelete<{ ok: boolean }>(`/health/vital/records/${id}`);
  },

  /**
   * 获取趋势分析数据。
   * @param metric - 指标
   * @param period - 周期（week/month/year）
   * @param date - 基准日期
   * @returns 趋势数据
   */
  getTrend(metric: string, period: 'week' | 'month' | 'year', date?: string) {
    const search = new URLSearchParams();
    search.set('metric', metric);
    search.set('period', period);
    if (date) search.set('date', date);
    return apiGet<VitalTrend>(`/health/vital/trend?${search.toString()}`);
  },
};
