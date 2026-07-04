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

export interface FinanceReportPushLog {
  id: string;
  channel: string;
  status: 'success' | 'skipped' | 'error';
  title: string;
  message: string;
  sceneId: string;
}

export interface FinanceReportPushResult {
  logs: FinanceReportPushLog[];
  report: FinanceMonthlyReport;
}

export interface FinanceReportInvestmentBreakdownItem {
  instrument: string;
  tradeCount: number;
  netPnl: number;
  commission: number;
  overnightFee: number;
}

export interface FinanceReportInvestmentSummary {
  netPnl: number;
  grossPnl: number;
  totalCommission: number;
  totalOvernightFee: number;
  tradeCount: number;
  deposits: number;
  withdrawals: number;
  netCapital: number;
  equity: number;
  roi: number;
  breakdown: FinanceReportInvestmentBreakdownItem[];
}

export interface FinanceReportNetWorthSummary {
  investmentEquity: number;
  unpaidLoanTotal: number;
  netWorth: number;
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
  investment: FinanceReportInvestmentSummary;
  netWorth: FinanceReportNetWorthSummary;
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
