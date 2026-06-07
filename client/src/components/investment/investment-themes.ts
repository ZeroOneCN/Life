// ============================================
// Investment 市场主题配置 (前端原型 · Mock 数据)
// ============================================

export type InvestmentMarketId = 'crypto' | 'us-stock' | 'hk-stock';

export interface TickerPoint {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sparkline: number[];
  sector?: string;
}

export interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  positionCount: number;
  sectorCount: number;
  cash: number;
  /** 1D 净值曲线（7 个点） */
  equityCurve: number[];
}

export interface MoversBucket {
  title: string;
  icon: string;
  items: Array<Pick<TickerPoint, 'symbol' | 'name' | 'change' | 'changePercent'>>;
}

export interface AllocationSlice {
  label: string;
  value: number;
  color: string;
}

export interface AlertItem {
  type: 'earnings' | 'target' | 'stop' | 'dividend';
  date: string;
  symbol: string;
  name: string;
  detail: string;
}

export interface InvestmentTheme {
  id: InvestmentMarketId;
  name: string;
  tagline: string;
  currencySymbol: string;
  currencyCode: string;
  /** 上涨颜色 (中国/HK/Crypto 用红, US 用绿) */
  upColor: string;
  /** 下跌颜色 */
  downColor: string;
  /** 主品牌色 (用于 hero 强调) */
  accent: string;
  accentSoft: string;
  /** 市场状态信息 */
  marketSession: string;
  /** 模拟数据 */
  portfolio: PortfolioSummary;
  watchlist: TickerPoint[];
  allocation: AllocationSlice[];
  movers: MoversBucket[];
  alerts: AlertItem[];
  /** ticker tape 滚动数据 (≥12 条更流畅) */
  tape: TickerPoint[];
}

// 工具：从 12 个点生成 mock 火花线
const spark = (seed: number, base: number, vol = 0.04): number[] => {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < 12; i += 1) {
    const r = Math.sin((seed + 1) * (i + 1) * 1.37) * 0.5 + Math.cos((seed + 2) * i * 0.91) * 0.5;
    v = v * (1 + r * vol * 0.15);
    out.push(Number(v.toFixed(2)));
  }
  return out;
};

