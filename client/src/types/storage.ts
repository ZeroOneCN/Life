export type StorageTab = 'items' | 'dashboard' | 'archive' | 'settings';

export type StorageItemStatus = 'active' | 'archived';

export interface StorageItemRecord {
  id: string;
  itemName: string;
  purchasePrice: number;
  purchaseDate: string;
  endDate: string;
  notes: string;
  status: StorageItemStatus;
  archivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageItemDraft {
  itemName: string;
  purchasePrice: number;
  purchaseDate: string;
  endDate?: string;
  notes?: string;
}

export interface StorageOverviewSummary {
  totalCount: number;
  activeCount: number;
  archivedCount: number;
  totalPurchaseAmount: number;
  currentDailyCostTotal: number;
  averageUsageDays: number;
  currentMonthNewCount: number;
  highestDailyCostItemName: string;
  highestDailyCost: number;
}

export interface StoragePurchaseTrendPoint {
  month: string;
  label: string;
  amount: number;
  count: number;
}

export interface StorageCostRankingPoint {
  id: string;
  itemName: string;
  purchasePrice: number;
  usageDays: number;
  dailyCost: number;
  purchaseDate: string;
  endDate: string;
  status: StorageItemStatus;
}

export interface StoragePageSettings {
  includeArchivedInDashboard: boolean;
  defaultSort: 'latest' | 'purchasePrice' | 'dailyCost';
  defaultDashboardRange: '30d' | '90d' | '365d' | 'all';
}

export interface StoragePageState {
  items: StorageItemRecord[];
  settings: StoragePageSettings;
}
