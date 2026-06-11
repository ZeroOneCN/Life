import dayjs from 'dayjs';

import type {
  TravelArchiveSuggestion,
  TravelBook,
  TravelBookDraft,
  TravelBookStatus,
  TravelBookSummaryRow,
  TravelBreakdownPoint,
  TravelCategory,
  TravelDailyTrendPoint,
  TravelExpenseDraft,
  TravelExpenseRecord,
  TravelImportInvalidRow,
  TravelImportResult,
  TravelLeaderboardItem,
  TravelPageState,
  TravelPayChannel,
  TravelReportColumnKey,
  TravelReportData,
  TravelSummaryStats,
} from '../types/travel';

export { TRAVEL_BOOK_STATUSES } from '../types/travel';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const TIME_FORMAT = 'HH:mm';

export const TRAVEL_ALL_BOOKS = 'all';
export const TRAVEL_RECORD_PAGE_SIZE = 10;
export const DEFAULT_TRAVEL_BOOK_STATUS: TravelBookStatus = 'ongoing';
export const DEFAULT_TRAVEL_BOOK_CURRENCY = 'CNY';

export const TRAVEL_BOOK_STATUS_LABELS: Record<TravelBookStatus, string> = {
  planning: '计划中',
  ongoing: '进行中',
  completed: '已完成',
  archived: '已归档',
};

export const TRAVEL_BOOK_STATUS_TONES: Record<TravelBookStatus, 'default' | 'blue' | 'green' | 'default'> = {
  planning: 'blue',
  ongoing: 'green',
  completed: 'default',
  archived: 'default',
};

export const TRAVEL_COMMON_CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD', 'JPY', 'GBP', 'AUD', 'SGD', 'KRW', 'THB'];
export const TRAVEL_DEFAULT_REPORT_COLUMNS: TravelReportColumnKey[] = [
  'date',
  'timeRange',
  'duration',
  'category',
  'title',
  'paid',
  'discount',
  'vehicleInfo',
  'payChannel',
  'remark',
];
export const TRAVEL_TIME_OPTIONS = Array.from({ length: 96 }, (_value, index) =>
  dayjs()
    .startOf('day')
    .add(index * 15, 'minute')
    .format(TIME_FORMAT),
);

const CATEGORY_LABELS: Record<TravelCategory, string> = {
  transport: '交通',
  hotel: '住宿',
  food: '餐饮',
  ticket: '门票',
  shopping: '购物',
  other: '其他',
};

/* 中文旧值或自定义输入回退映射 */
const CATEGORY_LABEL_FALLBACKS: Record<string, TravelCategory> = {
  交通: 'transport',
  住宿: 'hotel',
  酒店: 'hotel',
  餐饮: 'food',
  美食: 'food',
  门票: 'ticket',
  购物: 'shopping',
  其他: 'other',
};

const FALLBACK_PAY_CHANNELS = [
  { value: 'ALIPAY', label: '支付宝' },
  { value: 'WECHAT', label: '微信' },
  { value: 'UNIONPAY', label: '银联' },
  { value: 'CASH', label: '现金' },
  { value: 'CREDIT_CARD', label: '信用卡' },
  { value: 'OTHER', label: '其他' },
] as const;

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function normalizeTrimmedValue(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
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

function normalizeTime(value: unknown, fallback = '00:00') {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return fallback;
  }

  const parsed = dayjs(raw, ['HH:mm', 'H:mm'], true);
  return parsed.isValid() ? parsed.format(TIME_FORMAT) : fallback;
}

function normalizeCategory(value: unknown): TravelCategory {
  const raw = String(value ?? '').trim().toLowerCase();

  if (raw === 'transport') return 'transport';
  if (raw === 'hotel') return 'hotel';
  if (raw === 'food') return 'food';
  if (raw === 'ticket') return 'ticket';
  if (raw === 'shopping') return 'shopping';

  return 'other';
}

function buildDateTime(date: string, time: string) {
  return dayjs(`${date}T${time}`);
}

function normalizeBookId(value: string) {
  return value.trim();
}

export function getTravelCategoryLabel(category: TravelCategory | string) {
  if (!category) return '其他';
  /* 英文枚举走主映射 */
  if (Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category)) {
    return CATEGORY_LABELS[category as TravelCategory];
  }
  /* 中文/旧值/自定义走回退映射（找到则用对应中文标签） */
  const normalized = CATEGORY_LABEL_FALLBACKS[category as string];
  if (normalized) {
    return CATEGORY_LABELS[normalized];
  }
  return category as string;
}

export function getTravelPayChannelLabel(value: string, payChannels: TravelPayChannel[]) {
  const normalized = value.trim();
  const matched = payChannels.find((channel) => channel.value === normalized);
  return matched?.label || normalized || '其他';
}

export function formatTravelAmount(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `¥${amount.toFixed(2)}`;
}

export function formatTravelDateTime(value: string) {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '-';
}

export function formatTravelDateRange(startDate: string, endDate: string) {
  if (startDate && endDate) {
    return `${startDate} - ${endDate}`;
  }
  if (startDate) {
    return `开始：${startDate}`;
  }
  if (endDate) {
    return `结束：${endDate}`;
  }
  return '未设置日期';
}

export function formatTravelDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return '-';
  }

  if (minutes === 0) {
    return '0 分钟';
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours <= 0) {
    return `${remainder} 分钟`;
  }

  if (remainder <= 0) {
    return `${hours} 小时`;
  }

  return `${hours} 小时 ${remainder} 分钟`;
}

