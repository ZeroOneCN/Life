import dayjs from 'dayjs';

import type {
  ForexCalculationResult,
  ForexCalculatorPositionDraft,
  ForexCapitalFlow,
  ForexCapitalFlowDraft,
  ForexCapitalFlowType,
  ForexDailyPnlPoint,
  ForexDashboardSummary,
  ForexImportInvalidRow,
  ForexImportResult,
  ForexInsight,
  ForexInstrument,
  ForexInstrumentSummary,
  ForexOrderType,
  ForexPageState,
  ForexTradeDraft,
  ForexTradeRecord,
} from '../types/forex';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '10:00';
const DEFAULT_REMARK = '';

export const FOREX_TRADE_PAGE_SIZE = 10;
export const FOREX_CAPITAL_PAGE_SIZE = 10;
export const FOREX_INSTRUMENT_OPTIONS: ForexInstrument[] = ['XAUUSD', 'XAGUSD'];
export const FOREX_ORDER_TYPE_OPTIONS: ForexOrderType[] = ['buy', 'sell'];
export const FOREX_CAPITAL_TYPE_OPTIONS: ForexCapitalFlowType[] = ['deposit', 'withdrawal'];
export const FOREX_STORAGE_KEY = 'lifeos_investment_forex_page';
export const FOREX_CONTRACT_UNITS: Record<ForexInstrument, number> = {
  XAUUSD: 100,
  XAGUSD: 5000,
};
export const FOREX_POINT_SIZES: Record<ForexInstrument, number> = {
  XAUUSD: 0.01,
  XAGUSD: 0.001,
};
export const FOREX_INSTRUMENT_COLORS: Record<ForexInstrument, string> = {
  XAUUSD: '#f59e0b',
  XAGUSD: '#5e6ad2',
};
export const FOREX_PNL_COLORS = ['#27a644', '#5e6ad2', '#f59e0b', '#e5484d'] as const;

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function toNumber(value: unknown, fallback = 0) {
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizeDate(value: unknown, fallback = dayjs().format(DATE_FORMAT)) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return fallback;
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

function parseTimeValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);

  if (
    !Number.isInteger(hours)
    || !Number.isInteger(minutes)
    || !Number.isInteger(seconds)
    || hours < 0
    || hours > 23
    || minutes < 0
    || minutes > 59
    || seconds < 0
    || seconds > 59
  ) {
    return null;
  }

  return { hours, minutes, seconds, hasSeconds: match[3] !== undefined };
}

export function normalizeForexTimeInput(value: string, fallback = '') {
  const parsed = parseTimeValue(value);

  if (!parsed) {
    return fallback;
  }

  const base = `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`;
  return parsed.hasSeconds ? `${base}:${String(parsed.seconds).padStart(2, '0')}` : base;
}

function normalizeTrimmedValue(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function sortTrades(records: ForexTradeRecord[]) {
  return [...records].sort((left, right) => {
    const leftMoment = dayjs(`${left.tradeDate}T${normalizeForexTimeInput(left.openTime, DEFAULT_START_TIME)}`);
    const rightMoment = dayjs(`${right.tradeDate}T${normalizeForexTimeInput(right.openTime, DEFAULT_START_TIME)}`);
    return rightMoment.valueOf() - leftMoment.valueOf();
  });
}

function sortCapitalFlows(records: ForexCapitalFlow[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.flowDate).valueOf() - dayjs(left.flowDate).valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

export function getForexInstrumentLabel(instrument: ForexInstrument) {
  return instrument === 'XAUUSD' ? 'XAUUSD 黄金' : 'XAGUSD 白银';
}

export function getForexOrderTypeLabel(orderType: ForexOrderType) {
  return orderType === 'buy' ? '做多' : '做空';
}

export function getForexCapitalTypeLabel(flowType: ForexCapitalFlowType) {
  return flowType === 'deposit' ? '入金' : '出金';
}

export function formatForexAmount(value: number) {
  return `${value >= 0 ? '+' : ''}${roundMoney(value).toFixed(2)}`;
}

export function formatForexMoney(value: number) {
  return roundMoney(value).toFixed(2);
}

export function formatForexPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function ensureInstrument(value: unknown): ForexInstrument {
  return String(value ?? '').toUpperCase() === 'XAGUSD' ? 'XAGUSD' : 'XAUUSD';
}

function ensureOrderType(value: unknown): ForexOrderType {
  return String(value ?? '').toLowerCase() === 'sell' ? 'sell' : 'buy';
}

function ensureCapitalType(value: unknown): ForexCapitalFlowType {
  return String(value ?? '').toLowerCase() === 'withdrawal' ? 'withdrawal' : 'deposit';
}

export function calculateForexCommission(lotSize: number) {
  if (!Number.isFinite(lotSize) || lotSize <= 0) {
    return 0;
  }

  return roundMoney(-6 * lotSize);
}

export function calculateForexTradePnl(
  instrument: ForexInstrument,
  orderType: ForexOrderType,
  openPrice: number,
  closePrice: number,
  lotSize: number,
) {
  if (
    !Number.isFinite(openPrice)
    || !Number.isFinite(closePrice)
    || !Number.isFinite(lotSize)
    || openPrice <= 0
    || closePrice <= 0
    || lotSize <= 0
  ) {
    return 0;
  }

  const diff = orderType === 'buy' ? closePrice - openPrice : openPrice - closePrice;
  return roundMoney(diff * lotSize * FOREX_CONTRACT_UNITS[instrument]);
}

function formatHoldTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0分钟';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const segments = [
    hours > 0 ? `${hours}小时` : '',
    minutes > 0 ? `${minutes}分钟` : '',
    remainingSeconds > 0 && hours === 0 ? `${remainingSeconds}秒` : '',
  ].filter(Boolean);

  return segments.join(' ') || '0分钟';
}

