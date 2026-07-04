/**
 * 健康仪表盘类型定义
 *
 * 对应后端 /api/health/dashboard 接口返回的数据结构。
 */

/** 步数概览 */
export interface HealthDashboardStepOverview {
  todaySteps: number;
  todayDistanceKm: number;
  currentMonthSteps: number;
  currentMonthDistanceKm: number;
  strideLength: number;
}

/** 体重概览 */
export interface HealthDashboardWeightOverview {
  latestWeightKg: number | null;
  latestHeightCm: number;
  bmi: number | null;
  latestDate: string | null;
}

/** 运动概览 */
export interface HealthDashboardExerciseOverview {
  todayCaloriesOut: number;
  workoutDays30: number;
}

/** 饮食概览 */
export interface HealthDashboardDietOverview {
  avgNetCalories30: number;
}

/** 用药概览 */
export interface HealthDashboardMedicationOverview {
  recordDays30: number;
  plannedDays30: number;
}

/** 体检概览 */
export interface HealthDashboardCheckupOverview {
  totalRecords: number;
  abnormalCount: number;
  latestDate: string | null;
}

/** 综合概览 */
export interface HealthDashboardOverview {
  step: HealthDashboardStepOverview;
  weight: HealthDashboardWeightOverview;
  exercise: HealthDashboardExerciseOverview;
  diet: HealthDashboardDietOverview;
  medication: HealthDashboardMedicationOverview;
  checkup: HealthDashboardCheckupOverview;
  last30DaysStart: string;
  last30DaysEnd: string;
}

/** 步数热力图单项 */
export interface HealthStepHeatmapItem {
  date: string;
  steps: number;
  distanceKm: number;
}

/** 步数热力图响应 */
export interface HealthStepHeatmapResponse {
  year: number;
  items: HealthStepHeatmapItem[];
}

/** 对比指标类型 */
export type HealthComparisonMetric = 'step' | 'weight' | 'exercise' | 'medication';

/** 对比周期 */
export type HealthComparisonPeriod = 'month' | 'year';

/** 对比周期汇总 */
export interface HealthComparisonRangeSummary {
  label: string;
  value: number;
  recordCount: number;
}

/** 对比结果 */
export interface HealthComparisonResult {
  metric: HealthComparisonMetric;
  period: HealthComparisonPeriod;
  date: string;
  current: HealthComparisonRangeSummary;
  previous: HealthComparisonRangeSummary;
  changePercentage: number | null;
  trend: 'up' | 'down' | 'flat' | 'none';
}

/** 雷达图单项维度 */
export interface HealthRadarDimension {
  key: string;
  label: string;
  score: number;
  value: number;
  unit: string;
}

/** 雷达图响应 */
export interface HealthRadarSummary {
  dimensions: HealthRadarDimension[];
  overallScore: number;
  strideLength: number;
  last30DaysStart: string;
}
