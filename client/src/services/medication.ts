import dayjs from 'dayjs';

import type {
  MedicationDailySummary,
  MedicationOverviewSummary,
  MedicationPageState,
  MedicationPurchaseDraft,
  MedicationPurchaseRecord,
  MedicationRankingPoint,
  MedicationRecord,
  MedicationRecordDraft,
  MedicationReminderTimeKey,
  MedicationStockInsight,
  MedicationTimeOfDaySummary,
  MedicationTrendPoint,
} from '../types/medication';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

type MedicationRecordInput = MedicationRecordDraft & Partial<Pick<MedicationRecord, 'id' | 'createdAt' | 'updatedAt'>>;
type MedicationPurchaseInput = MedicationPurchaseDraft & Partial<Pick<MedicationPurchaseRecord, 'id' | 'createdAt' | 'updatedAt'>>;
type SummaryInput = Pick<MedicationDailySummary, 'userId' | 'date' | 'content'> & Partial<Pick<MedicationDailySummary, 'id' | 'createdAt' | 'updatedAt'>>;

export const DEFAULT_MEDICATION_USER_ID = 'user-001';
export const MEDICATION_RECORD_PAGE_SIZE = 10;
export const MEDICATION_PURCHASE_PAGE_SIZE = 10;
export const MEDICATION_TREND_RANGE_OPTIONS = [7, 30, 90] as const;
export const MEDICATION_REMINDER_META: Record<MedicationReminderTimeKey, { label: string; defaultTime: string }> = {
  breakfast: { label: '早餐提醒', defaultTime: '08:00' },
  lunch: { label: '午餐提醒', defaultTime: '13:00' },
  dinner: { label: '晚餐提醒', defaultTime: '19:00' },
};
export const MEDICATION_UNITS = ['片', '粒', '袋', '盒', '瓶'] as const;
export const MEDICATION_CHANNELS = ['药店', '京东', '淘宝', '拼多多', '医院', '诊所'] as const;
export const MEDICATION_TIME_COLORS: Record<MedicationReminderTimeKey | 'total', string> = {
  breakfast: '#1eaedb',
  lunch: '#27a644',
  dinner: '#f59e0b',
  total: '#5e6ad2',
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

function getRecordTotalDose(record: Pick<MedicationRecord, 'breakfast' | 'lunch' | 'dinner'>) {
  return record.breakfast + record.lunch + record.dinner;
}

function sortMedicationRecords(records: MedicationRecord[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.date).valueOf() - dayjs(left.date).valueOf();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortPurchases(records: MedicationPurchaseRecord[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.purchaseDate).valueOf() - dayjs(left.purchaseDate).valueOf();
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function sortSummaries(summaries: MedicationDailySummary[]) {
  return [...summaries].sort((left, right) => dayjs(right.date).valueOf() - dayjs(left.date).valueOf());
}

function normalizeMedicineKey(name: string) {
  return name.trim().toLowerCase();
}

export function normalizeMedicationUserId(userId: string) {
  return userId.trim();
}

function materializeMedicationRecord(input: MedicationRecordInput, existing?: MedicationRecord): MedicationRecord {
  const raw = input as MedicationRecordInput & Record<string, unknown>;
  const date = normalizeDate(raw.date ?? raw.recordDate);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    id: input.id ?? existing?.id ?? buildId(),
    userId: normalizeMedicationUserId(String(raw.userId ?? existing?.userId ?? DEFAULT_MEDICATION_USER_ID)) || DEFAULT_MEDICATION_USER_ID,
    date,
    medicineName: String(raw.medicineName ?? raw.medicine_name ?? existing?.medicineName ?? '').trim(),
    breakfast: Math.max(0, toNumber(raw.breakfast)),
    lunch: Math.max(0, toNumber(raw.lunch)),
    dinner: Math.max(0, toNumber(raw.dinner)),
    createdAt: existing?.createdAt ?? normalizeTimestamp(input.createdAt, date),
    updatedAt: input.updatedAt ? normalizeTimestamp(input.updatedAt, date) : now,
  };
}

function materializeMedicationPurchase(input: MedicationPurchaseInput, existing?: MedicationPurchaseRecord): MedicationPurchaseRecord {
  const raw = input as MedicationPurchaseInput & Record<string, unknown>;
  const purchaseDate = normalizeDate(raw.purchaseDate ?? raw.purchase_date);
  const quantity = Math.max(0, toNumber(raw.quantity));
  const unitPrice = Math.max(0, toNumber(raw.unitPrice ?? raw.unit_price));
  const totalPrice = Math.max(0, toNumber(raw.totalPrice ?? raw.total_price, quantity * unitPrice));
  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    id: input.id ?? existing?.id ?? buildId(),
    userId: normalizeMedicationUserId(String(raw.userId ?? existing?.userId ?? DEFAULT_MEDICATION_USER_ID)) || DEFAULT_MEDICATION_USER_ID,
    purchaseDate,
    medicineName: String(raw.medicineName ?? raw.medicine_name ?? existing?.medicineName ?? '').trim(),
    quantity,
    unit: String(raw.unit ?? existing?.unit ?? '片').trim() || '片',
    unitPrice,
    totalPrice,
    channel: String(raw.channel ?? existing?.channel ?? '药店').trim() || '药店',
    createdAt: existing?.createdAt ?? normalizeTimestamp(input.createdAt, purchaseDate),
    updatedAt: input.updatedAt ? normalizeTimestamp(input.updatedAt, purchaseDate) : now,
  };
}

function materializeSummary(input: SummaryInput, existing?: MedicationDailySummary): MedicationDailySummary {
  const date = normalizeDate(input.date);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    id: input.id ?? existing?.id ?? buildId(),
    userId: normalizeMedicationUserId(input.userId) || existing?.userId || DEFAULT_MEDICATION_USER_ID,
    date,
    content: input.content.trim(),
    createdAt: existing?.createdAt ?? normalizeTimestamp(input.createdAt, date),
    updatedAt: input.updatedAt ? normalizeTimestamp(input.updatedAt, date) : now,
  };
}

