/** 体征指标类型 */
export type VitalMetricKey =
  | 'heart_rate'
  | 'systolic_bp'
  | 'diastolic_bp'
  | 'blood_oxygen'
  | 'blood_sugar'
  | 'body_temp';

/** 体征状态 */
export type VitalStatus = 'normal' | 'abnormal' | 'attention' | 'unknown';

/** 体征指标定义 */
export interface VitalMetricInfo {
  key: VitalMetricKey;
  label: string;
  unit: string;
  referenceRange: string;
}

/** 体征记录 */
export interface VitalRecord {
  id: string;
  userId: string;
  recordTime: string;
  metric: VitalMetricKey;
  metricLabel: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: VitalStatus;
  notes: string;
  lastAbnormalAlertAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 体征概览 - 单个指标统计 */
export interface VitalMetricOverview {
  key: VitalMetricKey;
  label: string;
  unit: string;
  referenceRange: string;
  latest: VitalRecord | null;
  abnormalCount: number;
  recordCount: number;
}

/** 体征概览 */
export interface VitalOverview {
  totalRecords: number;
  totalAbnormal: number;
  latestRecordTime: string | null;
  metrics: VitalMetricOverview[];
}

/** 趋势数据点 */
export interface VitalTrendItem {
  date: string;
  label: string;
  avgValue: number | null;
  minValue: number | null;
  maxValue: number | null;
}

/** 趋势分析结果 */
export interface VitalTrend {
  metric: VitalMetricKey;
  metricLabel: string;
  unit: string;
  referenceRange: string;
  period: 'week' | 'month' | 'year';
  days: number;
  items: VitalTrendItem[];
}

/** 分页响应 */
export interface PaginatedVitalRecords {
  items: VitalRecord[];
  page: number;
  pageSize: number;
  total: number;
}

/** 新增体征记录入参 */
export interface VitalRecordDraft {
  recordTime: string;
  metric: VitalMetricKey;
  value: number;
  notes?: string;
}
