/**
 * 评估数值是否在参考范围内
 * @param value - 待评估的数值
 * @param referenceRange - 参考范围字符串，支持 "min-max"、"min~max"、"<=limit"、"<limit"、">=limit"、">limit" 格式
 * @returns 'normal'（正常）、'abnormal'（异常）或 'unknown'（无法评估）
 */
export function evaluateStatus(
  value: number,
  referenceRange: string,
): 'normal' | 'abnormal' | 'unknown' {
  const normalized = referenceRange.replace(/\s+/g, '');
  const rangeMatch = normalized.match(/^(-?\d+(?:\.\d+)?)(?:-|~)(-?\d+(?:\.\d+)?)$/);

  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return value >= min && value <= max ? 'normal' : 'abnormal';
  }

  const upperMatch = normalized.match(/^(<=|<)(-?\d+(?:\.\d+)?)$/);
  if (upperMatch) {
    const limit = Number(upperMatch[2]);
    return upperMatch[1] === '<=' ? (value <= limit ? 'normal' : 'abnormal') : (value < limit ? 'normal' : 'abnormal');
  }

  const lowerMatch = normalized.match(/^(>=|>)(-?\d+(?:\.\d+)?)$/);
  if (lowerMatch) {
    const limit = Number(lowerMatch[2]);
    return lowerMatch[1] === '>=' ? (value >= limit ? 'normal' : 'abnormal') : (value > limit ? 'normal' : 'abnormal');
  }

  return 'unknown';
}
