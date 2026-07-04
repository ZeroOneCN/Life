import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

/**
 * 睡眠记录实体。
 *
 * 记录每日睡眠情况：就寝时间、起床时间、睡眠时长、质量评分、备注等。
 * 一天允许多条记录（如午睡），以 date + nap 标记区分。
 */
@Entity('health_sleep_record')
export class HealthSleepRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'datetime' })
  bedtime!: Date;

  @Column({ type: 'datetime' })
  wake_time!: Date;

  @Column({ type: 'int' })
  duration_minutes!: number;

  @Column({ type: 'tinyint', nullable: true })
  quality_score!: number | null;

  @Column({ type: 'boolean', default: false })
  is_nap!: boolean;

  @Column({ type: 'varchar', length: 255, default: '' })
  notes!: string;
}
