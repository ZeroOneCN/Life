/**
 * 健康报告类型定义
 *
 * 对应后端 /api/health/report 接口返回的数据结构。
 */

/** 周期类型 */
export type HealthReportPeriod = 'week' | 'month' | 'year';

/** 步数汇总 */
export interface HealthReportStepSummary {
  totalSteps: number;
  avgSteps: number;
  activeDays: number;
  goalHitDays: number;
  totalDistanceKm: number;
}

/** 体重汇总 */
export interface HealthReportWeightSummary {
  firstWeight: number | null;
  latestWeight: number | null;
  weightChange: number | null;
  recordCount: number;
}

/** 运动汇总 */
export interface HealthReportExerciseSummary {
  totalCalories: number;
  totalDuration: number;
  totalSessions: number;
  activeDays: number;
}

/** 饮食汇总 */
export interface HealthReportDietSummary {
  intakeCalories: number;
  recordCount: number;
  netCalories: number;
  avgNetCalories: number;
}

/** 用药汇总 */
export interface HealthReportMedicationSummary {
  recordDays: number;
  recordCount: number;
}

/** 体检汇总 */
export interface HealthReportCheckupSummary {
  totalRecords: number;
  abnormalCount: number;
  attentionCount: number;
}

/** 单周期完整汇总 */
export interface HealthReportRangeSummary {
  label: string;
  start: string;
  end: string;
  step: HealthReportStepSummary;
  weight: HealthReportWeightSummary;
  exercise: HealthReportExerciseSummary;
  diet: HealthReportDietSummary;
  medication: HealthReportMedicationSummary;
  checkup: HealthReportCheckupSummary;
}

/** 同环比变化 */
export interface HealthReportChange {
  percent: number | null;
  trend: 'up' | 'down' | 'flat' | 'none';
}

/** 报告汇总响应 */
export interface HealthReportSummary {
  period: HealthReportPeriod;
  date: string;
  current: HealthReportRangeSummary;
  previous: HealthReportRangeSummary;
  changes: {
    step: HealthReportChange;
    exercise: HealthReportChange;
    diet: HealthReportChange;
    weight: HealthReportChange;
  };
  generatedAt: string;
}

/** 异常体检记录 */
export interface HealthReportAbnormalCheckupRecord {
  id: string;
  testDate: string;
  testType: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: string;
  notes: string;
}

/** 异常识别响应 */
export interface HealthReportAbnormal {
  period: HealthReportPeriod;
  date: string;
  range: { start: string; end: string; label: string };
  abnormalCheckupRecords: HealthReportAbnormalCheckupRecord[];
  abnormalCount: number;
  medication: {
    recordDays: number;
    totalDays: number;
    coverage: number;
    isLow: boolean;
  };
  weightChangeAlert: {
    change: number;
    threshold: number;
    isAlert: boolean;
  } | null;
}

/** AI 建议单项 */
export interface HealthReportAISuggestionItem {
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

/** AI 建议响应 */
export interface HealthReportAISuggestion {
  period: HealthReportPeriod;
  date: string;
  label: string;
  suggestion: {
    summary: string;
    suggestions: HealthReportAISuggestionItem[];
    risks: string[];
  };
  generatedAt: string;
}
