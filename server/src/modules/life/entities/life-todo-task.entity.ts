import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

/**
 * 重复任务配置：存储于 recurrence_config（JSON）字段。
 * - weekly.weekdays：1=周一 ... 7=周日（与 dayjs().day() 保持一致，0=周日）
 * - monthly.dayOfMonth：1-31；月末超出当月最大天数则顺延到月底
 */
export type LifeTodoRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface LifeTodoRecurrenceConfig {
  weekdays?: number[];
  dayOfMonth?: number;
}

@Entity('life_todo_task')
export class LifeTodoTaskEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description_markdown!: string;

  @Column({ type: 'date', nullable: true })
  due_date!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority!: string;

  @Column({ type: 'json', nullable: true })
  tags_json!: string[] | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_daily!: boolean;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  recurrence_type!: LifeTodoRecurrenceType;

  @Column({ type: 'json', nullable: true })
  recurrence_config!: LifeTodoRecurrenceConfig | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  completed!: boolean;

  @Column({ type: 'datetime', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'date', nullable: true })
  last_completed_date!: string | null;

  @Column({ type: 'datetime', nullable: true })
  trashed_at!: Date | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;
}
