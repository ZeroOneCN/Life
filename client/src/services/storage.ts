import dayjs from 'dayjs';

import type {
  StorageCostRankingPoint,
  StorageItemDraft,
  StorageItemRecord,
  StorageItemStatus,
  StorageOverviewSummary,
  StoragePageSettings,
  StoragePageState,
  StoragePurchaseTrendPoint,
} from '../types/storage';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

export const STORAGE_PAGE_SIZE = 10;
export const STORAGE_ARCHIVE_PAGE_SIZE = 8;
export const STORAGE_ALL_STATUSES = 'all';

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
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeDate(value: unknown, fallback = '') {
  const raw = normalizeText(value);

  if (!raw) {
    return fallback;
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate = dayjs().format(DATE_FORMAT)) {
  const parsed = dayjs(String(value ?? '').trim());

  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function normalizeStatus(value: unknown): StorageItemStatus {
  return value === 'archived' ? 'archived' : 'active';
}

function normalizeSettings(settings?: Partial<StoragePageSettings>): StoragePageSettings {
  return {
    includeArchivedInDashboard: settings?.includeArchivedInDashboard ?? true,
    defaultSort:
      settings?.defaultSort === 'purchasePrice' || settings?.defaultSort === 'dailyCost'
        ? settings.defaultSort
        : 'latest',
    defaultDashboardRange:
      settings?.defaultDashboardRange === '30d'
      || settings?.defaultDashboardRange === '90d'
      || settings?.defaultDashboardRange === '365d'
        ? settings.defaultDashboardRange
        : 'all',
  };
}

function sortStorageItems(
  items: StorageItemRecord[],
  sortBy: StoragePageSettings['defaultSort'] = 'latest',
) {
  return [...items].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'active' ? -1 : 1;
    }

    if (sortBy === 'purchasePrice') {
      const diff = right.purchasePrice - left.purchasePrice;
      if (diff !== 0) {
        return diff;
      }
    }

    if (sortBy === 'dailyCost') {
      const diff = calculateStorageDailyCost(right) - calculateStorageDailyCost(left);
      if (diff !== 0) {
        return diff;
      }
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function normalizeStorageItem(
  record: Partial<StorageItemRecord>,
  fallback: { sortStatus?: StorageItemStatus } = {},
): StorageItemRecord {
  const purchaseDate = normalizeDate(record.purchaseDate, dayjs().format(DATE_FORMAT));
  const createdAt = normalizeTimestamp(record.createdAt, purchaseDate);
  const endDate = normalizeDate(record.endDate, '');
  const status = normalizeStatus(record.status ?? fallback.sortStatus);
  const safeEndDate = endDate && dayjs(endDate).isBefore(dayjs(purchaseDate), 'day') ? purchaseDate : endDate;
  const archivedAt = status === 'archived'
    ? normalizeTimestamp(record.archivedAt, safeEndDate || purchaseDate)
    : '';

  return {
    id: normalizeText(record.id, buildId()),
    itemName: normalizeText(record.itemName, '未命名物品'),
    purchasePrice: Math.max(0.01, normalizeMoney(record.purchasePrice, 0)),
    purchaseDate,
    endDate: safeEndDate,
    notes: normalizeText(record.notes),
    status: status === 'archived' || safeEndDate ? 'archived' : 'active',
    archivedAt: status === 'archived' || safeEndDate ? archivedAt || normalizeTimestamp('', safeEndDate || purchaseDate) : '',
    createdAt,
    updatedAt: normalizeTimestamp(record.updatedAt, purchaseDate),
  };
}

function createInitialItems() {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortStorageItems([
    normalizeStorageItem({
      id: 'storage-item-shoes',
      itemName: '跑步鞋',
      purchasePrice: 600,
      purchaseDate: '2026-01-01',
      endDate: '',
      notes: '按自然日持续摊销，适合作为日均成本参考。',
      status: 'active',
      archivedAt: '',
      createdAt: now,
      updatedAt: now,
    }),
    normalizeStorageItem({
      id: 'storage-item-keyboard',
      itemName: '机械键盘',
      purchasePrice: 899,
      purchaseDate: dayjs().subtract(11, 'month').format(DATE_FORMAT),
      endDate: '',
      notes: '高频使用中的办公设备。',
      status: 'active',
      archivedAt: '',
      createdAt: now,
      updatedAt: now,
    }),
    normalizeStorageItem({
      id: 'storage-item-lamp',
      itemName: '露营灯',
      purchasePrice: 218,
      purchaseDate: dayjs().subtract(8, 'month').format(DATE_FORMAT),
      endDate: dayjs().subtract(2, 'month').format(DATE_FORMAT),
      notes: '已结束使用，保留最终摊销结果。',
      status: 'archived',
      archivedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
}

export function calculateStorageUsageDays(item: Pick<StorageItemRecord, 'purchaseDate' | 'endDate'>, today = dayjs()) {
  const purchase = dayjs(item.purchaseDate);
  const reference = item.endDate ? dayjs(item.endDate) : today.startOf('day');

  if (!purchase.isValid()) {
    return 1;
  }

  const safeReference = reference.isValid() && reference.isBefore(purchase, 'day') ? purchase : reference;
  return Math.max(1, safeReference.startOf('day').diff(purchase.startOf('day'), 'day') + 1);
}

export function calculateStorageDailyCost(item: Pick<StorageItemRecord, 'purchasePrice' | 'purchaseDate' | 'endDate'>) {
  const usageDays = calculateStorageUsageDays(item);
  return Number((Math.max(0, item.purchasePrice) / usageDays).toFixed(2));
}

export function formatStorageMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

export function getStorageStatusLabel(status: StorageItemStatus) {
  return status === 'archived' ? '已归档' : '使用中';
}

export function buildInitialStorageState(): StoragePageState {
  return {
    items: createInitialItems(),
    settings: normalizeSettings(),
  };
}

export function normalizeStoragePageState(state?: Partial<StoragePageState>): StoragePageState {
  const settings = normalizeSettings(state?.settings);
  const items = Array.isArray(state?.items)
    ? state.items.map((item) => normalizeStorageItem(item))
    : createInitialItems();

  return {
    items: sortStorageItems(items, settings.defaultSort),
    settings,
  };
}

export function createStorageItem(items: StorageItemRecord[], draft: StorageItemDraft, settings?: StoragePageSettings) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortStorageItems([
    normalizeStorageItem({
      id: buildId(),
      itemName: draft.itemName,
      purchasePrice: draft.purchasePrice,
      purchaseDate: draft.purchaseDate,
      endDate: draft.endDate,
      notes: draft.notes,
      status: draft.endDate ? 'archived' : 'active',
      archivedAt: draft.endDate ? now : '',
      createdAt: now,
      updatedAt: now,
    }),
    ...items,
  ], settings?.defaultSort ?? 'latest');
}

export function updateStorageItem(
  items: StorageItemRecord[],
  itemId: string,
  draft: StorageItemDraft,
  settings?: StoragePageSettings,
) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortStorageItems(items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const nextStatus: StorageItemStatus = draft.endDate ? 'archived' : 'active';

    return normalizeStorageItem({
      ...item,
      itemName: draft.itemName,
      purchasePrice: draft.purchasePrice,
      purchaseDate: draft.purchaseDate,
      endDate: draft.endDate,
      notes: draft.notes,
      status: nextStatus,
      archivedAt: nextStatus === 'archived' ? (item.archivedAt || now) : '',
      updatedAt: now,
    });
  }), settings?.defaultSort ?? 'latest');
}

export function archiveStorageItem(
  items: StorageItemRecord[],
  itemId: string,
  endDate = dayjs().format(DATE_FORMAT),
  settings?: StoragePageSettings,
) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortStorageItems(items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    return normalizeStorageItem({
      ...item,
      endDate,
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    });
  }), settings?.defaultSort ?? 'latest');
}

