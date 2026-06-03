import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_medication_threshold')
export class HealthMedicationThresholdEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  medicine_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  threshold!: number;
}
