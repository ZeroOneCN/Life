import { apiGet, apiPatch, apiPost, apiDelete } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  SubscriptionCategory,
  SubscriptionCategoryDraft,
  SubscriptionExpiryPoint,
  SubscriptionOverviewSummary,
  SubscriptionRecord,
  SubscriptionRecordDraft,
  SubscriptionReminderItem,
  SubscriptionCategoryBreakdownPoint,
} from '../types/subscription';

export interface SubscriptionListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  categoryId?: string;
  status?: 'all' | 'active' | 'upcoming' | 'expired';
  autoRenew?: 'all' | 'auto' | 'manual';
  expiryStartDate?: string;
  expiryEndDate?: string;
}

export interface SubscriptionSettings {
  recordsKeyword: string;
  recordsCategoryId: string;
  recordsStatus: 'all' | 'active' | 'upcoming' | 'expired';
  recordsAutoRenewFilter: 'all' | 'auto' | 'manual';
  recordsExpiryStartDate: string;
  recordsExpiryEndDate: string;
  dashboardRangeDays: 90 | 180 | 365;
  reminderEnabled: boolean;
  expiryDayReminderEnabled: boolean;
  leadDays: number;
  includeAutoRenewInReminders: boolean;
}

export const subscriptionApi = {
  listRecords(params: SubscriptionListParams) {
    return apiGet<PaginatedResponse<SubscriptionRecord>>('/finance/subscription/records', undefined, params as Record<string, unknown>);
  },

  createRecord(body: SubscriptionRecordDraft) {
    return apiPost<SubscriptionRecord, SubscriptionRecordDraft>('/finance/subscription/records', body);
  },

  updateRecord(recordId: string, body: Partial<SubscriptionRecordDraft>) {
    return apiPatch<SubscriptionRecord, Partial<SubscriptionRecordDraft>>(`/finance/subscription/records/${recordId}`, body);
  },

  deleteRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/finance/subscription/records/${recordId}`);
  },

  listCategories() {
    return apiGet<PaginatedResponse<SubscriptionCategory>>('/finance/subscription/categories');
  },

  createCategory(body: SubscriptionCategoryDraft) {
    return apiPost<SubscriptionCategory, SubscriptionCategoryDraft>('/finance/subscription/categories', body);
  },

  updateCategory(categoryId: string, body: Partial<SubscriptionCategoryDraft>) {
    return apiPatch<SubscriptionCategory, Partial<SubscriptionCategoryDraft>>(`/finance/subscription/categories/${categoryId}`, body);
  },

  deleteCategory(categoryId: string) {
    return apiDelete<{ ok: true }>(`/finance/subscription/categories/${categoryId}`);
  },

  getOverview() {
    return apiGet<SubscriptionOverviewSummary>('/finance/subscription/overview');
  },

  getCategoryBreakdown() {
    return apiGet<SubscriptionCategoryBreakdownPoint[]>('/finance/subscription/category-breakdown');
  },

  getExpiryTimeline() {
    return apiGet<SubscriptionExpiryPoint[]>('/finance/subscription/expiry-timeline');
  },

  getSettings() {
    return apiGet<SubscriptionSettings>('/finance/subscription/settings');
  },

  updateSettings(body: Partial<SubscriptionSettings>) {
    return apiPatch<SubscriptionSettings, Partial<SubscriptionSettings>>('/finance/subscription/settings', body);
  },

  getReminders() {
    return apiGet<SubscriptionReminderItem[]>('/finance/subscription/reminders');
  },

  triggerReminders(title?: string) {
    return apiPost('/finance/subscription/actions/trigger-reminders', title ? { title } : {});
  },
};