// ============================================
// Crypto 市场（24/7，红涨绿跌）
// ============================================
const cryptoTheme: InvestmentTheme = {
  id: 'crypto',
  name: '加密市场',
  tagline: '7×24 小时波动模拟盘',
  currencySymbol: 'USDT',
  currencyCode: 'USDT',
  upColor: '#ea2261',
  downColor: '#16a34a',
  accent: '#f59e0b',
  accentSoft: 'rgba(245, 158, 11, 0.16)',
  marketSession: '24/7 交易中',
  portfolio: {
    totalValue: 184523.42,
    dayChange: 3127.86,
    dayChangePercent: 1.72,
    totalReturn: 41230.55,
    totalReturnPercent: 28.78,
    positionCount: 8,
    sectorCount: 4,
    cash: 12500,
    equityCurve: spark(11, 100, 0.06),
  },
  tape: [
    { symbol: 'BTC', name: 'Bitcoin', price: 67423.18, change: 1204.32, changePercent: 1.82, sparkline: spark(1, 67000) },
    { symbol: 'ETH', name: 'Ethereum', price: 3482.55, change: -42.18, changePercent: -1.20, sparkline: spark(2, 3500) },
    { symbol: 'SOL', name: 'Solana', price: 168.42, change: 8.34, changePercent: 5.21, sparkline: spark(3, 160) },
    { symbol: 'BNB', name: 'BNB', price: 612.04, change: -3.88, changePercent: -0.63, sparkline: spark(4, 615) },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.1582, change: 0.0124, changePercent: 8.51, sparkline: spark(5, 0.15) },
    { symbol: 'XRP', name: 'XRP', price: 0.5234, change: -0.0182, changePercent: -3.36, sparkline: spark(6, 0.54) },
    { symbol: 'ADA', name: 'Cardano', price: 0.4421, change: 0.0204, changePercent: 4.84, sparkline: spark(7, 0.42) },
    { symbol: 'AVAX', name: 'Avalanche', price: 32.18, change: 1.45, changePercent: 4.72, sparkline: spark(8, 30) },
    { symbol: 'MATIC', name: 'Polygon', price: 0.6823, change: -0.0421, changePercent: -5.81, sparkline: spark(9, 0.71) },
    { symbol: 'DOT', name: 'Polkadot', price: 6.42, change: 0.18, changePercent: 2.88, sparkline: spark(10, 6.3) },
    { symbol: 'LINK', name: 'Chainlink', price: 14.82, change: 0.62, changePercent: 4.36, sparkline: spark(12, 14.2) },
    { symbol: 'UNI', name: 'Uniswap', price: 7.34, change: -0.21, changePercent: -2.78, sparkline: spark(13, 7.5) },
  ],
  watchlist: [
    { symbol: 'BTC', name: 'Bitcoin', price: 67423.18, change: 1204.32, changePercent: 1.82, sparkline: spark(1, 67000), sector: 'Layer 1' },
    { symbol: 'ETH', name: 'Ethereum', price: 3482.55, change: -42.18, changePercent: -1.20, sparkline: spark(2, 3500), sector: 'Layer 1' },
    { symbol: 'SOL', name: 'Solana', price: 168.42, change: 8.34, changePercent: 5.21, sparkline: spark(3, 160), sector: 'Layer 1' },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.1582, change: 0.0124, changePercent: 8.51, sparkline: spark(5, 0.15), sector: 'Meme' },
    { symbol: 'LINK', name: 'Chainlink', price: 14.82, change: 0.62, changePercent: 4.36, sparkline: spark(12, 14.2), sector: 'Oracle' },
    { symbol: 'AVAX', name: 'Avalanche', price: 32.18, change: 1.45, changePercent: 4.72, sparkline: spark(8, 30), sector: 'Layer 1' },
    { symbol: 'MATIC', name: 'Polygon', price: 0.6823, change: -0.0421, changePercent: -5.81, sparkline: spark(9, 0.71), sector: 'Layer 2' },
    { symbol: 'UNI', name: 'Uniswap', price: 7.34, change: -0.21, changePercent: -2.78, sparkline: spark(13, 7.5), sector: 'DeFi' },
  ],
  allocation: [
    { label: 'Layer 1', value: 62, color: '#f59e0b' },
    { label: 'DeFi', value: 18, color: '#ea2261' },
    { label: 'Layer 2', value: 12, color: '#533afd' },
    { label: 'Meme', value: 8, color: '#16a34a' },
  ],
  movers: [
    {
      title: '24h 涨幅榜',
      icon: '🚀',
      items: [
        { symbol: 'DOGE', name: 'Dogecoin', change: 0.0124, changePercent: 8.51 },
        { symbol: 'SOL', name: 'Solana', change: 8.34, changePercent: 5.21 },
        { symbol: 'ADA', name: 'Cardano', change: 0.0204, changePercent: 4.84 },
        { symbol: 'AVAX', name: 'Avalanche', change: 1.45, changePercent: 4.72 },
        { symbol: 'LINK', name: 'Chainlink', change: 0.62, changePercent: 4.36 },
      ],
    },
    {
      title: '24h 跌幅榜',
      icon: '📉',
      items: [
        { symbol: 'MATIC', name: 'Polygon', change: -0.0421, changePercent: -5.81 },
        { symbol: 'XRP', name: 'XRP', change: -0.0182, changePercent: -3.36 },
        { symbol: 'UNI', name: 'Uniswap', change: -0.21, changePercent: -2.78 },
        { symbol: 'ETH', name: 'Ethereum', change: -42.18, changePercent: -1.20 },
        { symbol: 'BNB', name: 'BNB', change: -3.88, changePercent: -0.63 },
      ],
    },
    {
      title: '资金异动',
      icon: '⚡',
      items: [
        { symbol: 'DOGE', name: 'Dogecoin', change: 0.0124, changePercent: 8.51 },
        { symbol: 'MATIC', name: 'Polygon', change: -0.0421, changePercent: -5.81 },
        { symbol: 'SOL', name: 'Solana', change: 8.34, changePercent: 5.21 },
        { symbol: 'XRP', name: 'XRP', change: -0.0182, changePercent: -3.36 },
        { symbol: 'ADA', name: 'Cardano', change: 0.0204, changePercent: 4.84 },
      ],
    },
  ],
  alerts: [
    { type: 'target', date: '2026-06-08', symbol: 'BTC', name: 'Bitcoin', detail: '目标价 ¥500,000 即将触发' },
    { type: 'stop', date: '2026-06-08', symbol: 'MATIC', name: 'Polygon', detail: '止损线 ¥4.80 提示' },
    { type: 'earnings', date: '2026-06-12', symbol: 'ETH', name: 'Ethereum', detail: 'EIP-7702 主网升级窗口' },
    { type: 'dividend', date: '2026-06-15', symbol: 'LINK', name: 'Chainlink', detail: 'Staking 收益快照日' },
  ],
};

