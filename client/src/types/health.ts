export type StepHour = 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | null;

export type StepConcreteHour = Exclude<StepHour, null>;

export type StepStatsGranularity = 'daily' | 'monthly';

export type StepRecordSortField = 'steps' | 'hour' | 'recordTime';

export interface StepRecord {
  id: string;
  steps: number;
  hour: StepHour;
  recordTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface StepRecordDraft {
  steps: number;
  hour: StepHour;
  recordTime: string;
}

export interface StepPageState {
  records: StepRecord[];
  settings: {
    strideLength: number;
    recordsUserId: string;
  };
}

export interface StepAggregatePoint {
  bucket: string;
  label: string;
  totalSteps: number;
  distanceKm: number;
  recordCount: number;
}

export interface StepMonthCompareSummary {
  currentLabel: string;
  previousLabel: string;
  currentSteps: number;
  previousSteps: number;
  currentDistanceKm: number;
  previousDistanceKm: number;
  changePercentage: number | null;
  trend: 'up' | 'down' | 'flat' | 'none';
}
