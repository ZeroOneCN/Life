import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('health_medication_setting')
export class HealthMedicationSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  records_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  purchase_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  analysis_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  summary_user_id!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  dose_reminder_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  stock_reminder_enabled!: boolean;

  @Column({ type: 'varchar', length: 8, default: '08:00' })
  breakfast_reminder_time!: string;

  @Column({ type: 'varchar', length: 8, default: '12:00' })
  lunch_reminder_time!: string;

  @Column({ type: 'varchar', length: 8, default: '19:00' })
  dinner_reminder_time!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 3 })
  default_stock_threshold!: number;
}