// ============================================
// US Stock 市场（绿涨红跌）
// ============================================
const usTheme: InvestmentTheme = {
  id: 'us-stock',
  name: '美股市场',
  tagline: 'NYSE · NASDAQ 综合模拟盘',
  currencySymbol: '$',
  currencyCode: 'USD',
  upColor: '#16a34a',
  downColor: '#ea2261',
  accent: '#533afd',
  accentSoft: 'rgba(83, 58, 253, 0.14)',
  marketSession: '盘后 21:00 ET',
  portfolio: {
    totalValue: 1_284_532.18,
    dayChange: 12_482.6,
    dayChangePercent: 0.98,
    totalReturn: 218_432.5,
    totalReturnPercent: 20.48,
    positionCount: 12,
    sectorCount: 5,
    cash: 80_000,
    equityCurve: spark(101, 100, 0.04),
  },
  tape: [
    { symbol: 'AAPL', name: 'Apple', price: 224.18, change: 2.34, changePercent: 1.05, sparkline: spark(21, 222) },
    { symbol: 'MSFT', name: 'Microsoft', price: 432.62, change: -1.18, changePercent: -0.27, sparkline: spark(22, 433) },
    { symbol: 'NVDA', name: 'NVIDIA', price: 138.45, change: 4.82, changePercent: 3.61, sparkline: spark(23, 134) },
    { symbol: 'GOOGL', name: 'Alphabet', price: 178.32, change: 1.42, changePercent: 0.80, sparkline: spark(24, 177) },
    { symbol: 'AMZN', name: 'Amazon', price: 198.84, change: -0.62, changePercent: -0.31, sparkline: spark(25, 199) },
    { symbol: 'META', name: 'Meta', price: 568.21, change: 12.34, changePercent: 2.22, sparkline: spark(26, 555) },
    { symbol: 'TSLA', name: 'Tesla', price: 248.62, change: -8.42, changePercent: -3.28, sparkline: spark(27, 256) },
    { symbol: 'AMD', name: 'AMD', price: 162.18, change: 3.24, changePercent: 2.04, sparkline: spark(28, 159) },
    { symbol: 'NFLX', name: 'Netflix', price: 712.42, change: 5.18, changePercent: 0.73, sparkline: spark(29, 707) },
    { symbol: 'CRM', name: 'Salesforce', price: 318.62, change: -1.82, changePercent: -0.57, sparkline: spark(30, 320) },
    { symbol: 'ORCL', name: 'Oracle', price: 142.18, change: 0.84, changePercent: 0.59, sparkline: spark(31, 141) },
    { symbol: 'INTC', name: 'Intel', price: 32.18, change: -1.24, changePercent: -3.71, sparkline: spark(32, 33.4) },
  ],
  watchlist: [
    { symbol: 'AAPL', name: 'Apple', price: 224.18, change: 2.34, changePercent: 1.05, sparkline: spark(21, 222), sector: 'Tech' },
    { symbol: 'NVDA', name: 'NVIDIA', price: 138.45, change: 4.82, changePercent: 3.61, sparkline: spark(23, 134), sector: 'Semis' },
    { symbol: 'MSFT', name: 'Microsoft', price: 432.62, change: -1.18, changePercent: -0.27, sparkline: spark(22, 433), sector: 'Software' },
    { symbol: 'META', name: 'Meta', price: 568.21, change: 12.34, changePercent: 2.22, sparkline: spark(26, 555), sector: '互联网' },
    { symbol: 'TSLA', name: 'Tesla', price: 248.62, change: -8.42, changePercent: -3.28, sparkline: spark(27, 256), sector: 'Auto' },
    { symbol: 'AMD', name: 'AMD', price: 162.18, change: 3.24, changePercent: 2.04, sparkline: spark(28, 159), sector: 'Semis' },
    { symbol: 'GOOGL', name: 'Alphabet', price: 178.32, change: 1.42, changePercent: 0.80, sparkline: spark(24, 177), sector: '互联网' },
    { symbol: 'AMZN', name: 'Amazon', price: 198.84, change: -0.62, changePercent: -0.31, sparkline: spark(25, 199), sector: 'E-commerce' },
  ],
  allocation: [
    { label: '科技', value: 48, color: '#533afd' },
    { label: '半导体', value: 22, color: '#1eaedb' },
    { label: '互联网', value: 18, color: '#f59e0b' },
    { label: '汽车', value: 8, color: '#16a34a' },
    { label: '其他', value: 4, color: '#64748b' },
  ],
  movers: [
    {
      title: '盘后涨幅榜',
      icon: '🚀',
      items: [
        { symbol: 'NVDA', name: 'NVIDIA', change: 4.82, changePercent: 3.61 },
        { symbol: 'META', name: 'Meta', change: 12.34, changePercent: 2.22 },
        { symbol: 'AMD', name: 'AMD', change: 3.24, changePercent: 2.04 },
        { symbol: 'AAPL', name: 'Apple', change: 2.34, changePercent: 1.05 },
        { symbol: 'GOOGL', name: 'Alphabet', change: 1.42, changePercent: 0.80 },
      ],
    },
    {
      title: '盘后跌幅榜',
      icon: '📉',
      items: [
        { symbol: 'INTC', name: 'Intel', change: -1.24, changePercent: -3.71 },
        { symbol: 'TSLA', name: 'Tesla', change: -8.42, changePercent: -3.28 },
        { symbol: 'CRM', name: 'Salesforce', change: -1.82, changePercent: -0.57 },
        { symbol: 'AMZN', name: 'Amazon', change: -0.62, changePercent: -0.31 },
        { symbol: 'MSFT', name: 'Microsoft', change: -1.18, changePercent: -0.27 },
      ],
    },
    {
      title: '成交活跃',
      icon: '⚡',
      items: [
        { symbol: 'TSLA', name: 'Tesla', change: -8.42, changePercent: -3.28 },
        { symbol: 'NVDA', name: 'NVIDIA', change: 4.82, changePercent: 3.61 },
        { symbol: 'AAPL', name: 'Apple', change: 2.34, changePercent: 1.05 },
        { symbol: 'META', name: 'Meta', change: 12.34, changePercent: 2.22 },
        { symbol: 'AMD', name: 'AMD', change: 3.24, changePercent: 2.04 },
      ],
    },
  ],
  alerts: [
    { type: 'earnings', date: '2026-06-10', symbol: 'NVDA', name: 'NVIDIA', detail: '财报披露 · 市场预期 EPS $5.86' },
    { type: 'target', date: '2026-06-08', symbol: 'AAPL', name: 'Apple', detail: '目标价 $235 即将触发' },
    { type: 'dividend', date: '2026-06-15', symbol: 'MSFT', name: 'Microsoft', detail: '现金股息除净日 $0.83' },
    { type: 'stop', date: '2026-06-09', symbol: 'TSLA', name: 'Tesla', detail: '跟踪止损线 $242 提示' },
  ],
};

