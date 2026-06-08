import { apiGet } from '../lib/api';

export interface DeepseekBalanceInfo {
  currency: string;
  totalBalance: number;
  grantedBalance: number | null;
  toppedUpBalance: number | null;
}

export type DeepseekUsageSnapshot =
  | {
      enabled: false;
      reason: string;
    }
  | {
      enabled: true;
      ok: false;
      reason: string;
    }
  | {
      enabled: true;
      ok: true;
      isAvailable: boolean;
      balances: DeepseekBalanceInfo[];
      fetchedAt: string;
    };

/**
 * 获取 DeepSeek 账户余额/Token 消耗快照。
 * 端点：GET /api/assistant/usage
 * 后端会调用 DeepSeek 官方 `/user/balance`，使用服务端配置的 API Key。
 */
export function fetchDeepseekUsage() {
  return apiGet<DeepseekUsageSnapshot>('/assistant/usage');
}
