export interface SleepRecord {
  id: string;
  userId: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  qualityScore: number | null;
  isNap: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SleepRecordDraft {
  date: string;
  bedtime: string;
  wakeTime: string;
  qualityScore?: number | null;
  isNap?: boolean;
  notes?: string;
}

export interface SleepTrendItem {
  date: string;
  label: string;
  durationMinutes: number | null;
  avgQuality: number | null;
  count: number;
}

export interface SleepTrend {
  period: 'week' | 'month' | 'year';
  days: number;
  items: SleepTrendItem[];
  avgDuration: number;
  avgDurationLabel: string;
  avgQuality: number | null;
  totalRecords: number;
}

export interface SleepOverview {
  avgDuration7d: number;
  avgDuration7dLabel: string;
  avgQuality7d: number | null;
  totalRecords: number;
  latestRecord: SleepRecord | null;
}

export interface PaginatedSleepRecords {
  items: SleepRecord[];
  page: number;
  pageSize: number;
  total: number;
}
