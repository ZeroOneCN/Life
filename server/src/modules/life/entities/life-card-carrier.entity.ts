import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('life_card_carrier')
export class LifeCardCarrierEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;
}
