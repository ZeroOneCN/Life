import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_shopping_record')
export class FinanceShoppingRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  ledger_id!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 128 })
  platform!: string;

  @Column({ type: 'varchar', length: 255 })
  item_name!: string;

  @Column({ type: 'varchar', length: 255 })
  spec!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  unit_price!: number | null;

  @Column({ type: 'varchar', length: 128 })
  order_no!: string;

  @Column({ type: 'text' })
  note!: string;
}
