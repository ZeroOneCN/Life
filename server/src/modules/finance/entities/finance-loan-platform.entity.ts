import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_loan_platform')
export class FinanceLoanPlatformEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'int' })
  billing_day!: number;

  @Column({ type: 'int' })
  repayment_day!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  credit_limit!: number;
}
