import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthStepRecordEntity } from '../../health/entities/health-step-record.entity';

/** 步数命令数据 */
interface StepData {
  steps: number;
  hour: number | null;
}

/**
 * 处理步数录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的步数数据
 * @returns 操作结果消息
 */
export async function handleStep(userId: string, data: StepData): Promise<string> {
  const repo = appDataSource.getRepository(HealthStepRecordEntity);
  const now = dayjs();
  const hour = data.hour ?? now.hour();
  const recordTime = now.hour(hour).minute(0).second(0).millisecond(0).toDate();

  // 重复检查：同一天同一小时视为重复记录
  const dateStart = now.startOf('day').toDate();
  const dateEnd = now.endOf('day').toDate();
  const existing = await repo
    .createQueryBuilder('r')
    .where('r.user_id = :userId', { userId })
    .andWhere('r.record_time BETWEEN :start AND :end', { start: dateStart, end: dateEnd })
    .andWhere(hour !== null ? 'r.hour = :hour' : 'r.hour IS NULL', hour !== null ? { hour } : {})
    .getOne();

  if (existing) {
    // 更新已有记录
    existing.steps = data.steps;
    existing.hour = hour;
    existing.record_time = recordTime;
    await repo.save(existing);
    return `✅ 步数已更新：${data.steps} 步`;
  }

  await repo.save(repo.create({
    user_id: userId,
    steps: data.steps,
    hour,
    record_time: recordTime,
  }));

  return `✅ 步数已记录：${data.steps} 步 (${hour !== null ? `${hour}:00` : '全天'})`;
}
