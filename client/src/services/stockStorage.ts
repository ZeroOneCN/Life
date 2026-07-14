// ============================================
// 股票/加密市场交易记录 - localStorage 持久化
// ============================================

import * as XLSX from 'xlsx';
import {
  type StockPlatform,
  type StockPlatformDraft,
  type StockTrade,
  type StockTradeDraft,
  genInvestmentId,
} from '../types/investment';

export type StockMarketType = 'hk-stock' | 'us-stock' | 'crypto';

const STORAGE_PREFIX = 'lifeos.stock';
const PLATFORMS_KEY = (market: StockMarketType) => `${STORAGE_PREFIX}.${market}.platforms`;
const TRADES_KEY = (market: StockMarketType) => `${STORAGE_PREFIX}.${market}.trades`;

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
// Platform CRUD
// ============================================
export function listPlatforms(market: StockMarketType): StockPlatform[] {
  return safeRead<StockPlatform>(PLATFORMS_KEY(market)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function getPlatformById(market: StockMarketType, id: string): StockPlatform | undefined {
  return listPlatforms(market).find((p) => p.id === id);
}

export function createPlatform(market: StockMarketType, draft: StockPlatformDraft): StockPlatform {
  const now = nowIso();
  const platform: StockPlatform = {
    id: genInvestmentId('p'),
    name: draft.name.trim(),
    brokerType: draft.brokerType,
    accountId: (draft.accountId ?? '').trim(),
    remark: (draft.remark ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  const items = listPlatforms(market);
  items.push(platform);
  safeWrite(PLATFORMS_KEY(market), items);
  return platform;
}

export function updatePlatform(
  market: StockMarketType,
  id: string,
  draft: Partial<StockPlatformDraft>,
): StockPlatform[] {
  const items = listPlatforms(market);
  const next = items.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      name: draft.name?.trim() ?? item.name,
      brokerType: draft.brokerType ?? item.brokerType,
      accountId: draft.accountId !== undefined ? draft.accountId.trim() : item.accountId,
      remark: draft.remark !== undefined ? draft.remark.trim() : item.remark,
      updatedAt: nowIso(),
    };
  });
  safeWrite(PLATFORMS_KEY(market), next);
  return next;
}

export function deletePlatform(market: StockMarketType, id: string): StockPlatform[] {
  const items = listPlatforms(market);
  const next = items.filter((item) => item.id !== id);
  safeWrite(PLATFORMS_KEY(market), next);
  return next;
}

// ============================================
// Trade CRUD
// ============================================
export function listTrades(market: StockMarketType): StockTrade[] {
  return safeRead<StockTrade>(TRADES_KEY(market)).sort((a, b) => {
    const dateCompare = b.tradeDate.localeCompare(a.tradeDate);
    if (dateCompare !== 0) return dateCompare;
    return b.tradeTime.localeCompare(a.tradeTime);
  });
}

export function getTradeById(market: StockMarketType, id: string): StockTrade | undefined {
  return listTrades(market).find((t) => t.id === id);
}

export function createTrade(market: StockMarketType, draft: StockTradeDraft): StockTrade {
  const now = nowIso();
  const platform = getPlatformById(market, draft.platformId);
  const trade: StockTrade = {
    id: genInvestmentId('st'),
    market: draft.market,
    platformId: draft.platformId,
    platformName: platform?.name ?? '',
    symbol: draft.symbol.trim().toUpperCase(),
    name: draft.name.trim() || draft.symbol.trim().toUpperCase(),
    side: draft.side,
    quantity: Math.max(0, Number(draft.quantity) || 0),
    price: Math.max(0, Number(draft.price) || 0),
    fee: Math.max(0, Number(draft.fee) || 0),
    tradeDate: draft.tradeDate,
    tradeTime: draft.tradeTime,
    status: draft.status ?? 'open',
    closePrice: draft.closePrice,
    closeDate: draft.closeDate,
    closeTime: draft.closeTime,
    closeFee: draft.closeFee,
    realizedPnl: draft.realizedPnl,
    currentPrice: draft.currentPrice,
    tags: (draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    remark: (draft.remark ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  const items = listTrades(market);
  items.unshift(trade);
  safeWrite(TRADES_KEY(market), items);
  return trade;
}

export function updateTrade(
  market: StockMarketType,
  id: string,
  patch: Partial<StockTradeDraft>,
): StockTrade[] {
  const items = listTrades(market);
  const next = items.map((item) => {
    if (item.id !== id) return item;
    const platform = patch.platformId ? getPlatformById(market, patch.platformId) : undefined;
    return {
      ...item,
      platformId: patch.platformId ?? item.platformId,
      platformName: platform?.name ?? item.platformName,
      symbol: patch.symbol?.trim().toUpperCase() ?? item.symbol,
      name: patch.name?.trim() ?? item.name,
      side: patch.side ?? item.side,
      quantity: patch.quantity !== undefined ? Math.max(0, Number(patch.quantity) || 0) : item.quantity,
      price: patch.price !== undefined ? Math.max(0, Number(patch.price) || 0) : item.price,
      fee: patch.fee !== undefined ? Math.max(0, Number(patch.fee) || 0) : item.fee,
      tradeDate: patch.tradeDate ?? item.tradeDate,
      tradeTime: patch.tradeTime ?? item.tradeTime,
      status: patch.status ?? item.status,
      closePrice: patch.closePrice !== undefined ? patch.closePrice : item.closePrice,
      closeDate: patch.closeDate ?? item.closeDate,
      closeTime: patch.closeTime ?? item.closeTime,
      closeFee: patch.closeFee !== undefined ? patch.closeFee : item.closeFee,
      realizedPnl: patch.realizedPnl !== undefined ? patch.realizedPnl : item.realizedPnl,
      currentPrice: patch.currentPrice !== undefined ? patch.currentPrice : item.currentPrice,
      tags: patch.tags ? patch.tags.map((tag) => tag.trim()).filter(Boolean) : item.tags,
      remark: patch.remark !== undefined ? patch.remark.trim() : item.remark,
      updatedAt: nowIso(),
    };
  });
  safeWrite(TRADES_KEY(market), next);
  return next;
}

export function deleteTrade(market: StockMarketType, id: string): StockTrade[] {
  const items = listTrades(market);
  const next = items.filter((item) => item.id !== id);
  safeWrite(TRADES_KEY(market), next);
  return next;
}

export function closeTrade(
  market: StockMarketType,
  id: string,
  closePrice: number,
  closeDate: string,
  closeTime: string,
  closeFee = 0,
): StockTrade[] {
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
    closeTime,
    closeFee,
    realizedPnl: Math.round(pnl * 100) / 100,
  });
}

export function reopenTrade(market: StockMarketType, id: string): StockTrade[] {
  return updateTrade(market, id, {
    status: 'open',
    closePrice: undefined,
    closeDate: undefined,
    closeTime: undefined,
    closeFee: undefined,
    realizedPnl: undefined,
  });
}

// ============================================
// Import/Export
// ============================================
export interface StockImportResult {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export function importTrades(
  market: StockMarketType,
  rows: Array<Record<string, unknown>>,
): StockImportResult {
  const platforms = listPlatforms(market);
  const existing = listTrades(market);
  const seen = new Set(existing.map((item) => [
    item.tradeDate,
    item.tradeTime,
    item.symbol,
    item.side,
    item.price,
    item.quantity,
  ].join('|')));

  let importedCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  rows.forEach((row) => {
    const tradeDate = String(row.tradeDate ?? row.date ?? '').trim();
    const tradeTime = String(row.tradeTime ?? row.time ?? '').trim();
    const symbol = String(row.symbol ?? row.code ?? row.stockCode ?? '').trim();
    const name = String(row.name ?? row.stockName ?? row.symbolName ?? '').trim();
    const sideStr = String(row.side ?? row.direction ?? row.orderType ?? '').trim().toLowerCase();
    const quantity = Number(row.quantity ?? row.shares ?? row.lots ?? row.amount ?? '');
    const price = Number(row.price ?? row.tradePrice ?? row.executionPrice ?? '');
    const fee = Number(row.fee ?? row.commission ?? row.fees ?? '');
    const platformName = String(row.platform ?? row.broker ?? row.account ?? '').trim();
    const remark = String(row.remark ?? row.note ?? row.comment ?? '').trim();

    const side = sideStr === 'sell' || sideStr === '卖出' || sideStr === '卖' ? 'sell' : 'buy';

    if (!tradeDate || !tradeTime || !symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      invalidCount += 1;
      return;
    }

    const key = [tradeDate, tradeTime, symbol.toUpperCase(), side, price, quantity].join('|');
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }

    let platformId = '';
    if (platformName) {
      const matched = platforms.find((p) => p.name.includes(platformName) || platformName.includes(p.name));
      if (!matched) {
        const newPlatform = createPlatform(market, {
          name: platformName,
          brokerType: platformName,
          remark: '自动导入创建',
        });
        platformId = newPlatform.id;
      } else {
        platformId = matched.id;
      }
    } else if (platforms.length > 0) {
      platformId = platforms[0].id;
    } else {
      invalidCount += 1;
      return;
    }

    seen.add(key);
    importedCount += 1;

    createTrade(market, {
      market,
      platformId,
      symbol,
      name: name || symbol,
      side,
      quantity,
      price,
      fee: Number.isFinite(fee) ? fee : 0,
      tradeDate,
      tradeTime,
      status: 'closed',
      remark,
    });
  });

  return {
    totalRows: rows.length,
    importedCount,
    duplicateCount,
    invalidCount,
  };
}

export function exportTrades(market: StockMarketType): Array<Record<string, unknown>> {
  const trades = listTrades(market);
  return trades.map((trade) => ({
    tradeDate: trade.tradeDate,
    tradeTime: trade.tradeTime,
    platform: trade.platformName,
    symbol: trade.symbol,
    name: trade.name,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    fee: trade.fee,
    status: trade.status,
    closePrice: trade.closePrice,
    closeDate: trade.closeDate,
    closeTime: trade.closeTime,
    closeFee: trade.closeFee,
    realizedPnl: trade.realizedPnl,
    tags: trade.tags.join(', '),
    remark: trade.remark,
  }));
}

export function getImportTemplate(): Array<Record<string, unknown>> {
  return [
    {
      tradeDate: '2024-01-15',
      tradeTime: '09:30:00',
      platform: '富途牛牛',
      symbol: 'AAPL',
      name: 'Apple',
      side: 'buy',
      quantity: 100,
      price: 180.50,
      fee: 5.42,
      status: 'closed',
      closePrice: 195.20,
      closeDate: '2024-02-20',
      closeTime: '14:15:00',
      closeFee: 5.86,
      realizedPnl: 1408.72,
      tags: '长线, 科技股',
      remark: '建仓',
    },
    {
      tradeDate: '2024-03-01',
      tradeTime: '10:00:00',
      platform: '老虎证券',
      symbol: '0700.HK',
      name: '腾讯控股',
      side: 'buy',
      quantity: 100,
      price: 380.00,
      fee: 11.40,
      status: 'open',
      closePrice: '',
      closeDate: '',
      closeTime: '',
      closeFee: '',
      realizedPnl: '',
      tags: '持仓中',
      remark: '回调买入',
    },
  ];
}

// ============================================
// Aliases for backward compatibility
// ============================================
export const listStockPlatforms = listPlatforms;
export const getStockPlatformById = getPlatformById;
export const createStockPlatform = createPlatform;
export const updateStockPlatform = updatePlatform;
export const deleteStockPlatform = deletePlatform;
export const listStockTrades = listTrades;
export const getStockTradeById = getTradeById;
export const createStockTrade = createTrade;
export const updateStockTrade = updateTrade;
export const deleteStockTrade = deleteTrade;
export const closeStockTrade = closeTrade;
export const reopenStockTrade = reopenTrade;

// ============================================
// Excel Import/Export helpers
// ============================================
export function downloadStockTradeTemplate(market: StockMarketType): void {
  const headers = [
    'tradeDate', 'tradeTime', 'platform', 'symbol', 'name',
    'side', 'quantity', 'price', 'fee', 'status',
    'closePrice', 'closeDate', 'closeTime', 'closeFee',
    'realizedPnl', 'tags', 'remark',
  ];
  const data = [
    headers,
    [
      '2024-01-15', '09:30:00', '富途牛牛', 'AAPL', 'Apple',
      'buy', 100, 180.50, 5.42, 'closed',
      195.20, '2024-02-20', '14:15:00', 5.86,
      1408.72, '长线, 科技股', '建仓',
    ],
    [
      '2024-03-01', '10:00:00', '老虎证券', '0700.HK', '腾讯控股',
      'buy', 100, 380.00, 11.40, 'open',
      '', '', '', '',
      '', '持仓中', '回调买入',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '交易记录');

  const fileName = market === 'hk-stock' ? '港股交易记录模板.xlsx' : '美股交易记录模板.xlsx';
  XLSX.writeFile(wb, fileName);
}

export interface ParsedTradeRow {
  status: 'new' | 'duplicate' | 'error';
  platformId?: string;
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  tradeDate: string;
  tradeTime: string;
  closePrice?: number;
  closeDate?: string;
  closeTime?: string;
  closeFee?: number;
  realizedPnl?: number;
  tags?: string[];
  remark?: string;
}

export async function importStockTrades(
  file: File,
  market: StockMarketType,
): Promise<ParsedTradeRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const platforms = listPlatforms(market);
  const existing = listTrades(market);
  const seen = new Set(existing.map((item) => [
    item.tradeDate,
    item.tradeTime,
    item.symbol,
    item.side,
    item.price,
    item.quantity,
  ].join('|')));

  const result: ParsedTradeRow[] = [];

  rows.forEach((row) => {
    const tradeDate = String(row.tradeDate ?? row.date ?? '').trim();
    const tradeTime = String(row.tradeTime ?? row.time ?? '').trim() || '00:00:00';
    const symbol = String(row.symbol ?? row.code ?? row.stockCode ?? '').trim();
    const name = String(row.name ?? row.stockName ?? row.symbolName ?? '').trim();
    const sideStr = String(row.side ?? row.direction ?? row.orderType ?? '').trim().toLowerCase();
    const quantity = Number(row.quantity ?? row.shares ?? row.lots ?? '');
    const price = Number(row.price ?? row.tradePrice ?? row.executionPrice ?? '');
    const fee = Number(row.fee ?? row.commission ?? row.fees ?? 0);
    const platformName = String(row.platform ?? row.broker ?? row.account ?? '').trim();
    const rowStatus = String(row.status ?? '').trim().toLowerCase();
    const remark = String(row.remark ?? row.note ?? row.comment ?? '').trim();
    const tagsStr = String(row.tags ?? '').trim();

    const side: 'buy' | 'sell' = sideStr === 'sell' || sideStr === '卖出' || sideStr === '卖' ? 'sell' : 'buy';
    const isClosed = rowStatus === 'closed' || rowStatus === '已平仓' || rowStatus === '平仓';

    if (!tradeDate || !symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      result.push({
        status: 'error',
        symbol: symbol || 'N/A',
        name: name || symbol || 'N/A',
        side,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        price: Number.isFinite(price) ? price : 0,
        fee: Number.isFinite(fee) ? fee : 0,
        tradeDate: tradeDate || 'N/A',
        tradeTime,
      });
      return;
    }

    const key = [tradeDate, tradeTime, symbol.toUpperCase(), side, price, quantity].join('|');
    if (seen.has(key)) {
      result.push({
        status: 'duplicate',
        symbol,
        name: name || symbol,
        side,
        quantity,
        price,
        fee: Number.isFinite(fee) ? fee : 0,
        tradeDate,
        tradeTime,
      });
      return;
    }

    let platformId = '';
    if (platformName) {
      const matched = platforms.find((p) => p.name.includes(platformName) || platformName.includes(p.name));
      if (!matched) {
        const newPlatform = createPlatform(market, {
          name: platformName,
          brokerType: platformName,
          remark: '自动导入创建',
        });
        platformId = newPlatform.id;
      } else {
        platformId = matched.id;
      }
    } else if (platforms.length > 0) {
      platformId = platforms[0].id;
    } else {
      result.push({
        status: 'error',
        symbol: symbol || 'N/A',
        name: name || symbol || 'N/A',
        side,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        price: Number.isFinite(price) ? price : 0,
        fee: Number.isFinite(fee) ? fee : 0,
        tradeDate: tradeDate || 'N/A',
        tradeTime,
      });
      return;
    }

    seen.add(key);

    const closePrice = isClosed ? Number(row.closePrice ?? '') : undefined;
    const closeDate = isClosed ? String(row.closeDate ?? '').trim() : undefined;
    const closeTime = isClosed ? String(row.closeTime ?? '').trim() || '00:00:00' : undefined;
    const closeFee = isClosed ? Number(row.closeFee ?? row.close_fee ?? 0) : undefined;

    result.push({
      status: 'new',
      platformId,
      symbol,
      name: name || symbol,
      side,
      quantity,
      price,
      fee: Number.isFinite(fee) ? fee : 0,
      tradeDate,
      tradeTime,
      ...(isClosed && closePrice !== undefined && Number.isFinite(closePrice) && closePrice > 0
        ? {
            closePrice,
            closeDate: closeDate || tradeDate,
            closeTime: closeTime || '00:00:00',
            closeFee: Number.isFinite(closeFee) ? closeFee : 0,
            realizedPnl: Number(row.realizedPnl ?? row.realized_pnl ?? row.pnl ?? ''),
          }
        : {}),
      tags: tagsStr ? tagsStr.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      remark,
    });
  });

  return result;
}

// ============================================
// Clear All (debug)
// ============================================
export function clearMarket(market: StockMarketType): void {
  safeWrite<StockPlatform>(PLATFORMS_KEY(market), []);
  safeWrite<StockTrade>(TRADES_KEY(market), []);
}