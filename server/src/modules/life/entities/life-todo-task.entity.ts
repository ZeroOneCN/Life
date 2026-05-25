import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

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
