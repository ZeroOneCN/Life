import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('life_card_recharge_record')
export class LifeCardRechargeRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  sim_id!: string;

  @Column({ type: 'varchar', length: 32 })
  phone_number!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  recharge_date!: string;

  @Column({ type: 'text' })
  note!: string;
}
