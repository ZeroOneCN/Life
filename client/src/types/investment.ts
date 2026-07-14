// ============================================
// 投资多市场实盘交易记录类型
// (Crypto / US Stock / HK Stock 共用)
// ============================================

export type InvestmentMarket = 'crypto' | 'us-stock' | 'hk-stock';

export type InvestmentTab = 'dashboard' | 'positions' | 'trades' | 'capital';

export type InvestmentOrderSide = 'buy' | 'sell';

export type InvestmentPositionStatus = 'open' | 'closed';

export type InvestmentCapitalType = 'deposit' | 'withdrawal';

// 单笔交易记录
export interface InvestmentTrade {
  id: string;
  market: InvestmentMarket;
  symbol: string;             // e.g. "BTC" / "AAPL" / "0700.HK"
  name: string;               // e.g. "Bitcoin"
  side: InvestmentOrderSide;  // buy | sell
  quantity: number;           // 数量 (股 / 币 / 手)
  price: number;              // 成交价
  fee: number;                // 手续费 (>=0)
  tradeDate: string;          // YYYY-MM-DD HH:mm:ss
  status: InvestmentPositionStatus;
  // 持仓中：用 mock 当前价算浮盈
  currentPrice?: number;
  // 已平仓：保存平仓价与时间
  closePrice?: number;
  closeDate?: string;
  closeFee?: number;
  // 已平仓：已实现盈亏 = (平仓价-买入价)*数量 - 手续费
  realizedPnl?: number;
  // 标签 (entry reason / lesson learned)
  tags: string[];
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentTradeDraft {
  market: InvestmentMarket;
  symbol: string;
  name: string;
  side: InvestmentOrderSide;
  quantity: number;
  price: number;
  fee?: number;
  tradeDate: string;
  status?: InvestmentPositionStatus;
  currentPrice?: number;
  closePrice?: number;
  closeDate?: string;
  closeFee?: number;
  realizedPnl?: number;
  tags?: string[];
  remark?: string;
}

// 出入金
export interface InvestmentCapitalFlow {
  id: string;
  market: InvestmentMarket;
  flowDate: string;
  flowType: InvestmentCapitalType;
  amount: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentCapitalFlowDraft {
  market: InvestmentMarket;
  flowDate: string;
  flowType: InvestmentCapitalType;
  amount: number;
  remark?: string;
}

// 当前持仓聚合 (按 symbol + 同向)
export interface InvestmentPosition {
  symbol: string;
  name: string;
  market: InvestmentMarket;
  side: InvestmentOrderSide;
  quantity: number;
  avgCost: number;             // 加权平均成本
  totalCost: number;           // 总成本 (含费)
  currentPrice: number;        // 当前价 (取最近一笔的 currentPrice 或 mock)
  marketValue: number;         // 数量 * 当前价
  unrealizedPnl: number;       // 浮盈 (marketValue - totalCost for long; 反之 short)
  unrealizedPnlPercent: number;
  openedAt: string;            // 第一笔建仓时间
  tradeIds: string[];          // 组成该持仓的所有交易 id
}

// 看板聚合
export interface InvestmentDashboardSummary {
  totalDeposit: number;
  totalWithdrawal: number;
  netCapital: number;
  cash: number;                // 净入金 - 已用资金
  totalTrades: number;
  openPositionsCount: number;
  closedTradesCount: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFees: number;
  winRate: number;             // 0..1
  profitFactor: number;        // 盈利/亏损比
  bestTradePnl: number;
  worstTradePnl: number;
  averageHoldDays: number;
  roi: number;                 // (realized + unrealized) / netCapital
  // 净值曲线 (按交易时间累加)
  equityCurve: Array<{ date: string; value: number }>;
  // 按 symbol 的盈亏
  symbolPnl: Array<{ symbol: string; name: string; pnl: number; trades: number }>;
  // 按月份的盈亏
  monthlyPnl: Array<{ month: string; pnl: number; trades: number }>;
  // P&L 区间分布 (5 桶)
  pnlBuckets: Array<{ range: string; count: number; pnl: number }>;
}

// 市场主题配置 (单位、币种、默认 symbol 列表等)
export interface InvestmentMarketConfig {
  id: InvestmentMarket;
  name: string;
  shortName: string;
  currencySymbol: string;
  currencyCode: string;
  quantityUnit: string;        // "股" / "币" / "手"
  priceDecimals: number;
  quantityDecimals: number;
  feeRate: number;             // 默认手续费率 (Crypto 0.1%, Stock 0.03%)
  upColor: string;             // 涨色 (US 绿, HK/Crypto 红)
  downColor: string;
  accent: string;
  accentSoft: string;
  defaultSymbols: Array<{ symbol: string; name: string; mockPrice: number }>;
}

export const INVESTMENT_MARKET_CONFIG: Record<InvestmentMarket, InvestmentMarketConfig> = {
  crypto: {
    id: 'crypto',
    name: '加密市场',
    shortName: 'Crypto',
    currencySymbol: 'USDT',
    currencyCode: 'USDT',
    quantityUnit: '币',
    priceDecimals: 4,
    quantityDecimals: 6,
    feeRate: 0.001,
    upColor: '#16a34a',
    downColor: '#ea2261',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.14)',
    defaultSymbols: [],
  },
  'us-stock': {
    id: 'us-stock',
    name: '美股市场',
    shortName: 'US Stock',
    currencySymbol: '$',
    currencyCode: 'USD',
    quantityUnit: '股',
    priceDecimals: 2,
    quantityDecimals: 4,
    feeRate: 0.0003,
    upColor: '#16a34a',
    downColor: '#ea2261',
    accent: '#533afd',
    accentSoft: 'rgba(83, 58, 253, 0.14)',
    defaultSymbols: [],
  },
  'hk-stock': {
    id: 'hk-stock',
    name: '港股市场',
    shortName: 'HK Stock',
    currencySymbol: 'HK$',
    currencyCode: 'HKD',
    quantityUnit: '股',
    priceDecimals: 2,
    quantityDecimals: 0,
    feeRate: 0.001,
    upColor: '#ea2261',
    downColor: '#16a34a',
    accent: '#dc2626',
    accentSoft: 'rgba(220, 38, 38, 0.14)',
    defaultSymbols: [],
  },
};

// 工具: 生成 id
export function genInvestmentId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 工具: P&L 区间 (5 桶)
export function getPnlBucket(pnl: number): string {
  if (pnl <= -1000) return '<= -1000';
  if (pnl <= -100) return '-1000 ~ -100';
  if (pnl <= 0) return '-100 ~ 0';
  if (pnl <= 100) return '0 ~ 100';
  if (pnl <= 1000) return '100 ~ 1000';
  return '>= 1000';
}

export const PNL_BUCKETS_ORDER: string[] = [
  '<= -1000', '-1000 ~ -100', '-100 ~ 0', '0 ~ 100', '100 ~ 1000', '>= 1000',
];

// ============================================
// 股票市场专用类型 (港股/美股)
// ============================================

export type StockTradeStatus = 'open' | 'closed';

export type StockBrokerType = 'futubull' | 'tiger' | 'snowball' | 'ib' | 'other';

export const STOCK_BROKER_LABELS: Record<StockBrokerType, string> = {
  futubull: '富途牛牛',
  tiger: '老虎证券',
  snowball: '雪盈证券',
  ib: '盈透证券',
  other: '其他',
};

export interface StockPlatform {
  id: string;
  name: string;
  brokerType: StockBrokerType;
  accountId: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockPlatformDraft {
  name: string;
  brokerType: StockBrokerType;
  accountId?: string;
  remark?: string;
}

export interface StockTrade {
  id: string;
  market: 'hk-stock' | 'us-stock';
  platformId: string;
  platformName: string;
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  tradeDate: string;
  tradeTime: string;
  status: StockTradeStatus;
  closePrice?: number;
  closeDate?: string;
  closeTime?: string;
  closeFee?: number;
  realizedPnl?: number;
  currentPrice?: number;
  tags: string[];
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTradeDraft {
  market: 'hk-stock' | 'us-stock';
  platformId: string;
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee?: number;
  tradeDate: string;
  tradeTime: string;
  status?: StockTradeStatus;
  closePrice?: number;
  closeDate?: string;
  closeTime?: string;
  closeFee?: number;
  realizedPnl?: number;
  currentPrice?: number;
  tags?: string[];
  remark?: string;
}

export interface StockPosition {
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  avgCost: number;
  totalCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  openedAt: string;
  tradeIds: string[];
}

export interface StockPlatformPnl {
  platformId: string;
  platformName: string;
  pnl: number;
  trades: number;
  fees: number;
}

export interface StockSymbolPnl {
  symbol: string;
  name: string;
  pnl: number;
  trades: number;
  fees: number;
}

export interface StockMonthPnl {
  month: string;
  pnl: number;
  trades: number;
  fees: number;
}

export interface StockDashboardSummary {
  totalTrades: number;
  openPositionsCount: number;
  closedTradesCount: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalFees: number;
  winRate: number;
  profitFactor: number;
  bestTradePnl: number;
  worstTradePnl: number;
  averageHoldDays: number;
  platformPnl: StockPlatformPnl[];
  symbolPnl: StockSymbolPnl[];
  monthlyPnl: StockMonthPnl[];
  positions: StockPosition[];
}