// ============================================
// HK Stock 市场（红涨绿跌，港股惯例）
// ============================================
const hkTheme: InvestmentTheme = {
  id: 'hk-stock',
  name: '港股市场',
  tagline: 'HKEX 主板模拟盘',
  currencySymbol: 'HK$',
  currencyCode: 'HKD',
  upColor: '#ea2261',
  downColor: '#16a34a',
  accent: '#dc2626',
  accentSoft: 'rgba(220, 38, 38, 0.14)',
  marketSession: '收盘 16:00 HKT',
  portfolio: {
    totalValue: 3_482_500,
    dayChange: -18_240,
    dayChangePercent: -0.52,
    totalReturn: 412_300,
    totalReturnPercent: 13.42,
    positionCount: 14,
    sectorCount: 6,
    cash: 220_000,
    equityCurve: spark(201, 100, 0.05),
  },
  tape: [
    { symbol: '0700.HK', name: '腾讯控股', price: 412.60, change: 6.20, changePercent: 1.53, sparkline: spark(41, 410) },
    { symbol: '9988.HK', name: '阿里巴巴', price: 88.45, change: -1.25, changePercent: -1.39, sparkline: spark(42, 89) },
    { symbol: '3690.HK', name: '美团', price: 142.80, change: 3.40, changePercent: 2.44, sparkline: spark(43, 139) },
    { symbol: '1810.HK', name: '小米集团', price: 48.62, change: 0.84, changePercent: 1.76, sparkline: spark(44, 48) },
    { symbol: '9618.HK', name: '京东集团', price: 132.40, change: -2.10, changePercent: -1.56, sparkline: spark(45, 134) },
    { symbol: '0941.HK', name: '中国移动', price: 78.20, change: 0.30, changePercent: 0.39, sparkline: spark(46, 78) },
    { symbol: '1299.HK', name: '友邦保险', price: 62.85, change: 0.95, changePercent: 1.53, sparkline: spark(47, 62) },
    { symbol: '0005.HK', name: '汇丰控股', price: 72.40, change: -0.60, changePercent: -0.82, sparkline: spark(48, 73) },
    { symbol: '0388.HK', name: '香港交易所', price: 348.20, change: 4.80, changePercent: 1.40, sparkline: spark(49, 343) },
    { symbol: '1398.HK', name: '工商银行', price: 5.18, change: 0.04, changePercent: 0.78, sparkline: spark(50, 5.14) },
    { symbol: '0883.HK', name: '中国海洋石油', price: 18.62, change: 0.18, changePercent: 0.98, sparkline: spark(51, 18.4) },
    { symbol: '2628.HK', name: '中国人寿', price: 14.32, change: -0.18, changePercent: -1.24, sparkline: spark(52, 14.5) },
  ],
  watchlist: [
    { symbol: '0700.HK', name: '腾讯控股', price: 412.60, change: 6.20, changePercent: 1.53, sparkline: spark(41, 410), sector: '互联网' },
    { symbol: '9988.HK', name: '阿里巴巴', price: 88.45, change: -1.25, changePercent: -1.39, sparkline: spark(42, 89), sector: '互联网' },
    { symbol: '3690.HK', name: '美团', price: 142.80, change: 3.40, changePercent: 2.44, sparkline: spark(43, 139), sector: '本地生活' },
    { symbol: '1810.HK', name: '小米集团', price: 48.62, change: 0.84, changePercent: 1.76, sparkline: spark(44, 48), sector: '硬件' },
    { symbol: '9618.HK', name: '京东集团', price: 132.40, change: -2.10, changePercent: -1.56, sparkline: spark(45, 134), sector: '电商' },
    { symbol: '0388.HK', name: '香港交易所', price: 348.20, change: 4.80, changePercent: 1.40, sparkline: spark(49, 343), sector: '金融' },
    { symbol: '1299.HK', name: '友邦保险', price: 62.85, change: 0.95, changePercent: 1.53, sparkline: spark(47, 62), sector: '保险' },
    { symbol: '0941.HK', name: '中国移动', price: 78.20, change: 0.30, changePercent: 0.39, sparkline: spark(46, 78), sector: '通信' },
  ],
  allocation: [
    { label: '互联网', value: 36, color: '#dc2626' },
    { label: '金融', value: 24, color: '#f59e0b' },
    { label: '消费', value: 16, color: '#ea2261' },
    { label: '科技', value: 14, color: '#533afd' },
    { label: '能源', value: 6, color: '#16a34a' },
    { label: '其他', value: 4, color: '#64748b' },
  ],
  movers: [
    {
      title: '今日涨幅',
      icon: '🚀',
      items: [
        { symbol: '3690.HK', name: '美团', change: 3.40, changePercent: 2.44 },
        { symbol: '1810.HK', name: '小米集团', change: 0.84, changePercent: 1.76 },
        { symbol: '0700.HK', name: '腾讯控股', change: 6.20, changePercent: 1.53 },
        { symbol: '1299.HK', name: '友邦保险', change: 0.95, changePercent: 1.53 },
        { symbol: '0388.HK', name: '香港交易所', change: 4.80, changePercent: 1.40 },
      ],
    },
    {
      title: '今日跌幅',
      icon: '📉',
      items: [
        { symbol: '9618.HK', name: '京东集团', change: -2.10, changePercent: -1.56 },
        { symbol: '9988.HK', name: '阿里巴巴', change: -1.25, changePercent: -1.39 },
        { symbol: '2628.HK', name: '中国人寿', change: -0.18, changePercent: -1.24 },
        { symbol: '0005.HK', name: '汇丰控股', change: -0.60, changePercent: -0.82 },
        { symbol: '1398.HK', name: '工商银行', change: 0.04, changePercent: 0.78 },
      ],
    },
    {
      title: '成交活跃',
      icon: '⚡',
      items: [
        { symbol: '0700.HK', name: '腾讯控股', change: 6.20, changePercent: 1.53 },
        { symbol: '9988.HK', name: '阿里巴巴', change: -1.25, changePercent: -1.39 },
        { symbol: '3690.HK', name: '美团', change: 3.40, changePercent: 2.44 },
        { symbol: '1810.HK', name: '小米集团', change: 0.84, changePercent: 1.76 },
        { symbol: '9618.HK', name: '京东集团', change: -2.10, changePercent: -1.56 },
      ],
    },
  ],
  alerts: [
    { type: 'earnings', date: '2026-06-10', symbol: '0700.HK', name: '腾讯控股', detail: 'Q1 业绩公告' },
    { type: 'dividend', date: '2026-06-12', symbol: '0941.HK', name: '中国移动', detail: '末期股息派发 HK$2.43' },
    { type: 'target', date: '2026-06-08', symbol: '3690.HK', name: '美团', detail: '目标价 HK$150 即将触发' },
    { type: 'stop', date: '2026-06-09', symbol: '9988.HK', name: '阿里巴巴', detail: '跟踪止损 HK$85 提示' },
  ],
};

export const INVESTMENT_THEMES: Record<InvestmentMarketId, InvestmentTheme> = {
  crypto: cryptoTheme,
  'us-stock': usTheme,
  'hk-stock': hkTheme,
};

export const INVESTMENT_ALERT_META: Record<AlertItem['type'], { label: string; tone: 'blue' | 'orange' | 'red' | 'green' }> = {
  earnings: { label: '财报', tone: 'blue' },
  target: { label: '目标价', tone: 'green' },
  stop: { label: '止损', tone: 'red' },
  dividend: { label: '股息', tone: 'orange' },
};
