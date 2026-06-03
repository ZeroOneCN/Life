import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('finance_subscription_setting')
export class FinanceSubscriptionSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 255, default: '' })
  records_keyword!: string;

  @Column({ type: 'varchar', length: 36, default: 'all' })
  records_category_id!: string;

  @Column({ type: 'varchar', length: 16, default: 'all' })
  records_status!: string;

  @Column({ type: 'varchar', length: 16, default: 'all' })
  records_auto_renew_filter!: string;

  @Column({ type: 'date', nullable: true })
  records_expiry_start_date!: string | null;

  @Column({ type: 'date', nullable: true })
  records_expiry_end_date!: string | null;

  @Column({ type: 'int', default: 90 })
  dashboard_range_days!: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  reminder_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  expiry_day_reminder_enabled!: boolean;

  @Column({ type: 'int', default: 7 })
  lead_days!: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  include_auto_renew_in_reminders!: boolean;
}
