import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_rent_channel')
export class FinanceRentChannelEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;
}
