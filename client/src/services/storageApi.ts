import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  StorageCostRankingPoint,
  StorageItemDraft,
  StorageItemRecord,
  StorageOverviewSummary,
  StoragePageSettings,
  StoragePurchaseTrendPoint,
} from '../types/storage';

export interface StorageListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: 'all' | 'active' | 'archived';
  source?: 'all' | 'manual' | 'shopping';
  purchaseStartDate?: string;
  purchaseEndDate?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
}

export const storageApi = {
  list(params: StorageListParams) {
    return apiGet<PaginatedResponse<StorageItemRecord>>('/life/storage/items', undefined, params as Record<string, unknown>);
  },

  create(body: StorageItemDraft) {
    return apiPost<StorageItemRecord, StorageItemDraft>('/life/storage/items', body);
  },

  update(itemId: string, body: Partial<StorageItemDraft>) {
    return apiPatch<StorageItemRecord, Partial<StorageItemDraft>>(`/life/storage/items/${itemId}`, body);
  },

  delete(itemId: string) {
    return apiDelete<{ ok: true }>(`/life/storage/items/${itemId}`);
  },

  getOverview() {
    return apiGet<StorageOverviewSummary>('/life/storage/overview');
  },

  getPurchaseTrend() {
    return apiGet<StoragePurchaseTrendPoint[]>('/life/storage/purchase-trend');
  },

  getCostRanking() {
    return apiGet<StorageCostRankingPoint[]>('/life/storage/cost-ranking');
  },

  getSettings() {
    return apiGet<StoragePageSettings>('/life/storage/settings');
  },

  updateSettings(body: Partial<StoragePageSettings>) {
    return apiPatch<StoragePageSettings, Partial<StoragePageSettings>>('/life/storage/settings', body);
  },

  archive(itemId: string, endDate?: string) {
    return apiPost<StorageItemRecord, { itemId: string; endDate?: string }>('/life/storage/actions/archive', { itemId, endDate });
  },

  restore(itemId: string) {
    return apiPost<StorageItemRecord, { itemId: string }>('/life/storage/actions/restore', { itemId });
  },

  importFromShopping(shoppingRecordIds: string[]) {
    return apiPost<{
      importedCount: number;
      duplicateCount: number;
      items: StorageItemRecord[];
    }, { shoppingRecordIds: string[] }>('/life/storage/actions/import-from-shopping', { shoppingRecordIds });
  },
};