export function calculateForexHoldTime(openTime: string, closeTime: string) {
  const start = parseTimeValue(openTime);
  const end = parseTimeValue(closeTime);

  if (!start || !end) {
    return '';
  }

  const startSeconds = start.hours * 3600 + start.minutes * 60 + start.seconds;
  const endSeconds = end.hours * 3600 + end.minutes * 60 + end.seconds;
  const diff = endSeconds >= startSeconds ? endSeconds - startSeconds : (24 * 3600) - startSeconds + endSeconds;

  return formatHoldTime(diff);
}

function normalizeForexTrade(record: Partial<ForexTradeRecord>, index = 0): ForexTradeRecord {
  const tradeDate = normalizeDate(record.tradeDate, dayjs().subtract(index, 'day').format(DATE_FORMAT));
  const instrument = ensureInstrument(record.instrument);
  const orderType = ensureOrderType(record.orderType);
  const openPrice = roundMoney(toNumber(record.openPrice, instrument === 'XAUUSD' ? 2340 : 29.5));
  const closePrice = roundMoney(toNumber(record.closePrice, openPrice));
  const lotSize = Number(toNumber(record.lotSize, 0.01).toFixed(2));
  const commission = roundMoney(
    typeof record.commission === 'number'
      ? record.commission
      : calculateForexCommission(lotSize),
  );
  const pnl = roundMoney(
    typeof record.pnl === 'number'
      ? record.pnl
      : calculateForexTradePnl(instrument, orderType, openPrice, closePrice, lotSize),
  );
  const openTime = normalizeForexTimeInput(String(record.openTime ?? DEFAULT_START_TIME), DEFAULT_START_TIME);
  const closeTime = normalizeForexTimeInput(String(record.closeTime ?? DEFAULT_END_TIME), DEFAULT_END_TIME);
  const holdTime = normalizeTrimmedValue(record.holdTime, calculateForexHoldTime(openTime, closeTime));
  const createdAt = normalizeTimestamp(record.createdAt, tradeDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, tradeDate);

  return {
    id: record.id ?? buildId(),
    tradeDate,
    instrument,
    orderType,
    openPrice,
    lotSize,
    commission,
    closePrice,
    pnl,
    openTime,
    closeTime,
    holdTime,
    remark: normalizeTrimmedValue(record.remark, DEFAULT_REMARK),
    createdAt,
    updatedAt,
  };
}

function normalizeForexCapitalFlow(record: Partial<ForexCapitalFlow>, index = 0): ForexCapitalFlow {
  const flowDate = normalizeDate(record.flowDate, dayjs().subtract(index * 4, 'day').format(DATE_FORMAT));
  const createdAt = normalizeTimestamp(record.createdAt, flowDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, flowDate);

  return {
    id: record.id ?? buildId(),
    flowDate,
    flowType: ensureCapitalType(record.flowType),
    amount: roundMoney(Math.max(0, toNumber(record.amount, 0))),
    remark: normalizeTrimmedValue(record.remark),
    createdAt,
    updatedAt,
  };
}

function normalizeSettings(settings: Partial<ForexPageState['settings']> | undefined): ForexPageState['settings'] {
  const endDate = normalizeDate(settings?.dashboardEndDate, dayjs().format(DATE_FORMAT));
  const startDate = normalizeDate(settings?.dashboardStartDate, dayjs(endDate).subtract(29, 'day').format(DATE_FORMAT));

  return {
    leverage: Math.max(1, Math.round(toNumber(settings?.leverage, 500))),
    forcedLiquidationRatio: Math.min(1, Math.max(0.1, Number(toNumber(settings?.forcedLiquidationRatio, 0.5).toFixed(2)))),
    dashboardStartDate: startDate,
    dashboardEndDate: endDate,
  };
}

