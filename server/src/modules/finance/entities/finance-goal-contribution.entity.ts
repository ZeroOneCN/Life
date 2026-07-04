import { Column, Entity, Index } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_goal_contribution')
@Index('idx_goal_id', ['goal_id'])
export class FinanceGoalContributionEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 36 })
  goal_id!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: number | string;

  @Column({ type: 'varchar', length: 16, default: 'deposit' })
  type!: 'deposit' | 'withdrawal';

  @Column({ type: 'date' })
  contribution_date!: string;

  @Column({ type: 'varchar', length: 256, default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 64, default: 'manual' })
  source!: 'manual' | 'auto_transfer' | 'interest' | 'other';
}
