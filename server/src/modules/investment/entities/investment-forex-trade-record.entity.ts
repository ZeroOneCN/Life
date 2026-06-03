import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('investment_forex_trade_record')
export class InvestmentForexTradeRecordEntity extends UserScopedEntity {
  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'date' })
  trade_date!: string;

  @Column({ type: 'varchar', length: 16 })
  instrument!: string;

  @Column({ type: 'varchar', length: 16 })
  order_type!: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  open_price!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lot_size!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  commission!: number;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  close_price!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  pnl!: number;

  @Column({ type: 'varchar', length: 16 })
  open_time!: string;

  @Column({ type: 'varchar', length: 16 })
  close_time!: string;

  @Column({ type: 'varchar', length: 64 })
  hold_time!: string;

  @Column({ type: 'text' })
  remark!: string;
}
