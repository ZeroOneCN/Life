import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('system_user_profile')
export class SystemUserProfileEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  nickname!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone!: string | null;

  @Column({ type: 'json', nullable: true })
  preferences_json!: Record<string, unknown> | null;
}
