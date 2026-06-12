import { Column, Entity, Index } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

/**
 * Telegram 用户与 LifeOS 用户的绑定关系实体
 * 用于通过 6 位绑定码完成跨系统账号关联
 */
@Entity('telegram_binding')
export class TelegramBindingEntity extends TimestampedEntity {
  /** LifeOS 用户 ID */
  @Column({ type: 'varchar', length: 36 })
  user_id!: string;

  /** Telegram 用户 ID（数字，用 bigint 存储） */
  @Index('idx_telegram_user_id')
  @Column({ type: 'bigint', name: 'telegram_user_id' })
  telegram_user_id!: string;

  /** Telegram 用户名（可变，仅作展示） */
  @Column({ type: 'varchar', length: 128, nullable: true })
  telegram_username!: string | null;

  /** Telegram 聊天 ID（用于主动推送消息） */
  @Index('idx_telegram_chat_id')
  @Column({ type: 'bigint', name: 'chat_id' })
  chat_id!: string;

  /** 6 位一次性绑定码（绑定成功后清空） */
  @Index('idx_telegram_bind_code')
  @Column({ type: 'varchar', length: 6, unique: true, nullable: true })
  bind_code!: string | null;

  /** 绑定码过期时间（10 分钟有效） */
  @Column({ type: 'datetime', nullable: true })
  bind_code_expires_at!: Date | null;
}
