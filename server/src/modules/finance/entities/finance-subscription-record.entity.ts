import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('finance_subscription_record')
export class FinanceSubscriptionRecordEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  service_name!: string;

  @Column({ type: 'varchar', length: 128 })
  plan_name!: string;

  @Column({ type: 'varchar', length: 36 })
  category_id!: string;

  @Column({ type: 'varchar', length: 128 })
  category_name!: string;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date' })
  end_date!: string;

  @Column({ type: 'varchar', length: 16 })
  billing_cycle!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  cycle_price!: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  auto_renew!: boolean;

  @Column({ type: 'text' })
  notes!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  last_upcoming_reminder_marker!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  last_expired_reminder_marker!: string | null;
}
