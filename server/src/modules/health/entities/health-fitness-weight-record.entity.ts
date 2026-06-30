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

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  visceral_fat!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fat_mass!: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  muscle_rate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  muscle_mass!: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  body_water_rate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  body_water_mass!: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  protein_rate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  protein_mass!: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  bone_rate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  bone_mass!: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  skeletal_muscle_rate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  skeletal_muscle_mass!: number;

  @Column({ type: 'decimal', precision: 10, scale: 1, default: 0 })
  subcutaneous_fat_rate!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subcutaneous_fat_mass!: number;
}
