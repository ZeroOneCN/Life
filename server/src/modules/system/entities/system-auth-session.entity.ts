import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('system_auth_session')
export class SystemAuthSessionEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128, unique: true })
  session_token!: string;

  @Column({ type: 'varchar', length: 255 })
  refresh_token_hash!: string;

  @Column({ type: 'datetime' })
  expires_at!: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  device_name!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  revoked!: boolean;
}
