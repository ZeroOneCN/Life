import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthFitnessExerciseRecordEntity } from '../../health/entities/health-fitness-exercise-record.entity';

/** 运动类型中文名 → 英文映射 */
const exerciseNameMap: Record<string, string> = {
  跑: '跑步',
  走: '步行',
  骑: '骑行',
  游: '游泳',
  球: '球类运动',
  瑜伽: '瑜伽',
  力量: '力量训练',
  健身: '健身',
  HIIT: 'HIIT',
  普拉提: '普拉提',
};

/**
 * 处理运动录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的运动数据
 * @returns 操作结果消息
 */
export async function handleExercise(userId: string, data: Record<string, unknown>): Promise<string> {
  const exerciseType = String(data.exerciseType ?? '');
  const durationMin = Number(data.durationMin);
  const intensity = String(data.intensity ?? 'medium');

  if (!exerciseType) {
    return '❌ 运动类型不能为空。格式：跑 30min 高强度';
  }
  if (!durationMin || durationMin <= 0 || durationMin > 1440) {
    return '❌ 时长无效（1-1440 分钟）。';
  }

  const exerciseName = exerciseNameMap[exerciseType] ?? exerciseType;

  const repo = appDataSource.getRepository(HealthFitnessExerciseRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    date: dayjs().format('YYYY-MM-DD'),
    exercise_type: exerciseType,
    exercise_name: exerciseName,
    duration: durationMin,
    calories: 0,
    intensity,
  }));

  return `🏃 运动已记录：${exerciseName} ${durationMin}分钟 (${intensity})`;
}
