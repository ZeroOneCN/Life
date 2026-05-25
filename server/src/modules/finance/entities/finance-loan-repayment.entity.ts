import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_loan_repayment')
export class FinanceLoanRepaymentEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  bill_id!: string | null;

  @Column({ type: 'varchar', length: 36 })
  platform_id!: string;

  @Column({ type: 'varchar', length: 128 })
  platform_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  interest!: number;

  @Column({ type: 'date' })
  repayment_date!: string;

  @Column({ type: 'text' })
  notes!: string;
}
