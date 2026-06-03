export type ForexTab = 'dashboard' | 'trades' | 'calculator' | 'capital';

export type ForexInstrument = 'XAUUSD' | 'XAGUSD';

export type ForexOrderType = 'buy' | 'sell';

export type ForexCapitalFlowType = 'deposit' | 'withdrawal';

export interface ForexTradeRecord {
  id: string;
  tradeDate: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: number;
  lotSize: number;
  commission: number;
  closePrice: number;
  pnl: number;
  openTime: string;
  closeTime: string;
  holdTime: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForexTradeDraft {
  tradeDate: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: number;
  lotSize: number;
  commission?: number;
  closePrice: number;
  pnl?: number;
  openTime: string;
  closeTime: string;
  holdTime?: string;
  remark?: string;
}

export interface ForexCapitalFlow {
  id: string;
  flowDate: string;
  flowType: ForexCapitalFlowType;
  amount: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForexCapitalFlowDraft {
  flowDate: string;
  flowType: ForexCapitalFlowType;
  amount: number;
  remark?: string;
}

export interface ForexCalculatorPositionDraft {
  id: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: number;
  lotSize: number;
  closePrice?: number | null;
}

export interface ForexCalculationPositionResult {
  id: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: number;
  lotSize: number;
  contractValue: number;
  margin: number;
  pointValue: number;
  pnl: number | null;
  forcedLiquidationPrice: number;
}

export interface ForexCalculationResult {
  positions: ForexCalculationPositionResult[];
  accountSummary: {
    balance: number;
    leverage: number;
    forcedLiquidationRatio: number;
    totalContractValue: number;
    totalMargin: number;
    totalPnl: number;
    equityIfClosed: number;
    marginUsageRatio: number;
    remainingAvailableMargin: number;
    /** 账户级爆仓亏损（多仓位时按总保证金计算） */
    accountLiquidationLoss: number;
    /** 账户级爆仓净值（余额 - 爆仓亏损） */
    accountLiquidationEquity: number;
  };
}

export interface ForexDashboardSummary {
  tradeCount: number;
  grossPnl: number;
  totalCommission: number;
  realizedNetPnl: number;
  winRate: number;
  profitLossRatio: number;
  longCount: number;
  shortCount: number;
  xauCount: number;
  xagCount: number;
  totalDeposit: number;
  totalWithdrawal: number;
  netCapital: number;
  equity: number;
  roi: number;
}

export interface ForexDailyPnlPoint {
  date: string;
  netPnl: number;
  grossPnl: number;
  commission: number;
  tradeCount: number;
}

export interface ForexInstrumentSummary {
  instrument: ForexInstrument;
  tradeCount: number;
  grossPnl: number;
  totalCommission: number;
  netPnl: number;
  avgLotSize: number;
  winRate: number;
  longCount: number;
  shortCount: number;
}

export interface ForexInsight {
  id: string;
  tone: 'positive' | 'warning' | 'neutral';
  title: string;
  description: string;
  metric?: string;
}

export interface ForexImportInvalidRow {
  rowNumber: number;
  reason: string;
}

export interface ForexImportResult {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  importedRecords: ForexTradeRecord[];
  invalidRows: ForexImportInvalidRow[];
  nextTrades: ForexTradeRecord[];
}

export interface ForexPageState {
  trades: ForexTradeRecord[];
  capitalFlows: ForexCapitalFlow[];
  settings: {
    leverage: number;
    forcedLiquidationRatio: number;
    dashboardStartDate: string;
    dashboardEndDate: string;
  };
}
