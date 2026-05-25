import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('life_storage_item')
export class LifeStorageItemEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  item_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  purchase_price!: number;

  @Column({ type: 'date' })
  purchase_date!: string;

  @Column({ type: 'date', nullable: true })
  end_date!: string | null;

  @Column({ type: 'text' })
  notes!: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: string;

  @Column({ type: 'datetime', nullable: true })
  archived_at!: Date | null;
}
