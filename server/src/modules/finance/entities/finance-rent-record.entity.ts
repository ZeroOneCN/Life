import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_rent_record')
export class FinanceRentRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  address_short!: string;

  @Column({ type: 'varchar', length: 36 })
  channel_id!: string;

  @Column({ type: 'varchar', length: 128 })
  channel_name!: string;

  @Column({ type: 'date' })
  move_in_date!: string;

  @Column({ type: 'date', nullable: true })
  move_out_date!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  rent!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deposit!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  electricity_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  water_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gas_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  agency_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cleaning_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  laundry_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  service_fee!: number;

  @Column({ type: 'varchar', length: 32, default: '' })
  orientation!: string;

  @Column({ type: 'text' })
  notes!: string;

  /**
   * 支付周期：monthly（月付）/ quarterly（季付）/ yearly（年付）
   */
  @Column({ type: 'varchar', length: 16, default: 'monthly' })
  pay_cycle!: string;

  /**
   * 实际月租金（与 pay_cycle 对应）。
   * 例如：合同总价 18000、月付、月租 1000，则 rentPerMonth = 1000。
   * 用于在在住期间正确显示折算月租，避免按总价折算虚高。
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  rent_per_month!: number | null;
}
