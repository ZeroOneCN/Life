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
  /** 投资账户的展示币种（forex 账户为 USD） */
  currency: string;
  /** 将投资金额换算为人民币（reportCurrency）时使用的汇率 */
  exchangeRate: number;
  /** 汇率来源：exchangerate-api 实时 或 fallback 降级 */
  exchangeRateSource: 'exchangerate-api' | 'fallback';
  /** 汇率获取时间（ISO 字符串） */
  exchangeRateFetchedAt: string;
  /** 投资净值换算为人民币后的等值金额 */
  equityInReportCurrency: number;
  /** 净收益换算为人民币后的等值金额 */
  netPnlInReportCurrency: number;
}

export interface FinanceReportNetWorthSummary {
  /** 投资账户原币种净值（USD） */
  investmentEquity: number;
  /** 未还贷款（CNY） */
  unpaidLoanTotal: number;
  /** 净资产：投资净值按汇率换算为人民币后减去未还贷款（CNY） */
  netWorth: number;
  /** 报告统一币种（人民币 CNY） */
  reportCurrency: string;
  /** 投资原币种换算为报告币种使用的汇率 */
  exchangeRate: number;
  /** 汇率来源 */
  exchangeRateSource: 'exchangerate-api' | 'fallback';
  /** 汇率获取时间（ISO 字符串） */
  exchangeRateFetchedAt: string;
  /** 投资净值换算为人民币后的等值金额 */
  investmentEquityInReportCurrency: number;
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
