import { Column, Entity } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

/**
 * 用户账号实体。
 * 存储登录认证信息和角色权限。
 */
@Entity('system_user_account')
export class SystemUserAccountEntity extends TimestampedEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  email!: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_active!: boolean;

  /** 用户角色：admin / user / readonly */
  @Column({ type: 'varchar', length: 32, default: 'user' })
  role!: string;
}
