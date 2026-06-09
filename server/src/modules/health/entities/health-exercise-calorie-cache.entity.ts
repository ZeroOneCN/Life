import { Column, Entity, Index } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

/**
 * 运动热量消耗缓存。
 * 运动录入时由 DeepSeek 给出「60kg 成人、中等强度」下的 cal/min 系数，
 * 乘以用户输入的 duration 得到总消耗；下次相同运动名（normalize 后）直接命中缓存。
 *
 * 注意：表不带 user_id，是全站共享的「运动字典」。
 */
@Entity('health_exercise_calorie_cache')
@Index('idx_exercise_cache_key', ['exercise_key'], { unique: true })
export class HealthExerciseCalorieCacheEntity extends TimestampedEntity {
  /** 归一化后的 key */
  @Column({ type: 'varchar', length: 128, unique: true })
  exercise_key!: string;

  /** 用户输入的原始名称 */
  @Column({ type: 'varchar', length: 128 })
  exercise_name!: string;

  /** 推荐单次时长（分钟），用于前端默认填入 duration */
  @Column({ type: 'double' })
  suggested_duration_min!: number;

  /** 每分钟消耗热量（60kg 成人 / 中等强度，单位：千卡） */
  @Column({ type: 'double' })
  calories_per_min!: number;

  /** 推荐运动分类（cardio / strength / flexibility） */
  @Column({ type: 'varchar', length: 32, default: 'cardio' })
  suggested_type!: string;

  /** 推荐强度（low / medium / high） */
  @Column({ type: 'varchar', length: 16, default: 'medium' })
  suggested_intensity!: string;

  /** 命中次数 */
  @Column({ type: 'int', default: 0 })
  hit_count!: number;
}
