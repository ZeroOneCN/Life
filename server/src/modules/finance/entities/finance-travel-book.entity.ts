import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

export type FinanceTravelBookStatus = 'planning' | 'ongoing' | 'completed' | 'archived';

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

  @Column({ type: 'varchar', length: 16, default: 'ongoing' })
  status!: FinanceTravelBookStatus;

  @Column({ type: 'varchar', length: 8, default: 'CNY' })
  currency!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget!: number | null;

  @Column({ type: 'datetime', nullable: true })
  archived_at!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  last_followup_marker!: string | null;
}

