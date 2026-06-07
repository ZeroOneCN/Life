// ============================================
// 投资统计计算 (positions / dashboard summary)
// 纯函数，便于单测
// ============================================

import {
  type InvestmentCapitalFlow,
  type InvestmentDashboardSummary,
  type InvestmentMarket,
  type InvestmentPosition,
  type InvestmentTrade,
  PNL_BUCKETS_ORDER,
  getPnlBucket,
} from '../types/investment';
import { INVESTMENT_MARKET_CONFIG } from '../types/investment';

// 工具: 解析 YYYY-MM-DD HH:mm:ss
function parseDate(value: string): number {
  if (!value) return 0;
  const t = new Date(value.replace(' ', 'T')).getTime();
  return Number.isFinite(t) ? t : 0;
}

// 工具: 保留 N 位小数
export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// 工具: 格式化金额
export function formatInvestmentMoney(value: number, symbol: string, digits = 2): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

// 工具: 格式化百分比
export function formatInvestmentPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

// ============================================
// 持仓聚合: 同 symbol + 同 side 的开仓合并
// ============================================
export function buildPositions(trades: InvestmentTrade[]): InvestmentPosition[] {
  const config = INVESTMENT_MARKET_CONFIG;
  // 按 symbol + side 分组
  const groups = new Map<string, InvestmentTrade[]>();
  for (const trade of trades) {
    if (trade.status !== 'open') continue;
    const key = `${trade.symbol}|${trade.side}`;
    const list = groups.get(key) ?? [];
    list.push(trade);
    groups.set(key, list);
  }

  const positions: InvestmentPosition[] = [];
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
    // mock 当前价: 取最近一笔的 currentPrice, 否则用平均成本 + 随机波动
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
      market: sample.market,
      side: side as 'buy' | 'sell',
      quantity: round(totalQty, config[sample.market].quantityDecimals),
      avgCost: round(avgCost, config[sample.market].priceDecimals),
      totalCost: round(totalCost, 2),
      currentPrice: round(currentPrice, config[sample.market].priceDecimals),
      marketValue: round(marketValue, 2),
      unrealizedPnl: round(unrealizedPnl, 2),
      unrealizedPnlPercent: round(unrealizedPnlPercent, 2),
      openedAt: sorted[0].tradeDate,
      tradeIds: sorted.map((t) => t.id),
    });
  }

  return positions.sort((a, b) => b.marketValue - a.marketValue);
}

// ============================================
// Dashboard 汇总
// ============================================
export function buildDashboardSummary(
  trades: InvestmentTrade[],
  capitalFlows: InvestmentCapitalFlow[],
  market: InvestmentMarket,
): InvestmentDashboardSummary {
  const config = INVESTMENT_MARKET_CONFIG[market];

  // 出入金
  let totalDeposit = 0;
  let totalWithdrawal = 0;
  for (const flow of capitalFlows) {
    if (flow.flowType === 'deposit') totalDeposit += flow.amount;
    else totalWithdrawal += flow.amount;
  }
  const netCapital = totalDeposit - totalWithdrawal;

  // 交易统计
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

  // 平均持仓天数
  let avgHoldDays = 0;
  if (closedTrades.length > 0) {
    const totalDays = closedTrades.reduce((sum, t) => {
      const open = parseDate(t.tradeDate);
      const close = parseDate(t.closeDate ?? '');
      if (!open || !close) return sum;
      return sum + Math.max(0, (close - open) / (1000 * 60 * 60 * 24));
    }, 0);
    avgHoldDays = totalDays / closedTrades.length;
  }

  // 现金 = 净入金 - 持仓总成本
  const positionCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const cash = round(netCapital - positionCost, 2);

  // ROI = (realized + unrealized) / netCapital
  const roi = netCapital > 0
    ? ((realizedPnl + unrealizedPnl) / netCapital) * 100
    : 0;

  // 净值曲线: 按交易时间累加 P&L
  const sortedClosed = [...closedTrades].sort((a, b) =>
    parseDate(a.closeDate ?? a.tradeDate) - parseDate(b.closeDate ?? b.tradeDate),
  );
  const equityCurve: Array<{ date: string; value: number }> = [];
  let acc = 0;
  for (const t of sortedClosed) {
    acc += t.realizedPnl ?? 0;
    equityCurve.push({
      date: (t.closeDate ?? t.tradeDate).slice(0, 10),
      value: round(acc, 2),
    });
  }

  // 按 symbol 盈亏
  const symbolMap = new Map<string, { symbol: string; name: string; pnl: number; trades: number }>();
  for (const t of trades) {
    if (t.status !== 'closed') continue;
    const existing = symbolMap.get(t.symbol) ?? { symbol: t.symbol, name: t.name, pnl: 0, trades: 0 };
    existing.pnl += t.realizedPnl ?? 0;
    existing.trades += 1;
    symbolMap.set(t.symbol, existing);
  }
  const symbolPnl = Array.from(symbolMap.values()).sort((a, b) => b.pnl - a.pnl);

  // 按月份盈亏
  const monthMap = new Map<string, { month: string; pnl: number; trades: number }>();
  for (const t of closedTrades) {
    const dateStr = t.closeDate ?? t.tradeDate;
    const month = dateStr.slice(0, 7);
    const existing = monthMap.get(month) ?? { month, pnl: 0, trades: 0 };
    existing.pnl += t.realizedPnl ?? 0;
    existing.trades += 1;
    monthMap.set(month, existing);
  }
  const monthlyPnl = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // P&L 区间分布
  const bucketMap = new Map<string, { range: string; count: number; pnl: number }>();
  PNL_BUCKETS_ORDER.forEach((range) => bucketMap.set(range, { range, count: 0, pnl: 0 }));
  for (const t of closedTrades) {
    const pnl = t.realizedPnl ?? 0;
    const range = getPnlBucket(pnl);
    const existing = bucketMap.get(range) ?? { range, count: 0, pnl: 0 };
    existing.count += 1;
    existing.pnl += pnl;
    bucketMap.set(range, existing);
  }
  const pnlBuckets = PNL_BUCKETS_ORDER.map((range) => bucketMap.get(range)!);

  return {
    totalDeposit: round(totalDeposit, 2),
    totalWithdrawal: round(totalWithdrawal, 2),
    netCapital: round(netCapital, 2),
    cash,
    totalTrades: trades.length,
    openPositionsCount: positions.length,
    closedTradesCount: closedTrades.length,
    realizedPnl: round(realizedPnl, 2),
    unrealizedPnl: round(unrealizedPnl, 2),
    totalFees: round(totalFees, 2),
    winRate,
    profitFactor: profitFactor === Infinity ? 99.99 : round(profitFactor, 2),
    bestTradePnl: round(bestTradePnl, 2),
    worstTradePnl: round(worstTradePnl, 2),
    averageHoldDays: round(avgHoldDays, 1),
    roi: round(roi, 2),
    equityCurve,
    symbolPnl,
    monthlyPnl,
    pnlBuckets,
  };
}

// 工具: 给定开仓价、数量、建议平仓价、费用率，预估 P&L
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
