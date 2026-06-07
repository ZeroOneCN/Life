import dayjs from 'dayjs';

import { CHART_CATEGORY_8 } from '../lib/chartPalette';
import type {
  SubscriptionBillingCycle,
  SubscriptionCategory,
  SubscriptionCategoryBreakdownPoint,
  SubscriptionCategoryDraft,
  SubscriptionExpiryPoint,
  SubscriptionOverviewSummary,
  SubscriptionPageState,
  SubscriptionRecord,
  SubscriptionRecordDraft,
  SubscriptionReminderItem,
  SubscriptionStatus,
} from '../types/subscription';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

export const SUBSCRIPTION_PAGE_SIZE = 10;
export const SUBSCRIPTION_ALL_CATEGORIES = 'all';
export const SUBSCRIPTION_CATEGORY_COLORS = CHART_CATEGORY_8;

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

function normalizeDate(value: unknown, fallback = dayjs().format(DATE_FORMAT)) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return fallback;
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function toMoney(value: unknown, fallback = 0) {
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeBillingCycle(value: unknown): SubscriptionBillingCycle {
  switch (value) {
    case 'quarterly':
    case 'yearly':
    case 'one_time':
      return value;
    default:
      return 'monthly';
  }
}

function sortCategories(categories: SubscriptionCategory[]) {
  return [...categories].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function sortRecords(records: SubscriptionRecord[]) {
  return [...records].sort((left, right) => {
    const endDiff = dayjs(left.endDate).valueOf() - dayjs(right.endDate).valueOf();
    if (endDiff !== 0) {
      return endDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function getDurationEffectiveEndDate(startDate: string, endDate: string) {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  const today = dayjs().startOf('day');

  if (!start.isValid() || !end.isValid()) {
    return null;
  }

  return end.isBefore(today) ? end : today;
}

function normalizeCategory(category: Partial<SubscriptionCategory>): SubscriptionCategory {
  const createdAt = normalizeTimestamp(category.createdAt, dayjs().format(DATE_FORMAT));
  const updatedAt = normalizeTimestamp(category.updatedAt, dayjs(createdAt).format(DATE_FORMAT));

  return {
    id: category.id ?? buildId(),
    name: normalizeTrimmedValue(category.name, '未命名分类'),
    description: normalizeTrimmedValue(category.description),
    createdAt,
    updatedAt,
  };
}

function normalizeRecord(
  record: Partial<SubscriptionRecord>,
  categories: SubscriptionCategory[],
): SubscriptionRecord {
  const startDate = normalizeDate(record.startDate);
  const endDate = normalizeDate(record.endDate, startDate);
  const matchedCategory = categories.find((category) => category.id === record.categoryId)
    ?? categories.find((category) => category.name === record.categoryName);
  const createdAt = normalizeTimestamp(record.createdAt, startDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, endDate);

  return {
    id: record.id ?? buildId(),
    serviceName: normalizeTrimmedValue(record.serviceName, '未命名服务'),
    planName: normalizeTrimmedValue(record.planName),
    categoryId: normalizeTrimmedValue(record.categoryId ?? matchedCategory?.id),
    categoryName: normalizeTrimmedValue(matchedCategory?.name ?? record.categoryName, '未分类'),
    startDate,
    endDate,
    billingCycle: normalizeBillingCycle(record.billingCycle),
    cyclePrice: toMoney(record.cyclePrice, 0),
    autoRenew: Boolean(record.autoRenew),
    notes: normalizeTrimmedValue(record.notes),
    lastUpcomingReminderMarker: normalizeTrimmedValue(record.lastUpcomingReminderMarker),
    lastExpiredReminderMarker: normalizeTrimmedValue(record.lastExpiredReminderMarker),
    createdAt,
    updatedAt,
  };
}

function normalizeSettings(
  settings: Partial<SubscriptionPageState['settings']> | undefined,
): SubscriptionPageState['settings'] {
  return {
    recordsKeyword: normalizeTrimmedValue(settings?.recordsKeyword),
    recordsCategoryId: normalizeTrimmedValue(settings?.recordsCategoryId, SUBSCRIPTION_ALL_CATEGORIES),
    recordsStatus: settings?.recordsStatus === 'active'
      || settings?.recordsStatus === 'upcoming'
      || settings?.recordsStatus === 'expired'
      ? settings.recordsStatus
      : 'all',
    recordsAutoRenewFilter: settings?.recordsAutoRenewFilter === 'auto'
      || settings?.recordsAutoRenewFilter === 'manual'
      ? settings.recordsAutoRenewFilter
      : 'all',
    recordsExpiryStartDate: normalizeTrimmedValue(settings?.recordsExpiryStartDate),
    recordsExpiryEndDate: normalizeTrimmedValue(settings?.recordsExpiryEndDate),
    dashboardRangeDays: settings?.dashboardRangeDays === 180 || settings?.dashboardRangeDays === 365
      ? settings.dashboardRangeDays
      : 90,
    reminderEnabled: settings?.reminderEnabled ?? true,
    expiryDayReminderEnabled: settings?.expiryDayReminderEnabled ?? true,
    leadDays: Math.max(0, Math.min(90, Math.round(Number(settings?.leadDays ?? 7) || 7))),
    includeAutoRenewInReminders: settings?.includeAutoRenewInReminders ?? false,
  };
}

function createInitialCategories() {
  const now = dayjs().format(DATE_TIME_FORMAT);
  return sortCategories([
    { id: 'subscription-cat-software', name: '软件工具', description: '效率与桌面应用', createdAt: now, updatedAt: now },
    { id: 'subscription-cat-entertainment', name: '影音娱乐', description: '视频、音乐与内容订阅', createdAt: now, updatedAt: now },
    { id: 'subscription-cat-cloud', name: '云服务', description: '主机、存储与部署资源', createdAt: now, updatedAt: now },
    { id: 'subscription-cat-ai', name: 'AI 工具', description: '模型、助手与生成式服务', createdAt: now, updatedAt: now },
    { id: 'subscription-cat-dev', name: '开发协作', description: '团队协作、代码与设计工具', createdAt: now, updatedAt: now },
  ]);
}

function createInitialRecords(categories: SubscriptionCategory[]) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRecords([
    normalizeRecord({
      id: 'subscription-record-chatgpt',
      serviceName: 'ChatGPT',
      planName: 'Plus',
      categoryId: 'subscription-cat-ai',
      startDate: dayjs().subtract(11, 'month').format(DATE_FORMAT),
      endDate: dayjs().add(8, 'day').format(DATE_FORMAT),
      billingCycle: 'monthly',
      cyclePrice: 145,
      autoRenew: true,
      notes: '日常写作、分析和自动化辅助',
      createdAt: now,
      updatedAt: now,
    }, categories),
    normalizeRecord({
      id: 'subscription-record-notion',
      serviceName: 'Notion',
      planName: 'Plus',
      categoryId: 'subscription-cat-software',
      startDate: dayjs().subtract(5, 'month').format(DATE_FORMAT),
      endDate: dayjs().add(42, 'day').format(DATE_FORMAT),
      billingCycle: 'monthly',
      cyclePrice: 68,
      autoRenew: true,
      notes: '知识库与项目管理',
      createdAt: now,
      updatedAt: now,
    }, categories),
    normalizeRecord({
      id: 'subscription-record-spotify',
      serviceName: 'Spotify',
      planName: 'Premium',
      categoryId: 'subscription-cat-entertainment',
      startDate: dayjs().subtract(2, 'year').format(DATE_FORMAT),
      endDate: dayjs().add(2, 'day').format(DATE_FORMAT),
      billingCycle: 'monthly',
      cyclePrice: 15,
      autoRenew: false,
      notes: '手动续费，方便控制娱乐支出',
      createdAt: now,
      updatedAt: now,
    }, categories),
    normalizeRecord({
      id: 'subscription-record-vercel',
      serviceName: 'Vercel',
      planName: 'Pro',
      categoryId: 'subscription-cat-cloud',
      startDate: dayjs().subtract(1, 'year').format(DATE_FORMAT),
      endDate: dayjs().add(72, 'day').format(DATE_FORMAT),
      billingCycle: 'monthly',
      cyclePrice: 150,
      autoRenew: true,
      notes: '个人项目部署与预览环境',
      createdAt: now,
      updatedAt: now,
    }, categories),
    normalizeRecord({
      id: 'subscription-record-figma',
      serviceName: 'Figma',
      planName: 'Professional',
      categoryId: 'subscription-cat-dev',
      startDate: dayjs().subtract(14, 'month').format(DATE_FORMAT),
      endDate: dayjs().subtract(6, 'day').format(DATE_FORMAT),
      billingCycle: 'yearly',
      cyclePrice: 1088,
      autoRenew: false,
      notes: '设计协作已过期，待评估是否恢复',
      createdAt: now,
      updatedAt: now,
    }, categories),
  ]);
}

export function buildInitialSubscriptionState(): SubscriptionPageState {
  const categories = createInitialCategories();

  return {
    records: createInitialRecords(categories),
    categories,
    settings: normalizeSettings(undefined),
  };
}

export function normalizeSubscriptionPageState(
  state: SubscriptionPageState | null | undefined,
): SubscriptionPageState {
  const categories = sortCategories(
    Array.isArray(state?.categories) && state?.categories.length
      ? state.categories.map((category) => normalizeCategory(category))
      : createInitialCategories(),
  );

  const records = sortRecords(
    Array.isArray(state?.records)
      ? state.records.map((record) => normalizeRecord(record, categories))
      : createInitialRecords(categories),
  );

  return {
    records,
    categories,
    settings: normalizeSettings(state?.settings),
  };
}

export function createSubscriptionRecord(
  records: SubscriptionRecord[],
  categories: SubscriptionCategory[],
  draft: SubscriptionRecordDraft,
) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const category = categories.find((item) => item.id === draft.categoryId);

  return sortRecords([
    ...records,
    normalizeRecord({
      ...draft,
      id: buildId(),
      categoryName: category?.name ?? '未分类',
      autoRenew: draft.autoRenew ?? false,
      createdAt: now,
      updatedAt: now,
    }, categories),
  ]);
}

export function updateSubscriptionRecord(
  records: SubscriptionRecord[],
  categories: SubscriptionCategory[],
  recordId: string,
  draft: SubscriptionRecordDraft,
) {
  const category = categories.find((item) => item.id === draft.categoryId);

  return sortRecords(records.map((record) => {
    if (record.id !== recordId) {
      return record;
    }

    return normalizeRecord({
      ...record,
      ...draft,
      categoryName: category?.name ?? record.categoryName,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
      lastUpcomingReminderMarker: record.endDate === draft.endDate ? record.lastUpcomingReminderMarker : '',
      lastExpiredReminderMarker: record.endDate === draft.endDate ? record.lastExpiredReminderMarker : '',
    }, categories);
  }));
}

export function deleteSubscriptionRecord(records: SubscriptionRecord[], recordId: string) {
  return sortRecords(records.filter((record) => record.id !== recordId));
}

export function createSubscriptionCategory(
  categories: SubscriptionCategory[],
  draft: SubscriptionCategoryDraft,
) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortCategories([
    ...categories,
    normalizeCategory({
      id: buildId(),
      name: draft.name,
      description: draft.description,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

export function updateSubscriptionCategory(
  categories: SubscriptionCategory[],
  categoryId: string,
  draft: SubscriptionCategoryDraft,
) {
  return sortCategories(categories.map((category) => {
    if (category.id !== categoryId) {
      return category;
    }

    return normalizeCategory({
      ...category,
      name: draft.name,
      description: draft.description,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    });
  }));
}

export function deleteSubscriptionCategory(categories: SubscriptionCategory[], categoryId: string) {
  return sortCategories(categories.filter((category) => category.id !== categoryId));
}

export function calculateSubscriptionDurationDays(record: Pick<SubscriptionRecord, 'startDate' | 'endDate'>) {
  const start = dayjs(record.startDate);
  const effectiveEnd = getDurationEffectiveEndDate(record.startDate, record.endDate);

  if (!start.isValid() || !effectiveEnd) {
    return 0;
  }

  if (effectiveEnd.isBefore(start, 'day')) {
    return 0;
  }

  return effectiveEnd.startOf('day').diff(start.startOf('day'), 'day') + 1;
}

export function calculateSubscriptionDurationText(record: Pick<SubscriptionRecord, 'startDate' | 'endDate'>) {
  const start = dayjs(record.startDate).startOf('day');
  const end = getDurationEffectiveEndDate(record.startDate, record.endDate);

  if (!start.isValid() || !end || end.isBefore(start, 'day')) {
    return '0 天';
  }

  let cursor = start;
  const years = end.diff(cursor, 'year');
  cursor = cursor.add(years, 'year');
  const months = end.diff(cursor, 'month');
  cursor = cursor.add(months, 'month');
  const days = end.diff(cursor, 'day') + 1;

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} 年`);
  }
  if (months > 0) {
    parts.push(`${months} 个月`);
  }
  if (days > 0 || parts.length === 0) {
    parts.push(`${days} 天`);
  }

  return parts.join(' ');
}

export function getSubscriptionStatus(
  record: Pick<SubscriptionRecord, 'endDate'>,
  leadDays = 7,
  now = dayjs(),
): SubscriptionStatus {
  const endDate = dayjs(record.endDate).startOf('day');

  if (!endDate.isValid()) {
    return 'expired';
  }

  if (now.startOf('day').isAfter(endDate)) {
    return 'expired';
  }

  const daysLeft = endDate.diff(now.startOf('day'), 'day');
  return daysLeft <= Math.max(0, leadDays) ? 'upcoming' : 'active';
}

export function convertCyclePriceToMonthly(
  cyclePrice: number,
  billingCycle: SubscriptionBillingCycle,
  startDate?: string,
  endDate?: string,
) {
  const amount = Number.isFinite(cyclePrice) ? cyclePrice : 0;

  switch (billingCycle) {
    case 'quarterly':
      return Number((amount / 3).toFixed(2));
    case 'yearly':
      return Number((amount / 12).toFixed(2));
    case 'one_time': {
      const totalDays = startDate
        ? Math.max(1, dayjs(endDate || startDate).diff(dayjs(startDate), 'day') + 1 || 30)
        : 30;
      const monthCount = Math.max(1, totalDays / 30);
      return Number((amount / monthCount).toFixed(2));
    }
    case 'monthly':
    default:
      return Number(amount.toFixed(2));
  }
}

export function convertCyclePriceToAnnual(
  cyclePrice: number,
  billingCycle: SubscriptionBillingCycle,
  startDate?: string,
  endDate?: string,
) {
  return Number((convertCyclePriceToMonthly(cyclePrice, billingCycle, startDate, endDate) * 12).toFixed(2));
}

export function filterSubscriptionRecords(
  records: SubscriptionRecord[],
  filter: {
    keyword?: string;
    categoryId?: string;
    status?: 'all' | SubscriptionStatus;
    autoRenew?: 'all' | 'auto' | 'manual';
    expiryStartDate?: string;
    expiryEndDate?: string;
    leadDays?: number;
  },
) {
  const keyword = normalizeTrimmedValue(filter.keyword).toLowerCase();
  const startDate = filter.expiryStartDate ? dayjs(filter.expiryStartDate) : null;
  const endDate = filter.expiryEndDate ? dayjs(filter.expiryEndDate) : null;

  return sortRecords(records.filter((record) => {
    if (keyword) {
      const haystack = `${record.serviceName} ${record.planName} ${record.categoryName} ${record.notes}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    if (filter.categoryId && filter.categoryId !== SUBSCRIPTION_ALL_CATEGORIES && record.categoryId !== filter.categoryId) {
      return false;
    }

    if (filter.status && filter.status !== 'all' && getSubscriptionStatus(record, filter.leadDays) !== filter.status) {
      return false;
    }

    if (filter.autoRenew === 'auto' && !record.autoRenew) {
      return false;
    }

    if (filter.autoRenew === 'manual' && record.autoRenew) {
      return false;
    }

    if (startDate?.isValid() && dayjs(record.endDate).isBefore(startDate, 'day')) {
      return false;
    }

    if (endDate?.isValid() && dayjs(record.endDate).isAfter(endDate, 'day')) {
      return false;
    }

    return true;
  }));
}

export function buildSubscriptionOverview(
  records: SubscriptionRecord[],
  leadDays = 7,
): SubscriptionOverviewSummary {
  return records.reduce<SubscriptionOverviewSummary>((summary, record) => {
    const status = getSubscriptionStatus(record, leadDays);
    const monthlyAmount = convertCyclePriceToMonthly(record.cyclePrice, record.billingCycle, record.startDate, record.endDate);
    const annualAmount = convertCyclePriceToAnnual(record.cyclePrice, record.billingCycle, record.startDate, record.endDate);

    summary.totalCount += 1;
    summary.monthlyEstimate += monthlyAmount;
    summary.annualEstimate += annualAmount;

    if (record.autoRenew) {
      summary.autoRenewCount += 1;
    }

    if (status === 'active') {
      summary.activeCount += 1;
    } else if (status === 'upcoming') {
      summary.upcomingCount += 1;
    } else {
      summary.expiredCount += 1;
    }

    const shouldReplaceNearest = !summary.nearestExpiryDate
      || (
        status !== 'expired'
        && (
          getSubscriptionStatus({ endDate: summary.nearestExpiryDate }, leadDays) === 'expired'
          || dayjs(record.endDate).isBefore(summary.nearestExpiryDate, 'day')
        )
      )
      || (
        status === 'expired'
        && getSubscriptionStatus({ endDate: summary.nearestExpiryDate }, leadDays) === 'expired'
        && dayjs(record.endDate).isAfter(summary.nearestExpiryDate, 'day')
      );

    if (shouldReplaceNearest) {
      summary.nearestExpiryDate = record.endDate;
    }

    return summary;
  }, {
    totalCount: 0,
    activeCount: 0,
    upcomingCount: 0,
    expiredCount: 0,
    autoRenewCount: 0,
    monthlyEstimate: 0,
    annualEstimate: 0,
    nearestExpiryDate: '',
  });
}

export function buildSubscriptionCategoryBreakdown(
  records: SubscriptionRecord[],
  categories: SubscriptionCategory[],
  leadDays = 7,
) {
  const categoryMap = new Map<string, SubscriptionCategoryBreakdownPoint>();

  records.forEach((record) => {
    if (getSubscriptionStatus(record, leadDays) === 'expired') {
      return;
    }

    const key = record.categoryId || record.categoryName;
    const current = categoryMap.get(key) ?? {
      categoryId: record.categoryId,
      categoryName: record.categoryName || '未分类',
      count: 0,
      monthlyAmount: 0,
      annualAmount: 0,
      color: SUBSCRIPTION_CATEGORY_COLORS[categoryMap.size % SUBSCRIPTION_CATEGORY_COLORS.length],
    };

    current.count += 1;
    current.monthlyAmount += convertCyclePriceToMonthly(record.cyclePrice, record.billingCycle, record.startDate, record.endDate);
    current.annualAmount += convertCyclePriceToAnnual(record.cyclePrice, record.billingCycle, record.startDate, record.endDate);

    const category = categories.find((item) => item.id === current.categoryId || item.name === current.categoryName);
    if (category) {
      current.categoryName = category.name;
    }

    categoryMap.set(key, current);
  });

  return [...categoryMap.values()]
    .map((item, index) => ({
      ...item,
      monthlyAmount: Number(item.monthlyAmount.toFixed(2)),
      annualAmount: Number(item.annualAmount.toFixed(2)),
      color: SUBSCRIPTION_CATEGORY_COLORS[index % SUBSCRIPTION_CATEGORY_COLORS.length],
    }))
    .sort((left, right) => right.annualAmount - left.annualAmount);
}

export function buildSubscriptionExpiryTimeline(
  records: SubscriptionRecord[],
  rangeDays = 90,
) {
  const today = dayjs().startOf('day');
  const endWindow = today.add(rangeDays, 'day');
  const bucket = new Map<string, SubscriptionExpiryPoint>();

  records.forEach((record) => {
    const endDate = dayjs(record.endDate).startOf('day');

    if (!endDate.isValid() || endDate.isBefore(today) || endDate.isAfter(endWindow)) {
      return;
    }

    const key = endDate.format(DATE_FORMAT);
    const current = bucket.get(key) ?? {
      date: key,
      label: endDate.format('MM-DD'),
      count: 0,
      annualAmount: 0,
      monthlyAmount: 0,
      services: [],
    };

    current.count += 1;
    current.annualAmount += convertCyclePriceToAnnual(record.cyclePrice, record.billingCycle, record.startDate, record.endDate);
    current.monthlyAmount += convertCyclePriceToMonthly(record.cyclePrice, record.billingCycle, record.startDate, record.endDate);
    current.services.push(record.serviceName);
    bucket.set(key, current);
  });

  return [...bucket.values()]
    .sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf())
    .map((item) => ({
      ...item,
      annualAmount: Number(item.annualAmount.toFixed(2)),
      monthlyAmount: Number(item.monthlyAmount.toFixed(2)),
    }));
}

export function buildDueSubscriptionReminders(
  records: SubscriptionRecord[],
  settings: Pick<
    SubscriptionPageState['settings'],
    'reminderEnabled' | 'expiryDayReminderEnabled' | 'leadDays' | 'includeAutoRenewInReminders'
  >,
  now = dayjs(),
) {
  const today = now.startOf('day');
  const items: SubscriptionReminderItem[] = [];

  records.forEach((record) => {
    const endDate = dayjs(record.endDate).startOf('day');
    if (!endDate.isValid()) {
      return;
    }

    const daysLeft = endDate.diff(today, 'day');
    const baseMarker = `${record.id}:${record.endDate}`;

    if (
      settings.reminderEnabled
      && daysLeft >= 0
      && daysLeft <= settings.leadDays
      && (settings.includeAutoRenewInReminders || !record.autoRenew)
    ) {
      const marker = `${baseMarker}:upcoming`;
      if (record.lastUpcomingReminderMarker !== marker) {
        items.push({
          recordId: record.id,
          serviceName: record.serviceName,
          endDate: record.endDate,
          sceneId: 'subscription.renewal_upcoming',
          marker,
          message: `${record.serviceName}${record.planName ? ` ${record.planName}` : ''} 将在 ${record.endDate} 到期，距离到期还有 ${daysLeft} 天。`,
        });
      }
    }

    if (settings.expiryDayReminderEnabled && daysLeft <= 0) {
      const marker = `${baseMarker}:expired`;
      if (record.lastExpiredReminderMarker !== marker) {
        items.push({
          recordId: record.id,
          serviceName: record.serviceName,
          endDate: record.endDate,
          sceneId: 'subscription.expired',
          marker,
          message: daysLeft === 0
            ? `${record.serviceName}${record.planName ? ` ${record.planName}` : ''} 今日到期，请及时处理续费或停用。`
            : `${record.serviceName}${record.planName ? ` ${record.planName}` : ''} 已于 ${record.endDate} 到期，当前已逾期 ${Math.abs(daysLeft)} 天。`,
        });
      }
    }
  });

  return items;
}

export function applySubscriptionReminderMarkers(
  records: SubscriptionRecord[],
  items: SubscriptionReminderItem[],
) {
  if (!items.length) {
    return records;
  }

  return records.map((record) => {
    const related = items.filter((item) => item.recordId === record.id);
    if (!related.length) {
      return record;
    }

    const nextRecord = { ...record };
    related.forEach((item) => {
      if (item.sceneId === 'subscription.renewal_upcoming') {
        nextRecord.lastUpcomingReminderMarker = item.marker;
      }

      if (item.sceneId === 'subscription.expired') {
        nextRecord.lastExpiredReminderMarker = item.marker;
      }
    });

    return nextRecord;
  });
}

export function formatSubscriptionAmount(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `¥${amount.toFixed(2)}`;
}

export function getSubscriptionBillingCycleLabel(value: SubscriptionBillingCycle) {
  switch (value) {
    case 'quarterly':
      return '季付';
    case 'yearly':
      return '年付';
    case 'one_time':
      return '一次性';
    case 'monthly':
    default:
      return '月付';
  }
}

export function getSubscriptionStatusLabel(value: SubscriptionStatus) {
  switch (value) {
    case 'upcoming':
      return '即将到期';
    case 'expired':
      return '已过期';
    case 'active':
    default:
      return '进行中';
  }
}
