import { Column } from 'typeorm';

import { TimestampedEntity } from './timestamped.entity';

export abstract class UserScopedEntity extends TimestampedEntity {
  @Column({ type: 'varchar', length: 36 })
  user_id!: string;
}
