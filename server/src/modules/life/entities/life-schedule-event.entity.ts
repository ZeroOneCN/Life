import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

/**
 * 重复事件配置：存储于 recurrence_config（JSON）字段。
 * - weekly.weekdays：0=周日 ... 6=周六（与 dayjs().day() 一致）
 * - monthly.dayOfMonth：1-31；超出当月最大天数则顺延到月底
 */
export type LifeScheduleRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface LifeScheduleRecurrenceConfig {
  weekdays?: number[];
  dayOfMonth?: number;
}

/**
 * 事件来源类型：
 * - manual：用户在日程模块手动创建
 * - todo：从待办事项转换而来
 */
export type LifeScheduleEventSource = 'manual' | 'todo';

/**
 * 日程事件实体：记录用户日程、提醒、重复规则。
 */
@Entity('life_schedule_event')
export class LifeScheduleEventEntity extends UserScopedEntity {
  /** 事件标题 */
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  /** 描述（Markdown） */
  @Column({ type: 'text' })
  description_markdown!: string;

  /** 开始时间（UTC ISO 字符串存储为 datetime） */
  @Column({ type: 'datetime' })
  start_at!: Date;

  /** 结束时间（可为空，表示瞬时事件） */
  @Column({ type: 'datetime', nullable: true })
  end_at!: Date | null;

  /** 是否全天事件 */
  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_all_day!: boolean;

  /** 地点（可为空） */
  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  /** 颜色标识（用于前端日历显示，如 indigo/green/red，可为空使用默认色） */
  @Column({ type: 'varchar', length: 16, nullable: true })
  color!: string | null;

  /** 重复类型 */
  @Column({ type: 'varchar', length: 16, default: 'none' })
  recurrence_type!: LifeScheduleRecurrenceType;

  /** 重复配置（JSON） */
  @Column({ type: 'json', nullable: true })
  recurrence_config!: LifeScheduleRecurrenceConfig | null;

  /** 重复结束日期（可为空，表示无限重复） */
  @Column({ type: 'date', nullable: true })
  recurrence_end_date!: string | null;

  /** 提前提醒分钟数（null 表示不提醒，常用值：15/30/60/1440） */
  @Column({ type: 'int', nullable: true })
  reminder_minutes!: number | null;

  /** 是否已完成 */
  @Column({ type: 'tinyint', width: 1, default: 0 })
  completed!: boolean;

  /** 完成时间 */
  @Column({ type: 'datetime', nullable: true })
  completed_at!: Date | null;

  /** 软删除时间（回收站） */
  @Column({ type: 'datetime', nullable: true })
  trashed_at!: Date | null;

  /** 来源（manual / todo） */
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source!: LifeScheduleEventSource;

  /** 来源 ID（如待办任务 ID，可为空） */
  @Column({ type: 'varchar', length: 36, nullable: true })
  source_id!: string | null;

  /** 排序权重（毫秒时间戳，需使用 BIGINT） */
  @Column({ type: 'bigint', default: 0 })
  sort_order!: number;
}
