import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_goal')
export class FinanceGoalEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 256, default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 64, default: 'saving' })
  type!: 'saving' | 'debt_repayment' | 'investment' | 'other';

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  target_amount!: number | string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  current_amount!: number | string;

  @Column({ type: 'varchar', length: 32, default: 'CNY' })
  currency!: string;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date' })
  target_date!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: 'active' | 'paused' | 'completed' | 'cancelled';

  @Column({ type: 'varchar', length: 128, default: '' })
  icon!: string;

  @Column({ type: 'varchar', length: 16, default: '#3b82f6' })
  color!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 80 })
  warning_threshold_percent!: number | string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  alert_enabled!: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 64, default: '' })
  last_warning_marker!: string;
}
