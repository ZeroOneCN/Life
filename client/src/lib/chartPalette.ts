/**
 * 图表统一调色板（Chart Palette）
 *
 * 用于 Recharts / ECharts / 自定义 SVG 等所有图表场景的"分类色"与"语义色"。
 * 统一来源：避免 12+ 个 service 各自硬编码同一组十六进制颜色。
 *
 * 命名规则：
 *   - CHART_CATEGORY_*  ：分类色板（环图 / 柱图 / 多系列折线 / 排行榜）
 *   - CHART_PNL_*       ：盈亏正负色
 *   - CHART_*_FILL      ：线性渐变填充（轴向：horizontal / vertical）
 *   - CHART_SEMANTIC_*  ：语义色（上涨/下跌/警告/中性）
 *
 * 注意：这些是"图表专用"色，独立于 UI 的 design system tokens；
 *       CSS 主题切换不会影响图表色板（图表是数据视图，需要稳定的视觉编码）。
 */

/** 8 色分类调色板（主用） */
export const CHART_CATEGORY_8 = [
  '#5e6ad2', // indigo
  '#1eaedb', // sky
  '#27a644', // green
  '#f59e0b', // amber
  '#e5484d', // red
  '#10b981', // emerald
  '#c084fc', // violet
  '#f97316', // orange
] as const;

/** 5 色分类调色板（精简场景） */
export const CHART_CATEGORY_5 = [
  '#5e6ad2',
  '#27a644',
  '#f59e0b',
  '#e5484d',
  '#1eaedb',
] as const;

/** 6 色分类调色板（标签/卡片背景常用） */
export const CHART_CATEGORY_6 = [
  '#5e6ad2',
  '#1eaedb',
  '#27a644',
  '#f59e0b',
  '#e5484d',
  '#10b981',
] as const;

/** 涨跌正负色（金融市场） */
export const CHART_PNL = {
  up: '#27a644',
  down: '#e5484d',
  neutral: '#6b7280',
} as const;

/** 健身饮食四餐颜色 */
export const CHART_MEAL = {
  breakfast: '#f0b90b',
  lunch: '#0ecb81',
  dinner: '#f6465d',
  snack: '#1eaedb',
} as const;

/** 健身训练类型颜色 */
export const CHART_EXERCISE = {
  cardio: '#f6465d',
  strength: '#1eaedb',
  flexibility: '#a855f7',
} as const;

/** 宏量营养素颜色（碳水/蛋白/脂肪） */
export const CHART_MACRO = {
  carb: '#f0b90b',
  protein: '#1eaedb',
  fat: '#f6465d',
} as const;

/** 健身强度等级颜色 */
export const CHART_INTENSITY = {
  low: '#848e9c',
  medium: '#f0b90b',
  high: '#f6465d',
} as const;

/** 用药时段颜色（早/中/晚/全部） */
export const CHART_DOSAGE = {
  breakfast: '#1eaedb',
  lunch: '#27a644',
  dinner: '#f59e0b',
  total: '#5e6ad2',
} as const;

/** 房租成本类型映射 */
export const RENT_COST = {
  rent: '#5e6ad2',
  electricityFee: '#f59e0b',
  waterFee: '#1eaedb',
  gasFee: '#10b981',
  agencyFee: '#e5484d',
  cleaningFee: '#c084fc',
  laundryFee: '#f97316',
  serviceFee: '#27a644',
} as const;

/** 外汇品种颜色 */
export const FOREX_INSTRUMENT = {
  XAUUSD: '#f59e0b',
  XAGUSD: '#5e6ad2',
} as const;

/** 通用图表工具：循环取色 */
export function pickChartColor(index: number, palette: readonly string[] = CHART_CATEGORY_8): string {
  if (palette.length === 0) return '#5e6ad2';
  return palette[index % palette.length];
}
