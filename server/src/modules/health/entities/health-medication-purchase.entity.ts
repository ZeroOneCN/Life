import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_medication_purchase')
export class HealthMedicationPurchaseEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  purchase_date!: string;

  @Column({ type: 'varchar', length: 128 })
  medicine_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: 'varchar', length: 32 })
  unit!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price!: number;

  @Column({ type: 'varchar', length: 128 })
  channel!: string;
}
