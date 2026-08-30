import { Column, Entity, Index } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

/**
 * 系统操作日志实体。
 * 记录所有用户操作（CRUD、登录、登出等），用于审计追溯。
 */
@Entity('system_audit_log')
@Index(['user_id', 'created_at'])
@Index(['action', 'entity_type'])
export class SystemAuditLogEntity extends TimestampedEntity {
  /** 操作用户 ID */
  @Column({ type: 'varchar', length: 36 })
  user_id!: string;

  /** 操作用户名（冗余存储，方便查询） */
  @Column({ type: 'varchar', length: 64 })
  username!: string;

  /** 操作类型：CREATE / UPDATE / DELETE / LOGIN / LOGOUT / EXPORT */
  @Column({ type: 'varchar', length: 32 })
  action!: string;

  /** 操作实体类型（模块/表名），如 'auth_login', 'finance_bill', 'health_fitness' */
  @Column({ type: 'varchar', length: 64 })
  @Index()
  entity_type!: string;

  /** 操作实体 ID */
  @Column({ type: 'varchar', length: 36, nullable: true })
  entity_id!: string | null;

  /** 操作描述（人类可读），如 '登录系统', '创建账单 #123' */
  @Column({ type: 'varchar', length: 255 })
  description!: string;

  /** 操作详情 JSON（可存储变更前后的数据快照） */
  @Column({ type: 'json', nullable: true })
  detail_json!: Record<string, unknown> | null;

  /** 请求 IP 地址 */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ip_address!: string | null;

  /** 请求 User-Agent */
  @Column({ type: 'varchar', length: 512, nullable: true })
  user_agent!: string | null;
}