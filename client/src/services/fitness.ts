import dayjs from 'dayjs';

import { CHART_EXERCISE, CHART_INTENSITY, CHART_MACRO, CHART_MEAL } from '../lib/chartPalette';
import type {
  CalorieTrendPoint,
  CostTrendPoint,
  DietRecord,
  DietRecordDraft,
  ExerciseRecord,
  ExerciseRecordDraft,
  ExerciseType,
  FitnessInsight,
  FitnessOverviewSummary,
  FitnessPageState,
  FitnessShoppingRecord,
  FitnessShoppingRecordDraft,
  FitnessUserScopedRecordBase,
  IntensityLevel,
  MacroSummaryPoint,
  MealType,
  WeightRecord,
  WeightRecordDraft,
  WeightTrendPoint,
} from '../types/fitness';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const MONTH_FORMAT = 'YYYY-MM';

export const FITNESS_RECORD_PAGE_SIZE = 10;
export const FITNESS_DASHBOARD_DAYS = 30;

export const MEAL_TYPE_META: Record<MealType, { label: string; color: string }> = {
  breakfast: { label: '早餐', color: CHART_MEAL.breakfast },
  lunch: { label: '午餐', color: CHART_MEAL.lunch },
  dinner: { label: '晚餐', color: CHART_MEAL.dinner },
  snack: { label: '加餐', color: CHART_MEAL.snack },
};

export const EXERCISE_TYPE_META: Record<ExerciseType, { label: string; color: string }> = {
  cardio: { label: '有氧', color: CHART_EXERCISE.cardio },
  strength: { label: '力量', color: CHART_EXERCISE.strength },
  flexibility: { label: '柔韧', color: CHART_EXERCISE.flexibility },
};

export const INTENSITY_LEVEL_META: Record<IntensityLevel, { label: string; color: string }> = {
  low: { label: '低', color: CHART_INTENSITY.low },
  medium: { label: '中', color: CHART_INTENSITY.medium },
  high: { label: '高', color: CHART_INTENSITY.high },
};

