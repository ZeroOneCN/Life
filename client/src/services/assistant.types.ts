export type AssistantTool = 'query_finance' | 'query_health' | 'query_investment' | 'query_life';

export interface AssistantChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface AssistantToolCallLog {
  tool: string;
  args: unknown;
  result: unknown;
}

export interface AssistantChatResponse {
  content: string;
  toolCalls: AssistantToolCallLog[];
}

export const ASSISTANT_PROMPT_SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  { label: '本月花了多少', prompt: '请汇总本月我在购物 / 旅行 / 贷款 / 订阅 / 房租总共花了多少钱？' },
  { label: '近 7 天步数', prompt: '我最近 7 天步数怎么样？' },
  { label: '待办近况', prompt: '我当前有哪些未完成 / 即将到期的待办？' },
  { label: '投资盈亏', prompt: '我最近的外汇交易盈亏表现如何？' },
  { label: '当前体重', prompt: '我最新的体重是多少？' },
];

export const ASSISTANT_TOOL_LABELS: Record<AssistantTool, string> = {
  query_finance: '财务聚合',
  query_health: '健康数据',
  query_investment: '投资汇总',
  query_life: '生活概览',
};
