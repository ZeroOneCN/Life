import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('finance_rent_setting')
export class FinanceRentSettingEntity extends UserSettingEntity {
  @Column({ type: 'varchar', length: 36, nullable: true })
  active_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  records_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  statistics_user_id!: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  editing_record_id!: string | null;
}
