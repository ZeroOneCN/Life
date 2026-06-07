// ============================================
// 投资多市场实盘记录 - localStorage 持久化
// (单用户本地存储，后续可平滑迁移到后端)
// ============================================

import {
  type InvestmentCapitalFlow,
  type InvestmentCapitalFlowDraft,
  type InvestmentMarket,
  type InvestmentTrade,
  type InvestmentTradeDraft,
  INVESTMENT_MARKET_CONFIG,
  genInvestmentId,
} from '../types/investment';

const STORAGE_PREFIX = 'lifeos.investment';
const TRADES_KEY = (market: InvestmentMarket) => `${STORAGE_PREFIX}.${market}.trades`;
const CAPITAL_KEY = (market: InvestmentMarket) => `${STORAGE_PREFIX}.${market}.capital`;

function safeRead<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeWrite<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // quota or disabled — silently ignore
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

// ============================================
// Trade CRUD
// ============================================
export function listTrades(market: InvestmentMarket): InvestmentTrade[] {
  return safeRead<InvestmentTrade>(TRADES_KEY(market)).sort((a, b) =>
    b.tradeDate.localeCompare(a.tradeDate),
  );
}

export function createTrade(draft: InvestmentTradeDraft): InvestmentTrade {
  const now = nowIso();
  const trade: InvestmentTrade = {
    id: genInvestmentId('t'),
    market: draft.market,
    symbol: draft.symbol.trim().toUpperCase(),
    name: draft.name.trim() || draft.symbol.trim().toUpperCase(),
    side: draft.side,
    quantity: Math.max(0, Number(draft.quantity) || 0),
    price: Math.max(0, Number(draft.price) || 0),
    fee: Math.max(0, Number(draft.fee) || 0),
    tradeDate: draft.tradeDate,
    status: draft.status ?? 'open',
    currentPrice: draft.currentPrice,
    closePrice: draft.closePrice,
    closeDate: draft.closeDate,
    closeFee: draft.closeFee,
    realizedPnl: draft.realizedPnl,
    tags: (draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    remark: (draft.remark ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  const items = listTrades(draft.market);
  items.unshift(trade);
  safeWrite(TRADES_KEY(draft.market), items);
  return trade;
}

export function updateTrade(
  market: InvestmentMarket,
  id: string,
  patch: Partial<InvestmentTradeDraft>,
): InvestmentTrade[] {
  const items = listTrades(market);
  const next = items.map((item) => {
    if (item.id !== id) return item;
    const updated: InvestmentTrade = {
      ...item,
      symbol: patch.symbol?.trim().toUpperCase() ?? item.symbol,
      name: patch.name?.trim() ?? item.name,
      side: patch.side ?? item.side,
      quantity: patch.quantity !== undefined ? Math.max(0, Number(patch.quantity) || 0) : item.quantity,
      price: patch.price !== undefined ? Math.max(0, Number(patch.price) || 0) : item.price,
      fee: patch.fee !== undefined ? Math.max(0, Number(patch.fee) || 0) : item.fee,
      tradeDate: patch.tradeDate ?? item.tradeDate,
      status: patch.status ?? item.status,
      currentPrice: patch.currentPrice !== undefined ? patch.currentPrice : item.currentPrice,
      closePrice: patch.closePrice !== undefined ? patch.closePrice : item.closePrice,
      closeDate: patch.closeDate !== undefined ? patch.closeDate : item.closeDate,
      closeFee: patch.closeFee !== undefined ? patch.closeFee : item.closeFee,
      realizedPnl: patch.realizedPnl !== undefined ? patch.realizedPnl : item.realizedPnl,
      tags: patch.tags ? patch.tags.map((tag) => tag.trim()).filter(Boolean) : item.tags,
      remark: patch.remark !== undefined ? patch.remark.trim() : item.remark,
      updatedAt: nowIso(),
    };
    return updated;
  });
  safeWrite(TRADES_KEY(market), next);
  return next;
}

export function deleteTrade(market: InvestmentMarket, id: string): InvestmentTrade[] {
  const items = listTrades(market);
  const next = items.filter((item) => item.id !== id);
  safeWrite(TRADES_KEY(market), next);
  return next;
}

// 平仓 (快捷方法)
export function closeTrade(
  market: InvestmentMarket,
  id: string,
  closePrice: number,
  closeDate: string,
  closeFee = 0,
): InvestmentTrade[] {
  const items = listTrades(market);
  const target = items.find((item) => item.id === id);
  if (!target) return items;
  const pnl =
    target.side === 'buy'
      ? (closePrice - target.price) * target.quantity - target.fee - closeFee
      : (target.price - closePrice) * target.quantity - target.fee - closeFee;
  return updateTrade(market, id, {
    status: 'closed',
    closePrice,
    closeDate,
    closeFee,
    realizedPnl: pnl,
  });
}

// 重开 (反平仓)
export function reopenTrade(market: InvestmentMarket, id: string): InvestmentTrade[] {
  return updateTrade(market, id, {
    status: 'open',
    closePrice: undefined,
    closeDate: undefined,
    closeFee: undefined,
    realizedPnl: undefined,
  });
}

// 整体重置 (调试用)
export function clearMarket(market: InvestmentMarket): void {
  safeWrite<InvestmentTrade>(TRADES_KEY(market), []);
  safeWrite<InvestmentCapitalFlow>(CAPITAL_KEY(market), []);
}

// ============================================
// Capital Flow CRUD
// ============================================
export function listCapitalFlows(market: InvestmentMarket): InvestmentCapitalFlow[] {
  return safeRead<InvestmentCapitalFlow>(CAPITAL_KEY(market)).sort((a, b) =>
    b.flowDate.localeCompare(a.flowDate),
  );
}

export function createCapitalFlow(draft: InvestmentCapitalFlowDraft): InvestmentCapitalFlow {
  const now = nowIso();
  const flow: InvestmentCapitalFlow = {
    id: genInvestmentId('c'),
    market: draft.market,
    flowDate: draft.flowDate,
    flowType: draft.flowType,
    amount: Math.max(0, Number(draft.amount) || 0),
    remark: (draft.remark ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  const items = listCapitalFlows(draft.market);
  items.unshift(flow);
  safeWrite(CAPITAL_KEY(draft.market), items);
  return flow;
}

export function updateCapitalFlow(
  market: InvestmentMarket,
  id: string,
  patch: Partial<InvestmentCapitalFlowDraft>,
): InvestmentCapitalFlow[] {
  const items = listCapitalFlows(market);
  const next = items.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      flowDate: patch.flowDate ?? item.flowDate,
      flowType: patch.flowType ?? item.flowType,
      amount: patch.amount !== undefined ? Math.max(0, Number(patch.amount) || 0) : item.amount,
      remark: patch.remark !== undefined ? patch.remark.trim() : item.remark,
      updatedAt: nowIso(),
    };
  });
  safeWrite(CAPITAL_KEY(market), next);
  return next;
}

export function deleteCapitalFlow(market: InvestmentMarket, id: string): InvestmentCapitalFlow[] {
  const items = listCapitalFlows(market);
  const next = items.filter((item) => item.id !== id);
  safeWrite(CAPITAL_KEY(market), next);
  return next;
}

// ============================================
// 导入示例数据 (新用户引导)
// ============================================
export function seedSampleData(market: InvestmentMarket): { trades: number; flows: number } {
  const config = INVESTMENT_MARKET_CONFIG[market];
  const sample: InvestmentTradeDraft[] = [
    {
      market,
      symbol: config.defaultSymbols[0].symbol,
      name: config.defaultSymbols[0].name,
      side: 'buy',
      quantity: market === 'crypto' ? 0.5 : 100,
      price: config.defaultSymbols[0].mockPrice * 0.95,
      fee: 0,
      tradeDate: nowDateMinus(28),
      tags: ['建仓', '趋势'],
      remark: '首笔建仓',
    },
    {
      market,
      symbol: config.defaultSymbols[0].symbol,
      name: config.defaultSymbols[0].name,
      side: 'buy',
      quantity: market === 'crypto' ? 0.3 : 50,
      price: config.defaultSymbols[0].mockPrice * 0.92,
      fee: 0,
      tradeDate: nowDateMinus(14),
      tags: ['加仓'],
      remark: '回调加仓',
    },
    {
      market,
      symbol: config.defaultSymbols[0].symbol,
      name: config.defaultSymbols[0].name,
      side: 'sell',
      quantity: market === 'crypto' ? 0.3 : 50,
      price: config.defaultSymbols[0].mockPrice * 1.08,
      fee: 0,
      tradeDate: nowDateMinus(5),
      status: 'open',  // 用作模拟"未实现"浮盈
      currentPrice: config.defaultSymbols[0].mockPrice,
      tags: ['部分止盈'],
      remark: '部分仓位止盈',
    },
    {
      market,
      symbol: config.defaultSymbols[1].symbol,
      name: config.defaultSymbols[1].name,
      side: 'buy',
      quantity: market === 'crypto' ? 2 : 20,
      price: config.defaultSymbols[1].mockPrice * 0.98,
      fee: 0,
      tradeDate: nowDateMinus(20),
      tags: ['建仓'],
      remark: '尝试性建仓',
    },
    {
      market,
      symbol: config.defaultSymbols[1].symbol,
      name: config.defaultSymbols[1].name,
      side: 'sell',
      quantity: market === 'crypto' ? 2 : 20,
      price: config.defaultSymbols[1].mockPrice * 0.95,
      fee: 0,
      tradeDate: nowDateMinus(2),
      status: 'open',
      currentPrice: config.defaultSymbols[1].mockPrice,
      tags: ['止损', '复盘'],
      remark: '暂浮亏',
    },
  ];
  sample.forEach((draft) => createTrade(draft));

  // 出入金
  const flows: InvestmentCapitalFlowDraft[] = [
    { market, flowDate: nowDateMinus(35), flowType: 'deposit', amount: 10000, remark: '初始入金' },
    { market, flowDate: nowDateMinus(20), flowType: 'deposit', amount: 5000, remark: '加仓入金' },
  ];
  flows.forEach((draft) => createCapitalFlow(draft));

  return { trades: sample.length, flows: flows.length };
}

function nowDateMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}
