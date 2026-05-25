import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('notification_center_template')
export class NotificationCenterTemplateEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  scene_id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;
}
