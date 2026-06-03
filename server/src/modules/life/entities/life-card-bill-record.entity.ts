import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('life_card_bill_record')
export class LifeCardBillRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  sim_id!: string;

  @Column({ type: 'varchar', length: 32 })
  phone_number!: string;

  @Column({ type: 'varchar', length: 128 })
  carrier_name!: string;

  @Column({ type: 'varchar', length: 16 })
  billing_month!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monthly_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  actual_fee!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  extra_charges!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_fee!: number;

  @Column({ type: 'text' })
  note!: string;
}
