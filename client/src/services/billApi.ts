import { apiGet, apiPost, apiPatch } from '../lib/api';
import type { UnifiedBill, BillSummary, BillReminderSetting, BillType } from '../types/bill';

const BASE = '/finance/bill';

/**
 * 账单提醒 API 服务。
 *
 * 封装账单日历、账单列表、提醒设置、状态标记等接口。
 */
export const billApi = {
  /**
   * 获取指定月份的账单概览统计。
   *
   * @param month 月份 YYYY-MM，默认当月
   * @returns 账单统计数据
   */
  getSummary(month?: string) {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    const qs = params.toString();
    return apiGet<BillSummary>(`${BASE}/summary${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取指定月份的账单日历数据。
   *
   * @param month 月份 YYYY-MM，默认当月
   * @param types 账单类型过滤，不传则返回全部
   * @returns 账单列表
   */
  getCalendar(month?: string, types?: BillType[]) {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (types && types.length > 0) params.set('types', types.join(','));
    const qs = params.toString();
    return apiGet<UnifiedBill[]>(`${BASE}/calendar${qs ? `?${qs}` : ''}`);
  },

  /**
   * 获取未来 N 天内即将到期的账单。
   *
   * @param days 天数，默认 7
   * @param types 账单类型过滤，不传则返回全部
   * @returns 即将到期的账单列表（不含已付）
   */
  getUpcoming(days?: number, types?: BillType[]) {
    const params = new URLSearchParams();
    if (days !== undefined) params.set('days', String(days));
    if (types && types.length > 0) params.set('types', types.join(','));
    const qs = params.toString();
    return apiGet<UnifiedBill[]>(`${BASE}/upcoming${qs ? `?${qs}` : ''}`);
  },

  /**
   * 按时间范围查询账单列表。
   *
   * @param startDate 开始日期 YYYY-MM-DD
   * @param endDate 结束日期 YYYY-MM-DD
   * @param types 账单类型过滤，不传则返回全部
   * @returns 账单列表
   */
  getList(startDate: string, endDate: string, types?: BillType[]) {
    const params = new URLSearchParams();
    params.set('start_date', startDate);
    params.set('end_date', endDate);
    if (types && types.length > 0) params.set('types', types.join(','));
    const qs = params.toString();
    return apiGet<UnifiedBill[]>(`${BASE}/list?${qs}`);
  },

  /**
   * 获取账单提醒设置。
   *
   * @returns 提醒设置
   */
  getSetting() {
    return apiGet<BillReminderSetting>(`${BASE}/setting`);
  },

  /**
   * 更新账单提醒设置。
   *
   * @param data 设置数据
   * @returns 更新后的设置
   */
  updateSetting(data: Partial<BillReminderSetting>) {
    return apiPatch<BillReminderSetting>(`${BASE}/setting`, data);
  },

  /**
   * 标记账单为已付。
   *
   * @param type 账单类型（目前仅支持 loan）
   * @param id 账单源 ID
   * @returns 操作结果
   */
  markPaid(type: BillType, id: string) {
    return apiPost<{ success: boolean }>(`${BASE}/${type}/${id}/mark-paid`, {});
  },
};
