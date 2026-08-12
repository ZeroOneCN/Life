import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('life_card_record')
export class LifeCardRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 32 })
  phone_number!: string;

  @Column({ type: 'varchar', length: 36 })
  carrier_id!: string;

  @Column({ type: 'varchar', length: 128 })
  carrier_name!: string;

  @Column({ type: 'varchar', length: 128 })
  location!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monthly_fee!: number;

  @Column({ type: 'int' })
  billing_day!: number;

  @Column({ type: 'varchar', length: 128 })
  data_plan!: string;

  @Column({ type: 'varchar', length: 64 })
  call_minutes!: string;

  @Column({ type: 'varchar', length: 64 })
  sms_count!: string;

  @Column({ type: 'date' })
  activation_date!: string;

  @Column({ type: 'text' })
  notes!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  last_balance_reminder_marker!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  last_billing_reminder_marker!: string | null;

  /** 本月自动扣账 marker：格式 YYYYMM，用于每月扣账一次的幂等控制（varchar 48 预留扩展空间） */
  @Column({ type: 'varchar', length: 48, nullable: true })
  last_auto_deduction_marker!: string | null;
}
