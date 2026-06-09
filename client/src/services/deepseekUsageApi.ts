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

/**
 * 单个 AI 场景的使用情况（用于按功能拆分 Token 消耗）。
 * scene 字段对应后端 `assistant_usage.scene`，label 由后端做中英文映射后下发。
 */
export interface DeepseekSceneUsage {
  scene: string;
  label: string;
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  lastCalledAt: string | null;
}

export interface DeepseekLocalUsageWithScenes extends DeepseekLocalUsage {
  scenes: DeepseekSceneUsage[];
}

export type DeepseekUsageSnapshot =
  | {
      enabled: false;
      reason: string;
      local: DeepseekLocalUsageWithScenes;
    }
  | {
      enabled: true;
      ok: false;
      reason: string;
      local: DeepseekLocalUsageWithScenes;
    }
  | {
      enabled: true;
      ok: true;
      isAvailable: boolean;
      balances: DeepseekBalanceInfo[];
      fetchedAt: string;
      local: DeepseekLocalUsageWithScenes;
    };

/**
 * 获取 DeepSeek 账户余额/Token 消耗快照。
 * 端点：GET /api/assistant/usage
 * 后端会同时返回：
 *  - DeepSeek 官方 `/user/balance` 数据
 *  - 本站 AI 助理请求的累计/今日统计
 *  - 按使用场景拆分（AI 智能助理 / 饮食营养查询 / 运动消耗查询 等）
 */
export function fetchDeepseekUsage() {
  return apiGet<DeepseekUsageSnapshot>('/assistant/usage');
}
