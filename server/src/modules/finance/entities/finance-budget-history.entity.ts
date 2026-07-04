import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_budget_history')
export class FinanceBudgetHistoryEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  budget_id!: string;

  @Column({ type: 'varchar', length: 128 })
  budget_name!: string;

  @Column({ type: 'varchar', length: 36 })
  category_id!: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  category_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  previous_amount!: number | string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  new_amount!: number | string;

  @Column({ type: 'varchar', length: 16, default: 'monthly' })
  period_type!: 'monthly' | 'yearly' | 'custom';

  @Column({ type: 'varchar', length: 128, default: '' })
  change_reason!: string;

  @Column({ type: 'date' })
  effective_date!: string;
}
