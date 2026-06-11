export type ShoppingCurrencyMode = 'CNY' | 'USDT';

export type ShoppingTab = 'records' | 'dashboard' | 'ledgers' | 'platforms';

export interface ShoppingRecord {
  id: string;
  ledgerId: string;
  date: string;
  platform: string;
  itemName: string;
  spec: string;
  price: number;
  unitPrice: number | null;
  orderNo: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingRecordDraft {
  ledgerId: string;
  date: string;
  platform: string;
  itemName: string;
  spec?: string;
  price: number;
  unitPrice?: number | null;
  orderNo?: string;
  note?: string;
}

export interface ShoppingLedger {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingLedgerDraft {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
}

export interface ShoppingPlatform {
  id: string;
  name: string;
  colorToken?: string;
  isBuiltIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingOverviewSummary {
  currentMonthOrders: number;
  currentMonthAmount: number;
  totalAmount: number;
  totalOrders: number;
  activePlatformCount: number;
  trackedMonths: number;
}

export interface ShoppingMonthlyTrendPoint {
  month: string;
  label: string;
  amount: number;
  orderCount: number;
}

export interface ShoppingPlatformBreakdownPoint {
  name: string;
  amount: number;
  count: number;
  color: string;
}

export interface ShoppingLedgerSummaryPoint {
  ledgerId: string;
  ledgerName: string;
  amount: number;
  count: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ShoppingImportInvalidRow {
  rowNumber: number;
  reason: string;
}

export interface ShoppingImportResult {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  createdLedgerCount: number;
  createdPlatformCount: number;
  importedRecords: ShoppingRecord[];
  invalidRows: ShoppingImportInvalidRow[];
  nextRecords: ShoppingRecord[];
  nextLedgers: ShoppingLedger[];
  nextPlatforms: ShoppingPlatform[];
}

export interface ShoppingPageState {
  records: ShoppingRecord[];
  ledgers: ShoppingLedger[];
  platforms: ShoppingPlatform[];
  settings: {
    activeLedgerId: string;
    recordsLedgerId: string;
    dashboardLedgerId: string;
    currencyMode: ShoppingCurrencyMode;
    usdtRate: number;
  };
}
