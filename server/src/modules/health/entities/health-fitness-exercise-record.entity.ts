import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_fitness_exercise_record')
export class HealthFitnessExerciseRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 32 })
  exercise_type!: string;

  @Column({ type: 'varchar', length: 255 })
  exercise_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  duration!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  calories!: number;

  @Column({ type: 'varchar', length: 16 })
  intensity!: string;
}
