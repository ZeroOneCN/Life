import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('finance_travel_setting')
export class FinanceTravelSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  active_book_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  details_book_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  stats_book_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  report_book_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  leaderboard_user_id!: string | null;

  @Column({ type: 'json', nullable: true })
  report_columns_json!: string[] | null;
}
