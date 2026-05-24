import dayjs from 'dayjs';

import type {
  StepAggregatePoint,
  StepConcreteHour,
  StepHour,
  StepMonthCompareSummary,
  StepPageState,
  StepRecord,
  StepRecordDraft,
} from '../types/health';

const DATE_FORMAT = 'YYYY-MM-DD';
const MONTH_FORMAT = 'YYYY-MM';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

export const DEFAULT_STRIDE_LENGTH = 0.7;
export const STEP_AGGREGATE_PAGE_SIZE = 8;
export const STEP_RECORD_PAGE_SIZE = 10;
export const STEP_HOURS: StepConcreteHour[] = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function normalizeDateTime(recordTime: string, hour: StepHour) {
  const parsed = dayjs(recordTime);
  const base = parsed.isValid() ? parsed : dayjs();

  if (hour === null) {
    return base.hour(23).minute(59).second(0).millisecond(0).format(DATE_TIME_FORMAT);
  }

  return base.hour(hour).second(0).millisecond(0).format(DATE_TIME_FORMAT);
}

function sortRecordsByLatest(records: StepRecord[]) {
  return [...records].sort((left, right) => dayjs(right.recordTime).valueOf() - dayjs(left.recordTime).valueOf());
}

function matchesHourFilter(record: StepRecord, hourFilter: StepConcreteHour | 'all') {
  return hourFilter === 'all' ? true : record.hour === hourFilter;
}

function createAggregatePoint(
  records: StepRecord[],
  strideLength: number,
  labelBuilder: (record: StepRecord) => string,
  bucketBuilder: (record: StepRecord) => string,
) {
  const buckets = new Map<string, StepAggregatePoint>();

  records.forEach((record) => {
    const bucket = bucketBuilder(record);
    const existing = buckets.get(bucket);

    if (existing) {
      existing.totalSteps += record.steps;
      existing.recordCount += 1;
      existing.distanceKm = calculateStepDistanceKm(existing.totalSteps, strideLength);
      return;
    }

    buckets.set(bucket, {
      bucket,
      label: labelBuilder(record),
      totalSteps: record.steps,
      recordCount: 1,
      distanceKm: calculateStepDistanceKm(record.steps, strideLength),
    });
  });

  return [...buckets.values()].sort((left, right) => left.bucket.localeCompare(right.bucket));
}

function createMockRecord(daysAgo: number, hour: StepHour, steps: number, minute = 0): StepRecord {
  const recordTime = hour === null
    ? dayjs().subtract(daysAgo, 'day').hour(23).minute(59).second(0).millisecond(0)
    : dayjs().subtract(daysAgo, 'day').hour(hour).minute(minute).second(0).millisecond(0);

  return {
    id: buildId(),
    steps,
    hour,
    recordTime: recordTime.format(DATE_TIME_FORMAT),
    createdAt: recordTime.format(DATE_TIME_FORMAT),
    updatedAt: recordTime.format(DATE_TIME_FORMAT),
  };
}

export function getTodayEndDateTime() {
  return dayjs().hour(23).minute(59).second(0).millisecond(0).format(DATE_TIME_FORMAT);
}

export function buildStepRecordTime(recordTime: string, hour: StepHour, minute = 0) {
  const base = dayjs(recordTime).isValid() ? dayjs(recordTime) : dayjs();

  if (hour === null) {
    return base.hour(23).minute(59).second(0).millisecond(0).format(DATE_TIME_FORMAT);
  }

  return base.hour(hour).minute(minute).second(0).millisecond(0).format(DATE_TIME_FORMAT);
}

export function inferStepHourFromRecordTime(recordTime: string): StepHour {
  const parsed = dayjs(recordTime);

  if (!parsed.isValid()) {
    return null;
  }

  if (parsed.hour() === 23 && parsed.minute() === 59) {
    return null;
  }

  return STEP_HOURS.includes(parsed.hour() as StepConcreteHour)
    ? parsed.hour() as StepConcreteHour
    : null;
}

export function getStepDateKey(recordTime: string) {
  return dayjs(recordTime).format(DATE_FORMAT);
}

export function getStepHourLabel(hour: StepHour) {
  return hour === null ? '全天' : `${String(hour).padStart(2, '0')}:00`;
}

export function getNextStepHour(hour: StepHour): StepHour {
  if (hour === null || hour === 23) {
    return hour;
  }

  return (hour + 1) as StepConcreteHour;
}

export function formatStepRecordTime(recordTime: string) {
  return dayjs(recordTime).format('YYYY-MM-DD HH:mm');
}

export function calculateStepDistanceKm(steps: number, strideLength: number) {
  return Number(((steps * strideLength) / 1000).toFixed(2));
}

