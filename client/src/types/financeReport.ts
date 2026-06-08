export type FinanceReportModuleKey = 'shopping' | 'travel' | 'loan' | 'subscription' | 'rent';

export interface FinanceReportModuleBreakdown {
  module: FinanceReportModuleKey;
  amount: number;
  count: number;
  percentage: number;
}

export interface FinanceReportCategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface FinanceReportTopExpense {
  module: FinanceReportModuleKey;
  title: string;
  date: string;
  amount: number;
  category?: string;
}

export interface FinanceMonthlyReport {
  month: string;
  startDate: string;
  endDate: string;
  totalExpense: number;
  previousMonthExpense: number;
  monthOverMonthChange: number;
  monthOverMonthChangePercent: number;
  lastYearSameMonthExpense: number;
  yearOverYearChange: number;
  yearOverYearChangePercent: number;
  moduleBreakdown: FinanceReportModuleBreakdown[];
  categoryBreakdown: FinanceReportCategoryBreakdown[];
  topExpenses: FinanceReportTopExpense[];
  generatedAt: string;
}

export interface FinanceYearlyReportMonth {
  month: string;
  total: number;
}

export interface FinanceYearlyReport {
  year: number;
  yearTotal: number;
  months: FinanceYearlyReportMonth[];
}
