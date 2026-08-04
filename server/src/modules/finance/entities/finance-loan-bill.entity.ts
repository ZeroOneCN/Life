import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_loan_bill')
export class FinanceLoanBillEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  platform_id!: string;

  @Column({ type: 'varchar', length: 128 })
  platform_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  interest!: number;

  /** 已还本金（累加值，由部分还款 API 维护） */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paid_amount!: number;

  /** 已还利息（累加值，由部分还款 API 维护） */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paid_interest!: number;

  @Column({ type: 'varchar', length: 16 })
  billing_month!: string;

  @Column({ type: 'date' })
  due_date!: string;

  @Column({ type: 'text' })
  notes!: string;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_paid!: boolean;

  @Column({ type: 'date', nullable: true })
  paid_at!: string | null;
}
