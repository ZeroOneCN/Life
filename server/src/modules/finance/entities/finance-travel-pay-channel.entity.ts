import { Column, Entity } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

@Entity('finance_travel_pay_channel')
export class FinanceTravelPayChannelEntity extends TimestampedEntity {
  @Column({ type: 'varchar', length: 64 })
  value!: string;

  @Column({ type: 'varchar', length: 128 })
  label!: string;
}
