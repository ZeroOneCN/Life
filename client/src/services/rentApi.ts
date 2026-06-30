import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  RentChannel,
  RentChannelBreakdownPoint,
  RentCostBreakdownPoint,
  RentHousingRecord,
  RentHousingRecordDraft,
  RentOverviewSummary,
  RentPageState,
  RentUtilityBill,
  RentUtilityBillDraft,
} from '../types/rent';

export const rentApi = {
  listRecords(params?: {
    page?: number;
    page_size?: number;
    userId?: string;
    keyword?: string;
    channelId?: string;
    occupancy?: 'all' | 'active' | 'ended';
  }) {
    return apiGet<PaginatedResponse<RentHousingRecord>>('/finance/rent/records', undefined, params as Record<string, unknown> | undefined);
  },

  createRecord(body: RentHousingRecordDraft) {
    return apiPost<RentHousingRecord, RentHousingRecordDraft>('/finance/rent/records', body);
  },

  updateRecord(recordId: string, body: Partial<RentHousingRecordDraft>) {
    return apiPatch<RentHousingRecord, Partial<RentHousingRecordDraft>>(`/finance/rent/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/finance/rent/records/${recordId}`);
  },

  listChannels(params?: { userId?: string }) {
    return apiGet<PaginatedResponse<RentChannel>>('/finance/rent/channels', undefined, params as Record<string, unknown> | undefined);
  },

  createChannel(body: { userId?: string; name: string }) {
    return apiPost<RentChannel, { userId?: string; name: string }>('/finance/rent/channels', body);
  },

  updateChannel(channelId: string, body: Partial<{ userId?: string; name: string }>) {
    return apiPatch<RentChannel, Partial<{ userId?: string; name: string }>>(`/finance/rent/channels/${channelId}`, body);
  },

  deleteChannel(channelId: string) {
    return apiDelete<{ ok: true }>(`/finance/rent/channels/${channelId}`);
  },

  getOverview(params?: { userId?: string }) {
    return apiGet<RentOverviewSummary>('/finance/rent/overview', undefined, params as Record<string, unknown> | undefined);
  },

  getCostBreakdown(params?: { userId?: string }) {
    return apiGet<RentCostBreakdownPoint[]>('/finance/rent/cost-breakdown', undefined, params as Record<string, unknown> | undefined);
  },

  getChannelBreakdown(params?: { userId?: string }) {
    return apiGet<RentChannelBreakdownPoint[]>('/finance/rent/channel-breakdown', undefined, params as Record<string, unknown> | undefined);
  },

  getSettings() {
    return apiGet<RentPageState['settings']>('/finance/rent/settings');
  },

  updateSettings(body: Partial<RentPageState['settings']>) {
    return apiPatch<RentPageState['settings'], Partial<RentPageState['settings']>>('/finance/rent/settings', body);
  },

  /** 查询月度水电燃气账单，不传 recordId 返回全部 */
  listUtilityBills(recordId?: string) {
    return apiGet<RentUtilityBill[]>('/finance/rent/utility-bills', undefined, recordId ? { recordId } : undefined);
  },

  /** 新增月度账单 */
  createUtilityBill(body: RentUtilityBillDraft) {
    return apiPost<RentUtilityBill, RentUtilityBillDraft>('/finance/rent/utility-bills', body);
  },

  /** 更新月度账单 */
  updateUtilityBill(billId: string, body: Partial<RentUtilityBillDraft>) {
    return apiPatch<RentUtilityBill, Partial<RentUtilityBillDraft>>(`/finance/rent/utility-bills/${billId}`, body);
  },

  /** 删除月度账单 */
  deleteUtilityBill(billId: string) {
    return apiDelete<{ ok: true }>(`/finance/rent/utility-bills/${billId}`);
  },
};
