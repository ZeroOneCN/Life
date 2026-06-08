import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

export type NotificationTemplateFormat = 'text' | 'html';

@Entity('notification_center_template')
export class NotificationCenterTemplateEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  scene_id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /**
   * 模板格式：
   * - text：纯文本（默认，向后兼容）
   * - html：富文本/HTML（适用于邮件、Markdown 机器人、Webhook 携带 html 字段）
   */
  @Column({ type: 'varchar', length: 16, default: 'text' })
  format!: NotificationTemplateFormat;

  /**
   * HTML 模板正文。启用 html 格式时优先使用此字段，未填写则回退到 body。
   * 支持 {{title}} / {{message}} / {{date}} / {{userId}} / {{meta.xxx}} 插值。
   */
  @Column({ type: 'mediumtext', nullable: true })
  html_body!: string | null;
}
