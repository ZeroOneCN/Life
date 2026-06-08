import { apiGet, apiPost } from '../lib/api';
import type {
  FinanceMonthlyReport,
  FinanceYearlyReport,
} from '../types/financeReport';

export const financeReportApi = {
  getMonthly(month?: string) {
    return apiGet<FinanceMonthlyReport>('/finance/report/monthly', undefined, month ? { month } : undefined);
  },

  getYearly(year: number) {
    return apiGet<FinanceYearlyReport>('/finance/report/yearly', undefined, { year });
  },

  pushMonthly(month?: string, title?: string) {
    return apiPost<{ log: { id: string }; report: FinanceMonthlyReport }>(
      '/finance/report/notify',
      { month, title },
    );
  },
};
