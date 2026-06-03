import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('life_storage_setting')
export class LifeStorageSettingEntity extends UserSettingEntity {
  @Column({ type: 'tinyint', width: 1, default: 1 })
  include_archived_in_dashboard!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'latest' })
  default_sort!: string;

  @Column({ type: 'varchar', length: 16, default: 'all' })
  default_dashboard_range!: string;
}
