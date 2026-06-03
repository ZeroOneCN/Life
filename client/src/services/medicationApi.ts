import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  MedicationDailySummary,
  MedicationOverviewSummary,
  MedicationPageState,
  MedicationPurchaseDraft,
  MedicationPurchaseRecord,
  MedicationRecord,
  MedicationRecordDraft,
  MedicationStockInsight,
} from '../types/medication';

export interface MedicationThresholdRecord {
  id: string;
  medicineName: string;
  threshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationInsight {
  id: string;
  title: string;
  description: string;
  metric?: string;
  tone: string;
}

export const medicationApi = {
  listRecords(params?: { page?: number; page_size?: number; userId?: string }) {
    return apiGet<PaginatedResponse<MedicationRecord>>('/health/medication/records', undefined, params as Record<string, unknown> | undefined);
  },

  createRecord(body: MedicationRecordDraft) {
    return apiPost<MedicationRecord, MedicationRecordDraft>('/health/medication/records', body);
  },

  updateRecord(recordId: string, body: Partial<MedicationRecordDraft>) {
    return apiPatch<MedicationRecord, Partial<MedicationRecordDraft>>(`/health/medication/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/medication/records/${recordId}`);
  },

  listPurchases(params?: { page?: number; page_size?: number; userId?: string }) {
    return apiGet<PaginatedResponse<MedicationPurchaseRecord>>('/health/medication/purchases', undefined, params as Record<string, unknown> | undefined);
  },

  createPurchase(body: MedicationPurchaseDraft) {
    return apiPost<MedicationPurchaseRecord, MedicationPurchaseDraft>('/health/medication/purchases', body);
  },

  updatePurchase(purchaseId: string, body: Partial<MedicationPurchaseDraft>) {
    return apiPatch<MedicationPurchaseRecord, Partial<MedicationPurchaseDraft>>(`/health/medication/purchases/${purchaseId}`, body);
  },

  deletePurchase(purchaseId: string) {
    return apiDelete<{ ok: true }>(`/health/medication/purchases/${purchaseId}`);
  },

  listSummaries(params?: { userId?: string }) {
    return apiGet<PaginatedResponse<MedicationDailySummary>>('/health/medication/summaries', undefined, params as Record<string, unknown> | undefined);
  },

  createSummary(body: { userId?: string; date: string; content: string }) {
    return apiPost<MedicationDailySummary, { userId?: string; date: string; content: string }>('/health/medication/summaries', body);
  },

  updateSummary(summaryId: string, body: Partial<{ userId?: string; date: string; content: string }>) {
    return apiPatch<MedicationDailySummary, Partial<{ userId?: string; date: string; content: string }>>(`/health/medication/summaries/${summaryId}`, body);
  },

  deleteSummary(summaryId: string) {
    return apiDelete<{ ok: true }>(`/health/medication/summaries/${summaryId}`);
  },

  getOverview(params?: { userId?: string }) {
    return apiGet<MedicationOverviewSummary>('/health/medication/overview', undefined, params as Record<string, unknown> | undefined);
  },

  getInsights(params?: { userId?: string }) {
    return apiGet<MedicationInsight[]>('/health/medication/analysis', undefined, params as Record<string, unknown> | undefined);
  },

  getStock(params?: { userId?: string }) {
    return apiGet<MedicationStockInsight[]>('/health/medication/stock', undefined, params as Record<string, unknown> | undefined);
  },

  getSettings() {
    return apiGet<MedicationPageState['settings']>('/health/medication/settings');
  },

  updateSettings(body: Partial<MedicationPageState['settings']>) {
    return apiPatch<MedicationPageState['settings'], Partial<MedicationPageState['settings']>>('/health/medication/settings', body);
  },

  listThresholds() {
    return apiGet<PaginatedResponse<MedicationThresholdRecord>>('/health/medication/thresholds');
  },

  createThreshold(body: { medicineName: string; threshold: number }) {
    return apiPost<MedicationThresholdRecord, { medicineName: string; threshold: number }>('/health/medication/thresholds', body);
  },

  updateThreshold(thresholdId: string, body: Partial<{ medicineName: string; threshold: number }>) {
    return apiPatch<MedicationThresholdRecord, Partial<{ medicineName: string; threshold: number }>>(`/health/medication/thresholds/${thresholdId}`, body);
  },

  deleteThreshold(thresholdId: string) {
    return apiDelete<{ ok: true }>(`/health/medication/thresholds/${thresholdId}`);
  },

  triggerDoseReminder(body?: { title?: string; message?: string }) {
    return apiPost<unknown[], { title?: string; message?: string }>('/health/medication/actions/trigger-dose-reminder', body ?? {});
  },

  triggerStockReminder(body?: { title?: string; message?: string }) {
    return apiPost<unknown[], { title?: string; message?: string }>('/health/medication/actions/trigger-stock-reminder', body ?? {});
  },
};
