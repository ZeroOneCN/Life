import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

/**
 * 账单提醒设置实体。
 *
 * 存储用户的统一账单提醒配置，包括提醒开关、提前提醒天数、
 * 启用的账单类型等。每个用户只有一条设置记录。
 */
@Entity('finance_bill_reminder_setting')
export class FinanceBillReminderSettingEntity extends UserSettingEntity {
  @Column({ type: 'tinyint', width: 1, default: 1 })
  reminder_enabled!: boolean;

  @Column({ type: 'int', default: 7 })
  lead_days!: number;

  @Column({ type: 'varchar', length: 255, default: 'loan,subscription,rent' })
  enabled_types!: string;

  @Column({ type: 'varchar', length: 8, default: '09:00' })
  reminder_time!: string;

  @Column({ type: 'text' })
  notes!: string;
}