export function sanitizeTravelFileName(value: string) {
  return normalizeTrimmedValue(value, '旅行报告').replace(/[\\/:*?"<>|]/g, '_');
}

export function buildTravelTimeRangeLabel(record: Pick<TravelExpenseRecord, 'timeStart' | 'timeEnd'>) {
  return `${record.timeStart} - ${record.timeEnd}`;
}

export function calculateTravelDurationMinutes(timeStart: string, timeEnd: string, date?: string) {
  const start = normalizeTime(timeStart);
  const end = normalizeTime(timeEnd);
  const baseDate = date || dayjs().format(DATE_FORMAT);
  const startDate = buildDateTime(baseDate, start);
  let endDate = buildDateTime(baseDate, end);

  if (!startDate.isValid() || !endDate.isValid()) {
    return 0;
  }

  if (endDate.isBefore(startDate)) {
    endDate = endDate.add(1, 'day');
  }

  return Math.max(0, endDate.diff(startDate, 'minute'));
}

function netAmount(totalAmount: number, savedAmount: number) {
  const paid = totalAmount - savedAmount;
  return roundMoney(paid < 0 ? 0 : paid);
}

function sortBooks(books: TravelBook[]) {
  return [...books].sort((left, right) => dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf());
}

function sortRecords(records: TravelExpenseRecord[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.date).valueOf() - dayjs(left.date).valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    const startDiff = buildDateTime(right.date, right.timeStart).valueOf() - buildDateTime(left.date, left.timeStart).valueOf();
    if (startDiff !== 0) {
      return startDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortPayChannels(payChannels: TravelPayChannel[]) {
  return [...payChannels].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

function normalizeReportColumns(columns: TravelReportColumnKey[] | undefined) {
  const valid = (columns ?? []).filter((item) => TRAVEL_DEFAULT_REPORT_COLUMNS.includes(item));
  return valid.length ? valid : [...TRAVEL_DEFAULT_REPORT_COLUMNS];
}

function createInitialPayChannels() {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortPayChannels(FALLBACK_PAY_CHANNELS.map((item) => ({
    id: buildId(),
    value: item.value,
    label: item.label,
    createdAt: now,
    updatedAt: now,
  })));
}

function createInitialBooks(): TravelBook[] {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortBooks([
    {
      id: 'travel-book-shanghai',
      name: '上海周末漫游',
      description: '两天一夜城市游，覆盖交通、住宿、餐饮和门票消费。',
      startDate: dayjs().subtract(18, 'day').format(DATE_FORMAT),
      endDate: dayjs().subtract(17, 'day').format(DATE_FORMAT),
      summary: '地铁与步行的组合最省心，热门景点最好提前预约，餐饮支出略高于预期。',
      status: 'completed',
      currency: 'CNY',
      budget: 3000,
      archivedAt: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'travel-book-hangzhou',
      name: '杭州短途放松',
      description: '高铁往返，重点放在住宿体验和景区门票。',
      startDate: dayjs().subtract(42, 'day').format(DATE_FORMAT),
      endDate: dayjs().subtract(39, 'day').format(DATE_FORMAT),
      summary: '住宿性价比不错，西湖周边餐饮波动较大，建议下次提前锁定交通。',
      status: 'completed',
      currency: 'CNY',
      budget: 2500,
      archivedAt: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'travel-book-guangzhou',
      name: '广州美食之旅',
      description: '朋友结伴出行，餐饮和交通占比最高。',
      startDate: dayjs().subtract(10, 'day').format(DATE_FORMAT),
      endDate: dayjs().subtract(7, 'day').format(DATE_FORMAT),
      summary: '餐饮体验很丰富，但网约车支出明显偏高，下次可以更多使用地铁。',
      status: 'archived',
      currency: 'CNY',
      budget: 4000,
      archivedAt: dayjs().subtract(5, 'day').format(DATE_TIME_FORMAT),
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createMockRecord(draft: Omit<TravelExpenseDraft, 'date'> & { date: string; createdAtOffset: number }): TravelExpenseRecord {
  const createdAt = dayjs().subtract(draft.createdAtOffset, 'day').format(DATE_TIME_FORMAT);

  return {
    id: buildId(),
    bookId: draft.bookId,
    date: draft.date,
    timeStart: normalizeTime(draft.timeStart),
    timeEnd: normalizeTime(draft.timeEnd),
    durationMinutes: calculateTravelDurationMinutes(draft.timeStart, draft.timeEnd),
    category: draft.category,
    title: draft.title,
    amount: roundMoney(draft.amount),
    discountAmount: roundMoney(draft.discountAmount ?? 0),
    discountNote: normalizeTrimmedValue(draft.discountNote),
    vehicleInfo: normalizeTrimmedValue(draft.vehicleInfo),
    payChannel: normalizeTrimmedValue(draft.payChannel, 'ALIPAY'),
    remark: normalizeTrimmedValue(draft.remark),
    createdAt,
    updatedAt: createdAt,
  };
}

function createInitialRecords(): TravelExpenseRecord[] {
  return sortRecords([
    createMockRecord({
      bookId: 'travel-book-shanghai',
      date: dayjs().subtract(18, 'day').format(DATE_FORMAT),
      timeStart: '07:45',
      timeEnd: '10:50',
      category: 'transport',
      title: '高铁去程',
      amount: 553,
      discountAmount: 28,
      discountNote: '早鸟票优惠',
      vehicleInfo: 'G7152',
      payChannel: 'ALIPAY',
      remark: '提前一周锁票',
      createdAtOffset: 18,
    }),
    createMockRecord({
      bookId: 'travel-book-shanghai',
      date: dayjs().subtract(18, 'day').format(DATE_FORMAT),
      timeStart: '13:10',
      timeEnd: '14:30',
      category: 'ticket',
      title: '展览门票',
      amount: 198,
      discountAmount: 20,
      discountNote: '双人优惠',
      vehicleInfo: '',
      payChannel: 'WECHAT',
      remark: '现场扫码入场',
      createdAtOffset: 18,
    }),
    createMockRecord({
      bookId: 'travel-book-shanghai',
      date: dayjs().subtract(17, 'day').format(DATE_FORMAT),
      timeStart: '19:00',
      timeEnd: '20:40',
      category: 'food',
      title: '晚餐套餐',
      amount: 268,
      discountAmount: 36,
      discountNote: '团购抵扣',
      vehicleInfo: '',
      payChannel: 'CREDIT_CARD',
      remark: '朋友推荐餐厅',
      createdAtOffset: 17,
    }),
    createMockRecord({
      bookId: 'travel-book-hangzhou',
      date: dayjs().subtract(41, 'day').format(DATE_FORMAT),
      timeStart: '15:00',
      timeEnd: '15:40',
      category: 'hotel',
      title: '民宿预订尾款',
      amount: 688,
      discountAmount: 88,
      discountNote: '会员立减',
      vehicleInfo: '',
      payChannel: 'ALIPAY',
      remark: '湖景房升级',
      createdAtOffset: 41,
    }),
    createMockRecord({
      bookId: 'travel-book-hangzhou',
      date: dayjs().subtract(40, 'day').format(DATE_FORMAT),
      timeStart: '09:30',
      timeEnd: '10:20',
      category: 'transport',
      title: '网约车往返景区',
      amount: 96,
      discountAmount: 10,
      discountNote: '券包抵扣',
      vehicleInfo: '杭州东站 - 西湖',
      payChannel: 'WECHAT',
      remark: '',
      createdAtOffset: 40,
    }),
    createMockRecord({
      bookId: 'travel-book-guangzhou',
      date: dayjs().subtract(9, 'day').format(DATE_FORMAT),
      timeStart: '11:20',
      timeEnd: '12:30',
      category: 'food',
      title: '早茶套餐',
      amount: 232,
      discountAmount: 0,
      discountNote: '',
      vehicleInfo: '',
      payChannel: 'WECHAT',
      remark: '四人拼桌',
      createdAtOffset: 9,
    }),
  ]);
}

function normalizeBook(book: Partial<TravelBook>): TravelBook {
  const startDate = normalizeDate(book.startDate);
  const status = (book.status ?? DEFAULT_TRAVEL_BOOK_STATUS) as TravelBookStatus;
  const currency = (book.currency || DEFAULT_TRAVEL_BOOK_CURRENCY).toUpperCase();
  const budgetValue = Number(book.budget);
  const budget = Number.isFinite(budgetValue) && budgetValue >= 0 ? budgetValue : null;

  return {
    id: book.id ?? buildId(),
    name: normalizeTrimmedValue(book.name, '未命名行程账本'),
    description: normalizeTrimmedValue(book.description),
    startDate,
    endDate: book.endDate ? normalizeDate(book.endDate) : '',
    summary: normalizeTrimmedValue(book.summary),
    status,
    currency,
    budget,
    archivedAt: book.archivedAt ? normalizeTimestamp(book.archivedAt, startDate) : '',
    createdAt: normalizeTimestamp(book.createdAt, startDate),
    updatedAt: normalizeTimestamp(book.updatedAt, startDate),
  };
}

function normalizeRecord(record: Partial<TravelExpenseRecord>, fallbackBookId: string): TravelExpenseRecord {
  const date = normalizeDate(record.date);
  const timeStart = normalizeTime(record.timeStart, '09:00');
  const timeEnd = normalizeTime(record.timeEnd, '10:00');

  return {
    id: record.id ?? buildId(),
    bookId: normalizeBookId(String(record.bookId ?? fallbackBookId)) || fallbackBookId,
    date,
    timeStart,
    timeEnd,
    durationMinutes: calculateTravelDurationMinutes(timeStart, timeEnd),
    category: normalizeCategory(record.category),
    title: normalizeTrimmedValue(record.title, '未命名消费'),
    amount: roundMoney(toNumber(record.amount, 0)),
    discountAmount: roundMoney(toNumber(record.discountAmount, 0)),
    discountNote: normalizeTrimmedValue(record.discountNote),
    vehicleInfo: normalizeTrimmedValue(record.vehicleInfo),
    payChannel: normalizeTrimmedValue(record.payChannel, 'OTHER'),
    remark: normalizeTrimmedValue(record.remark),
    createdAt: normalizeTimestamp(record.createdAt, date),
    updatedAt: normalizeTimestamp(record.updatedAt, date),
  };
}

function normalizePayChannel(channel: Partial<TravelPayChannel>): TravelPayChannel {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    id: channel.id ?? buildId(),
    value: normalizeTrimmedValue(channel.value, 'OTHER').toUpperCase(),
    label: normalizeTrimmedValue(channel.label, '其他'),
    createdAt: normalizeTimestamp(channel.createdAt, dayjs(now).format(DATE_FORMAT)),
    updatedAt: normalizeTimestamp(channel.updatedAt, dayjs(now).format(DATE_FORMAT)),
  };
}

function buildRecordDedupKey(record: Pick<TravelExpenseRecord, 'bookId' | 'date' | 'timeStart' | 'timeEnd' | 'title' | 'amount'>) {
  return [
    normalizeBookId(record.bookId).toLowerCase(),
    normalizeDate(record.date),
    normalizeTime(record.timeStart),
    normalizeTime(record.timeEnd),
    record.title.trim().toLowerCase(),
    Number(record.amount).toFixed(2),
  ].join('::');
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

function normalizeImportDateCell(value: unknown) {
  const textValue = normalizeTrimmedValue(value);
  return textValue ? normalizeDate(textValue) : '';
}

async function normalizeImportDateCellAsync(value: unknown) {
  if (typeof value === 'number') {
    const XLSX = await import('xlsx');
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return dayjs(new Date(parsed.y, parsed.m - 1, parsed.d)).format(DATE_FORMAT);
    }
  }

  const textValue = normalizeTrimmedValue(value);
  return textValue ? normalizeDate(textValue) : '';
}

function parseImportedTimeRange(value: unknown) {
  const text = normalizeTrimmedValue(value);
  if (!text) {
    return { timeStart: '', timeEnd: '' };
  }

  const matched = text.split(/[-~～至]/).map((item) => normalizeTime(item, ''));
  return {
    timeStart: matched[0] || '',
    timeEnd: matched[1] || '',
  };
}

function findBookByName(books: TravelBook[], name: string) {
  return books.find((book) => book.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function findPayChannelByValue(payChannels: TravelPayChannel[], value: string) {
  const normalized = value.trim().toUpperCase();
  return payChannels.find((channel) => channel.value === normalized || channel.label === value.trim());
}

export function buildInitialTravelState(): TravelPageState {
  const books = createInitialBooks();
  const payChannels = createInitialPayChannels();

  return {
    books,
    records: createInitialRecords(),
    payChannels,
    settings: {
      activeBookId: books[0]?.id ?? '',
      detailsBookId: books[0]?.id ?? '',
      statsBookId: books[0]?.id ?? '',
      reportBookId: books[0]?.id ?? '',
      reportColumns: [...TRAVEL_DEFAULT_REPORT_COLUMNS],
    },
  };
}

export function normalizeTravelPageState(state: TravelPageState): TravelPageState {
  const fallback = buildInitialTravelState();
  const rawState = state as Partial<TravelPageState>;
  const sourceBooks = rawState.books?.length ? rawState.books : fallback.books;
  const normalizedBooks = sortBooks(sourceBooks.map((book) => normalizeBook(book)));
  const availableBookIds = new Set(normalizedBooks.map((book) => book.id));
  const activeBookFallback = normalizedBooks[0]?.id ?? '';
  const recordFallbackBookId = normalizedBooks[0]?.id ?? fallback.settings.activeBookId;
  const sourceRecords = rawState.records?.length ? rawState.records : fallback.records;
  const normalizedRecords = sortRecords(sourceRecords.map((record) => {
    const normalized = normalizeRecord(record, recordFallbackBookId);
    return availableBookIds.has(normalized.bookId) ? normalized : { ...normalized, bookId: recordFallbackBookId };
  }));
  const sourcePayChannels = rawState.payChannels?.length ? rawState.payChannels : fallback.payChannels;
  const normalizedPayChannels = sourcePayChannels.map(normalizePayChannel);
  const payChannelKeys = new Set(normalizedPayChannels.map((item) => item.value));

  normalizedRecords.forEach((record) => {
    const normalizedValue = normalizeTrimmedValue(record.payChannel, 'OTHER').toUpperCase();
    if (!payChannelKeys.has(normalizedValue)) {
      payChannelKeys.add(normalizedValue);
      normalizedPayChannels.push({
        id: buildId(),
        value: normalizedValue,
        label: record.payChannel.trim() || normalizedValue,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }
  });

  const activeBookId = normalizeBookId(rawState.settings?.activeBookId ?? activeBookFallback);
  const detailsBookId = normalizeBookId(rawState.settings?.detailsBookId ?? activeBookFallback);
  const statsBookId = normalizeBookId(rawState.settings?.statsBookId ?? activeBookFallback);
  const reportBookId = normalizeBookId(rawState.settings?.reportBookId ?? activeBookFallback);

  return {
    books: normalizedBooks,
    records: normalizedRecords,
    payChannels: sortPayChannels(normalizedPayChannels),
    settings: {
      activeBookId: availableBookIds.has(activeBookId) ? activeBookId : activeBookFallback,
      detailsBookId: detailsBookId === TRAVEL_ALL_BOOKS || availableBookIds.has(detailsBookId) ? detailsBookId : activeBookFallback,
      statsBookId: statsBookId === TRAVEL_ALL_BOOKS || availableBookIds.has(statsBookId) ? statsBookId : activeBookFallback,
      reportBookId: availableBookIds.has(reportBookId) ? reportBookId : activeBookFallback,
      reportColumns: normalizeReportColumns(rawState.settings?.reportColumns),
    },
  };
}

export function filterTravelRecords(records: TravelExpenseRecord[], bookId: string) {
  const normalizedBookId = normalizeBookId(bookId);

  return records.filter((record) => {
    const matchesBook = !normalizedBookId || normalizedBookId === TRAVEL_ALL_BOOKS || record.bookId === normalizedBookId;
    return matchesBook;
  });
}

export function createTravelBook(books: TravelBook[], draft: TravelBookDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const status = draft.status ?? DEFAULT_TRAVEL_BOOK_STATUS;
  const currency = (draft.currency ?? DEFAULT_TRAVEL_BOOK_CURRENCY).toUpperCase();

  return sortBooks([
    {
      id: buildId(),
      name: draft.name.trim(),
      description: draft.description?.trim() ?? '',
      startDate: normalizeDate(draft.startDate),
      endDate: draft.endDate ? normalizeDate(draft.endDate) : '',
      summary: draft.summary?.trim() ?? '',
      status,
      currency,
      budget: typeof draft.budget === 'number' && Number.isFinite(draft.budget) ? draft.budget : null,
      archivedAt: status === 'archived' ? now : '',
      createdAt: now,
      updatedAt: now,
    },
    ...books,
  ]);
}

export function updateTravelBook(books: TravelBook[], id: string, draft: TravelBookDraft) {
  return sortBooks(books.map((book) => {
    if (book.id !== id) {
      return book;
    }

    const nextStatus = draft.status ?? book.status;
    const nextArchivedAt = nextStatus === 'archived'
      ? (book.archivedAt || dayjs().format(DATE_TIME_FORMAT))
      : (draft.status === 'archived' ? dayjs().format(DATE_TIME_FORMAT) : book.archivedAt);

    return {
      ...book,
      name: draft.name.trim(),
      description: draft.description?.trim() ?? '',
      startDate: normalizeDate(draft.startDate),
      endDate: draft.endDate ? normalizeDate(draft.endDate) : '',
      summary: draft.summary?.trim() ?? '',
      status: nextStatus,
      currency: (draft.currency ?? book.currency).toUpperCase(),
      budget: typeof draft.budget === 'number' ? draft.budget : book.budget,
      archivedAt: draft.status !== undefined ? nextArchivedAt : book.archivedAt,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    };
  }));
}

export function completeTravelBook(books: TravelBook[], id: string) {
  return sortBooks(books.map((book) => book.id === id
    ? {
      ...book,
      status: 'completed' as TravelBookStatus,
      endDate: book.endDate || dayjs().format('YYYY-MM-DD'),
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    }
    : book));
}

export function archiveTravelBook(books: TravelBook[], id: string) {
  return sortBooks(books.map((book) => book.id === id
    ? {
      ...book,
      status: 'archived' as TravelBookStatus,
      archivedAt: book.archivedAt || dayjs().format(DATE_TIME_FORMAT),
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    }
    : book));
}

export function mergeTravelBooks(existing: TravelBook[], incoming: TravelBook[]): TravelBook[] {
  const map = new Map<string, TravelBook>();
  existing.forEach((book) => map.set(book.id, book));
  incoming.forEach((book) => map.set(book.id, book));
  return sortBooks(Array.from(map.values()));
}

export function sortArchiveSuggestions(items: TravelArchiveSuggestion[]): TravelArchiveSuggestion[] {
  return [...items].sort((left, right) => right.daysAfterEnd - left.daysAfterEnd);
}

export function deleteTravelBook(books: TravelBook[], id: string) {
  return sortBooks(books.filter((book) => book.id !== id));
}

export function createTravelExpense(records: TravelExpenseRecord[], draft: TravelExpenseDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRecords([
    {
      id: buildId(),
      bookId: normalizeBookId(draft.bookId),
      date: normalizeDate(draft.date),
      timeStart: normalizeTime(draft.timeStart, '09:00'),
      timeEnd: normalizeTime(draft.timeEnd, '10:00'),
      durationMinutes: calculateTravelDurationMinutes(draft.timeStart, draft.timeEnd),
      category: normalizeCategory(draft.category),
      title: draft.title.trim(),
      amount: roundMoney(draft.amount),
      discountAmount: roundMoney(draft.discountAmount ?? 0),
      discountNote: draft.discountNote?.trim() ?? '',
      vehicleInfo: draft.vehicleInfo?.trim() ?? '',
      payChannel: normalizeTrimmedValue(draft.payChannel, 'OTHER'),
      remark: draft.remark?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateTravelExpense(records: TravelExpenseRecord[], id: string, draft: TravelExpenseDraft) {
  return sortRecords(records.map((record) => (
    record.id === id
      ? {
        ...record,
        bookId: normalizeBookId(draft.bookId),
        date: normalizeDate(draft.date),
        timeStart: normalizeTime(draft.timeStart, '09:00'),
        timeEnd: normalizeTime(draft.timeEnd, '10:00'),
        durationMinutes: calculateTravelDurationMinutes(draft.timeStart, draft.timeEnd),
        category: normalizeCategory(draft.category),
        title: draft.title.trim(),
        amount: roundMoney(draft.amount),
        discountAmount: roundMoney(draft.discountAmount ?? 0),
        discountNote: draft.discountNote?.trim() ?? '',
        vehicleInfo: draft.vehicleInfo?.trim() ?? '',
        payChannel: normalizeTrimmedValue(draft.payChannel, 'OTHER'),
        remark: draft.remark?.trim() ?? '',
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteTravelExpense(records: TravelExpenseRecord[], id: string) {
  return sortRecords(records.filter((record) => record.id !== id));
}

export function deleteTravelExpensesByBookId(records: TravelExpenseRecord[], bookId: string) {
  return sortRecords(records.filter((record) => record.bookId !== bookId));
}

export function createTravelPayChannel(payChannels: TravelPayChannel[], draft: { value: string; label: string }) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortPayChannels([
    {
      id: buildId(),
      value: normalizeTrimmedValue(draft.value, 'OTHER').toUpperCase(),
      label: normalizeTrimmedValue(draft.label, '其他'),
      createdAt: now,
      updatedAt: now,
    },
    ...payChannels,
  ]);
}

export function updateTravelPayChannel(payChannels: TravelPayChannel[], id: string, draft: { label: string }) {
  return sortPayChannels(payChannels.map((channel) => (
    channel.id === id
      ? {
        ...channel,
        label: normalizeTrimmedValue(draft.label, channel.label),
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : channel
  )));
}

export function buildTravelSummary(records: TravelExpenseRecord[], payChannels: TravelPayChannel[]): TravelSummaryStats {
  const totalCount = records.length;
  const totalAmount = roundMoney(records.reduce((sum, record) => sum + record.amount, 0));
  const totalSaved = roundMoney(records.reduce((sum, record) => sum + record.discountAmount, 0));
  const categoryBreakdown = buildTravelCategoryBreakdown(records);
  const payChannelBreakdown = buildTravelPayChannelBreakdown(records, payChannels);

  return {
    totalCount,
    totalAmount,
    totalSaved,
    totalPaidAmount: netAmount(totalAmount, totalSaved),
    topCategoryName: categoryBreakdown[0]?.name ?? '暂无',
    topPayChannelName: payChannelBreakdown[0]?.name ?? '暂无',
  };
}

export function buildTravelDailyTrend(records: TravelExpenseRecord[]): TravelDailyTrendPoint[] {
  const grouped = new Map<string, TravelDailyTrendPoint>();

  records.forEach((record) => {
    const key = record.date;
    const current = grouped.get(key) ?? {
      date: key,
      label: dayjs(key).format('MM/DD'),
      totalAmount: 0,
      savedAmount: 0,
      paidAmount: 0,
      count: 0,
    };

    current.totalAmount += record.amount;
    current.savedAmount += record.discountAmount;
    current.count += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      totalAmount: roundMoney(item.totalAmount),
      savedAmount: roundMoney(item.savedAmount),
      paidAmount: netAmount(item.totalAmount, item.savedAmount),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-30);
}

export function buildTravelCategoryBreakdown(records: TravelExpenseRecord[]): TravelBreakdownPoint[] {
  const grouped = new Map<TravelCategory, TravelBreakdownPoint>();

  records.forEach((record) => {
    const normalized = (CATEGORY_LABEL_FALLBACKS[record.category] ?? record.category) as TravelCategory;
    const current = grouped.get(normalized) ?? {
      name: getTravelCategoryLabel(record.category),
      count: 0,
      totalAmount: 0,
      savedAmount: 0,
      paidAmount: 0,
    };

    current.count += 1;
    current.totalAmount += record.amount;
    current.savedAmount += record.discountAmount;
    grouped.set(normalized, current);
  });

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      totalAmount: roundMoney(item.totalAmount),
      savedAmount: roundMoney(item.savedAmount),
      paidAmount: netAmount(item.totalAmount, item.savedAmount),
    }))
    .sort((left, right) => right.paidAmount - left.paidAmount);
}

export function buildTravelPayChannelBreakdown(records: TravelExpenseRecord[], payChannels: TravelPayChannel[]): TravelBreakdownPoint[] {
  const grouped = new Map<string, TravelBreakdownPoint>();

  records.forEach((record) => {
    const key = normalizeTrimmedValue(record.payChannel, 'OTHER');
    const current = grouped.get(key) ?? {
      name: getTravelPayChannelLabel(key, payChannels),
      count: 0,
      totalAmount: 0,
      savedAmount: 0,
      paidAmount: 0,
    };

    current.count += 1;
    current.totalAmount += record.amount;
    current.savedAmount += record.discountAmount;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      totalAmount: roundMoney(item.totalAmount),
      savedAmount: roundMoney(item.savedAmount),
      paidAmount: netAmount(item.totalAmount, item.savedAmount),
    }))
    .sort((left, right) => right.paidAmount - left.paidAmount);
}

export function buildTravelLeaderboard(books: TravelBook[], records: TravelExpenseRecord[]): TravelLeaderboardItem[] {
  const scopedBookIds = new Set(books.map((book) => book.id));
  const scopedRecords = filterTravelRecords(records, TRAVEL_ALL_BOOKS).filter((record) => scopedBookIds.has(record.bookId));

  return books.map((book) => {
    const bookRecords = scopedRecords.filter((record) => record.bookId === book.id);
    const totalAmount = roundMoney(bookRecords.reduce((sum, record) => sum + record.amount, 0));
    const totalSaved = roundMoney(bookRecords.reduce((sum, record) => sum + record.discountAmount, 0));

    return {
      bookId: book.id,
      bookName: book.name,
      totalCount: bookRecords.length,
      totalAmount,
      totalSaved,
      totalPaidAmount: netAmount(totalAmount, totalSaved),
      updatedAt: book.updatedAt,
    };
  }).sort((left, right) => right.totalPaidAmount - left.totalPaidAmount);
}

export function buildTravelBookSummaries(books: TravelBook[], records: TravelExpenseRecord[]): TravelBookSummaryRow[] {
  return books.map((book) => {
    const bookRecords = records.filter((record) => record.bookId === book.id);
    const totalAmount = roundMoney(bookRecords.reduce((sum, record) => sum + record.amount, 0));
    const totalSaved = roundMoney(bookRecords.reduce((sum, record) => sum + record.discountAmount, 0));

    return {
      bookId: book.id,
      bookName: book.name,
      dateRange: formatTravelDateRange(book.startDate, book.endDate),
      totalCount: bookRecords.length,
      totalAmount,
      totalSaved,
      totalPaidAmount: netAmount(totalAmount, totalSaved),
      updatedAt: book.updatedAt,
    };
  });
}

export function buildTravelReportData(
  books: TravelBook[],
  records: TravelExpenseRecord[],
  payChannels: TravelPayChannel[],
  bookId: string,
): TravelReportData {
  const book = books.find((item) => item.id === bookId) ?? null;
  const scopedRecords = filterTravelRecords(records, bookId);

  return {
    book,
    summary: buildTravelSummary(scopedRecords, payChannels),
    categoryBreakdown: buildTravelCategoryBreakdown(scopedRecords),
    payChannelBreakdown: buildTravelPayChannelBreakdown(scopedRecords, payChannels),
    dailyTrend: buildTravelDailyTrend(scopedRecords),
    records: scopedRecords,
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
  };
}

export function dedupeImportedTravelRecords(existingRecords: TravelExpenseRecord[], importedRecords: TravelExpenseRecord[]) {
  const uniqueRecords: TravelExpenseRecord[] = [];
  const duplicateRows: number[] = [];
  const seen = new Set(existingRecords.map(buildRecordDedupKey));

  importedRecords.forEach((record, index) => {
    const key = buildRecordDedupKey(record);

    if (seen.has(key)) {
      duplicateRows.push(index);
      return;
    }

    seen.add(key);
    uniqueRecords.push(record);
  });

  return {
    uniqueRecords,
    duplicateRows,
  };
}

function buildImportedRecord(
  row: Record<string, unknown>,
  rowNumber: number,
  options: {
    activeBookId: string;
    books: TravelBook[];
    payChannels: TravelPayChannel[];
  },
  createdBooks: TravelBook[],
  createdPayChannels: TravelPayChannel[],
): { record: TravelExpenseRecord | null; invalid: TravelImportInvalidRow | null } {
  const rawBookName = readAliasValue(row, ['行程账本', '账本', 'book', 'bookName']);
  const rawDate = readAliasValue(row, ['日期', 'date']);
  const rawTimeStart = readAliasValue(row, ['开始时间', 'timeStart']);
  const rawTimeEnd = readAliasValue(row, ['结束时间', 'timeEnd']);
  const rawTimeRange = readAliasValue(row, ['时间段', 'timeRange']);
  const rawCategory = readAliasValue(row, ['分类', 'category']);
  const rawTitle = readAliasValue(row, ['项目', '标题', 'title']);
  const rawAmount = readAliasValue(row, ['原价', '金额', 'amount']);
  const rawDiscount = readAliasValue(row, ['优惠', '节省', 'discountAmount']);
  const rawDiscountNote = readAliasValue(row, ['优惠说明', 'discountNote']);
  const rawVehicleInfo = readAliasValue(row, ['交通信息', 'vehicleInfo']);
  const rawPayChannel = readAliasValue(row, ['支付方式', '支付渠道', 'payChannel']);
  const rawRemark = readAliasValue(row, ['备注', 'remark']);

  const date = normalizeImportDateCell(rawDate);
  const title = normalizeTrimmedValue(rawTitle);
  const amount = toNumber(rawAmount, NaN);
  const discountAmount = toNumber(rawDiscount, 0);
  const range = parseImportedTimeRange(rawTimeRange);
  const timeStart = normalizeTime(rawTimeStart || range.timeStart, '09:00');
  const timeEnd = normalizeTime(rawTimeEnd || range.timeEnd, '10:00');

  if (!date) {
    return { record: null, invalid: { rowNumber, reason: '缺少可解析的日期' } };
  }

  if (!title) {
    return { record: null, invalid: { rowNumber, reason: '缺少项目名称' } };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { record: null, invalid: { rowNumber, reason: '金额不是有效正数' } };
  }

  let bookId = options.activeBookId;
  const bookName = normalizeTrimmedValue(rawBookName);
  if (bookName) {
    const matchedBook = findBookByName([...options.books, ...createdBooks], bookName);

    if (matchedBook) {
      bookId = matchedBook.id;
    } else {
      const now = dayjs().format(DATE_TIME_FORMAT);
      const nextBook: TravelBook = {
        id: buildId(),
        name: bookName,
        description: '由 Excel 导入自动创建',
        startDate: date,
        endDate: date,
        summary: '',
        status: DEFAULT_TRAVEL_BOOK_STATUS,
        currency: DEFAULT_TRAVEL_BOOK_CURRENCY,
        budget: null,
        archivedAt: '',
        createdAt: now,
        updatedAt: now,
      };
      createdBooks.push(nextBook);
      bookId = nextBook.id;
    }
  }

  const payChannelInput = normalizeTrimmedValue(rawPayChannel, 'OTHER');
  if (!findPayChannelByValue([...options.payChannels, ...createdPayChannels], payChannelInput)) {
    const now = dayjs().format(DATE_TIME_FORMAT);
    createdPayChannels.push({
      id: buildId(),
      value: payChannelInput.toUpperCase(),
      label: payChannelInput,
      createdAt: now,
      updatedAt: now,
    });
  }

  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    invalid: null,
    record: {
      id: buildId(),
      bookId,
      date,
      timeStart,
      timeEnd,
      durationMinutes: calculateTravelDurationMinutes(timeStart, timeEnd),
      category: normalizeCategory(rawCategory),
      title,
      amount: roundMoney(amount),
      discountAmount: roundMoney(discountAmount),
      discountNote: normalizeTrimmedValue(rawDiscountNote),
      vehicleInfo: normalizeTrimmedValue(rawVehicleInfo),
      payChannel: payChannelInput.toUpperCase(),
      remark: normalizeTrimmedValue(rawRemark),
      createdAt: now,
      updatedAt: now,
    },
  };
}

export async function importTravelWorkbook(
  file: File,
  options: {
    activeBookId: string;
    books: TravelBook[];
    records: TravelExpenseRecord[];
    payChannels: TravelPayChannel[];
  },
): Promise<TravelImportResult> {
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
      createdBookCount: 0,
      createdPayChannelCount: 0,
      importedRecords: [],
      invalidRows: [{ rowNumber: 0, reason: '未读取到可用工作表' }],
      nextBooks: options.books,
      nextRecords: options.records,
      nextPayChannels: options.payChannels,
    };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const invalidRows: TravelImportInvalidRow[] = [];
  const draftRecords: TravelExpenseRecord[] = [];
  const createdBooks: TravelBook[] = [];
  const createdPayChannels: TravelPayChannel[] = [];

  for (const [index, row] of rows.entries()) {
    const preparedRow = { ...row };
    const rawDate = readAliasValue(preparedRow, ['日期', 'date']);
    if (rawDate !== '') {
      preparedRow.日期 = await normalizeImportDateCellAsync(rawDate);
    }

    const { record, invalid } = buildImportedRecord(
      preparedRow,
      index + 2,
      {
        activeBookId: options.activeBookId,
        books: options.books,
        payChannels: options.payChannels,
      },
      createdBooks,
      createdPayChannels,
    );

    if (invalid) {
      invalidRows.push(invalid);
      continue;
    }

    if (record) {
      draftRecords.push(record);
    }
  }

  const { uniqueRecords, duplicateRows } = dedupeImportedTravelRecords(options.records, draftRecords);
  const nextBooks = sortBooks([...options.books, ...createdBooks]);
  const nextPayChannels = sortPayChannels([...options.payChannels, ...createdPayChannels]);
  const nextRecords = sortRecords([...uniqueRecords, ...options.records]);

  return {
    totalRows: rows.length,
    importedCount: uniqueRecords.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    createdBookCount: createdBooks.length,
    createdPayChannelCount: createdPayChannels.length,
    importedRecords: uniqueRecords,
    invalidRows,
    nextBooks,
    nextRecords,
    nextPayChannels,
  };
}

export async function buildTravelImportTemplateWorkbook() {
  const XLSX = await import('xlsx');
  const rows = [
    {
      行程账本: '上海周末漫游',
      日期: dayjs().format(DATE_FORMAT),
      开始时间: '09:00',
      结束时间: '10:30',
      分类: 'transport',
      项目: '高铁去程',
      原价: 553,
      优惠: 28,
      优惠说明: '早鸟票优惠',
      交通信息: 'G7152',
      支付方式: 'ALIPAY',
      备注: '示例数据',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'travel_template');
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

async function renderTravelReportCanvas(node: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(node, {
    backgroundColor: '#0f1011',
    scale: 2,
    useCORS: true,
    onclone(clonedDoc) {
      const clonedNode = clonedDoc.body.querySelector('.travel-report-sheet') as HTMLElement | null;
      if (!clonedNode) return;
      sanitizeColorMixInClone(clonedDoc, clonedNode);
    },
  });
}

function sanitizeColorMixInClone(doc: Document, root: HTMLElement) {
  const COLOR_MIX_RE = /color-mix\s*\([^)]+\)/g;
  for (const styleEl of Array.from(doc.querySelectorAll('style'))) {
    if (styleEl.sheet) {
      try {
        for (const rule of Array.from(styleEl.sheet.cssRules) as CSSStyleRule[]) {
          if (rule.cssText && rule.cssText.includes('color-mix')) {
            rule.style.cssText = rule.style.cssText.replace(COLOR_MIX_RE, 'transparent');
          }
        }
      } catch (error) {
        // 跨域样式表访问 cssRules 可能抛出 SecurityError，静默处理
        console.error('读取CSS规则失败:', error);
      }
    }
    if (styleEl.textContent && styleEl.textContent.includes('color-mix')) {
      styleEl.textContent = styleEl.textContent.replace(COLOR_MIX_RE, 'transparent');
    }
  }
  const allElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of allElements) {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style && htmlEl.style.cssText.includes('color-mix')) {
      htmlEl.style.cssText = htmlEl.style.cssText.replace(COLOR_MIX_RE, 'transparent');
    }
    const cs = doc.defaultView?.getComputedStyle(htmlEl);
    if (!cs) continue;
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      try {
        if (cs.getPropertyValue(prop).includes('color-mix')) {
          htmlEl.style.setProperty(prop, 'transparent', 'important');
        }
      } catch (error) {
        // getComputedStyle 访问某些属性可能抛出异常，静默处理
        console.error('读取计算样式属性失败:', error);
      }
    }
  }
}

export async function exportTravelReportAsPng(node: HTMLElement, fileName: string) {
  const canvas = await renderTravelReportCanvas(node);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

  if (!blob) {
    throw new Error('未能生成 PNG 文件');
  }

  downloadBlob(blob, `${sanitizeTravelFileName(fileName)}.png`);
}

export async function exportTravelReportAsPdf(node: HTMLElement, fileName: string) {
  const canvas = await renderTravelReportCanvas(node);
  const imageData = canvas.toDataURL('image/png');
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const scale = contentWidth / canvas.width;
  const drawWidth = contentWidth;
  const drawHeight = canvas.height * scale;
  const pageCount = Math.max(1, Math.ceil(drawHeight / contentHeight));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    const y = margin - pageIndex * contentHeight;
    pdf.addImage(imageData, 'PNG', margin, y, drawWidth, drawHeight, undefined, 'FAST');
  }

  pdf.save(`${sanitizeTravelFileName(fileName)}.pdf`);
}
