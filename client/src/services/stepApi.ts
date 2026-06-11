import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  StepMonthCompareSummary,
  StepPageState,
  StepRecord,
  StepRecordDraft,
  StepAggregatePoint,
} from '../types/health';

export interface StepListParams {
  page?: number;
  page_size?: number;
  hour?: number | 'all';
  month?: string;
}

export interface StepSummary {
  totalRecords: number;
  todaySteps: number;
  todayDistanceKm: number;
  currentMonthSteps: number;
  currentMonthDistanceKm: number;
  strideLength: number;
}

export const stepApi = {
  listRecords(params?: StepListParams) {
    return apiGet<PaginatedResponse<StepRecord>>('/health/step/records', undefined, params as Record<string, unknown> | undefined);
  },

  createRecord(body: StepRecordDraft) {
    return apiPost<StepRecord, StepRecordDraft>('/health/step/records', body);
  },

  updateRecord(recordId: string, body: Partial<StepRecordDraft>) {
    return apiPatch<StepRecord, Partial<StepRecordDraft>>(`/health/step/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/step/records/${recordId}`);
  },

  getSummary(params?: { userId?: string }) {
    return apiGet<StepSummary>('/health/step/summary', undefined, params as Record<string, unknown> | undefined);
  },

  getTrend(params?: Record<string, unknown>) {
    return apiGet<StepAggregatePoint[]>('/health/step/trend', undefined, params as Record<string, unknown> | undefined);
  },

  getMonthCompare(params?: Record<string, unknown>) {
    return apiGet<StepMonthCompareSummary>('/health/step/month-compare', undefined, params as Record<string, unknown> | undefined);
  },

  getSettings() {
    return apiGet<StepPageState['settings']>('/health/step/settings');
  },

  updateSettings(body: Partial<StepPageState['settings']>) {
    return apiPatch<StepPageState['settings'], Partial<StepPageState['settings']>>('/health/step/settings', body);
  },
};
