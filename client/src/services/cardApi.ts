import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  LifeCardBillDraft,
  LifeCardBillRecord,
  LifeCardCarrier,
  LifeCardCarrierDraft,
  LifeCardDraft,
  LifeCardImportResult,
  LifeCardOverviewSummary,
  LifeCardRechargeDraft,
  LifeCardRechargeRecord,
  LifeCardRecord,
  LifeCardCarrierBreakdownPoint,
  LifeCardMonthlyBillPoint,
  LifeCardRankingPoint,
} from '../types/card';

export interface CardListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  carrierId?: string;
  location?: string;
  minBalance?: number | string;
  maxBalance?: number | string;
}

export interface CardBillListParams {
  page?: number;
  page_size?: number;
  simId?: string;
  carrierName?: string;
  billingMonth?: string;
  keyword?: string;
}

export interface CardRechargeListParams {
  page?: number;
  page_size?: number;
  simId?: string;
  keyword?: string;
}

export interface CardSettingsPayload {
  balanceLowEnabled?: boolean;
  billingUpcomingEnabled?: boolean;
  autoDeductionEnabled?: boolean;
  balanceThreshold?: number;
  notificationDaysBefore?: number;
}

export interface CardSettingsResult {
  balanceLowEnabled: boolean;
  billingUpcomingEnabled: boolean;
  autoDeductionEnabled: boolean;
  balanceThreshold: number;
  notificationDaysBefore: number;
}

export interface AutoDeductDetail {
  simId: string;
  phoneNumber: string;
  carrierName: string;
  deductedAmount: number;
  remainingBalance: number;
  status: 'deducted' | 'skipped';
  reason?: string;
}

export interface AutoDeductResult {
  executedAt: string;
  billingMonth: string;
  billingDay: number;
  processedCount: number;
  deductedCount: number;
  totalDeducted: number;
  skippedAlreadyBilled: number;
  skippedNoFee: number;
  details: AutoDeductDetail[];
}

export interface CardImportRow {
  phoneNumber?: string;
  billingMonth?: string;
  monthlyFee?: number | string;
  actualFee?: number | string;
  extraCharges?: number | string;
  totalFee?: number | string;
  note?: string;
}

export const cardApi = {
  listCards(params: CardListParams) {
    return apiGet<PaginatedResponse<LifeCardRecord>>('/life/card/cards', undefined, params as Record<string, unknown>);
  },

  createCard(body: LifeCardDraft) {
    return apiPost<LifeCardRecord, LifeCardDraft>('/life/card/cards', body);
  },

  updateCard(cardId: string, body: Partial<LifeCardDraft>) {
    return apiPatch<LifeCardRecord, Partial<LifeCardDraft>>(`/life/card/cards/${cardId}`, body);
  },

  deleteCard(cardId: string) {
    return apiDelete<{ ok: true }>(`/life/card/cards/${cardId}`);
  },

  recharge(body: LifeCardRechargeDraft) {
    return apiPost<LifeCardRechargeRecord, LifeCardRechargeDraft>('/life/card/actions/recharge', body);
  },

  listBills(params: CardBillListParams) {
    return apiGet<PaginatedResponse<LifeCardBillRecord>>('/life/card/bills', undefined, params as Record<string, unknown>);
  },

  createBill(body: LifeCardBillDraft) {
    return apiPost<LifeCardBillRecord, LifeCardBillDraft>('/life/card/bills', body);
  },

  updateBill(billId: string, body: Partial<LifeCardBillDraft>) {
    return apiPatch<LifeCardBillRecord, Partial<LifeCardBillDraft>>(`/life/card/bills/${billId}`, body);
  },

  deleteBill(billId: string) {
    return apiDelete<{ ok: true }>(`/life/card/bills/${billId}`);
  },

  listRecharges(params: CardRechargeListParams) {
    return apiGet<PaginatedResponse<LifeCardRechargeRecord>>('/life/card/recharges', undefined, params as Record<string, unknown>);
  },

  deleteRecharge(rechargeId: string) {
    return apiDelete<{ ok: true }>(`/life/card/recharges/${rechargeId}`);
  },

  listCarriers() {
    return apiGet<PaginatedResponse<LifeCardCarrier>>('/life/card/carriers');
  },

  createCarrier(body: LifeCardCarrierDraft) {
    return apiPost<LifeCardCarrier, LifeCardCarrierDraft>('/life/card/carriers', body);
  },

  updateCarrier(carrierId: string, body: Partial<LifeCardCarrierDraft>) {
    return apiPatch<LifeCardCarrier, Partial<LifeCardCarrierDraft>>(`/life/card/carriers/${carrierId}`, body);
  },

  deleteCarrier(carrierId: string) {
    return apiDelete<{ ok: true }>(`/life/card/carriers/${carrierId}`);
  },

  getOverview() {
    return apiGet<LifeCardOverviewSummary>('/life/card/overview');
  },

  getMonthlyTrend() {
    return apiGet<LifeCardMonthlyBillPoint[]>('/life/card/monthly-trend');
  },

  getCarrierBreakdown() {
    return apiGet<LifeCardCarrierBreakdownPoint[]>('/life/card/carrier-breakdown');
  },

  getRanking() {
    return apiGet<LifeCardRankingPoint[]>('/life/card/ranking');
  },

  getSettings() {
    return apiGet<CardSettingsResult>('/life/card/settings');
  },

  updateSettings(body: CardSettingsPayload) {
    return apiPatch<CardSettingsResult, CardSettingsPayload>('/life/card/settings', body);
  },

  importBills(fileName: string, rows: CardImportRow[]) {
    return apiPost<LifeCardImportResult, { fileName: string; rows: CardImportRow[] }>('/life/card/actions/import-bills', {
      fileName,
      rows,
    });
  },

  triggerReminders(title?: string) {
    return apiPost('/life/card/actions/trigger-reminders', title ? { title } : {});
  },

  autoDeduct() {
    return apiPost<AutoDeductResult>('/life/card/actions/auto-deduct', {});
  },
};
