import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('notification_center_scene')
export class NotificationCenterSceneEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  scene_id!: string;

  @Column({ type: 'varchar', length: 128 })
  label!: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 255 })
  summary!: string;

  @Column({ type: 'text' })
  description!: string;
}
