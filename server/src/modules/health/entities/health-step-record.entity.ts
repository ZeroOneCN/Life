import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('health_step_record')
export class HealthStepRecordEntity extends UserScopedEntity {
  @Column({ type: 'int' })
  steps!: number;

  @Column({ type: 'int', nullable: true })
  hour!: number | null;

  @Column({ type: 'datetime' })
  record_time!: Date;
}
