import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('life_todo_setting')
export class LifeTodoSettingEntity extends UserSettingEntity {
  @Column({ type: 'tinyint', width: 1, default: 1 })
  reminder_enabled!: boolean;

  @Column({ type: 'varchar', length: 8, default: '09:00' })
  reminder_time!: string;

  @Column({ type: 'int', default: 3 })
  lead_days!: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  include_daily_tasks!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  include_overdue_tasks!: boolean;

  @Column({ type: 'date', nullable: true })
  last_auto_reminder_date!: string | null;
}
