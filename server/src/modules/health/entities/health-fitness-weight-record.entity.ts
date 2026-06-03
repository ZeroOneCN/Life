import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_fitness_weight_record')
export class HealthFitnessWeightRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  weight!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  height!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  body_fat!: number;
}