export function findDuplicateStepRecord(
  records: StepRecord[],
  draft: StepRecordDraft,
  excludeId?: string,
) {
  const dateKey = getStepDateKey(draft.recordTime);

  return records.find((record) => (
    record.id !== excludeId
    && getStepDateKey(record.recordTime) === dateKey
    && record.hour === draft.hour
  ));
}

export function createStepRecord(records: StepRecord[], draft: StepRecordDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const normalizedRecordTime = normalizeDateTime(draft.recordTime, draft.hour);

  return sortRecordsByLatest([
    {
      id: buildId(),
      steps: draft.steps,
      hour: draft.hour,
      recordTime: normalizedRecordTime,
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateStepRecord(records: StepRecord[], id: string, draft: StepRecordDraft) {
  const normalizedRecordTime = normalizeDateTime(draft.recordTime, draft.hour);

  return sortRecordsByLatest(records.map((record) => (
    record.id === id
      ? {
        ...record,
        steps: draft.steps,
        hour: draft.hour,
        recordTime: normalizedRecordTime,
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteStepRecord(records: StepRecord[], id: string) {
  return sortRecordsByLatest(records.filter((record) => record.id !== id));
}

export function deleteStepRecords(records: StepRecord[], ids: string[]) {
  const idSet = new Set(ids);
  return sortRecordsByLatest(records.filter((record) => !idSet.has(record.id)));
}

export function aggregateStepRecordsByDay(
  records: StepRecord[],
  month: string,
  strideLength: number,
  hourFilter: StepConcreteHour | 'all' = 'all',
) {
  const filteredRecords = records.filter((record) => (
    dayjs(record.recordTime).format(MONTH_FORMAT) === month && matchesHourFilter(record, hourFilter)
  ));

  return createAggregatePoint(
    filteredRecords,
    strideLength,
    (record) => dayjs(record.recordTime).format('M月D日'),
    (record) => dayjs(record.recordTime).format(DATE_FORMAT),
  );
}

export function aggregateStepRecordsByMonth(
  records: StepRecord[],
  year: string,
  strideLength: number,
  hourFilter: StepConcreteHour | 'all' = 'all',
) {
  const filteredRecords = records.filter((record) => (
    dayjs(record.recordTime).format('YYYY') === year && matchesHourFilter(record, hourFilter)
  ));

  return createAggregatePoint(
    filteredRecords,
    strideLength,
    (record) => dayjs(record.recordTime).format('M月'),
    (record) => dayjs(record.recordTime).format(MONTH_FORMAT),
  );
}

export function buildStepMonthCompare(
  records: StepRecord[],
  strideLength: number,
  month = dayjs().format(MONTH_FORMAT),
): StepMonthCompareSummary {
  const currentMonth = dayjs(`${month}-01`);
  const previousMonth = currentMonth.subtract(1, 'month');
  const currentMonthKey = currentMonth.format(MONTH_FORMAT);
  const previousMonthKey = previousMonth.format(MONTH_FORMAT);

  const currentSteps = records
    .filter((record) => dayjs(record.recordTime).format(MONTH_FORMAT) === currentMonthKey)
    .reduce((sum, record) => sum + record.steps, 0);

  const previousSteps = records
    .filter((record) => dayjs(record.recordTime).format(MONTH_FORMAT) === previousMonthKey)
    .reduce((sum, record) => sum + record.steps, 0);

  const changePercentage = previousSteps === 0
    ? null
    : Number((((currentSteps - previousSteps) / previousSteps) * 100).toFixed(1));

  let trend: StepMonthCompareSummary['trend'] = 'none';
  if (changePercentage !== null) {
    if (changePercentage > 0) {
      trend = 'up';
    } else if (changePercentage < 0) {
      trend = 'down';
    } else {
      trend = 'flat';
    }
  }

  return {
    currentLabel: currentMonth.format('YYYY年M月'),
    previousLabel: previousMonth.format('YYYY年M月'),
    currentSteps,
    previousSteps,
    currentDistanceKm: calculateStepDistanceKm(currentSteps, strideLength),
    previousDistanceKm: calculateStepDistanceKm(previousSteps, strideLength),
    changePercentage,
    trend,
  };
}

export function buildInitialStepState(): StepPageState {
  return {
    records: sortRecordsByLatest([
      createMockRecord(0, 21, 6842, 12),
      createMockRecord(1, 18, 9230, 8),
      createMockRecord(2, null, 12012),
      createMockRecord(4, 8, 3540, 16),
      createMockRecord(6, 20, 10120, 14),
      createMockRecord(8, 7, 2810, 5),
      createMockRecord(33, null, 9876),
      createMockRecord(35, 18, 7640, 18),
      createMockRecord(38, 12, 5430, 30),
      createMockRecord(41, 20, 11020, 24),
    ]),
    settings: {
      strideLength: DEFAULT_STRIDE_LENGTH,
    },
  };
}
