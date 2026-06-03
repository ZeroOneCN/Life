export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ExerciseType = 'cardio' | 'strength' | 'flexibility';

export type IntensityLevel = 'low' | 'medium' | 'high';

export type FitnessTab = 'diet' | 'exercise' | 'shopping' | 'weight' | 'dashboard';

export interface FitnessUserScopedRecordBase {
  id: string;
  userId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface DietRecord extends FitnessUserScopedRecordBase {
  mealType: MealType;
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ExerciseRecord extends FitnessUserScopedRecordBase {
  exerciseType: ExerciseType;
  exerciseName: string;
  duration: number;
  calories: number;
  intensity: IntensityLevel;
}

export interface FitnessShoppingRecord extends FitnessUserScopedRecordBase {
  itemName: string;
  specGrams: number;
  quantity: number;
  unitPrice: number;
  location: string;
}

export interface WeightRecord extends FitnessUserScopedRecordBase {
  weight: number;
  height: number;
  bodyFat: number;
}

export interface DietRecordDraft {
  userId: string;
  date: string;
  mealType: MealType;
  foodName: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ExerciseRecordDraft {
  userId: string;
  date: string;
  exerciseType: ExerciseType;
  exerciseName: string;
  duration: number;
  calories: number;
  intensity: IntensityLevel;
}

export interface FitnessShoppingRecordDraft {
  userId: string;
  date: string;
  itemName: string;
  specGrams: number;
  quantity: number;
  unitPrice: number;
  location: string;
}

export interface WeightRecordDraft {
  userId: string;
  date: string;
  weight: number;
  height: number;
  bodyFat: number;
}

export interface FitnessPageState {
  dietRecords: DietRecord[];
  exerciseRecords: ExerciseRecord[];
  shoppingRecords: FitnessShoppingRecord[];
  weightRecords: WeightRecord[];
  settings: {
    activeUserId: string;
    dietFilterUserId: string;
    exerciseFilterUserId: string;
    shoppingFilterUserId: string;
    weightFilterUserId: string;
    dashboardUserId: string;
    defaultHeightCm?: number;
  };
}

export interface FitnessInsight {
  id: string;
  title: string;
  description: string;
  metric?: string;
  tone: 'default' | 'green' | 'orange' | 'blue' | 'red';
}

export interface MacroSummaryPoint {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface WeightTrendPoint {
  date: string;
  label: string;
  weight: number | null;
  bodyFat: number | null;
}

export interface CalorieTrendPoint {
  date: string;
  label: string;
  intake: number;
  burn: number;
  net: number;
}

export interface CostTrendPoint {
  date: string;
  label: string;
  cost: number;
}

export interface FitnessOverviewSummary {
  todayCaloriesIn: number;
  todayCaloriesOut: number;
  todayNetCalories: number;
  latestWeightKg: number | null;
  bmi: number | null;
  weekAverageNetCalories: number;
  monthShoppingAmount: number;
  todayDietCost: number;
  trackedDays: number;
}
