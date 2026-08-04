export type StorageTab = 'items' | 'dashboard' | 'retired' | 'settings';

export type StorageItemStatus = 'active' | 'retired';

export type StorageItemSource = 'manual' | 'shopping';

export interface StorageItemRecord {
  id: string;
  itemName: string;
  purchasePrice: number;
  purchaseDate: string;
  endDate: string;
  notes: string;
  status: StorageItemStatus;
  retiredAt: string;
  source: StorageItemSource;
  shoppingRecordId: string;
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
  retiredCount: number;
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
  includeRetiredInDashboard: boolean;
  defaultSort: 'latest' | 'purchasePrice' | 'dailyCost';
  defaultDashboardRange: '30d' | '90d' | '365d' | 'all';
}

export interface StoragePageState {
  items: StorageItemRecord[];
  settings: StoragePageSettings;
}
