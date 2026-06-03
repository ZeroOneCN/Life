import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_fitness_diet_record')
export class HealthFitnessDietRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 32 })
  meal_type!: string;

  @Column({ type: 'varchar', length: 255 })
  food_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grams!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  calories!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  protein!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  carbs!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  fat!: number;
}
