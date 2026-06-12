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

/** 运动命令数据 */
interface ExerciseData {
  exerciseType: string;
  durationMin: number;
  intensity: string;
}

/**
 * 处理运动录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的运动数据
 * @returns 操作结果消息
 */
export async function handleExercise(userId: string, data: ExerciseData): Promise<string> {
  const repo = appDataSource.getRepository(HealthFitnessExerciseRecordEntity);
  const exerciseName = exerciseNameMap[data.exerciseType] ?? data.exerciseType;

  await repo.save(repo.create({
    user_id: userId,
    date: dayjs().format('YYYY-MM-DD'),
    exercise_type: data.exerciseType,
    exercise_name: exerciseName,
    duration: data.durationMin,
    calories: 0,
    intensity: data.intensity,
  }));

  return `🏃 运动已记录：${exerciseName} ${data.durationMin}分钟 (${data.intensity})`;
}
