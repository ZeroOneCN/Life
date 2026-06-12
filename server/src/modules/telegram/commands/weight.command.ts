import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthFitnessWeightRecordEntity } from '../../health/entities/health-fitness-weight-record.entity';

/**
 * 处理体重录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的体重数据
 * @returns 操作结果消息
 */
export async function handleWeight(userId: string, data: Record<string, unknown>): Promise<string> {
  const weight = Number(data.weight);
  if (!weight || weight <= 0 || weight > 500) {
    return '❌ 体重无效，请提供合理数值。格式：重 72.4';
  }

  const repo = appDataSource.getRepository(HealthFitnessWeightRecordEntity);
  const today = dayjs().format('YYYY-MM-DD');

  // 检查今天是否已有记录
  const existing = await repo.findOne({
    where: { user_id: userId, date: today },
  });

  if (existing) {
    existing.weight = weight;
    await repo.save(existing);
    return `⚖️ 体重已更新：${weight} kg`;
  }

  await repo.save(repo.create({
    user_id: userId,
    date: today,
    weight,
    height: 0,
    body_fat: 0,
  }));

  return `⚖️ 体重已记录：${weight} kg`;
}
