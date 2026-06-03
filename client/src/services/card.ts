import dayjs from 'dayjs';

import type {
  CardTab,
  LifeCardBillDraft,
  LifeCardBillRecord,
  LifeCardCarrier,
  LifeCardCarrierBreakdownPoint,
  LifeCardCarrierDraft,
  LifeCardImportResult,
  LifeCardMonthlyBillPoint,
  LifeCardOverviewSummary,
  LifeCardPageState,
  LifeCardRankingPoint,
  LifeCardRecord,
  LifeCardDraft,
  LifeCardRechargeDraft,
  LifeCardRechargeRecord,
  LifeCardReminderItem,
  LifeCardBalanceRangePoint,
} from '../types/card';
import type { CardPageState as LegacyCardPageState } from '../types/pages';
import { readStorage } from '../utils/storage';

const DATE_FORMAT = 'YYYY-MM-DD';
const MONTH_FORMAT = 'YYYY-MM';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const LEGACY_STORAGE_KEY = 'lifeos_card_page';

export const CARD_PAGE_SIZE = 10;
export const CARD_ALL_CARRIERS = 'all';
export const CARD_ALL_MONTHS = 'all';
export const CARD_ALL_BILL_CARDS = 'all';
export const CARD_BALANCE_RANGE_OPTIONS = [
  { range: '0-10 元', min: 0, max: 10 },
  { range: '10-30 元', min: 10, max: 30 },
  { range: '30-50 元', min: 30, max: 50 },
  { range: '50-100 元', min: 50, max: 100 },
  { range: '100 元以上', min: 100, max: Number.POSITIVE_INFINITY },
] as const;
export const CARD_CHART_COLORS = [
  '#5e6ad2',
  '#1eaedb',
  '#27a644',
  '#f59e0b',
  '#e5484d',
  '#10b981',
  '#0ea5e9',
  '#f97316',
] as const;

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function normalizeText(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeMoney(value: unknown, fallback = 0) {
  const raw = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeInteger(value: unknown, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
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

function normalizeMonth(value: unknown, fallback = dayjs().format(MONTH_FORMAT)) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return fallback;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    const parsed = dayjs(`${raw}-01`);
    return parsed.isValid() ? parsed.format(MONTH_FORMAT) : fallback;
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(MONTH_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate = dayjs().format(DATE_FORMAT)) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function sortCards(records: LifeCardRecord[]) {
  return [...records].sort((left, right) => {
    const balanceDiff = left.balance - right.balance;
    if (balanceDiff !== 0) {
      return balanceDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortBills(records: LifeCardBillRecord[]) {
  return [...records].sort((left, right) => {
    const monthDiff = dayjs(`${right.billingMonth}-01`).valueOf() - dayjs(`${left.billingMonth}-01`).valueOf();
    if (monthDiff !== 0) {
      return monthDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortRecharges(records: LifeCardRechargeRecord[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.rechargeDate).valueOf() - dayjs(left.rechargeDate).valueOf();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortCarriers(records: LifeCardCarrier[]) {
  return [...records].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function createDefaultCarriers() {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortCarriers([
    {
      id: 'life-card-carrier-cmcc',
      name: '中国移动',
      description: '适合日常通话与流量套餐管理',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-carrier-ct',
      name: '中国电信',
      description: '适合融合套餐和长期月租号卡',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-carrier-cu',
      name: '中国联通',
      description: '适合流量卡、副卡和互联网套餐',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-carrier-cbn',
      name: '中国广电',
      description: '适合补充性套餐与副号管理',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createInitialCards(carriers: LifeCardCarrier[]) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const carrierMap = new Map(carriers.map((carrier) => [carrier.name, carrier]));

  return sortCards([
    {
      id: 'life-card-sim-1',
      phoneNumber: '13800138000',
      carrierId: carrierMap.get('中国移动')?.id ?? '',
      carrierName: '中国移动',
      location: '上海',
      balance: 8.2,
      monthlyFee: 29,
      billingDay: 8,
      dataPlan: '30GB/月',
      callMinutes: '100 分钟/月',
      smsCount: '100 条/月',
      activationDate: dayjs().subtract(4, 'year').format(DATE_FORMAT),
      notes: '主力生活号卡，常驻使用。',
      lastBalanceReminderMarker: '',
      lastBillingReminderMarker: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-sim-2',
      phoneNumber: '13800138000',
      carrierId: carrierMap.get('中国电信')?.id ?? '',
      carrierName: '中国电信',
      location: '北京',
      balance: 42.5,
      monthlyFee: 19,
      billingDay: 12,
      dataPlan: '20GB/月',
      callMinutes: '50 分钟/月',
      smsCount: '50 条/月',
      activationDate: dayjs().subtract(2, 'year').format(DATE_FORMAT),
      notes: '备用通勤卡，账单稳定。',
      lastBalanceReminderMarker: '',
      lastBillingReminderMarker: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-sim-3',
      phoneNumber: '13800138000',
      carrierId: carrierMap.get('中国联通')?.id ?? '',
      carrierName: '中国联通',
      location: '深圳',
      balance: 5.9,
      monthlyFee: 39,
      billingDay: 23,
      dataPlan: '100GB/月',
      callMinutes: '300 分钟/月',
      smsCount: '200 条/月',
      activationDate: dayjs().subtract(14, 'month').format(DATE_FORMAT),
      notes: '大流量副号卡，关注低余额提醒。',
      lastBalanceReminderMarker: '',
      lastBillingReminderMarker: '',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createInitialBills(cards: LifeCardRecord[]) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortBills([
    {
      id: 'life-card-bill-1',
      simId: cards[0]?.id ?? '',
      phoneNumber: cards[0]?.phoneNumber ?? '13800138000',
      carrierName: cards[0]?.carrierName ?? '中国移动',
      billingMonth: dayjs().subtract(1, 'month').format(MONTH_FORMAT),
      monthlyFee: 29,
      actualFee: 29,
      extraCharges: 3,
      totalFee: 32,
      note: '套餐外短信费用',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-bill-2',
      simId: cards[1]?.id ?? '',
      phoneNumber: cards[1]?.phoneNumber ?? '13800138000',
      carrierName: cards[1]?.carrierName ?? '中国电信',
      billingMonth: dayjs().subtract(1, 'month').format(MONTH_FORMAT),
      monthlyFee: 19,
      actualFee: 19,
      extraCharges: 0,
      totalFee: 19,
      note: '标准月租',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-bill-3',
      simId: cards[2]?.id ?? '',
      phoneNumber: cards[2]?.phoneNumber ?? '13800138000',
      carrierName: cards[2]?.carrierName ?? '中国联通',
      billingMonth: dayjs().format(MONTH_FORMAT),
      monthlyFee: 39,
      actualFee: 39,
      extraCharges: 5,
      totalFee: 44,
      note: '超出套餐后加购流量',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createInitialRecharges(cards: LifeCardRecord[]) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRecharges([
    {
      id: 'life-card-recharge-1',
      simId: cards[0]?.id ?? '',
      phoneNumber: cards[0]?.phoneNumber ?? '13800138000',
      amount: 50,
      rechargeDate: dayjs().subtract(18, 'day').format(DATE_FORMAT),
      note: '月度充值',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'life-card-recharge-2',
      simId: cards[2]?.id ?? '',
      phoneNumber: cards[2]?.phoneNumber ?? '13800138000',
      amount: 100,
      rechargeDate: dayjs().subtract(35, 'day').format(DATE_FORMAT),
      note: '活动赠送前补充话费',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function normalizeCarrier(carrier: Partial<LifeCardCarrier>): LifeCardCarrier {
  const createdAt = normalizeTimestamp(carrier.createdAt);
  const updatedAt = normalizeTimestamp(carrier.updatedAt, dayjs(createdAt).format(DATE_FORMAT));

  return {
    id: carrier.id ?? buildId(),
    name: normalizeText(carrier.name, '未命名运营商'),
    description: normalizeText(carrier.description),
    createdAt,
    updatedAt,
  };
}

function normalizeCard(
  record: Partial<LifeCardRecord>,
  carriers: LifeCardCarrier[],
): LifeCardRecord {
  const phoneNumber = normalizeText(record.phoneNumber, '未填写号码');
  const matchedCarrier = carriers.find((carrier) => carrier.id === record.carrierId)
    ?? carriers.find((carrier) => carrier.name === record.carrierName);
  const carrierName = normalizeText(matchedCarrier?.name ?? record.carrierName, '未指定运营商');
  const activationDate = normalizeDate(record.activationDate, dayjs().format(DATE_FORMAT));
  const createdAt = normalizeTimestamp(record.createdAt, activationDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, activationDate);

  return {
    id: record.id ?? buildId(),
    phoneNumber,
    carrierId: normalizeText(record.carrierId ?? matchedCarrier?.id),
    carrierName,
    location: normalizeText(record.location),
    balance: normalizeMoney(record.balance, 0),
    monthlyFee: normalizeMoney(record.monthlyFee, 0),
    billingDay: normalizeInteger(record.billingDay, 1, 1, 31),
    dataPlan: normalizeText(record.dataPlan),
    callMinutes: normalizeText(record.callMinutes),
    smsCount: normalizeText(record.smsCount),
    activationDate,
    notes: normalizeText(record.notes),
    lastBalanceReminderMarker: normalizeText(record.lastBalanceReminderMarker),
    lastBillingReminderMarker: normalizeText(record.lastBillingReminderMarker),
    createdAt,
    updatedAt,
  };
}

function normalizeBill(
  record: Partial<LifeCardBillRecord>,
  cards: LifeCardRecord[],
): LifeCardBillRecord {
  const matchedCard = cards.find((card) => card.id === record.simId)
    ?? cards.find((card) => card.phoneNumber === record.phoneNumber);
  const billingMonth = normalizeMonth(record.billingMonth);
  const createdAt = normalizeTimestamp(record.createdAt, `${billingMonth}-01`);
  const updatedAt = normalizeTimestamp(record.updatedAt, `${billingMonth}-01`);
  const monthlyFee = normalizeMoney(record.monthlyFee, matchedCard?.monthlyFee ?? 0);
  const actualFee = normalizeMoney(record.actualFee, monthlyFee);
  const extraCharges = normalizeMoney(record.extraCharges, 0);
  const totalFee = normalizeMoney(
    record.totalFee,
    Number((actualFee + extraCharges).toFixed(2)),
  );

  return {
    id: record.id ?? buildId(),
    simId: matchedCard?.id ?? normalizeText(record.simId),
    phoneNumber: normalizeText(record.phoneNumber ?? matchedCard?.phoneNumber, '未匹配号码'),
    carrierName: normalizeText(record.carrierName ?? matchedCard?.carrierName, '未指定运营商'),
    billingMonth,
    monthlyFee,
    actualFee,
    extraCharges,
    totalFee,
    note: normalizeText(record.note),
    createdAt,
    updatedAt,
  };
}

function normalizeRecharge(
  record: Partial<LifeCardRechargeRecord>,
  cards: LifeCardRecord[],
): LifeCardRechargeRecord {
  const matchedCard = cards.find((card) => card.id === record.simId)
    ?? cards.find((card) => card.phoneNumber === record.phoneNumber);
  const rechargeDate = normalizeDate(record.rechargeDate, dayjs().format(DATE_FORMAT));
  const createdAt = normalizeTimestamp(record.createdAt, rechargeDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, rechargeDate);

  return {
    id: record.id ?? buildId(),
    simId: matchedCard?.id ?? normalizeText(record.simId),
    phoneNumber: normalizeText(record.phoneNumber ?? matchedCard?.phoneNumber, '未匹配号码'),
    amount: normalizeMoney(record.amount, 0),
    rechargeDate,
    note: normalizeText(record.note),
    createdAt,
    updatedAt,
  };
}

function normalizeSettings(
  settings: Partial<LifeCardPageState['settings']> | undefined,
): LifeCardPageState['settings'] {
  return {
    balanceLowEnabled: settings?.balanceLowEnabled ?? true,
    billingUpcomingEnabled: settings?.billingUpcomingEnabled ?? true,
    balanceThreshold: Math.max(0, Number(settings?.balanceThreshold ?? 10) || 10),
    notificationDaysBefore: Math.max(0, Math.min(31, Math.round(Number(settings?.notificationDaysBefore ?? 3) || 3))),
  };
}

function createInitialState(): LifeCardPageState {
  const carriers = createDefaultCarriers();
  const cards = createInitialCards(carriers);

  return {
    cards,
    bills: createInitialBills(cards),
    recharges: createInitialRecharges(cards),
    carriers,
    settings: {
      balanceLowEnabled: true,
      billingUpcomingEnabled: true,
      balanceThreshold: 10,
      notificationDaysBefore: 3,
    },
  };
}

export function buildInitialCardState() {
  return normalizeCardPageState(createInitialState());
}

export function migrateLegacyCardState(
  legacy: LegacyCardPageState | null | undefined,
  carriers = createDefaultCarriers(),
): LifeCardPageState | null {
  if (!legacy || !Array.isArray(legacy.cards)) {
    return null;
  }

  const now = dayjs().format(DATE_TIME_FORMAT);

  const cards = legacy.cards.map((record, index) => {
    const matchedCarrier = carriers.find((carrier) => carrier.name === normalizeText(record.carrier));
    const activationDate = dayjs().subtract(index + 1, 'year').format(DATE_FORMAT);

    return normalizeCard({
      id: record.id,
      phoneNumber: record.phone,
      carrierId: matchedCarrier?.id ?? '',
      carrierName: record.carrier,
      location: record.city,
      balance: record.balance,
      monthlyFee: record.monthlyFee,
      billingDay: record.billingDay,
      dataPlan: record.trafficPlan,
      callMinutes: '',
      smsCount: '',
      activationDate,
      notes: '',
      createdAt: now,
      updatedAt: now,
    }, carriers);
  });

  return {
    cards: sortCards(cards),
    bills: [],
    recharges: [],
    carriers,
    settings: normalizeSettings(legacy.settings),
  };
}

export function normalizeCardPageState(
  state: Partial<LifeCardPageState> | LifeCardPageState | null | undefined,
): LifeCardPageState {
  const fallback = createInitialState();
  const carriers = sortCarriers((state?.carriers ?? fallback.carriers).map((carrier) => normalizeCarrier(carrier)));

  let cards = sortCards((state?.cards ?? []).map((record) => normalizeCard(record, carriers)));
  let bills = sortBills((state?.bills ?? []).map((record) => normalizeBill(record, cards)));
  let recharges = sortRecharges((state?.recharges ?? []).map((record) => normalizeRecharge(record, cards)));

  const shouldUseFallback = !cards.length && !bills.length && !recharges.length && !state?.settings;

  if (shouldUseFallback) {
    const migrated = migrateLegacyCardState(readStorage<LegacyCardPageState | null>(LEGACY_STORAGE_KEY, null), carriers);

    if (migrated) {
      cards = migrated.cards;
      bills = migrated.bills;
      recharges = migrated.recharges;
    } else {
      cards = fallback.cards;
      bills = fallback.bills;
      recharges = fallback.recharges;
    }
  }

  return {
    cards,
    bills,
    recharges,
    carriers,
    settings: normalizeSettings(state?.settings ?? fallback.settings),
  };
}

export function createLifeCard(
  cards: LifeCardRecord[],
  carriers: LifeCardCarrier[],
  draft: LifeCardDraft,
) {
  const matchedCarrier = carriers.find((carrier) => carrier.id === draft.carrierId)
    ?? carriers.find((carrier) => carrier.name === draft.carrierName);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortCards([
    normalizeCard({
      id: buildId(),
      phoneNumber: draft.phoneNumber,
      carrierId: matchedCarrier?.id ?? normalizeText(draft.carrierId),
      carrierName: matchedCarrier?.name ?? normalizeText(draft.carrierName),
      location: draft.location,
      balance: draft.balance,
      monthlyFee: draft.monthlyFee,
      billingDay: draft.billingDay,
      dataPlan: draft.dataPlan,
      callMinutes: draft.callMinutes,
      smsCount: draft.smsCount,
      activationDate: draft.activationDate,
      notes: draft.notes,
      createdAt: now,
      updatedAt: now,
    }, carriers),
    ...cards,
  ]);
}

export function updateLifeCard(
  cards: LifeCardRecord[],
  carriers: LifeCardCarrier[],
  cardId: string,
  draft: LifeCardDraft,
) {
  const matchedCarrier = carriers.find((carrier) => carrier.id === draft.carrierId)
    ?? carriers.find((carrier) => carrier.name === draft.carrierName);

  return sortCards(cards.map((record) => {
    if (record.id !== cardId) {
      return record;
    }

    return normalizeCard({
      ...record,
      phoneNumber: draft.phoneNumber,
      carrierId: matchedCarrier?.id ?? normalizeText(draft.carrierId),
      carrierName: matchedCarrier?.name ?? normalizeText(draft.carrierName ?? record.carrierName),
      location: draft.location,
      balance: draft.balance,
      monthlyFee: draft.monthlyFee,
      billingDay: draft.billingDay,
      dataPlan: draft.dataPlan,
      callMinutes: draft.callMinutes,
      smsCount: draft.smsCount,
      activationDate: draft.activationDate,
      notes: draft.notes,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    }, carriers);
  }));
}

export function deleteLifeCard(cards: LifeCardRecord[], cardId: string) {
  return cards.filter((record) => record.id !== cardId);
}

export function createLifeCardRecharge(
  cards: LifeCardRecord[],
  recharges: LifeCardRechargeRecord[],
  draft: LifeCardRechargeDraft,
) {
  const matchedCard = cards.find((card) => card.id === draft.simId);
  if (!matchedCard) {
    return { cards, recharges };
  }

  const amount = normalizeMoney(draft.amount, 0);
  const now = dayjs().format(DATE_TIME_FORMAT);
  const nextRecharge = normalizeRecharge({
    id: buildId(),
    simId: matchedCard.id,
    phoneNumber: matchedCard.phoneNumber,
    amount,
    rechargeDate: draft.rechargeDate,
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  }, cards);

  const nextCards = sortCards(cards.map((record) => (
    record.id === matchedCard.id
      ? {
          ...record,
          balance: Number((record.balance + amount).toFixed(2)),
          updatedAt: now,
        }
      : record
  )));

  return {
    cards: nextCards,
    recharges: sortRecharges([nextRecharge, ...recharges]),
  };
}

export function deleteLifeCardRecharge(recharges: LifeCardRechargeRecord[], rechargeId: string) {
  return recharges.filter((record) => record.id !== rechargeId);
}

export function createLifeCardBill(
  bills: LifeCardBillRecord[],
  cards: LifeCardRecord[],
  draft: LifeCardBillDraft,
) {
  const matchedCard = cards.find((card) => card.id === draft.simId)
    ?? cards.find((card) => card.phoneNumber === draft.phoneNumber);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortBills([
    normalizeBill({
      id: buildId(),
      simId: matchedCard?.id ?? draft.simId,
      phoneNumber: matchedCard?.phoneNumber ?? draft.phoneNumber,
      carrierName: matchedCard?.carrierName ?? draft.carrierName,
      billingMonth: draft.billingMonth,
      monthlyFee: draft.monthlyFee ?? matchedCard?.monthlyFee,
      actualFee: draft.actualFee ?? draft.monthlyFee ?? matchedCard?.monthlyFee,
      extraCharges: draft.extraCharges,
      totalFee: draft.totalFee,
      note: draft.note,
      createdAt: now,
      updatedAt: now,
    }, cards),
    ...bills,
  ]);
}

export function updateLifeCardBill(
  bills: LifeCardBillRecord[],
  cards: LifeCardRecord[],
  billId: string,
  draft: LifeCardBillDraft,
) {
  return sortBills(bills.map((record) => {
    if (record.id !== billId) {
      return record;
    }

    return normalizeBill({
      ...record,
      simId: draft.simId,
      phoneNumber: draft.phoneNumber ?? record.phoneNumber,
      carrierName: draft.carrierName ?? record.carrierName,
      billingMonth: draft.billingMonth,
      monthlyFee: draft.monthlyFee,
      actualFee: draft.actualFee,
      extraCharges: draft.extraCharges,
      totalFee: draft.totalFee,
      note: draft.note,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    }, cards);
  }));
}

export function deleteLifeCardBill(bills: LifeCardBillRecord[], billId: string) {
  return bills.filter((record) => record.id !== billId);
}

export function createLifeCardCarrier(
  carriers: LifeCardCarrier[],
  draft: LifeCardCarrierDraft,
) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortCarriers([
    normalizeCarrier({
      id: buildId(),
      name: draft.name,
      description: draft.description,
      createdAt: now,
      updatedAt: now,
    }),
    ...carriers,
  ]);
}

export function updateLifeCardCarrier(
  carriers: LifeCardCarrier[],
  carrierId: string,
  draft: LifeCardCarrierDraft,
) {
  return sortCarriers(carriers.map((carrier) => (
    carrier.id === carrierId
      ? normalizeCarrier({
          ...carrier,
          name: draft.name,
          description: draft.description,
          updatedAt: dayjs().format(DATE_TIME_FORMAT),
        })
      : carrier
  )));
}

export function deleteLifeCardCarrier(carriers: LifeCardCarrier[], carrierId: string) {
  return carriers.filter((carrier) => carrier.id !== carrierId);
}

export function importLifeCardBillsFromCsv(
  csvText: string,
  cards: LifeCardRecord[],
): LifeCardImportResult {
  const lines = csvText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return {
      totalRows: Math.max(0, lines.length - 1),
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: Math.max(0, lines.length - 1),
      records: [],
    };
  }

  const records: LifeCardBillRecord[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  let invalidCount = 0;
  const dataLines = lines.slice(1);

  dataLines.forEach((line) => {
    const columns = line.split(',').map((item) => item.trim());
    const [billingMonth, phoneNumber, monthlyFee, actualFee, extraCharges, totalFee, note] = columns;

    if (!billingMonth || !phoneNumber || !totalFee) {
      invalidCount += 1;
      return;
    }

    const key = [
      normalizeText(phoneNumber),
      normalizeMonth(billingMonth),
      normalizeMoney(totalFee, 0),
      normalizeText(note),
    ].join('::');

    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }

    seen.add(key);

    records.push(normalizeBill({
      id: buildId(),
      simId: cards.find((card) => card.phoneNumber === phoneNumber)?.id ?? '',
      phoneNumber,
      carrierName: cards.find((card) => card.phoneNumber === phoneNumber)?.carrierName ?? '',
      billingMonth,
      monthlyFee: Number(monthlyFee || 0),
      actualFee: Number(actualFee || 0),
      extraCharges: Number(extraCharges || 0),
      totalFee: Number(totalFee || 0),
      note,
      createdAt: dayjs().format(DATE_TIME_FORMAT),
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    }, cards));
  });

  return {
    totalRows: dataLines.length,
    importedCount: records.length,
    duplicateCount,
    invalidCount,
    records: sortBills(records),
  };
}

export function buildLifeCardOverview(
  cards: LifeCardRecord[],
  bills: LifeCardBillRecord[],
  recharges: LifeCardRechargeRecord[],
  settings: LifeCardPageState['settings'],
): LifeCardOverviewSummary {
  const currentMonth = dayjs().format(MONTH_FORMAT);

  return {
    totalCards: cards.length,
    lowBalanceCount: cards.filter((card) => card.balance <= settings.balanceThreshold).length,
    totalBalance: Number(cards.reduce((sum, card) => sum + card.balance, 0).toFixed(2)),
    monthlyFeeTotal: Number(cards.reduce((sum, card) => sum + card.monthlyFee, 0).toFixed(2)),
    carrierCount: new Set(cards.map((card) => card.carrierName)).size,
    currentMonthBillCount: bills.filter((bill) => bill.billingMonth === currentMonth).length,
    currentMonthBillAmount: Number(
      bills
        .filter((bill) => bill.billingMonth === currentMonth)
        .reduce((sum, bill) => sum + bill.totalFee, 0)
        .toFixed(2),
    ),
    totalRechargeAmount: Number(recharges.reduce((sum, recharge) => sum + recharge.amount, 0).toFixed(2)),
  };
}

export function buildLifeCardMonthlyTrend(
  bills: LifeCardBillRecord[],
  rangeMonths = 12,
): LifeCardMonthlyBillPoint[] {
  const months = Array.from({ length: rangeMonths }, (_, index) =>
    dayjs().subtract(rangeMonths - index - 1, 'month').format(MONTH_FORMAT),
  );

  return months.map((month) => {
    const monthBills = bills.filter((bill) => bill.billingMonth === month);
    return {
      month,
      label: dayjs(`${month}-01`).format('MM 月'),
      amount: Number(monthBills.reduce((sum, bill) => sum + bill.totalFee, 0).toFixed(2)),
      count: monthBills.length,
    };
  });
}

export function buildLifeCardCarrierBreakdown(
  cards: LifeCardRecord[],
  bills: LifeCardBillRecord[],
): LifeCardCarrierBreakdownPoint[] {
  const grouped = new Map<string, LifeCardCarrierBreakdownPoint>();

  cards.forEach((card) => {
    const key = card.carrierId || card.carrierName;
    const current = grouped.get(key) ?? {
      carrierId: card.carrierId,
      carrierName: card.carrierName,
      cardCount: 0,
      monthlyFee: 0,
      totalBillAmount: 0,
      color: CARD_CHART_COLORS[grouped.size % CARD_CHART_COLORS.length],
    };

    current.cardCount += 1;
    current.monthlyFee = Number((current.monthlyFee + card.monthlyFee).toFixed(2));
    grouped.set(key, current);
  });

  bills.forEach((bill) => {
    const current = Array.from(grouped.values()).find((item) => item.carrierName === bill.carrierName);
    if (current) {
      current.totalBillAmount = Number((current.totalBillAmount + bill.totalFee).toFixed(2));
    }
  });

  return [...grouped.values()].sort((left, right) => right.cardCount - left.cardCount || right.totalBillAmount - left.totalBillAmount);
}

export function buildLifeCardBalanceDistribution(cards: LifeCardRecord[]): LifeCardBalanceRangePoint[] {
  return CARD_BALANCE_RANGE_OPTIONS.map((item) => {
    const matched = cards.filter((card) => card.balance >= item.min && card.balance < item.max);
    const totalBalance = Number(matched.reduce((sum, card) => sum + card.balance, 0).toFixed(2));

    return {
      range: item.range,
      count: matched.length,
      totalBalance,
      averageBalance: matched.length ? Number((totalBalance / matched.length).toFixed(2)) : 0,
    };
  });
}

export function buildLifeCardRanking(
  cards: LifeCardRecord[],
  bills: LifeCardBillRecord[],
  recharges: LifeCardRechargeRecord[],
): LifeCardRankingPoint[] {
  return cards
    .map((card) => {
      const cardBills = bills.filter((bill) => bill.simId === card.id || bill.phoneNumber === card.phoneNumber);
      const cardRecharges = recharges.filter((record) => record.simId === card.id || record.phoneNumber === card.phoneNumber);

      return {
        simId: card.id,
        phoneNumber: card.phoneNumber,
        carrierName: card.carrierName,
        billCount: cardBills.length,
        totalBillAmount: Number(cardBills.reduce((sum, bill) => sum + bill.totalFee, 0).toFixed(2)),
        totalRechargeAmount: Number(cardRecharges.reduce((sum, record) => sum + record.amount, 0).toFixed(2)),
      };
    })
    .sort((left, right) => right.billCount - left.billCount || right.totalBillAmount - left.totalBillAmount);
}

export function buildLifeCardDueNotifications(
  cards: LifeCardRecord[],
  settings: LifeCardPageState['settings'],
) {
  const reminders: LifeCardReminderItem[] = [];
  const today = dayjs().startOf('day');

  cards.forEach((card) => {
    if (settings.balanceLowEnabled && card.balance <= settings.balanceThreshold) {
      const marker = `${today.format(DATE_FORMAT)}|${card.id}|balance_low|${settings.balanceThreshold}`;
      if (card.lastBalanceReminderMarker !== marker) {
        reminders.push({
          sceneId: 'card.balance_low',
          marker,
          cardId: card.id,
          phoneNumber: card.phoneNumber,
          message: `${card.phoneNumber} 当前余额 ${card.balance.toFixed(2)} 元，已低于提醒阈值 ${settings.balanceThreshold.toFixed(2)} 元，请及时充值。`,
        });
      }
    }

    if (settings.billingUpcomingEnabled) {
      const nextBillingDate = today.date() <= card.billingDay
        ? today.date(card.billingDay)
        : today.add(1, 'month').date(card.billingDay);
      const diffDays = nextBillingDate.startOf('day').diff(today, 'day');

      if (diffDays >= 0 && diffDays <= settings.notificationDaysBefore) {
        const marker = `${nextBillingDate.format(DATE_FORMAT)}|${card.id}|billing_upcoming|${settings.notificationDaysBefore}`;
        if (card.lastBillingReminderMarker !== marker) {
          reminders.push({
            sceneId: 'card.billing_upcoming',
            marker,
            cardId: card.id,
            phoneNumber: card.phoneNumber,
            message: `${card.phoneNumber} 将在 ${nextBillingDate.format('MM-DD')} 进入账单日，建议提前 ${settings.notificationDaysBefore} 天检查余额与套餐。`,
          });
        }
      }
    }
  });

  return reminders;
}

export function triggerLifeCardNotifications(
  cards: LifeCardRecord[],
  reminders: LifeCardReminderItem[],
) {
  if (!reminders.length) {
    return cards;
  }

  const balanceMap = new Map(
    reminders
      .filter((item) => item.sceneId === 'card.balance_low')
      .map((item) => [item.cardId, item.marker]),
  );
  const billingMap = new Map(
    reminders
      .filter((item) => item.sceneId === 'card.billing_upcoming')
      .map((item) => [item.cardId, item.marker]),
  );

  return cards.map((card) => ({
    ...card,
    lastBalanceReminderMarker: balanceMap.get(card.id) ?? card.lastBalanceReminderMarker,
    lastBillingReminderMarker: billingMap.get(card.id) ?? card.lastBillingReminderMarker,
  }));
}

export function filterLifeCards(
  cards: LifeCardRecord[],
  carriers: LifeCardCarrier[],
  filter: {
    keyword?: string;
    carrierId?: string;
    location?: string;
    minBalance?: string;
    maxBalance?: string;
  },
) {
  const keyword = normalizeText(filter.keyword).toLowerCase();
  const location = normalizeText(filter.location).toLowerCase();
  const carrierId = normalizeText(filter.carrierId, CARD_ALL_CARRIERS);
  const minBalance = filter.minBalance ? Number(filter.minBalance) : null;
  const maxBalance = filter.maxBalance ? Number(filter.maxBalance) : null;

  return cards.filter((card) => {
    if (keyword) {
      const haystack = [card.phoneNumber, card.carrierName, card.dataPlan, card.notes].join(' ').toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    if (carrierId !== CARD_ALL_CARRIERS) {
      const matchedCarrier = carriers.find((c) => c.id === carrierId);
      const isMatch = card.carrierId === carrierId
        || (matchedCarrier && card.carrierName === matchedCarrier.name);
      if (!isMatch) {
        return false;
      }
    }

    if (location && !card.location.toLowerCase().includes(location)) {
      return false;
    }

    if (Number.isFinite(minBalance) && card.balance < Number(minBalance)) {
      return false;
    }

    if (Number.isFinite(maxBalance) && card.balance > Number(maxBalance)) {
      return false;
    }

    return true;
  });
}

export function filterLifeCardBills(
  bills: LifeCardBillRecord[],
  filter: {
    simId?: string;
    carrierName?: string;
    billingMonth?: string;
    keyword?: string;
  },
) {
  const simId = normalizeText(filter.simId, CARD_ALL_BILL_CARDS);
  const carrierName = normalizeText(filter.carrierName, CARD_ALL_CARRIERS);
  const billingMonth = normalizeText(filter.billingMonth, CARD_ALL_MONTHS);
  const keyword = normalizeText(filter.keyword).toLowerCase();

  return bills.filter((bill) => {
    if (simId !== CARD_ALL_BILL_CARDS && bill.simId !== simId) {
      return false;
    }

    if (carrierName !== CARD_ALL_CARRIERS && bill.carrierName !== carrierName) {
      return false;
    }

    if (billingMonth !== CARD_ALL_MONTHS && bill.billingMonth !== billingMonth) {
      return false;
    }

    if (keyword) {
      const haystack = [bill.phoneNumber, bill.carrierName, bill.note, bill.billingMonth].join(' ').toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

export function formatLifeCardMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

export function getCardTabLabel(tab: CardTab) {
  switch (tab) {
    case 'cards':
      return '号卡列表';
    case 'bills':
      return '账单管理';
    case 'statistics':
      return '统计分析';
    case 'carriers':
      return '运营商管理';
    case 'settings':
      return '提醒设置';
    default:
      return '号卡中心';
  }
}