function createMockMedicationRecord(
  userId: string,
  daysAgo: number,
  draft: Omit<MedicationRecordDraft, 'userId' | 'date'>,
): MedicationRecord {
  return materializeMedicationRecord({
    userId,
    date: dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT),
    ...draft,
  });
}

function createMockPurchase(
  userId: string,
  daysAgo: number,
  draft: Omit<MedicationPurchaseDraft, 'userId' | 'purchaseDate'>,
): MedicationPurchaseRecord {
  return materializeMedicationPurchase({
    userId,
    purchaseDate: dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT),
    ...draft,
  });
}

export function filterMedicationRecordsByUserId(records: MedicationRecord[], userId: string) {
  const normalizedUserId = normalizeMedicationUserId(userId);

  if (!normalizedUserId) {
    return records;
  }

  return records.filter((record) => normalizeMedicationUserId(record.userId) === normalizedUserId);
}

export function filterMedicationPurchasesByUserId(records: MedicationPurchaseRecord[], userId: string) {
  const normalizedUserId = normalizeMedicationUserId(userId);

  if (!normalizedUserId) {
    return records;
  }

  return records.filter((record) => normalizeMedicationUserId(record.userId) === normalizedUserId);
}

export function filterMedicationSummariesByUserId(records: MedicationDailySummary[], userId: string) {
  const normalizedUserId = normalizeMedicationUserId(userId);

  if (!normalizedUserId) {
    return records;
  }

  return records.filter((record) => normalizeMedicationUserId(record.userId) === normalizedUserId);
}

export function createMedicationRecord(records: MedicationRecord[], draft: MedicationRecordDraft) {
  return sortMedicationRecords([materializeMedicationRecord(draft), ...records]);
}

export function updateMedicationRecord(records: MedicationRecord[], id: string, draft: MedicationRecordDraft) {
  const existing = records.find((record) => record.id === id);
  if (!existing) {
    return records;
  }

  return sortMedicationRecords(records.map((record) => (
    record.id === id ? materializeMedicationRecord({ ...draft, id }, existing) : record
  )));
}

