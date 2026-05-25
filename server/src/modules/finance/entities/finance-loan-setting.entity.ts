import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('finance_loan_setting')
export class FinanceLoanSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  bills_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  repayments_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  statistics_user_id!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  repayment_reminder_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  overdue_reminder_enabled!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  auto_repayment_on_mark_paid!: boolean;

  @Column({ type: 'varchar', length: 16, default: 'daily' })
  notification_frequency!: string;

  @Column({ type: 'int', default: 7 })
  upcoming_days!: number;
}
