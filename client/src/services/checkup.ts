import dayjs from 'dayjs';

import type {
  CheckupDueFollowUpItem,
  CheckupInsight,
  CheckupOverviewSummary,
  CheckupPageState,
  CheckupRecord,
  CheckupRecordDraft,
  CheckupStatus,
  CheckupTemplate,
  CheckupTemplateItem,
  CheckupTrendPoint,
} from '../types/checkup';

type CheckupRecordInput = CheckupRecordDraft & Partial<Pick<
  CheckupRecord,
  'id' | 'createdAt' | 'updatedAt' | 'lastAbnormalAlertAt' | 'lastFollowUpReminderAt'
>>;

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

export const DEFAULT_CHECKUP_USER_ID = 'user-001';
export const CHECKUP_RECORD_PAGE_SIZE = 10;

export const CHECKUP_STATUS_META: Record<CheckupStatus, { label: string; tone: 'green' | 'orange' | 'red' | 'default' }> = {
  normal: { label: '正常', tone: 'green' },
  abnormal: { label: '异常', tone: 'red' },
  attention: { label: '关注', tone: 'orange' },
  unknown: { label: '待判断', tone: 'default' },
};

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function normalizeDate(value: unknown, fallback = dayjs().format(DATE_FORMAT)) {
  const parsed = dayjs(String(value ?? ''));
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? ''));
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T09:00`).format(DATE_TIME_FORMAT);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortRecords(records: CheckupRecord[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.testDate).valueOf() - dayjs(left.testDate).valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function normalizeTemplateItem(item: Partial<CheckupTemplateItem>): CheckupTemplateItem {
  return {
    id: item.id ?? buildId(),
    testName: String(item.testName ?? '').trim(),
    unit: String(item.unit ?? '').trim(),
    referenceRange: String(item.referenceRange ?? '').trim(),
  };
}

function normalizeTemplate(
  template: Omit<Partial<CheckupTemplate>, 'items'> & { items?: Array<Partial<CheckupTemplateItem>> },
  index: number,
): CheckupTemplate {
  const now = dayjs().subtract(index, 'day').format(DATE_TIME_FORMAT);

  return {
    id: template.id ?? buildId(),
    name: String(template.name ?? '').trim() || `模板 ${index + 1}`,
    testType: String(template.testType ?? '').trim() || '生化检查',
    items: Array.isArray(template.items)
      ? template.items.map((item) => normalizeTemplateItem(item)).filter((item) => item.testName)
      : [],
    createdAt: normalizeTimestamp(template.createdAt, dayjs(now).format(DATE_FORMAT)),
    updatedAt: normalizeTimestamp(template.updatedAt, dayjs(now).format(DATE_FORMAT)),
  };
}

export function normalizeCheckupUserId(userId: string) {
  return userId.trim();
}

function isPersistedRecord(
  input: CheckupRecordInput,
): input is CheckupRecordInput & Required<Pick<CheckupRecord, 'id'>> {
  return Boolean(input.id);
}

export function evaluateCheckupStatus(value: number, referenceRange: string): CheckupStatus {
  if (!Number.isFinite(value)) {
    return 'unknown';
  }

  const normalizedRange = referenceRange.replace(/\s+/g, '').replace(/[，,]/g, '.');

  if (!normalizedRange) {
    return 'unknown';
  }

  const rangeMatch = normalizedRange.match(/^(-?\d+(?:\.\d+)?)(?:-|~|～|—|至)(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return value >= min && value <= max ? 'normal' : 'abnormal';
  }

  const upperMatch = normalizedRange.match(/^(<=|<)(-?\d+(?:\.\d+)?)$/);
  if (upperMatch) {
    const limit = Number(upperMatch[2]);
    return upperMatch[1] === '<=' ? (value <= limit ? 'normal' : 'abnormal') : (value < limit ? 'normal' : 'abnormal');
  }

  const lowerMatch = normalizedRange.match(/^(>=|>)(-?\d+(?:\.\d+)?)$/);
  if (lowerMatch) {
    const limit = Number(lowerMatch[2]);
    return lowerMatch[1] === '>=' ? (value >= limit ? 'normal' : 'abnormal') : (value > limit ? 'normal' : 'abnormal');
  }

  return 'unknown';
}

export function materializeCheckupRecord(
  input: CheckupRecordInput,
  existingRecord?: CheckupRecord,
): CheckupRecord {
  if (isPersistedRecord(input)) {
    const normalizedStatus = input.status || evaluateCheckupStatus(input.value, input.referenceRange);
    return {
      ...input,
      userId: normalizeCheckupUserId(input.userId) || existingRecord?.userId || DEFAULT_CHECKUP_USER_ID,
      testDate: normalizeDate(input.testDate),
      testType: input.testType.trim(),
      testName: input.testName.trim(),
      value: toNumber(input.value),
      unit: input.unit.trim(),
      referenceRange: input.referenceRange.trim(),
      notes: String(input.notes ?? '').trim(),
      followUpDate: input.followUpDate ? normalizeDate(input.followUpDate) : '',
      status: normalizedStatus,
      createdAt: existingRecord?.createdAt ?? normalizeTimestamp(input.createdAt, normalizeDate(input.testDate)),
      updatedAt: normalizeTimestamp(input.updatedAt, normalizeDate(input.testDate)),
      lastAbnormalAlertAt: input.lastAbnormalAlertAt,
      lastFollowUpReminderAt: input.lastFollowUpReminderAt,
    };
  }

  const testDate = normalizeDate(input.testDate);
  const explicitStatus = input.status && input.status.length ? input.status : undefined;
  const nextStatus = explicitStatus ?? evaluateCheckupStatus(input.value, input.referenceRange);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    id: existingRecord?.id ?? buildId(),
    userId: normalizeCheckupUserId(input.userId) || existingRecord?.userId || DEFAULT_CHECKUP_USER_ID,
    testDate,
    testType: input.testType.trim(),
    testName: input.testName.trim(),
    value: toNumber(input.value),
    unit: input.unit.trim(),
    referenceRange: input.referenceRange.trim(),
    notes: String(input.notes ?? '').trim(),
    followUpDate: input.followUpDate ? normalizeDate(input.followUpDate) : '',
    status: nextStatus,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
    lastAbnormalAlertAt: existingRecord?.lastAbnormalAlertAt,
    lastFollowUpReminderAt: existingRecord?.lastFollowUpReminderAt,
  };
}

export function filterCheckupRecordsByUserId(records: CheckupRecord[], userId: string) {
  const normalizedUserId = normalizeCheckupUserId(userId);

  if (!normalizedUserId) {
    return records;
  }

  return records.filter((record) => normalizeCheckupUserId(record.userId) === normalizedUserId);
}

export function createCheckupRecord(records: CheckupRecord[], input: CheckupRecordInput) {
  const record = materializeCheckupRecord(input);
  return sortRecords([record, ...records]);
}

export function updateCheckupRecord(records: CheckupRecord[], id: string, input: CheckupRecordInput) {
  const previousRecord = records.find((record) => record.id === id);

  if (!previousRecord) {
    return records;
  }

  const nextRecord = materializeCheckupRecord(input, previousRecord);
  return sortRecords(records.map((record) => (record.id === id ? nextRecord : record)));
}

export function deleteCheckupRecord(records: CheckupRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function createBatchCheckupRecords(
  records: CheckupRecord[],
  inputs: CheckupRecordInput[],
) {
  const nextRecords = inputs.map((input) => materializeCheckupRecord(input));
  return sortRecords([...nextRecords, ...records]);
}

export function createCheckupTemplate(
  templates: CheckupTemplate[],
  draft: { name: string; testType: string; items: CheckupTemplateItem[] },
) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const nextTemplate: CheckupTemplate = {
    id: buildId(),
    name: draft.name.trim(),
    testType: draft.testType.trim() || '生化检查',
    items: draft.items.map((item) => normalizeTemplateItem(item)).filter((item) => item.testName),
    createdAt: now,
    updatedAt: now,
  };

  return [nextTemplate, ...templates];
}

export function updateCheckupTemplate(
  templates: CheckupTemplate[],
  id: string,
  draft: { name: string; testType: string; items: CheckupTemplateItem[] },
) {
  return templates.map((template) => (
    template.id === id
      ? {
        ...template,
        name: draft.name.trim(),
        testType: draft.testType.trim() || '生化检查',
        items: draft.items.map((item) => normalizeTemplateItem(item)).filter((item) => item.testName),
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : template
  ));
}

export function deleteCheckupTemplate(templates: CheckupTemplate[], id: string) {
  return templates.filter((template) => template.id !== id);
}

export function applyCheckupTemplate(template: CheckupTemplate) {
  return template.items.map((item) => ({
    id: buildId(),
    testName: item.testName,
    unit: item.unit,
    referenceRange: item.referenceRange,
  }));
}

export function buildDueFollowUps(records: CheckupRecord[], userId: string, leadDays: number): CheckupDueFollowUpItem[] {
  const today = dayjs().startOf('day');

  return filterCheckupRecordsByUserId(records, userId)
    .filter((record) => record.followUpDate && (record.status === 'abnormal' || record.status === 'attention'))
    .map((record) => {
      const followUpDate = normalizeDate(record.followUpDate);
      const daysUntilDue = dayjs(followUpDate).startOf('day').diff(today, 'day');

      return {
        id: record.id,
        userId: record.userId,
        testName: record.testName,
        testType: record.testType,
        testDate: record.testDate,
        followUpDate,
        status: record.status,
        daysUntilDue,
      };
    })
    .filter((item) => item.daysUntilDue <= leadDays)
    .sort((left, right) => dayjs(left.followUpDate).valueOf() - dayjs(right.followUpDate).valueOf());
}

export function buildCheckupOverview(
  records: CheckupRecord[],
  userId: string,
  leadDays: number,
): CheckupOverviewSummary {
  const filteredRecords = filterCheckupRecordsByUserId(records, userId);
  const dueFollowUps = buildDueFollowUps(filteredRecords, '', leadDays);

  return {
    totalRecords: filteredRecords.length,
    abnormalCount: filteredRecords.filter((record) => record.status === 'abnormal').length,
    attentionCount: filteredRecords.filter((record) => record.status === 'attention').length,
    dueFollowUpCount: dueFollowUps.length,
    uniqueIndicatorCount: new Set(filteredRecords.map((record) => record.testName)).size,
    recentTestDate: filteredRecords.length ? filteredRecords[0].testDate : null,
  };
}

export function buildCheckupTrend(
  records: CheckupRecord[],
  options: {
    userId: string;
    testName: string;
    startDate?: string;
    endDate?: string;
  },
): CheckupTrendPoint[] {
  const filteredRecords = filterCheckupRecordsByUserId(records, options.userId)
    .filter((record) => record.testName === options.testName)
    .filter((record) => (!options.startDate || record.testDate >= options.startDate))
    .filter((record) => (!options.endDate || record.testDate <= options.endDate))
    .sort((left, right) => dayjs(left.testDate).valueOf() - dayjs(right.testDate).valueOf());

  return filteredRecords.map((record) => ({
    date: record.testDate,
    label: dayjs(record.testDate).format('MM-DD'),
    value: record.value,
    status: record.status,
  }));
}

export function buildCheckupInsights(records: CheckupRecord[], userId: string, leadDays: number): CheckupInsight[] {
  const filteredRecords = filterCheckupRecordsByUserId(records, userId);

  if (!filteredRecords.length) {
    return [
      {
        id: 'empty',
        level: 'info',
        title: '等待体检数据',
        description: '先录入几条体检或化验指标，系统才能给出趋势判断和复查建议。',
      },
    ];
  }

  const insights: CheckupInsight[] = [];
  const abnormalRecords = filteredRecords.filter((record) => record.status === 'abnormal');
  const abnormalRatio = abnormalRecords.length / filteredRecords.length;

  if (abnormalRecords.length) {
    insights.push({
      id: 'abnormal-ratio',
      level: abnormalRatio >= 0.35 ? 'critical' : 'warning',
      title: abnormalRatio >= 0.35 ? '异常指标占比较高' : '发现异常指标',
      description: abnormalRatio >= 0.35
        ? `当前共有 ${abnormalRecords.length} 条异常指标，占比 ${(abnormalRatio * 100).toFixed(0)}%，建议优先复查高风险项目。`
        : `当前共有 ${abnormalRecords.length} 条异常指标，建议结合复查日期和历史走势进一步确认。`,
      affectedCount: abnormalRecords.length,
      sceneId: 'checkup.abnormal_alert',
    });
  }

  const dueFollowUps = buildDueFollowUps(filteredRecords, '', leadDays);
  const overdueCount = dueFollowUps.filter((item) => item.daysUntilDue < 0).length;
  if (dueFollowUps.length) {
    insights.push({
      id: 'follow-up',
      level: overdueCount ? 'critical' : 'warning',
      title: overdueCount ? '存在逾期复查项目' : '复查窗口临近',
      description: overdueCount
        ? `当前有 ${overdueCount} 项已超过复查日期，建议尽快安排复查。`
        : `未来 ${leadDays} 天内有 ${dueFollowUps.length} 项需要复查，可以提前安排时间。`,
      affectedCount: dueFollowUps.length,
      sceneId: 'checkup.followup_reminder',
    });
  }

  const trendCandidates = new Map<string, CheckupRecord[]>();
  filteredRecords.forEach((record) => {
    const current = trendCandidates.get(record.testName) ?? [];
    current.push(record);
    trendCandidates.set(record.testName, current);
  });

  for (const [testName, items] of trendCandidates.entries()) {
    if (items.length < 3) {
      continue;
    }

    const latestThree = [...items]
      .sort((left, right) => dayjs(left.testDate).valueOf() - dayjs(right.testDate).valueOf())
      .slice(-3);

    const increasing = latestThree.every((item, index) => index === 0 || item.value >= latestThree[index - 1].value);
    const decreasing = latestThree.every((item, index) => index === 0 || item.value <= latestThree[index - 1].value);

    if (increasing || decreasing) {
      insights.push({
        id: `trend-${testName}`,
        level: increasing ? 'warning' : 'info',
        title: `${testName} 出现连续${increasing ? '升高' : '下降'}趋势`,
        description: `最近三次记录分别为 ${latestThree.map((item) => `${item.value}${item.unit}`).join(' / ')}，建议结合医生建议判断是否需要继续追踪。`,
      });
      break;
    }
  }

  if (!abnormalRecords.length && !dueFollowUps.length) {
    insights.push({
      id: 'stable',
      level: 'success',
      title: '当前体检记录整体平稳',
      description: '已记录的指标未发现异常，且没有临近复查任务，可继续按既定节奏维护健康档案。',
    });
  }

  return insights.slice(0, 4);
}

function createMockRecord(userId: string, daysAgo: number, draft: Omit<CheckupRecordDraft, 'userId' | 'testDate'>): CheckupRecord {
  return materializeCheckupRecord({
    userId,
    testDate: dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT),
    ...draft,
  });
}

function buildDefaultTemplates() {
  return [
    normalizeTemplate({
      name: '肝功能模板',
      testType: '生化检查',
      items: [
        { testName: 'ALT', unit: 'U/L', referenceRange: '7-40' },
        { testName: 'AST', unit: 'U/L', referenceRange: '13-35' },
        { testName: '总胆红素', unit: 'μmol/L', referenceRange: '5-21' },
      ],
    }, 0),
    normalizeTemplate({
      name: '血脂模板',
      testType: '年度体检',
      items: [
        { testName: '总胆固醇', unit: 'mmol/L', referenceRange: '<5.2' },
        { testName: '甘油三酯', unit: 'mmol/L', referenceRange: '<1.7' },
        { testName: '高密度脂蛋白', unit: 'mmol/L', referenceRange: '>=1.0' },
      ],
    }, 1),
  ];
}

export function buildInitialCheckupState(): CheckupPageState {
  return {
    records: sortRecords([
      createMockRecord(DEFAULT_CHECKUP_USER_ID, 90, {
        testType: '年度体检',
        testName: '空腹血糖',
        value: 5.3,
        unit: 'mmol/L',
        referenceRange: '3.9-6.1',
        notes: '年度体检常规项目',
      }),
      createMockRecord(DEFAULT_CHECKUP_USER_ID, 60, {
        testType: '年度体检',
        testName: '总胆固醇',
        value: 5.7,
        unit: 'mmol/L',
        referenceRange: '<5.2',
        notes: '建议控制饮食',
        followUpDate: dayjs().add(3, 'day').format(DATE_FORMAT),
      }),
      createMockRecord(DEFAULT_CHECKUP_USER_ID, 45, {
        testType: '生化检查',
        testName: 'ALT',
        value: 52,
        unit: 'U/L',
        referenceRange: '7-40',
        notes: '复查肝功能',
        followUpDate: dayjs().subtract(2, 'day').format(DATE_FORMAT),
      }),
      createMockRecord(DEFAULT_CHECKUP_USER_ID, 20, {
        testType: '复查',
        testName: 'ALT',
        value: 45,
        unit: 'U/L',
        referenceRange: '7-40',
        notes: '较上次回落',
        status: 'attention',
        followUpDate: dayjs().add(10, 'day').format(DATE_FORMAT),
      }),
      createMockRecord('user-002', 15, {
        testType: '年度体检',
        testName: '尿酸',
        value: 455,
        unit: 'μmol/L',
        referenceRange: '208-428',
        notes: '偏高，建议饮水并复查',
        followUpDate: dayjs().add(7, 'day').format(DATE_FORMAT),
      }),
    ]),
    templates: buildDefaultTemplates(),
    settings: {
      activeUserId: DEFAULT_CHECKUP_USER_ID,
      recordsUserId: DEFAULT_CHECKUP_USER_ID,
      trendUserId: DEFAULT_CHECKUP_USER_ID,
      insightUserId: DEFAULT_CHECKUP_USER_ID,
      reminderEnabled: true,
      abnormalAlertEnabled: true,
      followUpLeadDays: 7,
    },
  };
}

export function normalizeCheckupPageState(state: CheckupPageState): CheckupPageState {
  const fallback = buildInitialCheckupState();
  const activeUserId = normalizeCheckupUserId(state?.settings?.activeUserId ?? fallback.settings.activeUserId) || DEFAULT_CHECKUP_USER_ID;

  const records = Array.isArray(state?.records)
    ? sortRecords(state.records.map((record) => materializeCheckupRecord({
      ...record,
      userId: normalizeCheckupUserId(String(record.userId ?? activeUserId)) || activeUserId,
      testDate: normalizeDate(record.testDate),
      testType: String(record.testType ?? '生化检查'),
      testName: String(record.testName ?? ''),
      value: toNumber(record.value),
      unit: String(record.unit ?? ''),
      referenceRange: String(record.referenceRange ?? ''),
      notes: String(record.notes ?? ''),
      followUpDate: record.followUpDate ? normalizeDate(record.followUpDate) : '',
      status: (record.status as CheckupStatus | undefined) ?? evaluateCheckupStatus(toNumber(record.value), String(record.referenceRange ?? '')),
      createdAt: normalizeTimestamp(record.createdAt, normalizeDate(record.testDate)),
      updatedAt: normalizeTimestamp(record.updatedAt, normalizeDate(record.testDate)),
    })))
    : fallback.records;

  const templates = Array.isArray(state?.templates)
    ? state.templates.map((template, index) => normalizeTemplate(template, index))
    : fallback.templates;

  return {
    records,
    templates,
    settings: {
      activeUserId,
      recordsUserId: normalizeCheckupUserId(state?.settings?.recordsUserId ?? activeUserId),
      trendUserId: normalizeCheckupUserId(state?.settings?.trendUserId ?? activeUserId),
      insightUserId: normalizeCheckupUserId(state?.settings?.insightUserId ?? activeUserId),
      reminderEnabled: state?.settings?.reminderEnabled ?? true,
      abnormalAlertEnabled: state?.settings?.abnormalAlertEnabled ?? true,
      followUpLeadDays: Math.max(1, toNumber(state?.settings?.followUpLeadDays, fallback.settings.followUpLeadDays)),
    },
  };
}