export function restoreStorageItem(
  items: StorageItemRecord[],
  itemId: string,
  settings?: StoragePageSettings,
) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortStorageItems(items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    return normalizeStorageItem({
      ...item,
      endDate: '',
      status: 'active',
      archivedAt: '',
      updatedAt: now,
    });
  }), settings?.defaultSort ?? 'latest');
}

export function deleteStorageItemPermanently(items: StorageItemRecord[], itemId: string, settings?: StoragePageSettings) {
  return sortStorageItems(
    items.filter((item) => item.id !== itemId),
    settings?.defaultSort ?? 'latest',
  );
}

export function filterStorageItems(
  items: StorageItemRecord[],
  filters: {
    keyword?: string;
    status?: StorageItemStatus | typeof STORAGE_ALL_STATUSES;
    purchaseStartDate?: string;
    purchaseEndDate?: string;
    minPrice?: string | number;
    maxPrice?: string | number;
  },
) {
  const keyword = normalizeText(filters.keyword).toLowerCase();
  const purchaseStart = normalizeDate(filters.purchaseStartDate, '');
  const purchaseEnd = normalizeDate(filters.purchaseEndDate, '');
  const minPrice = Number(filters.minPrice || 0);
  const maxPrice = Number(filters.maxPrice || 0);

  return items.filter((item) => {
    if (filters.status && filters.status !== STORAGE_ALL_STATUSES && item.status !== filters.status) {
      return false;
    }

    if (keyword) {
      const haystack = `${item.itemName} ${item.notes}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    if (purchaseStart && dayjs(item.purchaseDate).isBefore(dayjs(purchaseStart), 'day')) {
      return false;
    }

    if (purchaseEnd && dayjs(item.purchaseDate).isAfter(dayjs(purchaseEnd), 'day')) {
      return false;
    }

    if (Number.isFinite(minPrice) && minPrice > 0 && item.purchasePrice < minPrice) {
      return false;
    }

    if (Number.isFinite(maxPrice) && maxPrice > 0 && item.purchasePrice > maxPrice) {
      return false;
    }

    return true;
  });
}

function getDashboardItems(items: StorageItemRecord[], settings: StoragePageSettings) {
  return items.filter((item) => settings.includeArchivedInDashboard || item.status === 'active');
}

export function buildStorageOverview(items: StorageItemRecord[], settings: StoragePageSettings): StorageOverviewSummary {
  const dashboardItems = getDashboardItems(items, settings);
  const today = dayjs();

  const totalCount = items.length;
  const activeCount = items.filter((item) => item.status === 'active').length;
  const archivedCount = items.filter((item) => item.status === 'archived').length;
  const totalPurchaseAmount = dashboardItems.reduce((sum, item) => sum + item.purchasePrice, 0);
  const currentDailyCostTotal = dashboardItems.reduce((sum, item) => sum + calculateStorageDailyCost(item), 0);
  const totalUsageDays = dashboardItems.reduce((sum, item) => sum + calculateStorageUsageDays(item, today), 0);
  const currentMonthNewCount = items.filter((item) => dayjs(item.purchaseDate).isSame(today, 'month')).length;
  const highestDailyCostItem = dashboardItems
    .map((item) => ({ itemName: item.itemName, dailyCost: calculateStorageDailyCost(item) }))
    .sort((left, right) => right.dailyCost - left.dailyCost)[0];

  return {
    totalCount,
    activeCount,
    archivedCount,
    totalPurchaseAmount: Number(totalPurchaseAmount.toFixed(2)),
    currentDailyCostTotal: Number(currentDailyCostTotal.toFixed(2)),
    averageUsageDays: dashboardItems.length ? Math.round(totalUsageDays / dashboardItems.length) : 0,
    currentMonthNewCount,
    highestDailyCostItemName: highestDailyCostItem?.itemName ?? '暂无',
    highestDailyCost: highestDailyCostItem?.dailyCost ?? 0,
  };
}

export function buildStoragePurchaseTrend(
  items: StorageItemRecord[],
  settings: StoragePageSettings,
): StoragePurchaseTrendPoint[] {
  const dashboardItems = getDashboardItems(items, settings);
  const today = dayjs().startOf('month');
  const months = settings.defaultDashboardRange === '30d'
    ? 1
    : settings.defaultDashboardRange === '90d'
      ? 3
      : settings.defaultDashboardRange === '365d'
        ? 12
        : 12;

  const points = Array.from({ length: months }, (_, index) => {
    const month = today.subtract(months - index - 1, 'month');
    return {
      month: month.format('YYYY-MM'),
      label: month.format('MM 月'),
      amount: 0,
      count: 0,
    };
  });

  const pointMap = new Map(points.map((point) => [point.month, point]));
  const minMonth = points[0]?.month ?? '';

  dashboardItems.forEach((item) => {
    const month = dayjs(item.purchaseDate).format('YYYY-MM');
    if (settings.defaultDashboardRange !== 'all' && minMonth && month < minMonth) {
      return;
    }

    const target = pointMap.get(month);
    if (!target) {
      return;
    }

    target.amount += item.purchasePrice;
    target.count += 1;
  });

  return points.map((point) => ({
    ...point,
    amount: Number(point.amount.toFixed(2)),
  }));
}

export function buildStorageCostRanking(
  items: StorageItemRecord[],
  settings: StoragePageSettings,
) {
  return getDashboardItems(items, settings)
    .map<StorageCostRankingPoint>((item) => ({
      id: item.id,
      itemName: item.itemName,
      purchasePrice: item.purchasePrice,
      usageDays: calculateStorageUsageDays(item),
      dailyCost: calculateStorageDailyCost(item),
      purchaseDate: item.purchaseDate,
      endDate: item.endDate,
      status: item.status,
    }))
    .sort((left, right) => {
      if (settings.defaultSort === 'purchasePrice') {
        const diff = right.purchasePrice - left.purchasePrice;
        if (diff !== 0) {
          return diff;
        }
      }

      if (settings.defaultSort === 'latest') {
        const diff = dayjs(right.purchaseDate).valueOf() - dayjs(left.purchaseDate).valueOf();
        if (diff !== 0) {
          return diff;
        }
      }

      const dailyCostDiff = right.dailyCost - left.dailyCost;
      if (dailyCostDiff !== 0) {
        return dailyCostDiff;
      }

      return right.usageDays - left.usageDays;
    });
}
