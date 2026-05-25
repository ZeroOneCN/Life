import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('health_step_setting')
export class HealthStepSettingEntity extends UserSettingEntity {
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0.7 })
  stride_length!: number;

  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  stats_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  records_user_id!: string | null;
}
