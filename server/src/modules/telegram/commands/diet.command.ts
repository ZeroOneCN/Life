import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthFitnessDietRecordEntity } from '../../health/entities/health-fitness-diet-record.entity';

/** 饮食命令数据 */
interface DietData {
  mealType: string;
  foodName: string;
  amount?: string;
}

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
export async function handleDiet(userId: string, data: DietData): Promise<string> {
  const repo = appDataSource.getRepository(HealthFitnessDietRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    date: dayjs().format('YYYY-MM-DD'),
    meal_type: data.mealType,
    food_name: data.foodName,
    grams: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }));

  return `🍽️ ${mealLabels[data.mealType] ?? data.mealType}已记录：${data.foodName}${data.amount ? ` ${data.amount}` : ''}`;
}
