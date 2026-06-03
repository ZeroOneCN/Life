import { Column, Entity } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

@Entity('finance_shopping_platform')
export class FinanceShoppingPlatformEntity extends TimestampedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  color_token!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_built_in!: boolean;
}
