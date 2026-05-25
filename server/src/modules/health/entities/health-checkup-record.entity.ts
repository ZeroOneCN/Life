import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_checkup_record')
export class HealthCheckupRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  test_date!: string;

  @Column({ type: 'varchar', length: 128 })
  test_type!: string;

  @Column({ type: 'varchar', length: 128 })
  test_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  value!: number;

  @Column({ type: 'varchar', length: 64 })
  unit!: string;

  @Column({ type: 'varchar', length: 255 })
  reference_range!: string;

  @Column({ type: 'text' })
  notes!: string;

  @Column({ type: 'date', nullable: true })
  follow_up_date!: string | null;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ type: 'datetime', nullable: true })
  last_abnormal_alert_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  last_follow_up_reminder_at!: Date | null;
}
