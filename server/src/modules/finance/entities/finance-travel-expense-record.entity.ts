import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_travel_expense_record')
export class FinanceTravelExpenseRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  book_id!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 16 })
  time_start!: string;

  @Column({ type: 'varchar', length: 16 })
  time_end!: string;

  @Column({ type: 'int' })
  duration_minutes!: number;

  @Column({ type: 'varchar', length: 32 })
  category!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  discount_amount!: number;

  @Column({ type: 'varchar', length: 255 })
  discount_note!: string;

  @Column({ type: 'varchar', length: 255 })
  vehicle_info!: string;

  @Column({ type: 'varchar', length: 64 })
  pay_channel!: string;

  @Column({ type: 'text' })
  remark!: string;
}
