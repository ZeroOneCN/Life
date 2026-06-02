import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('life_card_setting')
export class LifeCardSettingEntity extends UserSettingEntity {
  @Column({ type: 'tinyint', width: 1, default: 1 })
  balance_low_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  billing_upcoming_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  auto_deduction_enabled!: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 20 })
  balance_threshold!: number;

  @Column({ type: 'int', default: 3 })
  notification_days_before!: number;
}
