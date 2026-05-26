import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  LoanBill,
  LoanBillDraft,
  LoanMonthlyStats,
  LoanPlatform,
  LoanPlatformBreakdownPoint,
  LoanPlatformDraft,
  LoanRepayment,
  LoanRepaymentDraft,
  LoanOverviewSummary,
  LoanSettings,
  LoanTrendPoint,
} from '../types/loan';

export interface LoanBillListParams {
  page?: number;
  page_size?: number;
  platformId?: string;
  status?: 'all' | 'paid' | 'unpaid' | 'overdue';
  billingMonth?: string;
  dueStartDate?: string;
  dueEndDate?: string;
  keyword?: string;
}

export interface LoanRepaymentListParams {
  page?: number;
  page_size?: number;
  platformId?: string;
  repaymentStartDate?: string;
  repaymentEndDate?: string;
  keyword?: string;
}

export const loanApi = {
  listPlatforms(params?: { page?: number; page_size?: number }) {
    return apiGet<PaginatedResponse<LoanPlatform>>('/finance/loan/platforms', undefined, params as Record<string, unknown> | undefined);
  },

  createPlatform(body: LoanPlatformDraft) {
    return apiPost<LoanPlatform, LoanPlatformDraft>('/finance/loan/platforms', body);
  },

  updatePlatform(platformId: string, body: Partial<LoanPlatformDraft>) {
    return apiPatch<LoanPlatform, Partial<LoanPlatformDraft>>(`/finance/loan/platforms/${platformId}`, body);
  },

  deletePlatform(platformId: string) {
    return apiDelete<{ ok: true }>(`/finance/loan/platforms/${platformId}`);
  },

  listBills(params?: LoanBillListParams) {
    return apiGet<PaginatedResponse<LoanBill>>('/finance/loan/bills', undefined, params as Record<string, unknown> | undefined);
  },

  createBill(body: LoanBillDraft) {
    return apiPost<LoanBill, LoanBillDraft>('/finance/loan/bills', body);
  },

  updateBill(billId: string, body: Partial<LoanBillDraft>) {
    return apiPatch<LoanBill, Partial<LoanBillDraft>>(`/finance/loan/bills/${billId}`, body);
  },

  deleteBill(billId: string) {
    return apiDelete<{ ok: true }>(`/finance/loan/bills/${billId}`);
  },

  listRepayments(params?: LoanRepaymentListParams) {
    return apiGet<PaginatedResponse<LoanRepayment>>('/finance/loan/repayments', undefined, params as Record<string, unknown> | undefined);
  },

  createRepayment(body: LoanRepaymentDraft) {
    return apiPost<LoanRepayment, LoanRepaymentDraft>('/finance/loan/repayments', body);
  },

  updateRepayment(repaymentId: string, body: Partial<LoanRepaymentDraft>) {
    return apiPatch<LoanRepayment, Partial<LoanRepaymentDraft>>(`/finance/loan/repayments/${repaymentId}`, body);
  },

  deleteRepayment(repaymentId: string) {
    return apiDelete<{ ok: true }>(`/finance/loan/repayments/${repaymentId}`);
  },

  getOverview() {
    return apiGet<LoanOverviewSummary>('/finance/loan/overview');
  },

  getMonthlyStats(params?: { month?: string; platformId?: string }) {
    return apiGet<LoanMonthlyStats>('/finance/loan/monthly-stats', undefined, params as Record<string, unknown> | undefined);
  },

  getRepaymentTrend(params?: { startDate?: string; endDate?: string; platformId?: string }) {
    return apiGet<LoanTrendPoint[]>('/finance/loan/repayment-trend', undefined, params as Record<string, unknown> | undefined);
  },

  getPlatformBreakdown() {
    return apiGet<LoanPlatformBreakdownPoint[]>('/finance/loan/platform-breakdown');
  },

  getSettings() {
    return apiGet<LoanSettings>('/finance/loan/settings');
  },

  updateSettings(body: Partial<LoanSettings>) {
    return apiPatch<LoanSettings, Partial<LoanSettings>>('/finance/loan/settings', body);
  },

  markBillPaid(billId: string) {
    return apiPost<{ bill: LoanBill; createdRepayment: boolean }, { billId: string }>('/finance/loan/actions/mark-bill-paid', { billId });
  },

  triggerReminders(title?: string) {
    return apiPost('/finance/loan/actions/trigger-reminders', title ? { title } : {});
  },
};
