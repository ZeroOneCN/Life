import { Column, Entity } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

@Entity('health_checkup_template_item')
export class HealthCheckupTemplateItemEntity extends TimestampedEntity {
  @Column({ type: 'varchar', length: 36 })
  template_id!: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'varchar', length: 128 })
  test_name!: string;

  @Column({ type: 'varchar', length: 64 })
  unit!: string;

  @Column({ type: 'varchar', length: 255 })
  reference_range!: string;
}
