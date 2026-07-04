import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_budget_category')
export class FinanceBudgetCategoryEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 256, default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 16, default: 'expense' })
  type!: 'income' | 'expense';

  @Column({ type: 'int', default: 0 })
  sort_order!: number;
}
