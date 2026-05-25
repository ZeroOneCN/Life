import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_medication_record')
export class HealthMedicationRecordEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'varchar', length: 128 })
  medicine_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  breakfast!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lunch!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  dinner!: number;
}
