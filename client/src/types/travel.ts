export type TravelTab = 'books' | 'details' | 'stats' | 'leaderboard' | 'report';

export type TravelCategory = 'transport' | 'hotel' | 'food' | 'ticket' | 'shopping' | 'other';

export type TravelReportColumnKey =
  | 'date'
  | 'timeRange'
  | 'duration'
  | 'category'
  | 'title'
  | 'paid'
  | 'discount'
  | 'vehicleInfo'
  | 'payChannel'
  | 'remark';

export interface TravelBook {
  id: string;
  userId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelBookDraft {
  userId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  summary?: string;
}

export interface TravelExpenseRecord {
  id: string;
  userId: string;
  bookId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  durationMinutes: number;
  category: TravelCategory;
  title: string;
  amount: number;
  discountAmount: number;
  discountNote: string;
  vehicleInfo: string;
  payChannel: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelExpenseDraft {
  userId: string;
  bookId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  category: TravelCategory;
  title: string;
  amount: number;
  discountAmount?: number;
  discountNote?: string;
  vehicleInfo?: string;
  payChannel?: string;
  remark?: string;
}

export interface TravelPayChannel {
  id: string;
  value: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelBreakdownPoint {
  name: string;
  count: number;
  totalAmount: number;
  savedAmount: number;
  paidAmount: number;
}

export interface TravelSummaryStats {
  totalCount: number;
  totalAmount: number;
  totalSaved: number;
  totalPaidAmount: number;
  topCategoryName: string;
  topPayChannelName: string;
}

export interface TravelDailyTrendPoint {
  date: string;
  label: string;
  totalAmount: number;
  savedAmount: number;
  paidAmount: number;
  count: number;
}

export interface TravelLeaderboardItem {
  bookId: string;
  bookName: string;
  totalCount: number;
  totalAmount: number;
  totalSaved: number;
  totalPaidAmount: number;
  updatedAt: string;
}

export interface TravelImportInvalidRow {
  rowNumber: number;
  reason: string;
}

export interface TravelImportResult {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  createdBookCount: number;
  createdPayChannelCount: number;
  importedRecords: TravelExpenseRecord[];
  invalidRows: TravelImportInvalidRow[];
  nextBooks: TravelBook[];
  nextRecords: TravelExpenseRecord[];
  nextPayChannels: TravelPayChannel[];
}

export interface TravelBookSummaryRow {
  bookId: string;
  bookName: string;
  dateRange: string;
  totalCount: number;
  totalAmount: number;
  totalSaved: number;
  totalPaidAmount: number;
  updatedAt: string;
}

export interface TravelReportData {
  book: TravelBook | null;
  summary: TravelSummaryStats;
  categoryBreakdown: TravelBreakdownPoint[];
  payChannelBreakdown: TravelBreakdownPoint[];
  dailyTrend: TravelDailyTrendPoint[];
  records: TravelExpenseRecord[];
  generatedAt: string;
}

export interface TravelPageState {
  books: TravelBook[];
  records: TravelExpenseRecord[];
  payChannels: TravelPayChannel[];
  settings: {
    activeUserId: string;
    activeBookId: string;
    detailsBookId: string;
    statsBookId: string;
    reportBookId: string;
    leaderboardUserId: string;
    reportColumns: TravelReportColumnKey[];
  };
}
