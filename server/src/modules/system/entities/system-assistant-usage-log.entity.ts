import { Column, Entity, Index } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

/**
 * AI 助理单次请求消耗记录（DeepSeek Token 估算）。
 * 每次 /assistant/chat 调用成功后落库一条，用于：
 *  - 个人中心「DeepSeek Token 消耗」组件的本站消耗统计
 *  - 投资中心 / 仪表盘的 AI 使用趋势
 *
 * 字段说明：
 *  - request_count: 本次实际发出的 HTTP 请求数（含多轮 tool_calls 调用的次数）
 *  - prompt_tokens / completion_tokens: 按 1 字符 ≈ 0.6 token 估算，避免引入第三方分词器
 *  - estimated_cost: 按 DeepSeek 公开价 0.001 元 / 1k tokens（缓存命中价 0.0002）粗估，单位元
 */
@Entity('system_assistant_usage_logs')
@Index('idx_assistant_usage_user_created', ['user_id', 'created_at'])
export class SystemAssistantUsageLogEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  scene!: string;

  /** 本次会话发出的 DeepSeek HTTP 请求次数（含 tool_calls 轮次） */
  @Column({ type: 'int', default: 0 })
  request_count!: number;

  /** 本次会话输入侧估算 token 数 */
  @Column({ type: 'int', default: 0 })
  prompt_tokens!: number;

  /** 本次会话输出侧估算 token 数 */
  @Column({ type: 'int', default: 0 })
  completion_tokens!: number;

  /** 估算花费（元），按 1 token = 0.000001 元粗算 */
  @Column({ type: 'double', default: 0 })
  estimated_cost!: number;

  @Column({ type: 'varchar', length: 16, default: 'success' })
  status!: 'success' | 'error';
}
