import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('notification_center_channel')
export class NotificationCenterChannelEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 32 })
  channel_type!: string;

  @Column({ type: 'varchar', length: 64 })
  label!: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'ready' })
  status!: string;

  @Column({ type: 'json', nullable: true })
  config_json!: Record<string, unknown> | null;
}
