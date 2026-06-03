import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('health_fitness_setting')
export class HealthFitnessSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  diet_filter_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  exercise_filter_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  shopping_filter_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  weight_filter_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  dashboard_user_id!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  default_height_cm!: number | null;
}
