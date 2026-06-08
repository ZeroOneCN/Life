import { apiGet } from '../lib/api';

export interface DeepseekBalanceInfo {
  currency: string;
  totalBalance: number;
  grantedBalance: number | null;
  toppedUpBalance: number | null;
}

export interface DeepseekLocalUsage {
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

export type DeepseekUsageSnapshot =
  | {
      enabled: false;
      reason: string;
      local: DeepseekLocalUsage;
    }
  | {
      enabled: true;
      ok: false;
      reason: string;
      local: DeepseekLocalUsage;
    }
  | {
      enabled: true;
      ok: true;
      isAvailable: boolean;
      balances: DeepseekBalanceInfo[];
      fetchedAt: string;
      local: DeepseekLocalUsage;
    };

/**
 * 获取 DeepSeek 账户余额/Token 消耗快照。
 * 端点：GET /api/assistant/usage
 * 后端会同时返回：
 *  - DeepSeek 官方 `/user/balance` 数据
 *  - 本站 AI 助理请求的累计/今日统计
 */
export function fetchDeepseekUsage() {
  return apiGet<DeepseekUsageSnapshot>('/assistant/usage');
}
