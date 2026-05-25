import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('health_checkup_setting')
export class HealthCheckupSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  records_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  trend_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  insight_user_id!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  reminder_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  abnormal_alert_enabled!: boolean;

  @Column({ type: 'int', default: 7 })
  follow_up_lead_days!: number;
}
