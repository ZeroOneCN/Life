import { Column, Entity } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

@Entity('finance_shopping_ledger')
export class FinanceShoppingLedgerEntity extends TimestampedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date', nullable: true })
  end_date!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_active!: boolean;
}
