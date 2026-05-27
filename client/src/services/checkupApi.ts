import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  CheckupInsight,
  CheckupOverviewSummary,
  CheckupPageState,
  CheckupRecord,
  CheckupRecordDraft,
  CheckupTemplate,
  CheckupTrendPoint,
} from '../types/checkup';

export const checkupApi = {
  listRecords(params?: { page?: number; page_size?: number; userId?: string; keyword?: string }) {
    return apiGet<PaginatedResponse<CheckupRecord>>('/health/checkup/records', undefined, params as Record<string, unknown> | undefined);
  },

  createRecord(body: CheckupRecordDraft) {
    return apiPost<CheckupRecord, CheckupRecordDraft>('/health/checkup/records', body);
  },

  updateRecord(recordId: string, body: Partial<CheckupRecordDraft>) {
    return apiPatch<CheckupRecord, Partial<CheckupRecordDraft>>(`/health/checkup/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/checkup/records/${recordId}`);
  },

  listTemplates() {
    return apiGet<PaginatedResponse<CheckupTemplate>>('/health/checkup/templates');
  },

  createTemplate(body: { userId?: string; name: string; testType: string; items: CheckupTemplate['items'] }) {
    return apiPost<CheckupTemplate, { userId?: string; name: string; testType: string; items: CheckupTemplate['items'] }>('/health/checkup/templates', body);
  },

  updateTemplate(templateId: string, body: Partial<{ userId?: string; name: string; testType: string; items: CheckupTemplate['items'] }>) {
    return apiPatch<CheckupTemplate, Partial<{ userId?: string; name: string; testType: string; items: CheckupTemplate['items'] }>>(`/health/checkup/templates/${templateId}`, body);
  },

  deleteTemplate(templateId: string) {
    return apiDelete<{ ok: true }>(`/health/checkup/templates/${templateId}`);
  },

  batchCreate(body: { userId?: string; templateId: string; testDate: string; followUpDate?: string; status?: string }) {
    return apiPost<CheckupRecord[], { userId?: string; templateId: string; testDate: string; followUpDate?: string; status?: string }>('/health/checkup/actions/batch-create', body);
  },

  getOverview(params?: { userId?: string }) {
    return apiGet<CheckupOverviewSummary>('/health/checkup/overview', undefined, params as Record<string, unknown> | undefined);
  },

  getTrend(params?: { userId?: string; testName?: string; startDate?: string; endDate?: string }) {
    return apiGet<CheckupTrendPoint[]>('/health/checkup/trend', undefined, params as Record<string, unknown> | undefined);
  },

  getInsights(params?: { userId?: string }) {
    return apiGet<CheckupInsight[]>('/health/checkup/insights', undefined, params as Record<string, unknown> | undefined);
  },

  getSettings() {
    return apiGet<CheckupPageState['settings']>('/health/checkup/settings');
  },

  updateSettings(body: Partial<CheckupPageState['settings']>) {
    return apiPatch<CheckupPageState['settings'], Partial<CheckupPageState['settings']>>('/health/checkup/settings', body);
  },

  triggerReminders(body?: { title?: string; message?: string }) {
    return apiPost<unknown[], { title?: string; message?: string }>('/health/checkup/actions/trigger-reminders', body ?? {});
  },
};