export const MACRO_COLORS = [CHART_MACRO.carb, CHART_MACRO.protein, CHART_MACRO.fat];

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDate(value: unknown) {
  const parsed = dayjs(String(value ?? ''));
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : dayjs().format(DATE_FORMAT);
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? ''));
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function sortByLatestDate<T extends FitnessUserScopedRecordBase>(records: T[]) {
  return [...records].sort((left, right) => {
    const dateDiff = dayjs(right.date).valueOf() - dayjs(left.date).valueOf();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function matchesName(left: string, right: string) {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function buildBaseRecord<T extends FitnessUserScopedRecordBase>(
  record: Partial<T>,
) {
  const date = normalizeDate(record.date);

  return {
    id: record.id ?? buildId(),
    date,
    createdAt: normalizeTimestamp(record.createdAt, date),
    updatedAt: normalizeTimestamp(record.updatedAt, date),
  };
}

function createMockDietRecord(daysAgo: number, draft: Omit<DietRecordDraft, 'date'>): DietRecord {
  const date = dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT);

  return {
    id: buildId(),
    date,
    createdAt: dayjs(`${date}T08:00`).format(DATE_TIME_FORMAT),
    updatedAt: dayjs(`${date}T08:00`).format(DATE_TIME_FORMAT),
    ...draft,
  };
}

function createMockExerciseRecord(
  daysAgo: number,
  draft: Omit<ExerciseRecordDraft, 'date'>,
): ExerciseRecord {
  const date = dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT);

  return {
    id: buildId(),
    date,
    createdAt: dayjs(`${date}T18:30`).format(DATE_TIME_FORMAT),
    updatedAt: dayjs(`${date}T18:30`).format(DATE_TIME_FORMAT),
    ...draft,
  };
}

function createMockShoppingRecord(
  daysAgo: number,
  draft: Omit<FitnessShoppingRecordDraft, 'date'>,
): FitnessShoppingRecord {
  const date = dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT);

  return {
    id: buildId(),
    date,
    createdAt: dayjs(`${date}T10:20`).format(DATE_TIME_FORMAT),
    updatedAt: dayjs(`${date}T10:20`).format(DATE_TIME_FORMAT),
    ...draft,
  };
}

function createMockWeightRecord(daysAgo: number, draft: Omit<WeightRecordDraft, 'date'>): WeightRecord {
  const date = dayjs().subtract(daysAgo, 'day').format(DATE_FORMAT);

  return {
    id: buildId(),
    date,
    createdAt: dayjs(`${date}T07:40`).format(DATE_TIME_FORMAT),
    updatedAt: dayjs(`${date}T07:40`).format(DATE_TIME_FORMAT),
    ...draft,
  };
}

function getRecentDateKeys(days: number) {
  return Array.from({ length: days }, (_, index) => dayjs().subtract(days - index - 1, 'day').format(DATE_FORMAT));
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function calculateDietCostFromShopping(record: DietRecord, shoppingRecords: FitnessShoppingRecord[]) {
  const matched = shoppingRecords.filter((shoppingRecord) => (
    matchesName(record.foodName, shoppingRecord.itemName)
    && shoppingRecord.specGrams > 0
    && shoppingRecord.unitPrice > 0
  ));

  if (!matched.length) {
    return 0;
  }

  const averageCostPerGram = matched.reduce(
    (sum, shoppingRecord) => sum + (shoppingRecord.unitPrice / shoppingRecord.specGrams),
    0,
  ) / matched.length;

  return Number((record.grams * averageCostPerGram).toFixed(2));
}

export function createDietRecord(records: DietRecord[], draft: DietRecordDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortByLatestDate([
    {
      id: buildId(),
      date: normalizeDate(draft.date),
      mealType: draft.mealType,
      foodName: draft.foodName.trim(),
      grams: draft.grams,
      calories: draft.calories,
      protein: draft.protein,
      carbs: draft.carbs,
      fat: draft.fat,
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateDietRecord(records: DietRecord[], id: string, draft: DietRecordDraft) {
  return sortByLatestDate(records.map((record) => (
    record.id === id
      ? {
        ...record,
        date: normalizeDate(draft.date),
        mealType: draft.mealType,
        foodName: draft.foodName.trim(),
        grams: draft.grams,
        calories: draft.calories,
        protein: draft.protein,
        carbs: draft.carbs,
        fat: draft.fat,
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteDietRecord(records: DietRecord[], id: string) {
  return sortByLatestDate(records.filter((record) => record.id !== id));
}

export function createExerciseRecord(records: ExerciseRecord[], draft: ExerciseRecordDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortByLatestDate([
    {
      id: buildId(),
      date: normalizeDate(draft.date),
      exerciseType: draft.exerciseType,
      exerciseName: draft.exerciseName.trim(),
      duration: draft.duration,
      calories: draft.calories,
      intensity: draft.intensity,
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateExerciseRecord(records: ExerciseRecord[], id: string, draft: ExerciseRecordDraft) {
  return sortByLatestDate(records.map((record) => (
    record.id === id
      ? {
        ...record,
        date: normalizeDate(draft.date),
        exerciseType: draft.exerciseType,
        exerciseName: draft.exerciseName.trim(),
        duration: draft.duration,
        calories: draft.calories,
        intensity: draft.intensity,
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteExerciseRecord(records: ExerciseRecord[], id: string) {
  return sortByLatestDate(records.filter((record) => record.id !== id));
}

export function createFitnessShoppingRecord(records: FitnessShoppingRecord[], draft: FitnessShoppingRecordDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortByLatestDate([
    {
      id: buildId(),
      date: normalizeDate(draft.date),
      itemName: draft.itemName.trim(),
      specGrams: draft.specGrams,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      location: draft.location.trim(),
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateFitnessShoppingRecord(records: FitnessShoppingRecord[], id: string, draft: FitnessShoppingRecordDraft) {
  return sortByLatestDate(records.map((record) => (
    record.id === id
      ? {
        ...record,
        date: normalizeDate(draft.date),
        itemName: draft.itemName.trim(),
        specGrams: draft.specGrams,
        quantity: draft.quantity,
        unitPrice: draft.unitPrice,
        location: draft.location.trim(),
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteFitnessShoppingRecord(records: FitnessShoppingRecord[], id: string) {
  return sortByLatestDate(records.filter((record) => record.id !== id));
}

export function createWeightRecord(records: WeightRecord[], draft: WeightRecordDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortByLatestDate([
    {
      id: buildId(),
      date: normalizeDate(draft.date),
      weight: draft.weight,
      height: draft.height,
      bodyFat: draft.bodyFat,
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateWeightRecord(records: WeightRecord[], id: string, draft: WeightRecordDraft) {
  return sortByLatestDate(records.map((record) => (
    record.id === id
      ? {
        ...record,
        date: normalizeDate(draft.date),
        weight: draft.weight,
        height: draft.height,
        bodyFat: draft.bodyFat,
        updatedAt: dayjs().format(DATE_TIME_FORMAT),
      }
      : record
  )));
}

export function deleteWeightRecord(records: WeightRecord[], id: string) {
  return sortByLatestDate(records.filter((record) => record.id !== id));
}

export function buildMacroSummary(records: DietRecord[], targetDate = dayjs().format(DATE_FORMAT)): MacroSummaryPoint[] {
  const dayRecords = records.filter((record) => record.date === targetDate);
  const protein = dayRecords.reduce((sum, record) => sum + record.protein, 0);
  const carbs = dayRecords.reduce((sum, record) => sum + record.carbs, 0);
  const fat = dayRecords.reduce((sum, record) => sum + record.fat, 0);
  const total = protein + carbs + fat;

  if (total <= 0) {
    return [];
  }

  return [
    { name: '蛋白质', value: Number(protein.toFixed(1)), percentage: Number(((protein / total) * 100).toFixed(1)), color: MACRO_COLORS[0] },
    { name: '碳水', value: Number(carbs.toFixed(1)), percentage: Number(((carbs / total) * 100).toFixed(1)), color: MACRO_COLORS[1] },
    { name: '脂肪', value: Number(fat.toFixed(1)), percentage: Number(((fat / total) * 100).toFixed(1)), color: MACRO_COLORS[2] },
  ];
}

export function buildWeightTrend(records: WeightRecord[], days = FITNESS_DASHBOARD_DAYS): WeightTrendPoint[] {
  return getRecentDateKeys(days).map((date) => {
    const dayRecords = records.filter((record) => record.date === date);

    if (!dayRecords.length) {
      return {
        date,
        label: dayjs(date).format('MM-DD'),
        weight: null,
        bodyFat: null,
      };
    }

    const averageWeight = dayRecords.reduce((sum, record) => sum + record.weight, 0) / dayRecords.length;
    const averageBodyFat = dayRecords.reduce((sum, record) => sum + record.bodyFat, 0) / dayRecords.length;

    return {
      date,
      label: dayjs(date).format('MM-DD'),
      weight: Number(averageWeight.toFixed(2)),
      bodyFat: Number(averageBodyFat.toFixed(1)),
    };
  });
}

export function buildCalorieTrend(
  dietRecords: DietRecord[],
  exerciseRecords: ExerciseRecord[],
  days = FITNESS_DASHBOARD_DAYS,
): CalorieTrendPoint[] {
  return getRecentDateKeys(days).map((date) => {
    const intake = dietRecords
      .filter((record) => record.date === date)
      .reduce((sum, record) => sum + record.calories, 0);
    const burn = exerciseRecords
      .filter((record) => record.date === date)
      .reduce((sum, record) => sum + record.calories, 0);

    return {
      date,
      label: dayjs(date).format('MM-DD'),
      intake: Number(intake.toFixed(1)),
      burn: Number(burn.toFixed(1)),
      net: Number((intake - burn).toFixed(1)),
    };
  });
}

export function buildFoodCostTrend(
  dietRecords: DietRecord[],
  shoppingRecords: FitnessShoppingRecord[],
  days = FITNESS_DASHBOARD_DAYS,
): CostTrendPoint[] {
  return getRecentDateKeys(days).map((date) => {
    const dayCost = dietRecords
      .filter((record) => record.date === date)
      .reduce((sum, record) => sum + calculateDietCostFromShopping(record, shoppingRecords), 0);

    return {
      date,
      label: dayjs(date).format('MM-DD'),
      cost: Number(dayCost.toFixed(2)),
    };
  });
}

export function buildFitnessOverviewSummary(
  dietRecords: DietRecord[],
  exerciseRecords: ExerciseRecord[],
  shoppingRecords: FitnessShoppingRecord[],
  weightRecords: WeightRecord[],
  defaultHeightCm = 170,
): FitnessOverviewSummary {
  const today = dayjs().format(DATE_FORMAT);
  const currentMonth = dayjs().format(MONTH_FORMAT);
  const calorieTrend = buildCalorieTrend(dietRecords, exerciseRecords, 7);
  const activeDays = calorieTrend.filter((point) => point.intake > 0 || point.burn > 0);
  const latestWeightRecord = sortByLatestDate(weightRecords)[0] ?? null;
  const monthShoppingAmount = shoppingRecords
    .filter((record) => dayjs(record.date).format(MONTH_FORMAT) === currentMonth)
    .reduce((sum, record) => sum + (record.quantity * record.unitPrice), 0);
  const todayDietCost = dietRecords
    .filter((record) => record.date === today)
    .reduce((sum, record) => sum + calculateDietCostFromShopping(record, shoppingRecords), 0);

  return {
    todayCaloriesIn: dietRecords
      .filter((record) => record.date === today)
      .reduce((sum, record) => sum + record.calories, 0),
    todayCaloriesOut: exerciseRecords
      .filter((record) => record.date === today)
      .reduce((sum, record) => sum + record.calories, 0),
    todayNetCalories: Number(
      (
        dietRecords.filter((record) => record.date === today).reduce((sum, record) => sum + record.calories, 0)
        - exerciseRecords.filter((record) => record.date === today).reduce((sum, record) => sum + record.calories, 0)
      ).toFixed(1)
    ),
    latestWeightKg: latestWeightRecord ? Number(latestWeightRecord.weight.toFixed(2)) : null,
    bmi: latestWeightRecord
      ? calculateBmi(latestWeightRecord.weight, latestWeightRecord.height || defaultHeightCm)
      : null,
    weekAverageNetCalories: activeDays.length
      ? Number((activeDays.reduce((sum, point) => sum + point.net, 0) / activeDays.length).toFixed(0))
      : 0,
    monthShoppingAmount: Number(monthShoppingAmount.toFixed(2)),
    todayDietCost: Number(todayDietCost.toFixed(2)),
    trackedDays: new Set([
      ...dietRecords.map((record) => record.date),
      ...exerciseRecords.map((record) => record.date),
      ...shoppingRecords.map((record) => record.date),
      ...weightRecords.map((record) => record.date),
    ]).size,
  };
}

export function buildFitnessInsights(
  dietRecords: DietRecord[],
  exerciseRecords: ExerciseRecord[],
  shoppingRecords: FitnessShoppingRecord[],
  weightRecords: WeightRecord[],
): FitnessInsight[] {
  const insights: FitnessInsight[] = [];
  const calorieTrend = buildCalorieTrend(dietRecords, exerciseRecords, 7);
  const recentWeightTrend = buildWeightTrend(weightRecords, 30).filter((point) => point.weight !== null);
  const sevenDayDietRecords = dietRecords.filter((record) => dayjs(record.date).isAfter(dayjs().subtract(7, 'day')));
  const sevenDayExerciseRecords = exerciseRecords.filter((record) => dayjs(record.date).isAfter(dayjs().subtract(7, 'day')));
  const sevenDayActiveDays = new Set([
    ...sevenDayDietRecords.map((record) => record.date),
    ...sevenDayExerciseRecords.map((record) => record.date),
  ]).size || 1;

  const averageNet = calorieTrend.length
    ? calorieTrend.reduce((sum, point) => sum + point.net, 0) / calorieTrend.length
    : 0;
  const averageProtein = sevenDayDietRecords.reduce((sum, record) => sum + record.protein, 0) / sevenDayActiveDays;
  const workoutDays = new Set(sevenDayExerciseRecords.map((record) => record.date)).size;
  const currentMonthSpend = shoppingRecords
    .filter((record) => dayjs(record.date).format(MONTH_FORMAT) === dayjs().format(MONTH_FORMAT))
    .reduce((sum, record) => sum + (record.quantity * record.unitPrice), 0);

  if (averageNet > 450) {
    insights.push({
      id: 'net-high',
      title: '净热量偏高',
      description: '最近 7 天平均净热量偏高，减脂阶段建议优先复核总摄入或增加活动量。',
      metric: `${Math.round(averageNet)} kcal / 天`,
      tone: 'red',
    });
  } else if (averageNet < -550) {
    insights.push({
      id: 'net-low',
      title: '净热量偏低',
      description: '最近 7 天平均净热量过低，建议避免长期过度节食，预留更稳定的恢复空间。',
      metric: `${Math.round(averageNet)} kcal / 天`,
      tone: 'orange',
    });
  }

  if (averageProtein > 0 && averageProtein < 75) {
    insights.push({
      id: 'protein-low',
      title: '蛋白质摄入偏低',
      description: '近一周平均蛋白质摄入不足，建议优先补充高蛋白主食材和加餐。',
      metric: `${averageProtein.toFixed(1)} g / 天`,
      tone: 'orange',
    });
  }

  if (workoutDays < 2) {
    insights.push({
      id: 'exercise-low',
      title: '运动频次不足',
      description: '近 7 天有效训练天数偏少，建议至少安排 2 到 3 次有计划的训练。',
      metric: `${workoutDays} 天`,
      tone: 'blue',
    });
  }

  if (recentWeightTrend.length >= 4) {
    const firstWeight = recentWeightTrend[0]?.weight ?? null;
    const lastWeight = recentWeightTrend[recentWeightTrend.length - 1]?.weight ?? null;

    if (firstWeight !== null && lastWeight !== null) {
      const delta = Number((lastWeight - firstWeight).toFixed(1));

      if (Math.abs(delta) < 0.3) {
        insights.push({
          id: 'weight-flat',
          title: '体重趋势接近平台',
          description: '最近 30 天体重变化很小，可以复核训练强度、总热量和日常步数。',
          metric: `${delta >= 0 ? '+' : ''}${delta} kg`,
          tone: 'blue',
        });
      }
    }

    const bodyFatDelta = Number(
      (
        (recentWeightTrend[recentWeightTrend.length - 1]?.bodyFat ?? 0)
        - (recentWeightTrend[0]?.bodyFat ?? 0)
      ).toFixed(1)
    );

    if (bodyFatDelta > 0.8) {
      insights.push({
        id: 'body-fat-up',
        title: '体脂有上升迹象',
        description: '体脂率较 30 天前有明显回升，建议优先复核饮食质量和训练持续性。',
        metric: `+${bodyFatDelta}%`,
        tone: 'red',
      });
    }
  }

  if (currentMonthSpend > 900) {
    insights.push({
      id: 'shopping-high',
      title: '本月食材采购偏高',
      description: '本月采购支出较高，可以复核采购频率、单价和计划性备餐策略。',
      metric: `¥${currentMonthSpend.toFixed(0)}`,
      tone: 'orange',
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'all-good',
      title: '整体状态稳定',
      description: '当前数据没有明显风险项，建议继续保持记录节奏并按周复盘趋势。',
      tone: 'green',
    });
  }

  return insights;
}

export function normalizeFitnessPageState(state: FitnessPageState): FitnessPageState {
  const fallback = buildInitialFitnessState();
  const rawState = state as Partial<FitnessPageState> & {
    diet?: unknown[];
    exercise?: unknown[];
    shopping?: unknown[];
    weight?: unknown[];
  };

  const normalizeDietRecord = (record: Partial<DietRecord>): DietRecord => ({
    ...buildBaseRecord<DietRecord>(record),
    mealType: (record.mealType as MealType) ?? 'breakfast',
    foodName: String(record.foodName ?? ''),
    grams: toNumber(record.grams, 100),
    calories: toNumber(record.calories, 0),
    protein: toNumber(record.protein, 0),
    carbs: toNumber(record.carbs, 0),
    fat: toNumber(record.fat, 0),
  });

  const normalizeExerciseRecord = (record: Partial<ExerciseRecord>): ExerciseRecord => ({
    ...buildBaseRecord<ExerciseRecord>(record),
    exerciseType: (record.exerciseType as ExerciseType) ?? 'cardio',
    exerciseName: String(record.exerciseName ?? ''),
    duration: toNumber(record.duration, 0),
    calories: toNumber(record.calories, 0),
    intensity: (record.intensity as IntensityLevel) ?? 'medium',
  });

  const normalizeShoppingRecord = (record: Partial<FitnessShoppingRecord>): FitnessShoppingRecord => ({
    ...buildBaseRecord<FitnessShoppingRecord>(record),
    itemName: String(record.itemName ?? ''),
    specGrams: toNumber(record.specGrams, 500),
    quantity: toNumber(record.quantity, 1),
    unitPrice: toNumber(record.unitPrice, 0),
    location: String(record.location ?? ''),
  });

  const normalizeWeightRecord = (record: Partial<WeightRecord>): WeightRecord => ({
    ...buildBaseRecord<WeightRecord>(record),
    weight: toNumber(record.weight, 0),
    height: toNumber(record.height, 170),
    bodyFat: toNumber(record.bodyFat, 0),
  });

  return {
    dietRecords: sortByLatestDate((rawState.dietRecords ?? rawState.diet ?? fallback.dietRecords).map((record) => normalizeDietRecord(record as Partial<DietRecord>))),
    exerciseRecords: sortByLatestDate((rawState.exerciseRecords ?? rawState.exercise ?? fallback.exerciseRecords).map((record) => normalizeExerciseRecord(record as Partial<ExerciseRecord>))),
    shoppingRecords: sortByLatestDate((rawState.shoppingRecords ?? rawState.shopping ?? fallback.shoppingRecords).map((record) => normalizeShoppingRecord(record as Partial<FitnessShoppingRecord>))),
    weightRecords: sortByLatestDate((rawState.weightRecords ?? rawState.weight ?? fallback.weightRecords).map((record) => normalizeWeightRecord(record as Partial<WeightRecord>))),
    settings: {
      defaultHeightCm: toNumber(state.settings?.defaultHeightCm, fallback.settings.defaultHeightCm ?? 170),
    },
  };
}

export function buildInitialFitnessState(): FitnessPageState {
  return {
    dietRecords: sortByLatestDate([
      createMockDietRecord(0, { mealType: 'breakfast', foodName: '燕麦酸奶杯', grams: 320, calories: 365, protein: 24, carbs: 46, fat: 9 }),
      createMockDietRecord(0, { mealType: 'dinner', foodName: '鸡胸肉沙拉', grams: 420, calories: 520, protein: 48, carbs: 22, fat: 18 }),
      createMockDietRecord(2, { mealType: 'lunch', foodName: '牛肉藜麦饭', grams: 460, calories: 610, protein: 42, carbs: 58, fat: 16 }),
      createMockDietRecord(5, { mealType: 'snack', foodName: '香蕉蛋白奶昔', grams: 280, calories: 265, protein: 26, carbs: 29, fat: 5 }),
      createMockDietRecord(1, { mealType: 'lunch', foodName: '三文鱼便当', grams: 430, calories: 590, protein: 39, carbs: 44, fat: 19 }),
      createMockDietRecord(4, { mealType: 'breakfast', foodName: '全麦三明治', grams: 250, calories: 340, protein: 18, carbs: 36, fat: 12 }),
    ]),
    exerciseRecords: sortByLatestDate([
      createMockExerciseRecord(0, { exerciseType: 'cardio', exerciseName: '跑步机间歇跑', duration: 35, calories: 360, intensity: 'high' }),
      createMockExerciseRecord(2, { exerciseType: 'strength', exerciseName: '上肢力量训练', duration: 50, calories: 280, intensity: 'medium' }),
      createMockExerciseRecord(4, { exerciseType: 'flexibility', exerciseName: '瑜伽拉伸', duration: 30, calories: 110, intensity: 'low' }),
      createMockExerciseRecord(1, { exerciseType: 'cardio', exerciseName: '动感单车', duration: 45, calories: 430, intensity: 'high' }),
      createMockExerciseRecord(6, { exerciseType: 'strength', exerciseName: '腿部训练', duration: 55, calories: 320, intensity: 'medium' }),
    ]),
    shoppingRecords: sortByLatestDate([
      createMockShoppingRecord(0, { itemName: '鸡胸肉', specGrams: 1000, quantity: 2, unitPrice: 32, location: '山姆' }),
      createMockShoppingRecord(1, { itemName: '燕麦', specGrams: 1000, quantity: 1, unitPrice: 26, location: '盒马' }),
      createMockShoppingRecord(3, { itemName: '香蕉', specGrams: 500, quantity: 2, unitPrice: 9.8, location: '永辉' }),
      createMockShoppingRecord(2, { itemName: '三文鱼', specGrams: 300, quantity: 2, unitPrice: 45, location: 'Ole' }),
      createMockShoppingRecord(6, { itemName: '全麦面包', specGrams: 420, quantity: 2, unitPrice: 16, location: '盒马' }),
    ]),
    weightRecords: sortByLatestDate([
      createMockWeightRecord(0, { weight: 72.4, height: 178, bodyFat: 19.6 }),
      createMockWeightRecord(7, { weight: 72.9, height: 178, bodyFat: 20.2 }),
      createMockWeightRecord(14, { weight: 73.3, height: 178, bodyFat: 20.6 }),
      createMockWeightRecord(21, { weight: 73.1, height: 178, bodyFat: 20.4 }),
      createMockWeightRecord(0, { weight: 64.8, height: 170, bodyFat: 23.1 }),
      createMockWeightRecord(10, { weight: 65.4, height: 170, bodyFat: 23.8 }),
    ]),
    settings: {
      defaultHeightCm: 170,
    },
  };
}
