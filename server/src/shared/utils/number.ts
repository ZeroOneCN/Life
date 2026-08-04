export function toMoney(value: unknown, fallback = 0) {
  const raw = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

export function toInteger(value: unknown, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

/**
 * 将任意值安全转换为数字，null/undefined/空字符串/非有限数返回 0
 * @param value - 任意输入值
 * @returns 安全数字（永远不会是 NaN/Infinity）
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 将数字四舍五入到两位小数，非有限数返回 0
 * @param value - 需要舍入的数字
 * @returns 两位小数的数字
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}
