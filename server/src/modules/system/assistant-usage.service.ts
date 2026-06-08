import { appDataSource } from '../../db/data-source';
import { SystemAssistantUsageLogEntity } from './entities/system-assistant-usage-log.entity';

export interface AssistantUsageStats {
  totalCalls: number;
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  todayCalls: number;
  todayTokens: number;
  lastCalledAt: string | null;
}

const EMPTY_STATS: AssistantUsageStats = {
  totalCalls: 0,
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  estimatedCost: 0,
  todayCalls: 0,
  todayTokens: 0,
  lastCalledAt: null,
};

/**
 * 估算一段文本的 token 数量。
 * 这里采用「中英文混合 1 字符 ≈ 0.6 token」的粗估公式，
 * 避免引入第三方分词依赖。
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length * 0.6));
}

/**
 * 估算本次会话产生的 token 总数（输入 + 输出）。
 * 消息数组按角色加权：system 1.0 / user 1.0 / assistant 1.0 / tool 0.5。
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content?: string; tool_calls?: unknown }>,
): { prompt: number; completion: number } {
  let prompt = 0;
  let completion = 0;
  for (const message of messages) {
    const tokens = estimateTokens(message.content);
    if (message.role === 'assistant') {
      completion += tokens;
    } else {
      prompt += tokens;
    }
  }
  return { prompt, completion };
}

/**
 * 记录一次 AI 助理请求的消耗（异步，不阻塞主请求）。
 * 失败仅记录到 console，不向用户抛错。
 */
export function recordAssistantUsage(input: {
  userId: string;
  scene: string;
  requestCount: number;
  prompt: number;
  completion: number;
  status: 'success' | 'error';
}) {
  const total = input.prompt + input.completion;
  /* 1 token ≈ 0.000001 元（按 DeepSeek-chat 0.001 元 / 1k tokens） */
  const cost = total * 0.000001;

  setImmediate(() => {
    const repo = appDataSource.getRepository(SystemAssistantUsageLogEntity);
    repo
      .insert({
        user_id: input.userId,
        scene: input.scene,
        request_count: input.requestCount,
        prompt_tokens: input.prompt,
        completion_tokens: input.completion,
        estimated_cost: Number(cost.toFixed(6)),
        status: input.status,
      })
      .catch((error) => {
        console.error('[assistant-usage] record failed:', error);
      });
  });
}

/**
 * 查询用户的 AI 助理消耗统计（累计 + 今日）。
 */
export async function getAssistantUsageStats(userId: string): Promise<AssistantUsageStats> {
  if (!userId) return EMPTY_STATS;

  const repo = appDataSource.getRepository(SystemAssistantUsageLogEntity);

  const [totals, today, lastRow] = await Promise.all([
    repo
      .createQueryBuilder('row')
      .select('COALESCE(SUM(row.request_count), 0)', 'totalRequests')
      .addSelect('COALESCE(SUM(row.prompt_tokens), 0)', 'totalPromptTokens')
      .addSelect('COALESCE(SUM(row.completion_tokens), 0)', 'totalCompletionTokens')
      .addSelect('COALESCE(SUM(row.estimated_cost), 0)', 'totalCost')
      .addSelect('COUNT(*)', 'totalCalls')
      .where('row.user_id = :userId', { userId })
      .getRawOne<{
        totalRequests: string;
        totalPromptTokens: string;
        totalCompletionTokens: string;
        totalCost: string;
        totalCalls: string;
      }>(),
    repo
      .createQueryBuilder('row')
      .select('COUNT(*)', 'todayCalls')
      .addSelect('COALESCE(SUM(row.prompt_tokens + row.completion_tokens), 0)', 'todayTokens')
      .where('row.user_id = :userId', { userId })
      .andWhere('DATE(row.created_at) = CURDATE()')
      .getRawOne<{ todayCalls: string; todayTokens: string }>(),
    repo
      .createQueryBuilder('row')
      .select('MAX(row.created_at)', 'lastCalledAt')
      .where('row.user_id = :userId', { userId })
      .getRawOne<{ lastCalledAt: Date | string | null }>(),
  ]);

  const promptTokens = Number(totals?.totalPromptTokens ?? 0);
  const completionTokens = Number(totals?.totalCompletionTokens ?? 0);
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = Number(totals?.totalCost ?? 0);
  const totalCalls = Number(totals?.totalCalls ?? 0);
  const totalRequests = Number(totals?.totalRequests ?? 0);
  const todayCalls = Number(today?.todayCalls ?? 0);
  const todayTokens = Number(today?.todayTokens ?? 0);
  const lastCalledAt = lastRow?.lastCalledAt
    ? new Date(lastRow.lastCalledAt).toISOString()
    : null;

  return {
    totalCalls,
    totalRequests,
    totalPromptTokens: promptTokens,
    totalCompletionTokens: completionTokens,
    totalTokens,
    estimatedCost,
    todayCalls,
    todayTokens,
    lastCalledAt,
  };
}
