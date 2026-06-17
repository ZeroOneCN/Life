import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

import { CHART_CATEGORY_8 } from '../lib/chartPalette';
import type {
  ShoppingCurrencyMode,
  ShoppingImportInvalidRow,
  ShoppingImportResult,
  ShoppingLedger,
  ShoppingLedgerDraft,
  ShoppingLedgerSummaryPoint,
  ShoppingMonthlyTrendPoint,
  ShoppingOverviewSummary,
  ShoppingPageState,
  ShoppingPlatform,
  ShoppingPlatformBreakdownPoint,
  ShoppingRecord,
  ShoppingRecordDraft,
} from '../types/shopping';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const MONTH_FORMAT = 'YYYY-MM';

export const SHOPPING_RECORD_PAGE_SIZE = 10;
export const DEFAULT_USDT_RATE = 7;
export const SHOPPING_ALL_LEDGERS = 'all';

export const SHOPPING_PLATFORM_COLOR_PRESETS = CHART_CATEGORY_8;

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

function normalizeDate(value: unknown) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return dayjs().format(DATE_FORMAT);
  }

  if (/^\d{8}$/.test(raw)) {
    const parsed = dayjs(raw, 'YYYYMMDD');
    if (parsed.isValid()) {
      return parsed.format(DATE_FORMAT);
    }
  }

  if (/^\d{6}$/.test(raw)) {
    const parsed = dayjs(raw, 'YYMMDD');
    if (parsed.isValid()) {
      return parsed.format(DATE_FORMAT);
    }
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : dayjs().format(DATE_FORMAT);
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function normalizeTrimmedValue(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeLedgerId(value: string) {
  return value.trim();
}

function normalizeCurrencyMode(value: unknown): ShoppingCurrencyMode {
  return value === 'USDT' ? 'USDT' : 'CNY';
}

function sortRecords(records: ShoppingRecord[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.date).valueOf() - dayjs(left.date).valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortLedgers(ledgers: ShoppingLedger[]) {
  return [...ledgers].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortPlatforms(platforms: ShoppingPlatform[]) {
  return [...platforms].sort((left, right) => {
    if (Boolean(left.isBuiltIn) !== Boolean(right.isBuiltIn)) {
      return left.isBuiltIn ? -1 : 1;
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function createInitialLedgers(): ShoppingLedger[] {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortLedgers([
    {
      id: 'ledger-general',
      name: '日常消费',
      description: '用于归档常规网购与生活补货。',
      startDate: dayjs().startOf('year').format(DATE_FORMAT),
      endDate: '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ledger-home',
      name: '居家升级',
      description: '记录家具、电器和空间改造相关支出。',
      startDate: dayjs().subtract(2, 'month').startOf('month').format(DATE_FORMAT),
      endDate: '',
      isActive: false,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createInitialPlatforms(): ShoppingPlatform[] {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const names = ['拼多多', '淘宝', '京东', '抖音', '唯品会', '美团', '其他'];

  return sortPlatforms(names.map((name, index) => ({
    id: `platform-${index + 1}`,
    name,
    colorToken: SHOPPING_PLATFORM_COLOR_PRESETS[index % SHOPPING_PLATFORM_COLOR_PRESETS.length],
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now,
  })));
}

function buildRecordDedupKey(record: Pick<ShoppingRecord, 'ledgerId' | 'date' | 'platform' | 'itemName' | 'price' | 'orderNo'>) {
  return [
    normalizeLedgerId(record.ledgerId).toLowerCase(),
    normalizeDate(record.date),
    record.platform.trim().toLowerCase(),
    record.itemName.trim().toLowerCase(),
    Number(record.price).toFixed(2),
    record.orderNo.trim().toLowerCase(),
  ].join('::');
}

function findLedgerByName(ledgers: ShoppingLedger[], name: string) {
  return ledgers.find((ledger) => ledger.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function findPlatformByName(platforms: ShoppingPlatform[], name: string) {
  return platforms.find((platform) => platform.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function ensurePositiveUsdtRate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USDT_RATE;
}

function normalizeRecord(
  record: Partial<ShoppingRecord>,
  fallbackLedgerId: string,
): ShoppingRecord {
  const date = normalizeDate(record.date);

  return {
    id: record.id ?? buildId(),
    ledgerId: normalizeLedgerId(String(record.ledgerId ?? fallbackLedgerId)) || fallbackLedgerId,
    date,
    platform: normalizeTrimmedValue(record.platform, '其他'),
    itemName: normalizeTrimmedValue(record.itemName, '未命名商品'),
    spec: normalizeTrimmedValue(record.spec),
    price: toNumber(record.price, 0),
    unitPrice: record.unitPrice === null || record.unitPrice === undefined
      ? null
      : toNumber(record.unitPrice, 0),
    orderNo: normalizeTrimmedValue(record.orderNo),
    note: normalizeTrimmedValue(record.note),
    createdAt: normalizeTimestamp(record.createdAt, date),
    updatedAt: normalizeTimestamp(record.updatedAt, date),
  };
}

function normalizeLedger(record: Partial<ShoppingLedger>): ShoppingLedger {
  const startDate = normalizeDate(record.startDate);
  const endDate = record.endDate ? normalizeDate(record.endDate) : '';

  return {
    id: record.id ?? buildId(),
    name: normalizeTrimmedValue(record.name, '默认账本'),
    description: normalizeTrimmedValue(record.description),
    startDate,
    endDate,
    isActive: Boolean(record.isActive),
    createdAt: normalizeTimestamp(record.createdAt, startDate),
    updatedAt: normalizeTimestamp(record.updatedAt, startDate),
  };
}

function normalizePlatform(record: Partial<ShoppingPlatform>, fallbackIndex: number): ShoppingPlatform {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    id: record.id ?? buildId(),
    name: normalizeTrimmedValue(record.name, `平台 ${fallbackIndex + 1}`),
    colorToken: normalizeTrimmedValue(
      record.colorToken,
      SHOPPING_PLATFORM_COLOR_PRESETS[fallbackIndex % SHOPPING_PLATFORM_COLOR_PRESETS.length],
    ),
    isBuiltIn: Boolean(record.isBuiltIn),
    createdAt: normalizeTimestamp(record.createdAt, dayjs(now).format(DATE_FORMAT)),
    updatedAt: normalizeTimestamp(record.updatedAt, dayjs(now).format(DATE_FORMAT)),
  };
}

export function buildInitialShoppingState(): ShoppingPageState {
  const ledgers = createInitialLedgers();
  const platforms = createInitialPlatforms();

  return {
    records: sortRecords([]),
    ledgers,
    platforms,
    settings: {
      activeLedgerId: ledgers[0].id,
      recordsLedgerId: SHOPPING_ALL_LEDGERS,
      dashboardLedgerId: SHOPPING_ALL_LEDGERS,
      currencyMode: 'CNY',
      usdtRate: DEFAULT_USDT_RATE,
    },
  };
}

export function normalizeShoppingPageState(state: ShoppingPageState): ShoppingPageState {
  const fallback = buildInitialShoppingState();
  const rawState = state as Partial<ShoppingPageState>;
  const rawLedgers = (rawState.ledgers?.length ? rawState.ledgers : fallback.ledgers).map(normalizeLedger);
  const ledgerIds = new Set(rawLedgers.map((ledger) => ledger.id));
  const activeLedgerFallback = rawLedgers[0]?.id ?? fallback.settings.activeLedgerId;

  const rawPlatforms = (rawState.platforms?.length ? rawState.platforms : fallback.platforms)
    .map((platform, index) => normalizePlatform(platform, index));

  const platformNameSet = new Set(rawPlatforms.map((platform) => platform.name.trim().toLowerCase()));
  const recordsSource = rawState.records?.length ? rawState.records : fallback.records;
  const normalizedRecords = sortRecords(recordsSource.map((record) => {
    const normalizedRecord = normalizeRecord(
      record,
      ledgerIds.has(String(record.ledgerId ?? '')) ? String(record.ledgerId) : activeLedgerFallback,
    );

    return ledgerIds.has(normalizedRecord.ledgerId)
      ? normalizedRecord
      : { ...normalizedRecord, ledgerId: activeLedgerFallback };
  }));

  const platformHydratedList = [...rawPlatforms];
  normalizedRecords.forEach((record) => {
    const key = record.platform.trim().toLowerCase();
    if (!platformNameSet.has(key)) {
      platformNameSet.add(key);
      platformHydratedList.push({
        id: buildId(),
        name: record.platform,
        colorToken: SHOPPING_PLATFORM_COLOR_PRESETS[platformHydratedList.length % SHOPPING_PLATFORM_COLOR_PRESETS.length],
        isBuiltIn: false,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }
  });

  const activeLedgerId = normalizeLedgerId(rawState.settings?.activeLedgerId ?? activeLedgerFallback);
  const resolvedActiveLedgerId = ledgerIds.has(activeLedgerId) ? activeLedgerId : activeLedgerFallback;
  const recordsLedgerId = normalizeLedgerId(rawState.settings?.recordsLedgerId ?? SHOPPING_ALL_LEDGERS);
  const dashboardLedgerId = normalizeLedgerId(rawState.settings?.dashboardLedgerId ?? SHOPPING_ALL_LEDGERS);

  return {
    records: normalizedRecords,
    ledgers: sortLedgers(rawLedgers),
    platforms: sortPlatforms(platformHydratedList),
    settings: {
      activeLedgerId: resolvedActiveLedgerId,
      recordsLedgerId: recordsLedgerId === SHOPPING_ALL_LEDGERS || ledgerIds.has(recordsLedgerId)
        ? recordsLedgerId
        : SHOPPING_ALL_LEDGERS,
      dashboardLedgerId: dashboardLedgerId === SHOPPING_ALL_LEDGERS || ledgerIds.has(dashboardLedgerId)
        ? dashboardLedgerId
        : SHOPPING_ALL_LEDGERS,
      currencyMode: normalizeCurrencyMode(rawState.settings?.currencyMode),
      usdtRate: ensurePositiveUsdtRate(rawState.settings?.usdtRate),
    },
  };
}

export function filterShoppingRecords(records: ShoppingRecord[], ledgerId: string) {
  const normalizedLedgerId = normalizeLedgerId(ledgerId);

  return records.filter((record) => {
    const matchesLedger = !normalizedLedgerId || normalizedLedgerId === SHOPPING_ALL_LEDGERS || record.ledgerId === normalizedLedgerId;
    return matchesLedger;
  });
}

export function createShoppingRecord(records: ShoppingRecord[], draft: ShoppingRecordDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRecords([
    {
      id: buildId(),
      ledgerId: normalizeLedgerId(draft.ledgerId),
      date: normalizeDate(draft.date),
      platform: draft.platform.trim() || '其他',
      itemName: draft.itemName.trim(),
      spec: draft.spec?.trim() ?? '',
      price: Number(draft.price.toFixed(2)),
      unitPrice: draft.unitPrice === null || draft.unitPrice === undefined ? null : Number(draft.unitPrice.toFixed(2)),
      orderNo: draft.orderNo?.trim() ?? '',
      note: draft.note?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateShoppingRecord(records: ShoppingRecord[], id: string, draft: ShoppingRecordDraft) {
  return sortRecords(records.map((record) => (
    record.id === id
      ? {
        ...record,
        ledgerId: normalizeLedgerId(draft.ledgerId),
        date: normalizeDate(draft.date),
        platform: draft.platform.trim() || '其他',
        itemName: draft.itemName.trim(),
        spec: draft.spec?.trim() ?? '',
        price: Number(draft.price.toFixed(2)),
        unitPrice: draft.unitPrice === null || draft.unitPrice === undefined ? null : Number(draft.unitPrice.toFixed(2)),
        orderNo: draft.orderNo?.trim() ?? '',
        note: draft.note?.trim() ?? '',
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteShoppingRecord(records: ShoppingRecord[], id: string) {
  return sortRecords(records.filter((record) => record.id !== id));
}

export function createShoppingLedger(ledgers: ShoppingLedger[], draft: ShoppingLedgerDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortLedgers([
    {
      id: buildId(),
      name: draft.name.trim(),
      description: draft.description?.trim() ?? '',
      startDate: normalizeDate(draft.startDate),
      endDate: draft.endDate ? normalizeDate(draft.endDate) : '',
      isActive: draft.isActive,
      createdAt: now,
      updatedAt: now,
    },
    ...ledgers.map((ledger) => (
      draft.isActive ? { ...ledger, isActive: false } : ledger
    )),
  ]);
}

export function updateShoppingLedger(ledgers: ShoppingLedger[], id: string, draft: ShoppingLedgerDraft) {
  return sortLedgers(ledgers.map((ledger) => {
    if (ledger.id === id) {
      return {
        ...ledger,
        name: draft.name.trim(),
        description: draft.description?.trim() ?? '',
        startDate: normalizeDate(draft.startDate),
        endDate: draft.endDate ? normalizeDate(draft.endDate) : '',
        isActive: draft.isActive,
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      };
    }

    if (draft.isActive) {
      return { ...ledger, isActive: false };
    }

    return ledger;
  }));
}

export function deleteShoppingLedger(ledgers: ShoppingLedger[], id: string) {
  return sortLedgers(ledgers.filter((ledger) => ledger.id !== id));
}

export function createShoppingPlatform(
  platforms: ShoppingPlatform[],
  draft: { name: string; colorToken?: string; isBuiltIn?: boolean },
) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortPlatforms([
    {
      id: buildId(),
      name: draft.name.trim(),
      colorToken: draft.colorToken ?? SHOPPING_PLATFORM_COLOR_PRESETS[platforms.length % SHOPPING_PLATFORM_COLOR_PRESETS.length],
      isBuiltIn: draft.isBuiltIn ?? false,
      createdAt: now,
      updatedAt: now,
    },
    ...platforms,
  ]);
}

export function updateShoppingPlatform(
  platforms: ShoppingPlatform[],
  id: string,
  draft: { name: string; colorToken?: string; isBuiltIn?: boolean },
) {
  return sortPlatforms(platforms.map((platform) => (
    platform.id === id
      ? {
        ...platform,
        name: draft.name.trim(),
        colorToken: draft.colorToken ?? platform.colorToken,
        isBuiltIn: draft.isBuiltIn ?? platform.isBuiltIn,
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : platform
  )));
}

export function deleteShoppingPlatform(platforms: ShoppingPlatform[], id: string) {
  return sortPlatforms(platforms.filter((platform) => platform.id !== id));
}

export function convertShoppingAmountByCurrencyMode(
  amount: number,
  currencyMode: ShoppingCurrencyMode,
  usdtRate: number,
) {
  if (currencyMode === 'USDT') {
    return Number((amount / ensurePositiveUsdtRate(usdtRate)).toFixed(2));
  }

  return Number(amount.toFixed(2));
}

export function formatShoppingAmount(
  amount: number,
  currencyMode: ShoppingCurrencyMode,
  usdtRate: number,
) {
  const converted = convertShoppingAmountByCurrencyMode(amount, currencyMode, usdtRate);
  return currencyMode === 'USDT'
    ? `USDT ${converted.toFixed(2)}`
    : `¥${converted.toFixed(2)}`;
}

export function resolveShoppingPlatformColor(name: string, platforms: ShoppingPlatform[]) {
  const matched = findPlatformByName(platforms, name);
  return matched?.colorToken || SHOPPING_PLATFORM_COLOR_PRESETS[0];
}

export function buildShoppingOverview(records: ShoppingRecord[], ledgerId: string): ShoppingOverviewSummary {
  const filtered = filterShoppingRecords(records, ledgerId);
  const currentMonth = dayjs().format(MONTH_FORMAT);
  const monthRecords = filtered.filter((record) => dayjs(record.date).format(MONTH_FORMAT) === currentMonth);
  const monthSet = new Set(filtered.map((record) => dayjs(record.date).format(MONTH_FORMAT)));
  const platformSet = new Set(filtered.map((record) => record.platform));

  return {
    currentMonthOrders: monthRecords.length,
    currentMonthAmount: Number(monthRecords.reduce((sum, record) => sum + record.price, 0).toFixed(2)),
    totalAmount: Number(filtered.reduce((sum, record) => sum + record.price, 0).toFixed(2)),
    totalOrders: filtered.length,
    activePlatformCount: platformSet.size,
    trackedMonths: monthSet.size,
  };
}

export function buildShoppingMonthlyTrend(
  records: ShoppingRecord[],
  ledgerId: string,
  monthCount = 12,
): ShoppingMonthlyTrendPoint[] {
  const filtered = filterShoppingRecords(records, ledgerId);

  return Array.from({ length: monthCount }, (_value, index) => {
    const month = dayjs().subtract(monthCount - index - 1, 'month').format(MONTH_FORMAT);
    const monthRecords = filtered.filter((record) => dayjs(record.date).format(MONTH_FORMAT) === month);

    return {
      month,
      label: dayjs(month).format('MM 月'),
      amount: Number(monthRecords.reduce((sum, record) => sum + record.price, 0).toFixed(2)),
      orderCount: monthRecords.length,
    };
  });
}

export function buildShoppingPlatformBreakdown(
  records: ShoppingRecord[],
  ledgerId: string,
  platforms: ShoppingPlatform[],
): ShoppingPlatformBreakdownPoint[] {
  const filtered = filterShoppingRecords(records, ledgerId);
  const grouped = new Map<string, { amount: number; count: number }>();

  filtered.forEach((record) => {
    const current = grouped.get(record.platform) ?? { amount: 0, count: 0 };
    grouped.set(record.platform, {
      amount: current.amount + record.price,
      count: current.count + 1,
    });
  });

  return Array.from(grouped.entries())
    .map(([name, summary]) => ({
      name,
      amount: Number(summary.amount.toFixed(2)),
      count: summary.count,
      color: resolveShoppingPlatformColor(name, platforms),
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function buildShoppingLedgerSummary(
  records: ShoppingRecord[],
  ledgers: ShoppingLedger[],
): ShoppingLedgerSummaryPoint[] {
  const filtered = filterShoppingRecords(records, SHOPPING_ALL_LEDGERS);

  return ledgers.map((ledger) => {
    const ledgerRecords = filtered.filter((record) => record.ledgerId === ledger.id);

    return {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      amount: Number(ledgerRecords.reduce((sum, record) => sum + record.price, 0).toFixed(2)),
      count: ledgerRecords.length,
      startDate: ledger.startDate,
      endDate: ledger.endDate,
      isActive: ledger.isActive,
    };
  }).sort((left, right) => right.amount - left.amount);
}

export function countRecordsByLedger(records: ShoppingRecord[], ledgerId: string) {
  return records.filter((record) => record.ledgerId === ledgerId).length;
}

export function dedupeImportedShoppingRecords(
  existingRecords: ShoppingRecord[],
  importedRecords: ShoppingRecord[],
) {
  const deduped: ShoppingRecord[] = [];
  const duplicateRows: number[] = [];
  const seen = new Set(existingRecords.map(buildRecordDedupKey));

  importedRecords.forEach((record, index) => {
    const key = buildRecordDedupKey(record);

    if (seen.has(key)) {
      duplicateRows.push(index);
      return;
    }

    seen.add(key);
    deduped.push(record);
  });

  return {
    uniqueRecords: deduped,
    duplicateRows,
  };
}

function normalizeImportDateCell(value: unknown) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return dayjs(new Date(parsed.y, parsed.m - 1, parsed.d)).format(DATE_FORMAT);
    }
  }

  const textValue = normalizeTrimmedValue(value);
  return textValue ? normalizeDate(textValue) : '';
}

function readAliasValue(row: Record<string, unknown>, aliases: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [key.replace(/\s+/g, '').toLowerCase(), value] as const);
  const normalizedRow = Object.fromEntries(normalizedEntries);

  for (const alias of aliases) {
    const hit = normalizedRow[alias.replace(/\s+/g, '').toLowerCase()];
    if (hit !== undefined && hit !== null && String(hit).trim() !== '') {
      return hit;
    }
  }

  return '';
}

function buildImportedRecord(
  row: Record<string, unknown>,
  rowNumber: number,
  options: {
    activeLedgerId: string;
    ledgers: ShoppingLedger[];
    platforms: ShoppingPlatform[];
  },
  createdLedgers: ShoppingLedger[],
  createdPlatforms: ShoppingPlatform[],
): { record: ShoppingRecord | null; invalid: ShoppingImportInvalidRow | null } {
  const rawLedgerName = readAliasValue(row, ['账本', '账本名称', 'ledger', 'ledgerName']);
  const rawDate = readAliasValue(row, ['日期', 'date']);
  const rawPlatform = readAliasValue(row, ['平台', '购买平台', 'platform']);
  const rawItemName = readAliasValue(row, ['商品名称', '商品名', 'itemname', 'itemName']);
  const rawSpec = readAliasValue(row, ['规格', 'spec']);
  const rawPrice = readAliasValue(row, ['价格', '总价', 'price']);
  const rawUnitPrice = readAliasValue(row, ['单价', 'unitprice', 'unitPrice']);
  const rawOrderNo = readAliasValue(row, ['订单号', 'orderNo', 'orderno']);
  const rawNote = readAliasValue(row, ['备注', 'note']);

  const date = normalizeImportDateCell(rawDate);
  const platformName = normalizeTrimmedValue(rawPlatform, '其他');
  const itemName = normalizeTrimmedValue(rawItemName);
  const price = toNumber(rawPrice, NaN);

  if (!date) {
    return { record: null, invalid: { rowNumber, reason: '缺少可解析的日期' } };
  }

  if (!itemName) {
    return { record: null, invalid: { rowNumber, reason: '缺少商品名称' } };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { record: null, invalid: { rowNumber, reason: '价格不是有效正数' } };
  }

  let ledgerId = options.activeLedgerId;
  const ledgerName = normalizeTrimmedValue(rawLedgerName);
  if (ledgerName) {
    const matchedLedger = findLedgerByName([...options.ledgers, ...createdLedgers], ledgerName);

    if (matchedLedger) {
      ledgerId = matchedLedger.id;
    } else {
      const now = dayjs().format(DATE_TIME_FORMAT);
      const nextLedger: ShoppingLedger = {
        id: buildId(),
        name: ledgerName,
        description: '由 Excel 导入自动创建',
        startDate: date,
        endDate: '',
        isActive: false,
        createdAt: now,
        updatedAt: now,
      };
      createdLedgers.push(nextLedger);
      ledgerId = nextLedger.id;
    }
  }

  if (!findPlatformByName([...options.platforms, ...createdPlatforms], platformName)) {
    const now = dayjs().format(DATE_TIME_FORMAT);
    createdPlatforms.push({
      id: buildId(),
      name: platformName,
      colorToken: SHOPPING_PLATFORM_COLOR_PRESETS[(options.platforms.length + createdPlatforms.length) % SHOPPING_PLATFORM_COLOR_PRESETS.length],
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    invalid: null,
    record: {
      id: buildId(),
      ledgerId,
      date,
      platform: platformName,
      itemName,
      spec: normalizeTrimmedValue(rawSpec),
      price: Number(price.toFixed(2)),
      unitPrice: rawUnitPrice === '' ? null : Number(toNumber(rawUnitPrice, 0).toFixed(2)),
      orderNo: normalizeTrimmedValue(rawOrderNo),
      note: normalizeTrimmedValue(rawNote),
      createdAt: now,
      updatedAt: now,
    },
  };
}

export async function importShoppingWorkbook(
  file: File,
  options: {
    activeLedgerId: string;
    records: ShoppingRecord[];
    ledgers: ShoppingLedger[];
    platforms: ShoppingPlatform[];
  },
): Promise<ShoppingImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return {
      totalRows: 0,
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
      createdLedgerCount: 0,
      createdPlatformCount: 0,
      importedRecords: [],
      invalidRows: [{ rowNumber: 0, reason: '未读取到可用工作表' }],
      nextRecords: options.records,
      nextLedgers: options.ledgers,
      nextPlatforms: options.platforms,
    };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const invalidRows: ShoppingImportInvalidRow[] = [];
  const draftRecords: ShoppingRecord[] = [];
  const createdLedgers: ShoppingLedger[] = [];
  const createdPlatforms: ShoppingPlatform[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const { record, invalid } = buildImportedRecord(
      row,
      rowNumber,
      {
        activeLedgerId: options.activeLedgerId,
        ledgers: options.ledgers,
        platforms: options.platforms,
      },
      createdLedgers,
      createdPlatforms,
    );

    if (invalid) {
      invalidRows.push(invalid);
      return;
    }

    if (record) {
      draftRecords.push(record);
    }
  });

  const { uniqueRecords, duplicateRows } = dedupeImportedShoppingRecords(options.records, draftRecords);
  const nextLedgers = sortLedgers([...options.ledgers, ...createdLedgers]);
  const nextPlatforms = sortPlatforms([...options.platforms, ...createdPlatforms]);
  const nextRecords = sortRecords([...uniqueRecords, ...options.records]);

  return {
    totalRows: rows.length,
    importedCount: uniqueRecords.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    createdLedgerCount: createdLedgers.length,
    createdPlatformCount: createdPlatforms.length,
    importedRecords: uniqueRecords,
    invalidRows,
    nextRecords,
    nextLedgers,
    nextPlatforms,
  };
}
