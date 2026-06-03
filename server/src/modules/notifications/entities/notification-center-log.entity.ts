import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('notification_center_log')
export class NotificationCenterLogEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 32 })
  channel!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  scene_id!: string | null;

  @Column({ type: 'varchar', length: 16 })
  kind!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;
}
