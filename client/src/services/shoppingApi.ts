import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  ShoppingImportResult,
  ShoppingLedger,
  ShoppingLedgerDraft,
  ShoppingLedgerSummaryPoint,
  ShoppingMonthlyTrendPoint,
  ShoppingOverviewSummary,
  ShoppingPageState,
  ShoppingPlatform,
  ShoppingPlatformBreakdownPoint,
  ShoppingRecord,
  ShoppingRecordDraft,
} from '../types/shopping';

export const shoppingApi = {
  listRecords(params?: { page?: number; page_size?: number; userId?: string; ledgerId?: string; keyword?: string }) {
    return apiGet<PaginatedResponse<ShoppingRecord>>('/finance/shopping/records', undefined, params as Record<string, unknown> | undefined);
  },

  createRecord(body: ShoppingRecordDraft) {
    return apiPost<ShoppingRecord, ShoppingRecordDraft>('/finance/shopping/records', body);
  },

  updateRecord(recordId: string, body: Partial<ShoppingRecordDraft>) {
    return apiPatch<ShoppingRecord, Partial<ShoppingRecordDraft>>(`/finance/shopping/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/finance/shopping/records/${recordId}`);
  },

  listLedgers() {
    return apiGet<PaginatedResponse<ShoppingLedger>>('/finance/shopping/ledgers');
  },

  createLedger(body: ShoppingLedgerDraft) {
    return apiPost<ShoppingLedger, ShoppingLedgerDraft>('/finance/shopping/ledgers', body);
  },

  updateLedger(ledgerId: string, body: Partial<ShoppingLedgerDraft>) {
    return apiPatch<ShoppingLedger, Partial<ShoppingLedgerDraft>>(`/finance/shopping/ledgers/${ledgerId}`, body);
  },

  deleteLedger(ledgerId: string) {
    return apiDelete<{ ok: true }>(`/finance/shopping/ledgers/${ledgerId}`);
  },

  listPlatforms() {
    return apiGet<PaginatedResponse<ShoppingPlatform>>('/finance/shopping/platforms');
  },

  createPlatform(body: { name: string; colorToken?: string | null; isBuiltIn?: boolean }) {
    return apiPost<ShoppingPlatform, { name: string; colorToken?: string | null; isBuiltIn?: boolean }>('/finance/shopping/platforms', body);
  },

  updatePlatform(platformId: string, body: Partial<{ name: string; colorToken?: string | null; isBuiltIn?: boolean }>) {
    return apiPatch<ShoppingPlatform, Partial<{ name: string; colorToken?: string | null; isBuiltIn?: boolean }>>(`/finance/shopping/platforms/${platformId}`, body);
  },

  deletePlatform(platformId: string) {
    return apiDelete<{ ok: true }>(`/finance/shopping/platforms/${platformId}`);
  },

  getOverview(params?: { userId?: string; ledgerId?: string }) {
    return apiGet<ShoppingOverviewSummary>('/finance/shopping/overview', undefined, params as Record<string, unknown> | undefined);
  },

  getMonthlyTrend(params?: { userId?: string; ledgerId?: string }) {
    return apiGet<ShoppingMonthlyTrendPoint[]>('/finance/shopping/monthly-trend', undefined, params as Record<string, unknown> | undefined);
  },

  getPlatformBreakdown(params?: { userId?: string; ledgerId?: string }) {
    return apiGet<ShoppingPlatformBreakdownPoint[]>('/finance/shopping/platform-breakdown', undefined, params as Record<string, unknown> | undefined);
  },

  getLedgerSummary(params?: { userId?: string }) {
    return apiGet<ShoppingLedgerSummaryPoint[]>('/finance/shopping/ledger-summary', undefined, params as Record<string, unknown> | undefined);
  },

  getSettings() {
    return apiGet<ShoppingPageState['settings']>('/finance/shopping/settings');
  },

  updateSettings(body: Partial<ShoppingPageState['settings']>) {
    return apiPatch<ShoppingPageState['settings'], Partial<ShoppingPageState['settings']>>('/finance/shopping/settings', body);
  },

  importRows(fileName: string, rows: Array<Record<string, unknown>>) {
    return apiPost<ShoppingImportResult, { fileName: string; rows: Array<Record<string, unknown>> }>('/finance/shopping/actions/import', {
      fileName,
      rows,
    });
  },
};