function createSampleTrades() {
  return sortTrades([
    normalizeForexTrade({
      id: 'forex-trade-1',
      tradeDate: dayjs().subtract(6, 'day').format(DATE_FORMAT),
      instrument: 'XAUUSD',
      orderType: 'buy',
      openPrice: 2338.2,
      closePrice: 2344.5,
      lotSize: 0.2,
      openTime: '09:20',
      closeTime: '12:05',
      remark: '欧盘前顺势多单',
    }),
    normalizeForexTrade({
      id: 'forex-trade-2',
      tradeDate: dayjs().subtract(5, 'day').format(DATE_FORMAT),
      instrument: 'XAGUSD',
      orderType: 'sell',
      openPrice: 30.18,
      closePrice: 29.96,
      lotSize: 0.04,
      openTime: '13:30',
      closeTime: '16:10',
      remark: '白银回落段',
    }),
    normalizeForexTrade({
      id: 'forex-trade-3',
      tradeDate: dayjs().subtract(3, 'day').format(DATE_FORMAT),
      instrument: 'XAUUSD',
      orderType: 'sell',
      openPrice: 2350.4,
      closePrice: 2354.2,
      lotSize: 0.1,
      openTime: '20:40',
      closeTime: '21:05',
      remark: '逆势空单止损',
    }),
    normalizeForexTrade({
      id: 'forex-trade-4',
      tradeDate: dayjs().subtract(1, 'day').format(DATE_FORMAT),
      instrument: 'XAUUSD',
      orderType: 'buy',
      openPrice: 2342.8,
      closePrice: 2348.1,
      lotSize: 0.15,
      openTime: '10:10',
      closeTime: '10:46',
      remark: '突破回踩确认',
    }),
  ]);
}

function createSampleCapitalFlows() {
  return sortCapitalFlows([
    normalizeForexCapitalFlow({
      id: 'forex-capital-1',
      flowDate: dayjs().subtract(20, 'day').format(DATE_FORMAT),
      flowType: 'deposit',
      amount: 5000,
      remark: '初始入金',
    }),
    normalizeForexCapitalFlow({
      id: 'forex-capital-2',
      flowDate: dayjs().subtract(8, 'day').format(DATE_FORMAT),
      flowType: 'deposit',
      amount: 1500,
      remark: '补充保证金',
    }),
    normalizeForexCapitalFlow({
      id: 'forex-capital-3',
      flowDate: dayjs().subtract(2, 'day').format(DATE_FORMAT),
      flowType: 'withdrawal',
      amount: 500,
      remark: '阶段性出金',
    }),
  ]);
}

export function buildInitialForexState(): ForexPageState {
  return {
    trades: createSampleTrades(),
    capitalFlows: createSampleCapitalFlows(),
    settings: normalizeSettings(undefined),
  };
}

export function normalizeForexPageState(state: Partial<ForexPageState> | undefined): ForexPageState {
  const trades = Array.isArray(state?.trades)
    ? sortTrades(state?.trades.map((record, index) => normalizeForexTrade(record, index)))
    : createSampleTrades();

  const capitalFlows = Array.isArray(state?.capitalFlows)
    ? sortCapitalFlows(state?.capitalFlows.map((record, index) => normalizeForexCapitalFlow(record, index)))
    : createSampleCapitalFlows();

  return {
    trades,
    capitalFlows,
    settings: normalizeSettings(state?.settings),
  };
}

export function createForexTrade(records: ForexTradeRecord[], draft: ForexTradeDraft) {
  const nextRecord = normalizeForexTrade({
    ...draft,
    id: buildId(),
    commission: draft.commission ?? calculateForexCommission(draft.lotSize),
    pnl: draft.pnl ?? calculateForexTradePnl(draft.instrument, draft.orderType, draft.openPrice, draft.closePrice, draft.lotSize),
    holdTime: draft.holdTime ?? calculateForexHoldTime(draft.openTime, draft.closeTime),
    createdAt: dayjs().format(DATE_TIME_FORMAT),
    updatedAt: dayjs().format(DATE_TIME_FORMAT),
  });

  return sortTrades([nextRecord, ...records]);
}

export function updateForexTrade(records: ForexTradeRecord[], tradeId: string, draft: ForexTradeDraft) {
  return sortTrades(records.map((record) => {
    if (record.id !== tradeId) {
      return record;
    }

    return normalizeForexTrade({
      ...record,
      ...draft,
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
      commission: draft.commission ?? calculateForexCommission(draft.lotSize),
      pnl: draft.pnl ?? calculateForexTradePnl(draft.instrument, draft.orderType, draft.openPrice, draft.closePrice, draft.lotSize),
      holdTime: draft.holdTime ?? calculateForexHoldTime(draft.openTime, draft.closeTime),
    });
  }));
}

