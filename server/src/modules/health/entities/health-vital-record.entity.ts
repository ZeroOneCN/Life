import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

/**
 * 日常体征记录实体。
 *
 * 覆盖心率、血压（收缩压/舒张压分开记录）、血氧、血糖、体温等生命体征，
 * 一天可多次记录，按 record_time 排序。参考范围内置，状态自动评估。
 */
@Entity('health_vital_record')
export class HealthVitalRecordEntity extends UserScopedEntity {
  @Column({ type: 'datetime' })
  record_time!: Date;

  @Column({ type: 'varchar', length: 32 })
  metric!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value!: number;

  @Column({ type: 'varchar', length: 16 })
  unit!: string;

  @Column({ type: 'varchar', length: 255 })
  reference_range!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ type: 'varchar', length: 255 })
  notes!: string;

  @Column({ type: 'datetime', nullable: true })
  last_abnormal_alert_at!: Date | null;
}
