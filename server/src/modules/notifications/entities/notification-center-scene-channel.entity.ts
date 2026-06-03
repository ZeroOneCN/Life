import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('notification_center_scene_channel')
export class NotificationCenterSceneChannelEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  scene_id!: string;

  @Column({ type: 'varchar', length: 32 })
  channel_type!: string;
}
