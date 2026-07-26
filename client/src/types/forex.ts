export type ForexTab = 'dashboard' | 'trades' | 'calculator' | 'capital';

export type ForexInstrument = 'XAUUSD' | 'XAGUSD';

export type ForexOrderType = 'buy' | 'sell';

/**
 * 出入金流水类型
 * - deposit: 入金（含真实入金与体验金入金，体验金入金通过 isBonus=true 标记）
 * - withdrawal: 出金（视为真实金钱转出）
 * - bonus_expired: 体验金失效（仅记录，不计入任何资金流）
 */
export type ForexCapitalFlowType = 'deposit' | 'withdrawal' | 'bonus_expired';

export interface ForexTradeRecord {
  id: string;
  positionId: string;
  tradeDate: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: number;
  lotSize: number;
  commission: number;
  closePrice: number;
  pnl: number;
  overnightFee: number;
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
  overnightFee?: number;
  openTime: string;
  closeTime: string;
  holdTime?: string;
  remark?: string;
  positionId?: string;
}

export interface ForexCapitalFlow {
  id: string;
  flowDate: string;
  flowType: ForexCapitalFlowType;
  amount: number;
  remark: string;
  /** 是否为体验金（体验金入金不计入净值，体验金出金视为真实出金） */
  isBonus: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForexCapitalFlowDraft {
  flowDate: string;
  flowType: ForexCapitalFlowType;
  amount: number;
  remark?: string;
  isBonus?: boolean;
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

export interface ForexCalculationGroupResult {
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  totalLotSize: number;
  weightedOpenPrice: number;
  forcedLiquidationPrice: number;
  totalMargin: number;
  contractValue: number;
}

export interface ForexCalculationResult {
  positions: ForexCalculationPositionResult[];
  groups: ForexCalculationGroupResult[];
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
  totalOvernightFee: number;
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
  overnightFee: number;
  tradeCount: number;
}

/** 收益曲线数据点：累计盈亏 + 当日盈亏 */
export interface ForexEquityPoint {
  date: string;
  equity: number;
  dailyPnl: number;
}

export interface ForexInstrumentSummary {
  instrument: ForexInstrument;
  tradeCount: number;
  grossPnl: number;
  totalCommission: number;
  totalOvernightFee: number;
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
