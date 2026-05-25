import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_rent_record')
export class FinanceRentRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  address!: string;

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

  @Column({ type: 'text' })
  notes!: string;
}