export function deleteForexTrade(records: ForexTradeRecord[], tradeId: string) {
  return records.filter((record) => record.id !== tradeId);
}

export function createForexCapitalFlow(records: ForexCapitalFlow[], draft: ForexCapitalFlowDraft) {
  const nextRecord = normalizeForexCapitalFlow({
    ...draft,
    id: buildId(),
    createdAt: dayjs().format(DATE_TIME_FORMAT),
    updatedAt: dayjs().format(DATE_TIME_FORMAT),
  });

  return sortCapitalFlows([nextRecord, ...records]);
}

export function updateForexCapitalFlow(records: ForexCapitalFlow[], flowId: string, draft: ForexCapitalFlowDraft) {
  return sortCapitalFlows(records.map((record) => {
    if (record.id !== flowId) {
      return record;
    }

    return normalizeForexCapitalFlow({
      ...record,
      ...draft,
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    });
  }));
}

export function deleteForexCapitalFlow(records: ForexCapitalFlow[], flowId: string) {
  return records.filter((record) => record.id !== flowId);
}

export function filterForexTrades(
  records: ForexTradeRecord[],
  filters: {
    instrument?: string;
    orderType?: string;
    tradeDate?: string;
    keyword?: string;
  },
) {
  const keyword = (filters.keyword ?? '').trim().toLowerCase();

  return records
    .filter((record) => (!filters.instrument || record.instrument === filters.instrument))
    .filter((record) => (!filters.orderType || record.orderType === filters.orderType))
    .filter((record) => (!filters.tradeDate || record.tradeDate === filters.tradeDate))
    .filter((record) => {
      if (!keyword) {
        return true;
      }

      return [
        record.instrument,
        getForexOrderTypeLabel(record.orderType),
        record.remark,
        record.tradeDate,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
}

export function filterForexCapitalFlows(
  records: ForexCapitalFlow[],
  filters: {
    flowType?: string;
    flowDate?: string;
    keyword?: string;
  },
) {
  const keyword = (filters.keyword ?? '').trim().toLowerCase();

  return records
    .filter((record) => (!filters.flowType || record.flowType === filters.flowType))
    .filter((record) => (!filters.flowDate || record.flowDate === filters.flowDate))
    .filter((record) => {
      if (!keyword) {
        return true;
      }

      return [
        getForexCapitalTypeLabel(record.flowType),
        record.remark,
        record.flowDate,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
}

function filterTradesByDateRange(trades: ForexTradeRecord[], startDate?: string, endDate?: string) {
  return trades
    .filter((record) => (!startDate || !dayjs(record.tradeDate).isBefore(startDate, 'day')))
    .filter((record) => (!endDate || !dayjs(record.tradeDate).isAfter(endDate, 'day')));
}

function filterCapitalByDateRange(capitalFlows: ForexCapitalFlow[], startDate?: string, endDate?: string) {
  return capitalFlows
    .filter((record) => (!startDate || !dayjs(record.flowDate).isBefore(startDate, 'day')))
    .filter((record) => (!endDate || !dayjs(record.flowDate).isAfter(endDate, 'day')));
}

export function buildForexDashboardSummary(
  trades: ForexTradeRecord[],
  capitalFlows: ForexCapitalFlow[],
  startDate?: string,
  endDate?: string,
): ForexDashboardSummary {
  const scopedTrades = filterTradesByDateRange(trades, startDate, endDate);
  const scopedCapital = filterCapitalByDateRange(capitalFlows, startDate, endDate);
  const winners = scopedTrades.filter((trade) => trade.pnl > 0);
  const losers = scopedTrades.filter((trade) => trade.pnl < 0);
  const positiveGross = winners.reduce((sum, trade) => sum + trade.pnl, 0);
  const negativeGross = Math.abs(losers.reduce((sum, trade) => sum + trade.pnl, 0));
  const grossPnl = roundMoney(scopedTrades.reduce((sum, trade) => sum + trade.pnl, 0));
  const totalCommission = roundMoney(scopedTrades.reduce((sum, trade) => sum + trade.commission, 0));
  const realizedNetPnl = roundMoney(grossPnl + totalCommission);
  const totalDeposit = roundMoney(scopedCapital.filter((flow) => flow.flowType === 'deposit').reduce((sum, flow) => sum + flow.amount, 0));
  const totalWithdrawal = roundMoney(scopedCapital.filter((flow) => flow.flowType === 'withdrawal').reduce((sum, flow) => sum + flow.amount, 0));
  const netCapital = roundMoney(totalDeposit - totalWithdrawal);
  const equity = roundMoney(netCapital + realizedNetPnl);

  return {
    tradeCount: scopedTrades.length,
    grossPnl,
    totalCommission,
    realizedNetPnl,
    winRate: scopedTrades.length ? winners.length / scopedTrades.length : 0,
    profitLossRatio: negativeGross > 0 ? positiveGross / negativeGross : positiveGross > 0 ? positiveGross : 0,
    longCount: scopedTrades.filter((trade) => trade.orderType === 'buy').length,
    shortCount: scopedTrades.filter((trade) => trade.orderType === 'sell').length,
    xauCount: scopedTrades.filter((trade) => trade.instrument === 'XAUUSD').length,
    xagCount: scopedTrades.filter((trade) => trade.instrument === 'XAGUSD').length,
    totalDeposit,
    totalWithdrawal,
    netCapital,
    equity,
    roi: netCapital > 0 ? realizedNetPnl / netCapital : 0,
  };
}

export function buildForexDailyPnlTrend(
  trades: ForexTradeRecord[],
  startDate?: string,
  endDate?: string,
): ForexDailyPnlPoint[] {
  const scopedTrades = filterTradesByDateRange(trades, startDate, endDate);
  const grouped = new Map<string, ForexDailyPnlPoint>();

  scopedTrades.forEach((record) => {
    const existing = grouped.get(record.tradeDate) ?? {
      date: record.tradeDate,
      netPnl: 0,
      grossPnl: 0,
      commission: 0,
      tradeCount: 0,
    };

    existing.grossPnl = roundMoney(existing.grossPnl + record.pnl);
    existing.commission = roundMoney(existing.commission + record.commission);
    existing.netPnl = roundMoney(existing.grossPnl + existing.commission);
    existing.tradeCount += 1;
    grouped.set(record.tradeDate, existing);
  });

  const filled: ForexDailyPnlPoint[] = [];
  const start = startDate ? dayjs(startDate) : null;
  const end = endDate ? dayjs(endDate) : null;

  if (start && end && end.diff(start, 'day') <= 60) {
    for (let cursor = start.clone(); !cursor.isAfter(end, 'day'); cursor = cursor.add(1, 'day')) {
      const key = cursor.format(DATE_FORMAT);
      filled.push(grouped.get(key) ?? {
        date: key,
        netPnl: 0,
        grossPnl: 0,
        commission: 0,
        tradeCount: 0,
      });
    }

    return filled;
  }

  return [...grouped.values()].sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf());
}

export function buildForexInstrumentSummary(
  trades: ForexTradeRecord[],
  startDate?: string,
  endDate?: string,
): ForexInstrumentSummary[] {
  const scopedTrades = filterTradesByDateRange(trades, startDate, endDate);

  return FOREX_INSTRUMENT_OPTIONS.map((instrument) => {
    const records = scopedTrades.filter((trade) => trade.instrument === instrument);
    const winners = records.filter((trade) => trade.pnl > 0).length;
    const grossPnl = roundMoney(records.reduce((sum, trade) => sum + trade.pnl, 0));
    const totalCommission = roundMoney(records.reduce((sum, trade) => sum + trade.commission, 0));

    return {
      instrument,
      tradeCount: records.length,
      grossPnl,
      totalCommission,
      netPnl: roundMoney(grossPnl + totalCommission),
      avgLotSize: records.length
        ? Number((records.reduce((sum, trade) => sum + trade.lotSize, 0) / records.length).toFixed(2))
        : 0,
      winRate: records.length ? winners / records.length : 0,
      longCount: records.filter((trade) => trade.orderType === 'buy').length,
      shortCount: records.filter((trade) => trade.orderType === 'sell').length,
    };
  });
}

function buildConsecutiveLossMetric(trades: ForexTradeRecord[]) {
  let streak = 0;
  let maxStreak = 0;

  [...trades]
    .sort((left, right) => dayjs(`${left.tradeDate}T${left.closeTime}`).valueOf() - dayjs(`${right.tradeDate}T${right.closeTime}`).valueOf())
    .forEach((trade) => {
      if (trade.pnl + trade.commission < 0) {
        streak += 1;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    });

  return maxStreak;
}

function parseHoldMinutes(holdTime: string) {
  const hours = Number(holdTime.match(/(\d+)小时/)?.[1] ?? 0);
  const minutes = Number(holdTime.match(/(\d+)分钟/)?.[1] ?? 0);
  const seconds = Number(holdTime.match(/(\d+)秒/)?.[1] ?? 0);
  return hours * 60 + minutes + seconds / 60;
}

export function buildForexInsights(
  trades: ForexTradeRecord[],
  capitalFlows: ForexCapitalFlow[],
  startDate?: string,
  endDate?: string,
): ForexInsight[] {
  const scopedTrades = filterTradesByDateRange(trades, startDate, endDate);
  const summary = buildForexDashboardSummary(trades, capitalFlows, startDate, endDate);
  const insights: ForexInsight[] = [];

  if (!scopedTrades.length) {
    return [
      {
        id: 'empty',
        tone: 'neutral',
        title: '当前区间没有交易样本',
        description: '先录入几笔 XAUUSD 或 XAGUSD 交易，这里就会开始给出胜率、手续费侵蚀和仓位偏置等规则分析。',
      },
    ];
  }

  if (summary.tradeCount >= 5 && summary.winRate < 0.4) {
    insights.push({
      id: 'low-win-rate',
      tone: 'warning',
      title: '胜率偏低',
      description: '当前区间的有效胜率还没有站上 40%，建议回看入场条件是否过于宽松，或是否在震荡阶段追单过多。',
      metric: formatForexPercent(summary.winRate),
    });
  }

  if (summary.tradeCount >= 5 && summary.profitLossRatio > 0 && summary.profitLossRatio < 1) {
    insights.push({
      id: 'weak-profit-loss',
      tone: 'warning',
      title: '盈亏比偏弱',
      description: '平均盈利尚不足以覆盖平均亏损，说明止盈空间可能太近，或者亏损单处理还不够果断。',
      metric: summary.profitLossRatio.toFixed(2),
    });
  }

  if (Math.abs(summary.totalCommission) > Math.max(Math.abs(summary.grossPnl) * 0.2, 10)) {
    insights.push({
      id: 'commission-erosion',
      tone: 'warning',
      title: '手续费侵蚀明显',
      description: '手续费已经占到较高比例，频繁短打的收益正在被成本吞掉，可以考虑减少低把握度交易。',
      metric: formatForexMoney(summary.totalCommission),
    });
  }

  const activeDays = new Set(scopedTrades.map((trade) => trade.tradeDate)).size || 1;
  const avgTradesPerDay = scopedTrades.length / activeDays;

  if (scopedTrades.length >= 8 && avgTradesPerDay > 4) {
    insights.push({
      id: 'high-frequency',
      tone: 'warning',
      title: '交易频次偏高',
      description: '平均每天超过 4 笔，容易把情绪波动放大成执行噪音，尤其在黄金震荡时会显著拉低质量。',
      metric: `${avgTradesPerDay.toFixed(1)} 笔/天`,
    });
  }

  const losingStreak = buildConsecutiveLossMetric(scopedTrades);

  if (losingStreak >= 3) {
    insights.push({
      id: 'losing-streak',
      tone: 'warning',
      title: '连续亏损需要停一下',
      description: '已经出现至少 3 笔连续亏损，建议暂停追单，回到复盘和等待高质量形态上。',
      metric: `${losingStreak} 连亏`,
    });
  }

  const longBias = summary.tradeCount ? summary.longCount / summary.tradeCount : 0;

  if (longBias >= 0.8 || longBias <= 0.2) {
    insights.push({
      id: 'direction-bias',
      tone: 'neutral',
      title: '方向偏置明显',
      description: '当前区间的做多和做空分布明显失衡，建议确认自己是在跟随趋势，还是在习惯性单边押注。',
      metric: longBias >= 0.8 ? `做多 ${formatForexPercent(longBias)}` : `做空 ${formatForexPercent(1 - longBias)}`,
    });
  }

  const dominantInstrumentShare = summary.tradeCount
    ? Math.max(summary.xauCount, summary.xagCount) / summary.tradeCount
    : 0;

  if (dominantInstrumentShare >= 0.8) {
    const instrument = summary.xauCount >= summary.xagCount ? 'XAUUSD' : 'XAGUSD';
    insights.push({
      id: 'instrument-concentration',
      tone: 'neutral',
      title: '单品种集中度较高',
      description: '当前区间的交易几乎集中在同一个品种上，优点是熟悉节奏，风险是容易忽略另一个品种更干净的结构机会。',
      metric: `${instrument} ${formatForexPercent(dominantInstrumentShare)}`,
    });
  }

  const averageHoldMinutes = scopedTrades.length
    ? scopedTrades.reduce((sum, trade) => sum + parseHoldMinutes(trade.holdTime), 0) / scopedTrades.length
    : 0;

  if (scopedTrades.length >= 4 && averageHoldMinutes > 0 && averageHoldMinutes < 15) {
    insights.push({
      id: 'short-holding',
      tone: 'warning',
      title: '持仓时间偏短',
      description: '平均持仓不到 15 分钟，说明你更像在抢波动而不是拿结构，需要确认这种节奏是否和你的手续费与胜率匹配。',
      metric: `${averageHoldMinutes.toFixed(1)} 分钟`,
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'balanced',
      tone: summary.realizedNetPnl >= 0 ? 'positive' : 'neutral',
      title: summary.realizedNetPnl >= 0 ? '当前交易节奏相对稳定' : '当前交易结构还算均衡',
      description: summary.realizedNetPnl >= 0
        ? '这段时间的胜率、方向分布和成本控制没有触发明显风险信号，可以继续围绕高质量 setup 复盘强化。'
        : '虽然净收益暂时不理想，但目前还没有出现特别突出的结构性风险点，优先关注执行一致性和样本积累。',
      metric: formatForexAmount(summary.realizedNetPnl),
    });
  }

  return insights;
}

export function computeForexMultiPosition(
  positions: ForexCalculatorPositionDraft[],
  options: {
    leverage: number;
    balance: number;
    forcedLiquidationRatio: number;
  },
): ForexCalculationResult {
  const leverage = Math.max(1, options.leverage || 1);
  const balance = Math.max(0, options.balance || 0);
  const forcedLiquidationRatio = Math.min(1, Math.max(0.1, options.forcedLiquidationRatio || 0.5));

  const results = positions.map((position) => {
    const contractValue = roundMoney(position.openPrice * position.lotSize * FOREX_CONTRACT_UNITS[position.instrument]);
    const margin = roundMoney(contractValue / leverage);
    const pointValue = roundMoney(position.lotSize * FOREX_CONTRACT_UNITS[position.instrument] * FOREX_POINT_SIZES[position.instrument]);
    const pnl = position.closePrice && position.closePrice > 0
      ? calculateForexTradePnl(position.instrument, position.orderType, position.openPrice, position.closePrice, position.lotSize)
      : null;
    const allowedLoss = Math.max(balance - (margin * forcedLiquidationRatio), 0);
    const priceMove = position.lotSize > 0
      ? allowedLoss / (position.lotSize * FOREX_CONTRACT_UNITS[position.instrument])
      : 0;
    const forcedLiquidationPrice = roundMoney(
      position.orderType === 'buy'
        ? Math.max(0, position.openPrice - priceMove)
        : position.openPrice + priceMove,
    );

    return {
      id: position.id,
      instrument: position.instrument,
      orderType: position.orderType,
      contractValue,
      margin,
      pointValue,
      pnl,
      forcedLiquidationPrice,
    };
  });

  const totalContractValue = roundMoney(results.reduce((sum, item) => sum + item.contractValue, 0));
  const totalMargin = roundMoney(results.reduce((sum, item) => sum + item.margin, 0));
  const totalPnl = roundMoney(results.reduce((sum, item) => sum + (item.pnl ?? 0), 0));
  const equityIfClosed = roundMoney(balance + totalPnl);
  const marginUsageRatio = balance > 0 ? totalMargin / balance : 0;
  const remainingAvailableMargin = roundMoney(balance - totalMargin);

  return {
    positions: results,
    accountSummary: {
      balance,
      leverage,
      forcedLiquidationRatio,
      totalContractValue,
      totalMargin,
      totalPnl,
      equityIfClosed,
      marginUsageRatio,
      remainingAvailableMargin,
    },
  };
}

function readAliasValue(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (alias in row) {
      return row[alias];
    }
  }

  return '';
}

async function normalizeImportDateCellAsync(value: unknown) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '';
  }

  const parsed = dayjs(raw.replace(/\./g, '-').replace(/\//g, '-'));
  if (parsed.isValid()) {
    return parsed.format(DATE_FORMAT);
  }

  const numeric = Number(raw);

  if (Number.isFinite(numeric)) {
    const XLSX = await import('xlsx');
    const dateCode = XLSX.SSF.parse_date_code(numeric);

    if (dateCode) {
      return dayjs(`${dateCode.y}-${String(dateCode.m).padStart(2, '0')}-${String(dateCode.d).padStart(2, '0')}`).format(DATE_FORMAT);
    }
  }

  return raw;
}

function buildTradeDedupKey(record: ForexTradeRecord) {
  return [
    record.tradeDate,
    record.instrument,
    record.orderType,
    record.openPrice.toFixed(2),
    record.lotSize.toFixed(2),
    record.closePrice.toFixed(2),
    record.openTime,
    record.closeTime,
  ].join('|');
}

export function dedupeImportedForexTrades(
  existingRecords: ForexTradeRecord[],
  importedRecords: ForexTradeRecord[],
) {
  const knownKeys = new Set(existingRecords.map(buildTradeDedupKey));
  const duplicateRows: ForexTradeRecord[] = [];
  const uniqueRecords: ForexTradeRecord[] = [];

  importedRecords.forEach((record) => {
    const key = buildTradeDedupKey(record);

    if (knownKeys.has(key)) {
      duplicateRows.push(record);
      return;
    }

    knownKeys.add(key);
    uniqueRecords.push(record);
  });

  return { uniqueRecords, duplicateRows };
}

function buildImportedTrade(
  row: Record<string, unknown>,
  rowNumber: number,
): { record: ForexTradeRecord | null; invalid: ForexImportInvalidRow | null } {
  const tradeDate = normalizeTrimmedValue(readAliasValue(row, ['交易日期', 'tradeDate', 'date', '日期']));
  const instrument = ensureInstrument(readAliasValue(row, ['品种', 'instrument']));
  const orderType = ensureOrderType(readAliasValue(row, ['方向', 'orderType', 'type']));
  const openPrice = toNumber(readAliasValue(row, ['开仓价', 'openPrice']), 0);
  const lotSize = toNumber(readAliasValue(row, ['手数', 'lotSize']), 0);
  const closePrice = toNumber(readAliasValue(row, ['平仓价', 'closePrice']), 0);
  const openTime = normalizeForexTimeInput(String(readAliasValue(row, ['开仓时间', 'openTime']) ?? ''), DEFAULT_START_TIME);
  const closeTime = normalizeForexTimeInput(String(readAliasValue(row, ['平仓时间', 'closeTime']) ?? ''), DEFAULT_END_TIME);

  if (!tradeDate || openPrice <= 0 || closePrice <= 0 || lotSize <= 0) {
    return {
      record: null,
      invalid: { rowNumber, reason: '缺少必填字段，至少需要交易日期、开仓价、平仓价和手数。' },
    };
  }

  return {
    record: normalizeForexTrade({
      tradeDate,
      instrument,
      orderType,
      openPrice,
      lotSize,
      commission: toNumber(readAliasValue(row, ['手续费', 'commission']), calculateForexCommission(lotSize)),
      closePrice,
      pnl: toNumber(
        readAliasValue(row, ['盈亏', 'pnl']),
        calculateForexTradePnl(instrument, orderType, openPrice, closePrice, lotSize),
      ),
      openTime,
      closeTime,
      holdTime: normalizeTrimmedValue(readAliasValue(row, ['持仓时长', 'holdTime']), calculateForexHoldTime(openTime, closeTime)),
      remark: normalizeTrimmedValue(readAliasValue(row, ['备注', 'remark'])),
    }),
    invalid: null,
  };
}

export async function importForexWorkbook(
  file: File,
  options: {
    trades: ForexTradeRecord[];
  },
): Promise<ForexImportResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return {
      totalRows: 0,
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
      importedRecords: [],
      invalidRows: [{ rowNumber: 0, reason: '没有读取到可用工作表。' }],
      nextTrades: options.trades,
    };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const invalidRows: ForexImportInvalidRow[] = [];
  const draftRecords: ForexTradeRecord[] = [];

  for (const [index, rawRow] of rows.entries()) {
    const row = { ...rawRow };
    const normalizedDate = await normalizeImportDateCellAsync(readAliasValue(row, ['交易日期', 'tradeDate', 'date', '日期']));
    if (normalizedDate) {
      row.交易日期 = normalizedDate;
      row.tradeDate = normalizedDate;
      row.date = normalizedDate;
      row.日期 = normalizedDate;
    }

    const { record, invalid } = buildImportedTrade(row, index + 2);

    if (invalid) {
      invalidRows.push(invalid);
      continue;
    }

    if (record) {
      draftRecords.push(record);
    }
  }

  const { uniqueRecords, duplicateRows } = dedupeImportedForexTrades(options.trades, draftRecords);
  const nextTrades = sortTrades([...uniqueRecords, ...options.trades]);

  return {
    totalRows: rows.length,
    importedCount: uniqueRecords.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    importedRecords: uniqueRecords,
    invalidRows,
    nextTrades,
  };
}

export async function buildForexImportTemplateWorkbook() {
  const XLSX = await import('xlsx');
  const rows = [
    {
      交易日期: dayjs().format(DATE_FORMAT),
      品种: 'XAUUSD',
      方向: 'buy',
      开仓价: 2340.5,
      手数: 0.1,
      手续费: -0.6,
      平仓价: 2346.2,
      盈亏: 57,
      开仓时间: '09:35',
      平仓时间: '11:10',
      持仓时长: '1小时 35分钟',
      备注: '示例数据',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'forex_template');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
