import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_budget')
export class FinanceBudgetEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 256, default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 36 })
  category_id!: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  category_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: number | string;

  @Column({ type: 'varchar', length: 16, default: 'monthly' })
  period_type!: 'monthly' | 'yearly' | 'custom';

  @Column({ type: 'varchar', length: 16, default: 'expense' })
  type!: 'income' | 'expense';

  @Column({ type: 'date', nullable: true })
  start_date!: string | null;

  @Column({ type: 'date', nullable: true })
  end_date!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 80 })
  warning_threshold_percent!: number | string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_active!: boolean;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  alert_enabled!: boolean;

  @Column({ type: 'varchar', length: 64, default: '' })
  last_warning_marker!: string;
}
