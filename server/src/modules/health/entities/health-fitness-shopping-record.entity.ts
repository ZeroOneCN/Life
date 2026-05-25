import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_fitness_shopping_record')
export class HealthFitnessShoppingRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 255 })
  item_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  spec_grams!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price!: number;

  @Column({ type: 'varchar', length: 255 })
  location!: string;
}
