import { apiGet, apiPost } from '../lib/api';
import type {
  FinanceMonthlyReport,
  FinanceYearlyReport,
  FinanceReportPushResult,
} from '../types/financeReport';

/** AI 财务月报摘要响应 */
export interface FinanceReportAiSummary {
  enabled: boolean;
  summary: string;
  suggestions: Array<{ category: string; title: string; detail: string }>;
  risks: string[];
  generatedAt?: string;
}

export const financeReportApi = {
  getMonthly(month?: string) {
    return apiGet<FinanceMonthlyReport>('/finance/report/monthly', undefined, month ? { month } : undefined);
  },

  getYearly(year: number) {
    return apiGet<FinanceYearlyReport>('/finance/report/yearly', undefined, { year });
  },

  pushMonthly(month?: string, title?: string) {
    return apiPost<FinanceReportPushResult>(
      '/finance/report/notify',
      { month, title },
    );
  },

  /** 生成 AI 财务月报摘要 */
  getAiSummary(month?: string) {
    return apiPost<FinanceReportAiSummary>(
      '/finance/report/ai-summary',
      { month },
    );
  },
};
