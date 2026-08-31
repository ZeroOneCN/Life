/**
 * 图表统一调色板（Chart Palette）
 *
 * 基于 Arco Design 官方色板，用于 Recharts 等所有图表场景。
 * 颜色值取自 Arco 的 10 级色板中的第 6 级（基础色），确保与 Arco UI 主题一致。
 *
 * 命名规则：
 *   - CHART_CATEGORY_*  ：分类色板（环图 / 柱图 / 多系列折线 / 排行榜）
 *   - CHART_PNL_*       ：盈亏正负色
 *   - CHART_*_FILL      ：线性渐变填充（轴向：horizontal / vertical）
 *   - CHART_SEMANTIC_*  ：语义色（上涨/下跌/警告/中性）
 */

/* ========== Arco Design 官方色板（第 6 级） ========== */
const ARCO_BLUE = '#165DFF';
const ARCO_GREEN = '#00B42A';
const ARCO_ORANGE = '#FF7D00';
const ARCO_RED = '#F53F3F';
const ARCO_PURPLE = '#722ED1';
const ARCO_CYAN = '#14C9C9';
const ARCO_LIME = '#7CB305';
const ARCO_GOLD = '#FFC53D';
const ARCO_PINK = '#F5319D';
const ARCO_GREY = '#86909C';

/** 8 色分类调色板（主用）— Arco 语义色 */
export const CHART_CATEGORY_8 = [
  ARCO_BLUE, // primary
  ARCO_CYAN, // cyan
  ARCO_GREEN, // success
  ARCO_GOLD, // warning
  ARCO_RED, // danger
  ARCO_LIME, // lime
  ARCO_PURPLE, // purple
  ARCO_ORANGE, // orange
] as const;

/** 5 色分类调色板（精简场景） */
export const CHART_CATEGORY_5 = [ARCO_BLUE, ARCO_GREEN, ARCO_GOLD, ARCO_RED, ARCO_CYAN] as const;

/** 6 色分类调色板（标签/卡片背景常用） */
export const CHART_CATEGORY_6 = [
  ARCO_BLUE,
  ARCO_CYAN,
  ARCO_GREEN,
  ARCO_GOLD,
  ARCO_RED,
  ARCO_LIME,
] as const;

/** 10 色全调色板 */
export const CHART_CATEGORY_10 = [
  ARCO_BLUE,
  ARCO_CYAN,
  ARCO_GREEN,
  ARCO_GOLD,
  ARCO_RED,
  ARCO_LIME,
  ARCO_PURPLE,
  ARCO_ORANGE,
  ARCO_PINK,
  ARCO_GREY,
] as const;

/** 涨跌正负色（金融市场） */
export const CHART_PNL = {
  up: ARCO_GREEN,
  down: ARCO_RED,
  neutral: ARCO_GREY,
} as const;

/** 健身饮食四餐颜色 */
export const CHART_MEAL = {
  breakfast: ARCO_GOLD,
  lunch: ARCO_GREEN,
  dinner: ARCO_RED,
  snack: ARCO_CYAN,
} as const;

/** 健身训练类型颜色 */
export const CHART_EXERCISE = {
  cardio: ARCO_RED,
  strength: ARCO_CYAN,
  flexibility: ARCO_PURPLE,
} as const;

/** 宏量营养素颜色（碳水/蛋白/脂肪） */
export const CHART_MACRO = {
  carb: ARCO_GOLD,
  protein: ARCO_CYAN,
  fat: ARCO_RED,
} as const;

/** 健身强度等级颜色 */
export const CHART_INTENSITY = {
  low: ARCO_GREY,
  medium: ARCO_GOLD,
  high: ARCO_RED,
} as const;

/** 用药时段颜色（早/中/晚/全部） */
export const CHART_DOSAGE = {
  breakfast: ARCO_CYAN,
  lunch: ARCO_GREEN,
  dinner: ARCO_GOLD,
  total: ARCO_BLUE,
} as const;

/** 房租成本类型映射 */
export const RENT_COST = {
  rent: ARCO_BLUE,
  electricityFee: ARCO_GOLD,
  waterFee: ARCO_CYAN,
  gasFee: ARCO_LIME,
  agencyFee: ARCO_RED,
  cleaningFee: ARCO_PURPLE,
  laundryFee: ARCO_ORANGE,
  serviceFee: ARCO_GREEN,
} as const;

/** 外汇品种默认颜色（已知品种优先使用，未知品种从通用调色板取色） */
export const FOREX_INSTRUMENT_COLORS: Record<string, string> = {
  XAUUSD: ARCO_GOLD,
  XAGUSD: ARCO_BLUE,
};

/** 根据品种代码获取颜色，未知品种从通用调色板循环取色 */
export function getForexInstrumentColor(instrument: string, index = 0): string {
  return FOREX_INSTRUMENT_COLORS[instrument] ?? pickChartColor(index);
}

/** 通用图表工具：循环取色 */
export function pickChartColor(
  index: number,
  palette: readonly string[] = CHART_CATEGORY_8,
): string {
  if (palette.length === 0) return ARCO_BLUE;
  return palette[index % palette.length];
}

/**
 * Recharts 通用 Tooltip 样式 — 使用 Arco CSS 变量。
 * 各图表组件可直接引用此对象，避免重复定义。
 */
export const ARCO_TOOLTIP_STYLE = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  fontSize: 13,
} as const;

/**
 * Recharts 通用坐标轴样式 — 使用 Arco CSS 变量。
 */
export const ARCO_AXIS_STYLE = {
  tick: { fill: 'var(--color-text-3)', fontSize: 12 },
  axisLine: { stroke: 'var(--color-hairline)' },
  gridLine: { stroke: 'var(--color-hairline)' },
} as const;
