import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('finance_shopping_setting')
export class FinanceShoppingSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  records_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  dashboard_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  active_ledger_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  records_ledger_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  dashboard_ledger_id!: string | null;

  @Column({ type: 'varchar', length: 8, default: 'CNY' })
  currency_mode!: string;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 7.2 })
  usdt_rate!: number;
}
