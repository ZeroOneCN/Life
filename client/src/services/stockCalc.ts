// ============================================
// 股票交易统计计算
// ============================================

import {
  type StockDashboardSummary,
  type StockPosition,
  type StockTrade,
} from '../types/investment';

function parseDate(value: string): number {
  if (!value) return 0;
  const t = new Date(value.replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function formatMoney(value: number, symbol: string, digits = 2): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function buildPositions(trades: StockTrade[]): StockPosition[] {
  const groups = new Map<string, StockTrade[]>();
  for (const trade of trades) {
    if (trade.status !== 'open') continue;
    const key = `${trade.symbol}|${trade.side}`;
    const list = groups.get(key) ?? [];
    list.push(trade);
    groups.set(key, list);
  }

  const positions: StockPosition[] = [];
  for (const [key, list] of groups) {
    if (list.length === 0) continue;
    const sorted = [...list].sort((a, b) => parseDate(a.tradeDate) - parseDate(b.tradeDate));
    let totalQty = 0;
    let totalCost = 0;
    for (const t of sorted) {
      totalQty += t.quantity;
      totalCost += t.quantity * t.price + t.fee;
    }
    if (totalQty <= 0) continue;
    const avgCost = totalCost / totalQty;
    const sample = sorted[0];
    const latest = sorted[sorted.length - 1];
    const currentPrice =
      latest.currentPrice ??
      sorted.map((t) => t.currentPrice).find((p) => typeof p === 'number') ??
      avgCost;
    const marketValue = totalQty * currentPrice;
    const unrealizedPnl =
      sample.side === 'buy' ? marketValue - totalCost : totalCost - marketValue;
    const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

    const [symbol, side] = key.split('|');
    positions.push({
      symbol,
      name: sample.name,
      side: side as 'buy' | 'sell',
      quantity: round(totalQty, 0),
      avgCost: round(avgCost, 2),
      totalCost: round(totalCost, 2),
      currentPrice: round(currentPrice, 2),
      marketValue: round(marketValue, 2),
      unrealizedPnl: round(unrealizedPnl, 2),
      unrealizedPnlPercent: round(unrealizedPnlPercent, 2),
      openedAt: sorted[0].tradeDate,
      tradeIds: sorted.map((t) => t.id),
    });
  }

  return positions.sort((a, b) => b.marketValue - a.marketValue);
}

export function buildDashboardSummary(
  trades: StockTrade[],
): StockDashboardSummary {
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const positions = buildPositions(trades);

  const totalFees = trades.reduce((sum, t) => sum + t.fee + (t.closeFee ?? 0), 0);
  const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  const winCount = closedTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? winCount / closedTrades.length : 0;

  const totalWin = closedTrades.filter((t) => (t.realizedPnl ?? 0) > 0)
    .reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const totalLoss = Math.abs(
    closedTrades.filter((t) => (t.realizedPnl ?? 0) < 0)
      .reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0),
  );
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

  const bestTradePnl = closedTrades.length > 0
    ? Math.max(...closedTrades.map((t) => t.realizedPnl ?? 0))
    : 0;
  const worstTradePnl = closedTrades.length > 0
    ? Math.min(...closedTrades.map((t) => t.realizedPnl ?? 0))
    : 0;

  let avgHoldDays = 0;
  if (closedTrades.length > 0) {
    const totalDays = closedTrades.reduce((sum, t) => {
      const open = parseDate(`${t.tradeDate}T${t.tradeTime}`);
      const close = parseDate(`${t.closeDate ?? t.tradeDate}T${t.closeTime ?? t.tradeTime}`);
      if (!open || !close) return sum;
      return sum + Math.max(0, (close - open) / (1000 * 60 * 60 * 24));
    }, 0);
    avgHoldDays = totalDays / closedTrades.length;
  }

  const platformMap = new Map<string, { platformId: string; platformName: string; pnl: number; trades: number; fees: number }>();
  for (const t of trades) {
    if (t.status !== 'closed') continue;
    const existing = platformMap.get(t.platformId) ?? {
      platformId: t.platformId,
      platformName: t.platformName || '未知平台',
      pnl: 0,
      trades: 0,
      fees: 0,
    };
    existing.pnl += t.realizedPnl ?? 0;
    existing.trades += 1;
    existing.fees += t.fee + (t.closeFee ?? 0);
    platformMap.set(t.platformId, existing);
  }
  const platformPnl = Array.from(platformMap.values()).sort((a, b) => b.pnl - a.pnl);

  const symbolMap = new Map<string, { symbol: string; name: string; pnl: number; trades: number; fees: number }>();
  for (const t of trades) {
    if (t.status !== 'closed') continue;
    const existing = symbolMap.get(t.symbol) ?? { symbol: t.symbol, name: t.name, pnl: 0, trades: 0, fees: 0 };
    existing.pnl += t.realizedPnl ?? 0;
    existing.trades += 1;
    existing.fees += t.fee + (t.closeFee ?? 0);
    symbolMap.set(t.symbol, existing);
  }
  const symbolPnl = Array.from(symbolMap.values()).sort((a, b) => b.pnl - a.pnl);

  const monthMap = new Map<string, { month: string; pnl: number; trades: number; fees: number }>();
  for (const t of closedTrades) {
    const dateStr = t.closeDate ?? t.tradeDate;
    const month = dateStr.slice(0, 7);
    const existing = monthMap.get(month) ?? { month, pnl: 0, trades: 0, fees: 0 };
    existing.pnl += t.realizedPnl ?? 0;
    existing.trades += 1;
    existing.fees += t.fee + (t.closeFee ?? 0);
    monthMap.set(month, existing);
  }
  const monthlyPnl = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalTrades: trades.length,
    openPositionsCount: positions.length,
    closedTradesCount: closedTrades.length,
    realizedPnl: round(realizedPnl, 2),
    unrealizedPnl: round(unrealizedPnl, 2),
    totalFees: round(totalFees, 2),
    winRate: round(winRate * 100, 1),
    profitFactor: profitFactor === Infinity ? 99.99 : round(profitFactor, 2),
    bestTradePnl: round(bestTradePnl, 2),
    worstTradePnl: round(worstTradePnl, 2),
    averageHoldDays: round(avgHoldDays, 1),
    platformPnl: platformPnl.map((p) => ({ ...p, pnl: round(p.pnl, 2), fees: round(p.fees, 2) })),
    symbolPnl: symbolPnl.map((s) => ({ ...s, pnl: round(s.pnl, 2), fees: round(s.fees, 2) })),
    monthlyPnl: monthlyPnl.map((m) => ({ ...m, pnl: round(m.pnl, 2), fees: round(m.fees, 2) })),
    positions,
  };
}

export function estimatePnl(
  side: 'buy' | 'sell',
  openPrice: number,
  quantity: number,
  closePrice: number,
  openFee = 0,
  closeFee = 0,
): number {
  if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || quantity <= 0) return 0;
  const gross = side === 'buy'
    ? (closePrice - openPrice) * quantity
    : (openPrice - closePrice) * quantity;
  return round(gross - openFee - closeFee, 2);
}