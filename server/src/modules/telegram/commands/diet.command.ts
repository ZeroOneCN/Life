import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthFitnessDietRecordEntity } from '../../health/entities/health-fitness-diet-record.entity';

/** 餐次中文标签映射 */
const mealLabels: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  other: '其他',
};

/**
 * 处理饮食录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的饮食数据
 * @returns 操作结果消息
 */
export async function handleDiet(userId: string, data: Record<string, unknown>): Promise<string> {
  const mealType = String(data.mealType ?? 'other');
  const foodName = String(data.foodName ?? '').trim();

  if (!foodName) {
    return '❌ 食物名称不能为空。格式：早 燕麦杯';
  }

  const repo = appDataSource.getRepository(HealthFitnessDietRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    date: dayjs().format('YYYY-MM-DD'),
    meal_type: mealType,
    food_name: foodName,
    grams: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }));

  return `🍽️ ${mealLabels[mealType] ?? mealType}已记录：${foodName}${data.amount ? ` ${data.amount}` : ''}`;
}
