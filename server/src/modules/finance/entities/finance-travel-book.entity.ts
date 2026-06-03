import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_travel_book')
export class FinanceTravelBookEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date', nullable: true })
  end_date!: string | null;

  @Column({ type: 'text' })
  summary!: string;
}