export function deleteMedicationRecord(records: MedicationRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function createMedicationPurchase(records: MedicationPurchaseRecord[], draft: MedicationPurchaseDraft) {
  return sortPurchases([materializeMedicationPurchase(draft), ...records]);
}

export function updateMedicationPurchase(records: MedicationPurchaseRecord[], id: string, draft: MedicationPurchaseDraft) {
  const existing = records.find((record) => record.id === id);
  if (!existing) {
    return records;
  }

  return sortPurchases(records.map((record) => (
    record.id === id ? materializeMedicationPurchase({ ...draft, id }, existing) : record
  )));
}

export function deleteMedicationPurchase(records: MedicationPurchaseRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function saveMedicationDailySummary(
  summaries: MedicationDailySummary[],
  input: Pick<MedicationDailySummary, 'userId' | 'date' | 'content'>,
) {
  const existing = summaries.find((item) => (
    normalizeMedicationUserId(item.userId) === normalizeMedicationUserId(input.userId) && dayjs(item.date).format(DATE_FORMAT) === dayjs(input.date).format(DATE_FORMAT)
  ));

  if (!input.content.trim()) {
    return summaries.filter((item) => item.id !== existing?.id);
  }

  const next = materializeSummary(existing ? { ...input, id: existing.id } : input, existing);

  if (!existing) {
    return sortSummaries([next, ...summaries]);
  }

  return sortSummaries(summaries.map((item) => (item.id === existing.id ? next : item)));
}

export function buildMedicationOverview(
  records: MedicationRecord[],
  purchases: MedicationPurchaseRecord[],
  userId: string,
): MedicationOverviewSummary {
  const filteredRecords = filterMedicationRecordsByUserId(records, userId);
  const filteredPurchases = filterMedicationPurchasesByUserId(purchases, userId);
  const totalDosage = filteredRecords.reduce((sum, record) => sum + getRecordTotalDose(record), 0);
  const trackedDays = new Set(filteredRecords.map((record) => dayjs(record.date).format(DATE_FORMAT))).size;
  const activeMedicineCount = new Set(filteredRecords.map((record) => record.medicineName)).size;
  const totalPurchaseAmount = Number(filteredPurchases.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2));
  const todayKey = dayjs().format(DATE_FORMAT);

  return {
    totalRecords: filteredRecords.length,
    totalDosage,
    trackedDays,
    avgDailyDosage: trackedDays ? Number((totalDosage / trackedDays).toFixed(1)) : 0,
    activeMedicineCount,
    purchaseCount: filteredPurchases.length,
    totalPurchaseAmount,
    latestRecordDate: filteredRecords.length ? dayjs(filteredRecords[0].date).format(DATE_FORMAT) : null,
    todayDosage: filteredRecords
      .filter((record) => dayjs(record.date).format(DATE_FORMAT) === todayKey)
      .reduce((sum, record) => sum + getRecordTotalDose(record), 0),
  };
}

export function buildMedicationTrend(records: MedicationRecord[], userId: string, days: number): MedicationTrendPoint[] {
  const filteredRecords = filterMedicationRecordsByUserId(records, userId);
  const dateMap = new Map<string, MedicationTrendPoint>();

  Array.from({ length: days }, (_, index) => {
    const date = dayjs().subtract(days - index - 1, 'day').format(DATE_FORMAT);
    dateMap.set(date, {
      date,
      label: dayjs(date).format('MM-DD'),
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      total: 0,
    });
  });

  filteredRecords.forEach((record) => {
    const normalizedDate = dayjs(record.date).format(DATE_FORMAT);
    const point = dateMap.get(normalizedDate);
    if (!point) {
      return;
    }

    point.breakfast += record.breakfast;
    point.lunch += record.lunch;
    point.dinner += record.dinner;
    point.total += getRecordTotalDose(record);
  });

  return Array.from(dateMap.values());
}

export function buildMedicationTimeOfDaySummary(records: MedicationRecord[], userId: string): MedicationTimeOfDaySummary {
  return filterMedicationRecordsByUserId(records, userId).reduce<MedicationTimeOfDaySummary>((summary, record) => ({
    breakfast: summary.breakfast + record.breakfast,
    lunch: summary.lunch + record.lunch,
    dinner: summary.dinner + record.dinner,
  }), {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
  });
}

export function buildMedicationRanking(records: MedicationRecord[], userId: string): MedicationRankingPoint[] {
  const medicineMap = new Map<string, number>();
  const filteredRecords = filterMedicationRecordsByUserId(records, userId);
  const totalDosage = filteredRecords.reduce((sum, record) => sum + getRecordTotalDose(record), 0);

  filteredRecords.forEach((record) => {
    const key = record.medicineName.trim();
    medicineMap.set(key, (medicineMap.get(key) ?? 0) + getRecordTotalDose(record));
  });

  return [...medicineMap.entries()]
    .map(([medicineName, totalDose]) => ({
      medicineName,
      totalDose,
      percentage: totalDosage ? Number(((totalDose / totalDosage) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.totalDose - left.totalDose);
}

/** 容器型单位（盒/瓶），与单次服用量（片/粒/袋）不可直接相减 */
const CONTAINER_UNITS = new Set(['盒', '瓶']);

export function buildMedicationStockSummary(
  records: MedicationRecord[],
  purchases: MedicationPurchaseRecord[],
  userId: string,
  defaultThreshold: number,
  medicineThresholds: Record<string, number>,
): MedicationStockInsight[] {
  const filteredRecords = filterMedicationRecordsByUserId(records, userId);
  const filteredPurchases = filterMedicationPurchasesByUserId(purchases, userId);
  const medicineNames = new Map<string, string>();

  filteredRecords.forEach((record) => medicineNames.set(normalizeMedicineKey(record.medicineName), record.medicineName.trim()));
  filteredPurchases.forEach((purchase) => medicineNames.set(normalizeMedicineKey(purchase.medicineName), purchase.medicineName.trim()));

  return [...medicineNames.entries()]
    .map(([key, medicineName]) => {
      const medicineRecords = filteredRecords.filter((r) => normalizeMedicineKey(r.medicineName) === key);
      const medicinePurchases = filteredPurchases.filter((p) => normalizeMedicineKey(p.medicineName) === key);
      const threshold = Math.max(0, medicineThresholds[medicineName] ?? defaultThreshold);

      if (medicinePurchases.length === 0) {
        const totalUsed = medicineRecords.reduce((sum, r) => sum + getRecordTotalDose(r), 0);
        return {
          medicineName,
          unit: null,
          purchasedQuantity: 0,
          usedQuantity: totalUsed,
          remainingQuantity: null,
          threshold,
          status: 'no_purchase' as const,
          note: '尚未记录对应购药信息，暂不参与库存估算。',
        };
      }

      const units = new Set(medicinePurchases.map((p) => p.unit));
      if (units.size > 1) {
        const totalPurchased = medicinePurchases.reduce((sum, p) => sum + p.quantity, 0);
        const totalUsed = medicineRecords.reduce((sum, r) => sum + getRecordTotalDose(r), 0);
        return {
          medicineName,
          unit: null,
          purchasedQuantity: totalPurchased,
          usedQuantity: totalUsed,
          remainingQuantity: null,
          threshold,
          status: 'mixed_unit' as const,
          note: '该药品采购记录存在多个单位，暂不参与库存估算。',
        };
      }

      const sortedPurchases = [...medicinePurchases].sort((a, b) => dayjs(a.purchaseDate).valueOf() - dayjs(b.purchaseDate).valueOf());
      const sortedRecords = [...medicineRecords].sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
      const unit = sortedPurchases[0]?.unit ?? null;
      const totalPurchased = sortedPurchases.reduce((sum, p) => sum + p.quantity, 0);
      const totalUsed = sortedRecords.reduce((sum, r) => sum + getRecordTotalDose(r), 0);

      /* 容器型单位（盒/瓶）与服用量（片/粒/袋）不可直接相减，以采购总量作为库存参考 */
      if (unit && CONTAINER_UNITS.has(unit)) {
        return {
          medicineName,
          unit,
          purchasedQuantity: totalPurchased,
          usedQuantity: totalUsed,
          remainingQuantity: totalPurchased,
          threshold,
          status: 'ok' as const,
          note: `已采购 ${totalPurchased} ${unit}，累计服用 ${totalUsed} 次（单位不同，暂不自动扣减）`,
        };
      }

      let runningUsed = 0;
      let recordIndex = 0;

      for (let pi = 0; pi < sortedPurchases.length; pi += 1) {
        while (recordIndex < sortedRecords.length && dayjs(sortedRecords[recordIndex].date).format(DATE_FORMAT) <= dayjs(sortedPurchases[pi].purchaseDate).format(DATE_FORMAT)) {
          runningUsed += getRecordTotalDose(sortedRecords[recordIndex]);
          recordIndex += 1;
        }
      }

      while (recordIndex < sortedRecords.length) {
        runningUsed += getRecordTotalDose(sortedRecords[recordIndex]);
        recordIndex += 1;
      }

      const rawRemaining = totalPurchased - runningUsed;
      const remainingQuantity = Math.max(0, Number(rawRemaining.toFixed(1)));

      if (rawRemaining < 0) {
        return {
          medicineName,
          unit,
          purchasedQuantity: totalPurchased,
          usedQuantity: runningUsed,
          remainingQuantity: 0,
          threshold,
          status: 'low' as const,
          note: '累计使用量已超过购买总量，库存可能已耗尽，请及时补货。',
        };
      }

      return {
        medicineName,
        unit,
        purchasedQuantity: totalPurchased,
        usedQuantity: runningUsed,
        remainingQuantity,
        threshold,
        status: remainingQuantity <= threshold ? 'low' as const : 'ok' as const,
        note: remainingQuantity <= threshold ? '已进入低库存提醒阈值。' : '库存仍高于提醒阈值。',
      };
    })
    .sort((left, right) => {
      const priority = { low: 0, mixed_unit: 1, no_purchase: 2, ok: 3 };
      const diff = priority[left.status] - priority[right.status];
      if (diff !== 0) {
        return diff;
      }
      return left.medicineName.localeCompare(right.medicineName);
    });
}

export function buildMedicationLowStockItems(
  records: MedicationRecord[],
  purchases: MedicationPurchaseRecord[],
  userId: string,
  defaultThreshold: number,
  medicineThresholds: Record<string, number>,
) {
  return buildMedicationStockSummary(records, purchases, userId, defaultThreshold, medicineThresholds)
    .filter((item) => item.status === 'low');
}

function buildInitialSummaries() {
  return sortSummaries([
    materializeSummary({
      userId: DEFAULT_MEDICATION_USER_ID,
      date: dayjs().format(DATE_FORMAT),
      content: '今天症状较轻，早餐和晚餐按计划服药，午后未出现明显不适。',
    }),
    materializeSummary({
      userId: DEFAULT_MEDICATION_USER_ID,
      date: dayjs().subtract(2, 'day').format(DATE_FORMAT),
      content: '连续几天按时服药后睡眠更稳定，建议继续观察一周。',
    }),
  ]);
}

export function buildInitialMedicationState(): MedicationPageState {
  return {
    records: sortMedicationRecords([
      createMockMedicationRecord(DEFAULT_MEDICATION_USER_ID, 0, {
        medicineName: '维生素 C',
        breakfast: 1,
        lunch: 0,
        dinner: 1,
      }),
      createMockMedicationRecord(DEFAULT_MEDICATION_USER_ID, 1, {
        medicineName: '感冒灵',
        breakfast: 1,
        lunch: 1,
        dinner: 1,
      }),
      createMockMedicationRecord(DEFAULT_MEDICATION_USER_ID, 2, {
        medicineName: '维生素 C',
        breakfast: 1,
        lunch: 0,
        dinner: 1,
      }),
      createMockMedicationRecord(DEFAULT_MEDICATION_USER_ID, 4, {
        medicineName: '褪黑素',
        breakfast: 0,
        lunch: 0,
        dinner: 1,
      }),
      createMockMedicationRecord('user-002', 1, {
        medicineName: '阿莫西林',
        breakfast: 1,
        lunch: 1,
        dinner: 1,
      }),
    ]),
    purchases: sortPurchases([
      createMockPurchase(DEFAULT_MEDICATION_USER_ID, 8, {
        medicineName: '维生素 C',
        quantity: 6,
        unit: '片',
        unitPrice: 1.2,
        totalPrice: 7.2,
        channel: '京东',
      }),
      createMockPurchase(DEFAULT_MEDICATION_USER_ID, 20, {
        medicineName: '感冒灵',
        quantity: 12,
        unit: '袋',
        unitPrice: 1.5,
        totalPrice: 18,
        channel: '药店',
      }),
      createMockPurchase(DEFAULT_MEDICATION_USER_ID, 35, {
        medicineName: '褪黑素',
        quantity: 30,
        unit: '粒',
        unitPrice: 0.8,
        totalPrice: 24,
        channel: '淘宝',
      }),
      createMockPurchase('user-002', 6, {
        medicineName: '阿莫西林',
        quantity: 18,
        unit: '粒',
        unitPrice: 0.9,
        totalPrice: 16.2,
        channel: '医院',
      }),
    ]),
    summaries: buildInitialSummaries(),
    settings: {
      activeUserId: DEFAULT_MEDICATION_USER_ID,
      recordsUserId: DEFAULT_MEDICATION_USER_ID,
      purchaseUserId: DEFAULT_MEDICATION_USER_ID,
      analysisUserId: DEFAULT_MEDICATION_USER_ID,
      summaryUserId: DEFAULT_MEDICATION_USER_ID,
      doseReminderEnabled: true,
      stockReminderEnabled: true,
      breakfastReminderTime: MEDICATION_REMINDER_META.breakfast.defaultTime,
      lunchReminderTime: MEDICATION_REMINDER_META.lunch.defaultTime,
      dinnerReminderTime: MEDICATION_REMINDER_META.dinner.defaultTime,
      defaultStockThreshold: 3,
      medicineThresholds: {
        '维生素 C': 2,
        感冒灵: 3,
      },
    },
  };
}

export function normalizeMedicationPageState(state: MedicationPageState): MedicationPageState {
  const fallback = buildInitialMedicationState();
  const activeUserId = normalizeMedicationUserId(state?.settings?.activeUserId ?? fallback.settings.activeUserId) || DEFAULT_MEDICATION_USER_ID;

  const records = Array.isArray(state?.records)
    ? sortMedicationRecords(state.records.map((record) => materializeMedicationRecord({
      ...record,
      userId: normalizeMedicationUserId(String(record.userId ?? activeUserId)) || activeUserId,
      medicineName: String(
        record.medicineName
        ?? ((record as unknown as Record<string, unknown>).medicine_name ?? ''),
      ),
    })))
    : fallback.records;

  const purchases = Array.isArray(state?.purchases)
    ? sortPurchases(state.purchases.map((record) => materializeMedicationPurchase({
      ...record,
      userId: normalizeMedicationUserId(String(record.userId ?? activeUserId)) || activeUserId,
      medicineName: String(
        record.medicineName
        ?? ((record as unknown as Record<string, unknown>).medicine_name ?? ''),
      ),
    })))
    : fallback.purchases;

  const summaries = Array.isArray(state?.summaries)
    ? sortSummaries(state.summaries
      .map((summary) => materializeSummary({
        ...summary,
        userId: normalizeMedicationUserId(String(summary.userId ?? activeUserId)) || activeUserId,
        content: String(
          summary.content
          ?? ((summary as unknown as Record<string, unknown>).summary ?? ''),
        ),
      }))
      .filter((summary) => summary.content.trim()))
    : fallback.summaries;

  return {
    records,
    purchases,
    summaries,
    settings: {
      activeUserId,
      recordsUserId: normalizeMedicationUserId(state?.settings?.recordsUserId ?? activeUserId),
      purchaseUserId: normalizeMedicationUserId(state?.settings?.purchaseUserId ?? activeUserId),
      analysisUserId: normalizeMedicationUserId(state?.settings?.analysisUserId ?? activeUserId),
      summaryUserId: normalizeMedicationUserId(state?.settings?.summaryUserId ?? activeUserId),
      doseReminderEnabled: state?.settings?.doseReminderEnabled ?? true,
      stockReminderEnabled: state?.settings?.stockReminderEnabled ?? true,
      breakfastReminderTime: state?.settings?.breakfastReminderTime ?? MEDICATION_REMINDER_META.breakfast.defaultTime,
      lunchReminderTime: state?.settings?.lunchReminderTime ?? MEDICATION_REMINDER_META.lunch.defaultTime,
      dinnerReminderTime: state?.settings?.dinnerReminderTime ?? MEDICATION_REMINDER_META.dinner.defaultTime,
      defaultStockThreshold: Math.max(0, toNumber(state?.settings?.defaultStockThreshold, fallback.settings.defaultStockThreshold)),
      medicineThresholds: Object.fromEntries(
        Object.entries(state?.settings?.medicineThresholds ?? {})
          .map(([key, value]) => [key, Math.max(0, toNumber(value))]),
      ),
    },
  };
}
