/**
 * 根据体重和身高计算 BMI 指数
 * @param weightKg - 体重（公斤）
 * @param heightCm - 身高（厘米）
 * @returns BMI 值（保留一位小数），若体重或身高 ≤ 0 则返回 null
 */
export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}
