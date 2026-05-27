import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  ForexCalculationResult,
  ForexCapitalFlow,
  ForexCapitalFlowDraft,
  ForexDailyPnlPoint,
  ForexDashboardSummary,
  ForexImportResult,
  ForexInsight,
  ForexInstrumentSummary,
  ForexPageState,
  ForexTradeDraft,
  ForexTradeRecord,
} from '../types/forex';

export const forexApi = {
  listTrades(params?: { page?: number; page_size?: number }) {
    return apiGet<PaginatedResponse<ForexTradeRecord>>('/investment/forex/trades', undefined, params as Record<string, unknown> | undefined);
  },

  createTrade(body: ForexTradeDraft) {
    return apiPost<ForexTradeRecord, ForexTradeDraft>('/investment/forex/trades', body);
  },

  updateTrade(tradeId: string, body: Partial<ForexTradeDraft>) {
    return apiPatch<ForexTradeRecord, Partial<ForexTradeDraft>>(`/investment/forex/trades/${tradeId}`, body);
  },

  deleteTrade(tradeId: string) {
    return apiDelete<{ ok: true }>(`/investment/forex/trades/${tradeId}`);
  },

  listCapitalFlows(params?: { page?: number; page_size?: number }) {
    return apiGet<PaginatedResponse<ForexCapitalFlow>>('/investment/forex/capital-flows', undefined, params as Record<string, unknown> | undefined);
  },

  createCapitalFlow(body: ForexCapitalFlowDraft) {
    return apiPost<ForexCapitalFlow, ForexCapitalFlowDraft>('/investment/forex/capital-flows', body);
  },

  updateCapitalFlow(flowId: string, body: Partial<ForexCapitalFlowDraft>) {
    return apiPatch<ForexCapitalFlow, Partial<ForexCapitalFlowDraft>>(`/investment/forex/capital-flows/${flowId}`, body);
  },

  deleteCapitalFlow(flowId: string) {
    return apiDelete<{ ok: true }>(`/investment/forex/capital-flows/${flowId}`);
  },

  getDashboardSummary() {
    return apiGet<ForexDashboardSummary>('/investment/forex/dashboard-summary');
  },

  getDailyPnlTrend() {
    return apiGet<ForexDailyPnlPoint[]>('/investment/forex/daily-pnl-trend');
  },

  getInstrumentSummary() {
    return apiGet<ForexInstrumentSummary[]>('/investment/forex/instrument-summary');
  },

  getInsights() {
    return apiGet<ForexInsight[]>('/investment/forex/insights');
  },

  getSettings() {
    return apiGet<ForexPageState['settings']>('/investment/forex/settings');
  },

  updateSettings(body: Partial<ForexPageState['settings']>) {
    return apiPatch<ForexPageState['settings'], Partial<ForexPageState['settings']>>('/investment/forex/settings', body);
  },

  calculate(body: {
    leverage: number;
    balance: number;
    forcedLiquidationRatio: number;
    positions: Array<{
      id: string;
      instrument: 'XAUUSD' | 'XAGUSD';
      orderType: 'buy' | 'sell';
      openPrice: number;
      lotSize: number;
      closePrice?: number | null;
    }>;
  }) {
    return apiPost<ForexCalculationResult, typeof body>('/investment/forex/calculator', body);
  },

  importRows(fileName: string, rows: Array<Record<string, unknown>>) {
    return apiPost<ForexImportResult, { fileName: string; rows: Array<Record<string, unknown>> }>('/investment/forex/actions/import', {
      fileName,
      rows,
    });
  },

  downloadTemplate() {
    return apiGet<{ fileName: string; headers: string[]; exampleRows: Array<Record<string, unknown>> }>('/investment/forex/actions/download-template');
  },
};
