import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

/**
 * 日程模块用户设置：默认视图、提醒开关、提醒时间等。
 */
@Entity('life_schedule_setting')
export class LifeScheduleSettingEntity extends UserSettingEntity {
  /** 默认提醒分钟数（创建事件时的默认值，常用 15/30/60） */
  @Column({ type: 'int', default: 30 })
  default_reminder_minutes!: number;

  /** 默认日历视图（month / week / day） */
  @Column({ type: 'varchar', length: 8, default: 'month' })
  default_view!: string;

  /** 周起始日（0=周日，1=周一） */
  @Column({ type: 'tinyint', default: 1 })
  week_starts_on!: number;

  /** 是否启用提醒 */
  @Column({ type: 'tinyint', width: 1, default: 1 })
  reminder_enabled!: boolean;

  /** 每日提醒时间（HH:mm，用于每日日程汇总推送） */
  @Column({ type: 'varchar', length: 8, default: '08:00' })
  reminder_time!: string;

  /** 最后一次自动提醒日期（防止同一天重复推送） */
  @Column({ type: 'date', nullable: true })
  last_auto_reminder_date!: string | null;
}
