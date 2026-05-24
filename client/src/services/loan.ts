import dayjs from 'dayjs';

import type { LoanPageState as LegacyLoanPageState } from '../types/pages';
import type {
  LoanBill,
  LoanBillDraft,
  LoanBillStatus,
  LoanMonthlyStats,
  LoanOverviewSummary,
  LoanPageState,
  LoanPlatform,
  LoanPlatformBreakdownPoint,
  LoanPlatformDraft,
  LoanRepayment,
  LoanRepaymentDraft,
  LoanTrendPoint,
} from '../types/loan';
import { readStorage } from '../utils/storage';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const MONTH_FORMAT = 'YYYY-MM';

const LEGACY_STORAGE_KEY = 'lifeos_loan_page';

export const DEFAULT_LOAN_USER_ID = 'user-001';
export const LOAN_ALL_PLATFORMS = 'all';
export const LOAN_BILL_PAGE_SIZE = 10;
export const LOAN_REPAYMENT_PAGE_SIZE = 10;
export const LOAN_PLATFORM_COLORS = ['#5e6ad2', '#1eaedb', '#27a644', '#f59e0b', '#e5484d', '#10b981'] as const;

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

  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format(MONTH_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

export function normalizeLoanUserId(value: string) {
  return value.trim();
}

export function formatLoanAmount(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `¥${amount.toFixed(2)}`;
}

function sortPlatforms(platforms: LoanPlatform[]) {
  return [...platforms].sort((left, right) => {
    if (left.userId !== right.userId) {
      return left.userId.localeCompare(right.userId, 'zh-CN');
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function sortBills(bills: LoanBill[]) {
  return [...bills].sort((left, right) => {
    const dueDateDiff = dayjs(left.dueDate).valueOf() - dayjs(right.dueDate).valueOf();

    if (dueDateDiff !== 0) {
      return dueDateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortRepayments(repayments: LoanRepayment[]) {
  return [...repayments].sort((left, right) => {
    const dateDiff = dayjs(right.repaymentDate).valueOf() - dayjs(left.repaymentDate).valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function normalizeLoanPlatform(record: Partial<LoanPlatform>, fallbackUserId = DEFAULT_LOAN_USER_ID): LoanPlatform {
  const createdAt = normalizeTimestamp(record.createdAt, dayjs().format(DATE_FORMAT));
  const updatedAt = normalizeTimestamp(record.updatedAt, dayjs(createdAt).format(DATE_FORMAT));

  return {
    id: record.id ?? buildId(),
    userId: normalizeLoanUserId(String(record.userId ?? fallbackUserId)) || fallbackUserId,
    name: normalizeTrimmedValue(record.name, '未命名平台'),
    billingDay: Math.min(31, Math.max(1, Math.round(toNumber(record.billingDay, 1)))),
    repaymentDay: Math.min(31, Math.max(1, Math.round(toNumber(record.repaymentDay, 1)))),
    creditLimit: roundMoney(toNumber(record.creditLimit, 0)),
    createdAt,
    updatedAt,
  };
}

function normalizeLoanBill(
  record: Partial<LoanBill>,
  platforms: LoanPlatform[],
  fallbackUserId = DEFAULT_LOAN_USER_ID,
): LoanBill {
  const billingMonth = normalizeMonth(record.billingMonth, normalizeMonth(record.dueDate));
  const dueDate = normalizeDate(record.dueDate, dayjs(`${billingMonth}-01`).format(DATE_FORMAT));
  const userId = normalizeLoanUserId(String(record.userId ?? fallbackUserId)) || fallbackUserId;
  const matchedPlatform = platforms.find((platform) => platform.id === record.platformId)
    ?? platforms.find((platform) => platform.userId === userId && platform.name === record.platformName);
  const platformId = record.platformId ?? matchedPlatform?.id ?? '';
  const platformName = normalizeTrimmedValue(record.platformName ?? matchedPlatform?.name, '未命名平台');
  const createdAt = normalizeTimestamp(record.createdAt, dueDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, dueDate);

  return {
    id: record.id ?? buildId(),
    userId,
    platformId,
    platformName,
    amount: roundMoney(toNumber(record.amount, 0)),
    interest: roundMoney(toNumber(record.interest, 0)),
    billingMonth,
    dueDate,
    notes: normalizeTrimmedValue(record.notes),
    isPaid: Boolean(record.isPaid),
    paidAt: record.isPaid ? normalizeDate(record.paidAt, dueDate) : '',
    createdAt,
    updatedAt,
  };
}

function normalizeLoanRepayment(
  record: Partial<LoanRepayment>,
  platforms: LoanPlatform[],
  bills: LoanBill[],
  fallbackUserId = DEFAULT_LOAN_USER_ID,
): LoanRepayment {
  const repaymentDate = normalizeDate(record.repaymentDate);
  const userId = normalizeLoanUserId(String(record.userId ?? fallbackUserId)) || fallbackUserId;
  const matchedBill = bills.find((bill) => bill.id === record.billId);
  const matchedPlatform = platforms.find((platform) => platform.id === record.platformId)
    ?? platforms.find((platform) => platform.id === matchedBill?.platformId)
    ?? platforms.find((platform) => platform.userId === userId && platform.name === record.platformName);

  return {
    id: record.id ?? buildId(),
    userId,
    billId: normalizeTrimmedValue(record.billId),
    platformId: normalizeTrimmedValue(record.platformId ?? matchedBill?.platformId ?? matchedPlatform?.id),
    platformName: normalizeTrimmedValue(record.platformName ?? matchedBill?.platformName ?? matchedPlatform?.name, '未命名平台'),
    amount: roundMoney(toNumber(record.amount, 0)),
    interest: roundMoney(toNumber(record.interest, 0)),
    repaymentDate,
    notes: normalizeTrimmedValue(record.notes),
    createdAt: normalizeTimestamp(record.createdAt, repaymentDate),
    updatedAt: normalizeTimestamp(record.updatedAt, repaymentDate),
  };
}

function normalizeSettings(
  settings: Partial<LoanPageState['settings']> | undefined,
  fallbackUserId: string,
): LoanPageState['settings'] {
  const activeUserId = normalizeLoanUserId(String(settings?.activeUserId ?? fallbackUserId)) || fallbackUserId;

  return {
    activeUserId,
    billsUserId: normalizeLoanUserId(String(settings?.billsUserId ?? activeUserId)),
    repaymentsUserId: normalizeLoanUserId(String(settings?.repaymentsUserId ?? activeUserId)),
    statisticsUserId: normalizeLoanUserId(String(settings?.statisticsUserId ?? activeUserId)),
    repaymentReminderEnabled: settings?.repaymentReminderEnabled ?? true,
    overdueReminderEnabled: settings?.overdueReminderEnabled ?? true,
    autoRepaymentOnMarkPaid: settings?.autoRepaymentOnMarkPaid ?? true,
    notificationFrequency: settings?.notificationFrequency === 'always' ? 'always' : 'daily',
    upcomingDays: Math.min(30, Math.max(0, Math.round(toNumber(settings?.upcomingDays, 7)))),
  };
}

function createInitialPlatforms() {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortPlatforms([
    {
      id: 'loan-platform-huabei',
      userId: 'user-001',
      name: '花呗',
      billingDay: 9,
      repaymentDay: 10,
      creditLimit: 12000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'loan-platform-jiebei',
      userId: 'user-001',
      name: '借呗',
      billingDay: 15,
      repaymentDay: 20,
      creditLimit: 30000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'loan-platform-jd',
      userId: 'user-001',
      name: '京东白条',
      billingDay: 6,
      repaymentDay: 15,
      creditLimit: 8000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'loan-platform-weilidai',
      userId: 'user-002',
      name: '微粒贷',
      billingDay: 10,
      repaymentDay: 18,
      creditLimit: 15000,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createInitialBills(platforms: LoanPlatform[]) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const byId = Object.fromEntries(platforms.map((platform) => [platform.id, platform]));

  return sortBills([
    {
      id: 'loan-bill-1',
      userId: 'user-001',
      platformId: 'loan-platform-huabei',
      platformName: byId['loan-platform-huabei']?.name ?? '花呗',
      amount: 1680,
      interest: 42,
      billingMonth: dayjs().format(MONTH_FORMAT),
      dueDate: dayjs().add(3, 'day').format(DATE_FORMAT),
      notes: '家居和数码配件分期',
      isPaid: false,
      paidAt: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'loan-bill-2',
      userId: 'user-001',
      platformId: 'loan-platform-jiebei',
      platformName: byId['loan-platform-jiebei']?.name ?? '借呗',
      amount: 4200,
      interest: 88,
      billingMonth: dayjs().format(MONTH_FORMAT),
      dueDate: dayjs().subtract(2, 'day').format(DATE_FORMAT),
      notes: '短期周转',
      isPaid: false,
      paidAt: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'loan-bill-3',
      userId: 'user-001',
      platformId: 'loan-platform-jd',
      platformName: byId['loan-platform-jd']?.name ?? '京东白条',
      amount: 980,
      interest: 16,
      billingMonth: dayjs().subtract(1, 'month').format(MONTH_FORMAT),
      dueDate: dayjs().subtract(10, 'day').format(DATE_FORMAT),
      notes: '家电尾款',
      isPaid: true,
      paidAt: dayjs().subtract(11, 'day').format(DATE_FORMAT),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'loan-bill-4',
      userId: 'user-002',
      platformId: 'loan-platform-weilidai',
      platformName: byId['loan-platform-weilidai']?.name ?? '微粒贷',
      amount: 2500,
      interest: 57,
      billingMonth: dayjs().format(MONTH_FORMAT),
      dueDate: dayjs().add(8, 'day').format(DATE_FORMAT),
      notes: '备用金',
      isPaid: false,
      paidAt: '',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

function createInitialRepayments(bills: LoanBill[]) {
  const paidBill = bills.find((bill) => bill.id === 'loan-bill-3');

  if (!paidBill) {
    return [] as LoanRepayment[];
  }

  return sortRepayments([
    {
      id: 'loan-repayment-1',
      userId: paidBill.userId,
      billId: paidBill.id,
      platformId: paidBill.platformId,
      platformName: paidBill.platformName,
      amount: paidBill.amount,
      interest: paidBill.interest,
      repaymentDate: paidBill.paidAt || paidBill.dueDate,
      notes: '从历史已还账单迁移而来',
      createdAt: dayjs(`${paidBill.paidAt || paidBill.dueDate}T10:00`).format(DATE_TIME_FORMAT),
      updatedAt: dayjs(`${paidBill.paidAt || paidBill.dueDate}T10:00`).format(DATE_TIME_FORMAT),
    },
  ]);
}

function createDefaultState(): LoanPageState {
  const platforms = createInitialPlatforms();
  const bills = createInitialBills(platforms);
  const repayments = createInitialRepayments(bills);

  return {
    platforms,
    bills,
    repayments,
    settings: {
      activeUserId: DEFAULT_LOAN_USER_ID,
      billsUserId: DEFAULT_LOAN_USER_ID,
      repaymentsUserId: DEFAULT_LOAN_USER_ID,
      statisticsUserId: DEFAULT_LOAN_USER_ID,
      repaymentReminderEnabled: true,
      overdueReminderEnabled: true,
      autoRepaymentOnMarkPaid: true,
      notificationFrequency: 'daily',
      upcomingDays: 7,
    },
  };
}

function isLegacyLoanState(value: unknown): value is LegacyLoanPageState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Array.isArray((value as LegacyLoanPageState).bills) && !('platforms' in (value as Record<string, unknown>));
}

export function migrateLegacyLoanState(legacyState: LegacyLoanPageState | null | undefined): LoanPageState {
  if (!legacyState) {
    return createDefaultState();
  }

  const now = dayjs().format(DATE_TIME_FORMAT);
  const platformNameSet = Array.from(new Set(
    legacyState.bills.map((bill) => normalizeTrimmedValue(bill.platform, '未命名平台')),
  ));

  const platforms = sortPlatforms(platformNameSet.map((name, index) => ({
    id: `loan-platform-legacy-${index + 1}`,
    userId: DEFAULT_LOAN_USER_ID,
    name,
    billingDay: 10 + (index % 5),
    repaymentDay: 15 + (index % 5),
    creditLimit: 10000,
    createdAt: now,
    updatedAt: now,
  })));

  const bills = sortBills(legacyState.bills.map((bill, index) => {
    const matchedPlatform = platforms.find((platform) => platform.name === normalizeTrimmedValue(bill.platform, '未命名平台'));
    const dueDate = normalizeDate(bill.dueDate);

    return {
      id: bill.id || `loan-bill-legacy-${index + 1}`,
      userId: DEFAULT_LOAN_USER_ID,
      platformId: matchedPlatform?.id ?? '',
      platformName: matchedPlatform?.name ?? normalizeTrimmedValue(bill.platform, '未命名平台'),
      amount: roundMoney(toNumber(bill.amount, 0)),
      interest: 0,
      billingMonth: normalizeMonth(dueDate),
      dueDate,
      notes: '',
      isPaid: Boolean(bill.paid),
      paidAt: bill.paid ? dueDate : '',
      createdAt: normalizeTimestamp(dueDate, dueDate),
      updatedAt: normalizeTimestamp(dueDate, dueDate),
    } satisfies LoanBill;
  }));

  const repayments = sortRepayments(
    bills
      .filter((bill) => bill.isPaid)
      .map((bill, index) => ({
        id: `loan-repayment-legacy-${index + 1}`,
        userId: bill.userId,
        billId: bill.id,
        platformId: bill.platformId,
        platformName: bill.platformName,
        amount: bill.amount,
        interest: bill.interest,
        repaymentDate: bill.paidAt || bill.dueDate,
        notes: '从旧贷款页迁移',
        createdAt: normalizeTimestamp(bill.paidAt || bill.dueDate, bill.dueDate),
        updatedAt: normalizeTimestamp(bill.paidAt || bill.dueDate, bill.dueDate),
      })),
  );

  return {
    platforms,
    bills,
    repayments,
    settings: normalizeSettings(legacyState.settings, DEFAULT_LOAN_USER_ID),
  };
}

export function buildInitialLoanState(): LoanPageState {
  const legacyState = readStorage<LegacyLoanPageState | null>(LEGACY_STORAGE_KEY, null);
  return legacyState ? migrateLegacyLoanState(legacyState) : createDefaultState();
}

export function normalizeLoanPageState(state: LoanPageState | LegacyLoanPageState | null | undefined): LoanPageState {
  if (isLegacyLoanState(state)) {
    return migrateLegacyLoanState(state);
  }

  const fallback = createDefaultState();
  const rawPlatforms = Array.isArray(state?.platforms) ? state.platforms : fallback.platforms;
  const platforms = sortPlatforms(rawPlatforms.map((platform) => normalizeLoanPlatform(platform)));
  const fallbackUserId = platforms[0]?.userId || DEFAULT_LOAN_USER_ID;
  const bills = sortBills(
    (Array.isArray(state?.bills) ? state.bills : fallback.bills).map((bill) =>
      normalizeLoanBill(bill, platforms, fallbackUserId)),
  );
  const repayments = sortRepayments(
    (Array.isArray(state?.repayments) ? state.repayments : fallback.repayments).map((repayment) =>
      normalizeLoanRepayment(repayment, platforms, bills, fallbackUserId)),
  );

  return {
    platforms,
    bills,
    repayments,
    settings: normalizeSettings(state?.settings, fallbackUserId),
  };
}

export function filterLoanPlatformsByUserId(platforms: LoanPlatform[], userId: string) {
  const normalizedUserId = normalizeLoanUserId(userId);

  if (!normalizedUserId) {
    return platforms;
  }

  return platforms.filter((platform) => platform.userId === normalizedUserId);
}

export function filterLoanBills(bills: LoanBill[], userId: string, platformId = LOAN_ALL_PLATFORMS) {
  const normalizedUserId = normalizeLoanUserId(userId);

  return bills
    .filter((bill) => !normalizedUserId || bill.userId === normalizedUserId)
    .filter((bill) => platformId === LOAN_ALL_PLATFORMS || bill.platformId === platformId);
}

export function filterLoanRepayments(repayments: LoanRepayment[], userId: string, platformId = LOAN_ALL_PLATFORMS) {
  const normalizedUserId = normalizeLoanUserId(userId);

  return repayments
    .filter((repayment) => !normalizedUserId || repayment.userId === normalizedUserId)
    .filter((repayment) => platformId === LOAN_ALL_PLATFORMS || repayment.platformId === platformId);
}

export function getLoanBillStatus(bill: LoanBill, referenceDate = dayjs()): LoanBillStatus {
  if (bill.isPaid) {
    return 'paid';
  }

  return dayjs(bill.dueDate).isBefore(referenceDate, 'day') ? 'overdue' : 'unpaid';
}

export function suggestLoanDueDate(platform: LoanPlatform | null | undefined, billingMonth: string) {
  const monthSeed = normalizeMonth(billingMonth);

  if (!platform) {
    return dayjs(`${monthSeed}-01`).format(DATE_FORMAT);
  }

  const baseMonth = dayjs(`${monthSeed}-01`);
  const day = Math.min(platform.repaymentDay, baseMonth.daysInMonth());
  return baseMonth.date(day).format(DATE_FORMAT);
}

export function createLoanPlatform(platforms: LoanPlatform[], draft: LoanPlatformDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortPlatforms([
    ...platforms,
    {
      id: buildId(),
      userId: normalizeLoanUserId(draft.userId) || DEFAULT_LOAN_USER_ID,
      name: draft.name.trim(),
      billingDay: Math.min(31, Math.max(1, Math.round(draft.billingDay))),
      repaymentDay: Math.min(31, Math.max(1, Math.round(draft.repaymentDay))),
      creditLimit: roundMoney(draft.creditLimit ?? 0),
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export function updateLoanPlatform(platforms: LoanPlatform[], platformId: string, draft: LoanPlatformDraft) {
  return sortPlatforms(platforms.map((platform) => {
    if (platform.id !== platformId) {
      return platform;
    }

    return {
      ...platform,
      userId: normalizeLoanUserId(draft.userId) || DEFAULT_LOAN_USER_ID,
      name: draft.name.trim(),
      billingDay: Math.min(31, Math.max(1, Math.round(draft.billingDay))),
      repaymentDay: Math.min(31, Math.max(1, Math.round(draft.repaymentDay))),
      creditLimit: roundMoney(draft.creditLimit ?? 0),
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    };
  }));
}

export function deleteLoanPlatform(platforms: LoanPlatform[], platformId: string) {
  return sortPlatforms(platforms.filter((platform) => platform.id !== platformId));
}

export function createLoanBill(platforms: LoanPlatform[], bills: LoanBill[], draft: LoanBillDraft) {
  const platform = platforms.find((item) => item.id === draft.platformId);
  const now = dayjs().format(DATE_TIME_FORMAT);
  const dueDate = normalizeDate(draft.dueDate, suggestLoanDueDate(platform, draft.billingMonth));

  return sortBills([
    ...bills,
    {
      id: buildId(),
      userId: normalizeLoanUserId(draft.userId) || DEFAULT_LOAN_USER_ID,
      platformId: draft.platformId,
      platformName: platform?.name ?? '未命名平台',
      amount: roundMoney(draft.amount),
      interest: roundMoney(draft.interest ?? 0),
      billingMonth: normalizeMonth(draft.billingMonth),
      dueDate,
      notes: draft.notes?.trim() ?? '',
      isPaid: Boolean(draft.isPaid),
      paidAt: draft.isPaid ? dueDate : '',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export function updateLoanBill(platforms: LoanPlatform[], bills: LoanBill[], billId: string, draft: LoanBillDraft) {
  const platform = platforms.find((item) => item.id === draft.platformId);

  return sortBills(bills.map((bill) => {
    if (bill.id !== billId) {
      return bill;
    }

    const dueDate = normalizeDate(draft.dueDate, suggestLoanDueDate(platform, draft.billingMonth));
    const isPaid = draft.isPaid ?? bill.isPaid;

    return {
      ...bill,
      userId: normalizeLoanUserId(draft.userId) || DEFAULT_LOAN_USER_ID,
      platformId: draft.platformId,
      platformName: platform?.name ?? bill.platformName,
      amount: roundMoney(draft.amount),
      interest: roundMoney(draft.interest ?? 0),
      billingMonth: normalizeMonth(draft.billingMonth),
      dueDate,
      notes: draft.notes?.trim() ?? '',
      isPaid,
      paidAt: isPaid ? (bill.paidAt || dueDate) : '',
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    };
  }));
}

export function deleteLoanBill(bills: LoanBill[], billId: string) {
  return sortBills(bills.filter((bill) => bill.id !== billId));
}

export function createLoanRepayment(
  platforms: LoanPlatform[],
  bills: LoanBill[],
  repayments: LoanRepayment[],
  draft: LoanRepaymentDraft,
) {
  const matchedBill = draft.billId ? bills.find((bill) => bill.id === draft.billId) : null;
  const platform = platforms.find((item) => item.id === draft.platformId)
    ?? platforms.find((item) => item.id === matchedBill?.platformId);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRepayments([
    ...repayments,
    {
      id: buildId(),
      userId: normalizeLoanUserId(draft.userId) || DEFAULT_LOAN_USER_ID,
      billId: draft.billId?.trim() ?? '',
      platformId: draft.platformId,
      platformName: platform?.name ?? matchedBill?.platformName ?? '未命名平台',
      amount: roundMoney(draft.amount),
      interest: roundMoney(draft.interest ?? 0),
      repaymentDate: normalizeDate(draft.repaymentDate),
      notes: draft.notes?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export function updateLoanRepayment(
  platforms: LoanPlatform[],
  bills: LoanBill[],
  repayments: LoanRepayment[],
  repaymentId: string,
  draft: LoanRepaymentDraft,
) {
  const matchedBill = draft.billId ? bills.find((bill) => bill.id === draft.billId) : null;
  const platform = platforms.find((item) => item.id === draft.platformId)
    ?? platforms.find((item) => item.id === matchedBill?.platformId);

  return sortRepayments(repayments.map((repayment) => {
    if (repayment.id !== repaymentId) {
      return repayment;
    }

    return {
      ...repayment,
      userId: normalizeLoanUserId(draft.userId) || DEFAULT_LOAN_USER_ID,
      billId: draft.billId?.trim() ?? '',
      platformId: draft.platformId,
      platformName: platform?.name ?? matchedBill?.platformName ?? repayment.platformName,
      amount: roundMoney(draft.amount),
      interest: roundMoney(draft.interest ?? 0),
      repaymentDate: normalizeDate(draft.repaymentDate),
      notes: draft.notes?.trim() ?? '',
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    };
  }));
}

export function deleteLoanRepayment(repayments: LoanRepayment[], repaymentId: string) {
  return sortRepayments(repayments.filter((repayment) => repayment.id !== repaymentId));
}

export function markLoanBillAsPaid(
  bills: LoanBill[],
  repayments: LoanRepayment[],
  billId: string,
  autoCreateRepayment: boolean,
) {
  const targetBill = bills.find((bill) => bill.id === billId);

  if (!targetBill || targetBill.isPaid) {
    return { bills, repayments, createdRepayment: false };
  }

  const paidAt = dayjs().format(DATE_FORMAT);
  const nextBills = sortBills(bills.map((bill) => (
    bill.id === billId
      ? {
          ...bill,
          isPaid: true,
          paidAt,
          updatedAt: dayjs().format(DATE_TIME_FORMAT),
        }
      : bill
  )));

  if (!autoCreateRepayment) {
    return {
      bills: nextBills,
      repayments,
      createdRepayment: false,
    };
  }

  const existingRepayment = repayments.some((repayment) => repayment.billId === billId);

  if (existingRepayment) {
    return {
      bills: nextBills,
      repayments,
      createdRepayment: false,
    };
  }

  const now = dayjs().format(DATE_TIME_FORMAT);
  const nextRepayments = sortRepayments([
    {
      id: buildId(),
      userId: targetBill.userId,
      billId: targetBill.id,
      platformId: targetBill.platformId,
      platformName: targetBill.platformName,
      amount: targetBill.amount,
      interest: targetBill.interest,
      repaymentDate: paidAt,
      notes: '标记账单已还时自动生成',
      createdAt: now,
      updatedAt: now,
    },
    ...repayments,
  ]);

  return {
    bills: nextBills,
    repayments: nextRepayments,
    createdRepayment: true,
  };
}

export function buildLoanOverview(bills: LoanBill[], repayments: LoanRepayment[], userId: string): LoanOverviewSummary {
  const scopedBills = filterLoanBills(bills, userId);
  const scopedRepayments = filterLoanRepayments(repayments, userId);

  return {
    totalDebt: roundMoney(scopedBills.reduce((sum, bill) => sum + bill.amount, 0)),
    totalPaid: roundMoney(scopedRepayments.reduce((sum, repayment) => sum + repayment.amount, 0)),
    totalUnpaid: roundMoney(scopedBills.filter((bill) => !bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)),
    totalInterest: roundMoney(scopedBills.reduce((sum, bill) => sum + bill.interest, 0)),
    totalBillCount: scopedBills.length,
    repaymentCount: scopedRepayments.length,
    upcomingCount: scopedBills.filter((bill) => getLoanBillStatus(bill) === 'unpaid').length,
    overdueCount: scopedBills.filter((bill) => getLoanBillStatus(bill) === 'overdue').length,
  };
}

export function buildLoanMonthlyStats(
  bills: LoanBill[],
  month: string,
  userId: string,
  platformId = LOAN_ALL_PLATFORMS,
): LoanMonthlyStats {
  const scopedBills = filterLoanBills(bills, userId, platformId)
    .filter((bill) => bill.billingMonth === normalizeMonth(month));

  const paidBills = scopedBills.filter((bill) => bill.isPaid);
  const unpaidBills = scopedBills.filter((bill) => !bill.isPaid);
  const overdueBills = scopedBills.filter((bill) => getLoanBillStatus(bill) === 'overdue');

  return {
    month: normalizeMonth(month),
    totalBills: scopedBills.length,
    totalAmount: roundMoney(scopedBills.reduce((sum, bill) => sum + bill.amount, 0)),
    totalInterest: roundMoney(scopedBills.reduce((sum, bill) => sum + bill.interest, 0)),
    paidAmount: roundMoney(paidBills.reduce((sum, bill) => sum + bill.amount, 0)),
    unpaidAmount: roundMoney(unpaidBills.reduce((sum, bill) => sum + bill.amount, 0)),
    overdueAmount: roundMoney(overdueBills.reduce((sum, bill) => sum + bill.amount, 0)),
  };
}

export function buildLoanRepaymentTrend(
  repayments: LoanRepayment[],
  userId: string,
  startDate: string,
  endDate: string,
  platformId = LOAN_ALL_PLATFORMS,
): LoanTrendPoint[] {
  const start = dayjs(normalizeDate(startDate));
  const end = dayjs(normalizeDate(endDate));
  const rangeStart = start.isAfter(end) ? end : start;
  const rangeEnd = start.isAfter(end) ? start : end;
  const days = Math.max(0, rangeEnd.diff(rangeStart, 'day'));

  const bucket = new Map<string, LoanTrendPoint>();

  for (let index = 0; index <= days; index += 1) {
    const currentDate = rangeStart.add(index, 'day');
    const date = currentDate.format(DATE_FORMAT);
    bucket.set(date, {
      date,
      label: currentDate.format('MM-DD'),
      repaymentAmount: 0,
      interestAmount: 0,
      count: 0,
    });
  }

  filterLoanRepayments(repayments, userId, platformId)
    .filter((repayment) => {
      const current = dayjs(repayment.repaymentDate);
      return (current.isAfter(rangeStart, 'day') || current.isSame(rangeStart, 'day'))
        && (current.isBefore(rangeEnd, 'day') || current.isSame(rangeEnd, 'day'));
    })
    .forEach((repayment) => {
      const date = normalizeDate(repayment.repaymentDate);
      const current = bucket.get(date);

      if (!current) {
        return;
      }

      current.repaymentAmount = roundMoney(current.repaymentAmount + repayment.amount);
      current.interestAmount = roundMoney(current.interestAmount + repayment.interest);
      current.count += 1;
    });

  return Array.from(bucket.values());
}

export function buildLoanPlatformBreakdown(
  bills: LoanBill[],
  platforms: LoanPlatform[],
  userId: string,
): LoanPlatformBreakdownPoint[] {
  const scopedBills = filterLoanBills(bills, userId);

  return sortPlatforms(filterLoanPlatformsByUserId(platforms, userId))
    .map((platform, index) => {
      const matchedBills = scopedBills.filter((bill) => bill.platformId === platform.id);

      return {
        platformId: platform.id,
        platformName: platform.name,
        totalAmount: roundMoney(matchedBills.reduce((sum, bill) => sum + bill.amount, 0)),
        paidAmount: roundMoney(matchedBills.filter((bill) => bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)),
        unpaidAmount: roundMoney(matchedBills.filter((bill) => !bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)),
        totalInterest: roundMoney(matchedBills.reduce((sum, bill) => sum + bill.interest, 0)),
        billCount: matchedBills.length,
        color: LOAN_PLATFORM_COLORS[index % LOAN_PLATFORM_COLORS.length],
      };
    })
    .filter((item) => item.billCount > 0);
}

export function countBillsByPlatform(bills: LoanBill[], platformId: string) {
  return bills.filter((bill) => bill.platformId === platformId).length;
}

export function countRepaymentsByPlatform(repayments: LoanRepayment[], platformId: string) {
  return repayments.filter((repayment) => repayment.platformId === platformId).length;
}
