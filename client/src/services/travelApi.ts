import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  TravelArchiveSuggestion,
  TravelBook,
  TravelBookDraft,
  TravelBreakdownPoint,
  TravelDailyTrendPoint,
  TravelExpenseDraft,
  TravelExpenseRecord,
  TravelImportResult,
  TravelLeaderboardItem,
  TravelPageState,
  TravelPayChannel,
  TravelReportData,
  TravelSummaryStats,
} from '../types/travel';

export interface TravelExportReportResult {
  format: 'json' | 'html';
  fileName: string;
  contentType: string;
  generatedAt: string;
  report: TravelReportData;
  html?: string;
}

export const travelApi = {
  listBooks(params?: { userId?: string }) {
    return apiGet<PaginatedResponse<TravelBook>>('/finance/travel/books', undefined, params as Record<string, unknown> | undefined);
  },

  createBook(body: TravelBookDraft) {
    return apiPost<TravelBook, TravelBookDraft>('/finance/travel/books', body);
  },

  updateBook(bookId: string, body: Partial<TravelBookDraft>) {
    return apiPatch<TravelBook, Partial<TravelBookDraft>>(`/finance/travel/books/${bookId}`, body);
  },

  deleteBook(bookId: string) {
    return apiDelete<{ ok: true }>(`/finance/travel/books/${bookId}`);
  },

  completeBook(bookId: string) {
    return apiPost<TravelBook, Record<string, never>>(`/finance/travel/books/${bookId}/complete`, {});
  },

  archiveBook(bookId: string) {
    return apiPost<TravelBook, Record<string, never>>(`/finance/travel/books/${bookId}/archive`, {});
  },

  getArchiveSuggestions() {
    return apiGet<TravelArchiveSuggestion[]>('/finance/travel/archive/suggestions');
  },

  listRecords(params?: { page?: number; page_size?: number; userId?: string; bookId?: string; keyword?: string }) {
    return apiGet<PaginatedResponse<TravelExpenseRecord>>('/finance/travel/records', undefined, params as Record<string, unknown> | undefined);
  },

  createRecord(body: TravelExpenseDraft) {
    return apiPost<TravelExpenseRecord, TravelExpenseDraft>('/finance/travel/records', body);
  },

  updateRecord(recordId: string, body: Partial<TravelExpenseDraft>) {
    return apiPatch<TravelExpenseRecord, Partial<TravelExpenseDraft>>(`/finance/travel/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/finance/travel/records/${recordId}`);
  },

  listPayChannels() {
    return apiGet<PaginatedResponse<TravelPayChannel>>('/finance/travel/pay-channels');
  },

  createPayChannel(body: { value: string; label: string }) {
    return apiPost<TravelPayChannel, { value: string; label: string }>('/finance/travel/pay-channels', body);
  },

  updatePayChannel(channelId: string, body: Partial<{ value: string; label: string }>) {
    return apiPatch<TravelPayChannel, Partial<{ value: string; label: string }>>(`/finance/travel/pay-channels/${channelId}`, body);
  },

  deletePayChannel(channelId: string) {
    return apiDelete<{ ok: true }>(`/finance/travel/pay-channels/${channelId}`);
  },

  getSummary(params?: { userId?: string; bookId?: string }) {
    return apiGet<TravelSummaryStats>('/finance/travel/summary', undefined, params as Record<string, unknown> | undefined);
  },

  getDailyTrend(params?: { userId?: string; bookId?: string }) {
    return apiGet<TravelDailyTrendPoint[]>('/finance/travel/daily-trend', undefined, params as Record<string, unknown> | undefined);
  },

  getCategoryBreakdown(params?: { userId?: string; bookId?: string }) {
    return apiGet<TravelBreakdownPoint[]>('/finance/travel/category-breakdown', undefined, params as Record<string, unknown> | undefined);
  },

  getPayChannelBreakdown(params?: { userId?: string; bookId?: string }) {
    return apiGet<TravelBreakdownPoint[]>('/finance/travel/pay-channel-breakdown', undefined, params as Record<string, unknown> | undefined);
  },

  getLeaderboard(params?: { userId?: string }) {
    return apiGet<TravelLeaderboardItem[]>('/finance/travel/leaderboard', undefined, params as Record<string, unknown> | undefined);
  },

  getReport(params: { userId?: string; bookId: string }) {
    return apiGet<TravelReportData>('/finance/travel/report', undefined, params as Record<string, unknown>);
  },

  getSettings() {
    return apiGet<TravelPageState['settings']>('/finance/travel/settings');
  },

  updateSettings(body: Partial<TravelPageState['settings']>) {
    return apiPatch<TravelPageState['settings'], Partial<TravelPageState['settings']>>('/finance/travel/settings', body);
  },

  importRows(fileName: string, rows: Array<Record<string, unknown>>) {
    return apiPost<TravelImportResult, { fileName: string; rows: Array<Record<string, unknown>> }>('/finance/travel/actions/import', {
      fileName,
      rows,
    });
  },

  exportReport(body: { userId?: string; bookId: string; format?: 'json' | 'html' }) {
    return apiPost<TravelExportReportResult, { userId?: string; bookId: string; format?: 'json' | 'html' }>('/finance/travel/actions/export-report', body);
  },
};
