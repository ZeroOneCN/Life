import { env } from '../../config/env';
import { estimateTokens } from '../../modules/system/assistant-usage.service';

/**
 * DeepSeek 聊天消息（兼容 system/user/assistant/tool 四种角色）。
 */
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

/**
 * 工具定义（OpenAI function-calling 兼容格式）。
 */
export interface DeepSeekTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatOptions {
  /** 模型名，默认 deepseek-chat */
  model?: string;
  /** 温度，默认 0.5 */
  temperature?: number;
  /** 最大 token，默认 1024 */
  maxTokens?: number;
  /** 可选工具列表 */
  tools?: DeepSeekTool[];
  /** 工具选择策略，默认 'auto' */
  toolChoice?: 'auto' | 'none' | 'required';
}

interface ChatJsonOptions {
  /** 模型名，默认 deepseek-chat */
  model?: string;
  /** 温度，默认 0.2（JSON 模式偏低） */
  temperature?: number;
  /** 最大 token，默认 1024 */
  maxTokens?: number;
}

interface DeepSeekApiResponse {
  choices?: Array<{
    message?: DeepSeekMessage & {
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * 统一 DeepSeek 客户端。
 * 封装 chat / chatJson / chatWithTools 三种调用模式，
 * 统一鉴权、错误处理、token 估算。
 *
 * 使用方式：
 *   import { deepseek } from './deepseek.client';
 *   const reply = await deepseek.chat({ messages });
 *   const data = await deepseek.chatJson(messages, schema);
 */
export class DeepSeekClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly defaultModel: string = 'deepseek-chat',
  ) {}

  /** 是否已配置 API Key（未配置时所有调用返回 enabled:false） */
  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * 普通对话模式。
   * @param params.messages - 消息数组
   * @param params.options - 可选参数（temperature/maxTokens/tools）
   * @returns assistant 回复消息 + token 估算
   */
  async chat(
    messages: DeepSeekMessage[],
    options: ChatOptions = {},
  ): Promise<{
    message: DeepSeekMessage | undefined;
    promptTokens: number;
    completionTokens: number;
  }> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
    }

    const body: Record<string, unknown> = {
      model: options.model ?? this.defaultModel,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 1024,
    };
    if (options.tools && options.tools.length) {
      body.tools = options.tools;
      body.tool_choice = options.toolChoice ?? 'auto';
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as DeepSeekApiResponse;
    const message = data.choices?.[0]?.message;
    const usage = data.usage;

    const promptTokens = usage?.prompt_tokens ?? messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const completionTokens = usage?.completion_tokens ?? estimateTokens(message?.content);

    return { message, promptTokens, completionTokens };
  }

  /**
   * JSON 模式对话（强制 response_format: json_object）。
   * @param messages - 消息数组
   * @param options - 可选参数
   * @returns 解析后的 JSON 数据 + token 估算
   */
  async chatJson<T>(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: ChatJsonOptions = {},
  ): Promise<{
    data: T;
    promptTokens: number;
    completionTokens: number;
    rawContent: string;
  }> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY 未配置');
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? this.defaultModel,
        messages,
        response_format: { type: 'json_object' },
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as DeepSeekApiResponse;
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsed: T;
    try {
      parsed = JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`AI 返回非 JSON：${content.slice(0, 200)}`);
    }

    const usage = data.usage;
    const promptTokens = usage?.prompt_tokens ?? messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const completionTokens = usage?.completion_tokens ?? estimateTokens(content);

    return { data: parsed, promptTokens, completionTokens, rawContent: content };
  }

  /**
   * 查询 DeepSeek 账户余额（官方 /user/balance 端点）。
   * 用于个人中心展示余额消耗。
   */
  async fetchBalance(): Promise<{
    enabled: boolean;
    ok?: boolean;
    isAvailable?: boolean;
    reason?: string;
    balances?: Array<{
      currency: string;
      totalBalance: number;
      grantedBalance: number | null;
      toppedUpBalance: number | null;
    }>;
    fetchedAt?: string;
  }> {
    if (!this.apiKey) {
      return { enabled: false, reason: 'DEEPSEEK_API_KEY 未配置' };
    }

    const response = await fetch(`${this.baseUrl}/user/balance`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        enabled: true,
        ok: false,
        reason: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      is_available?: boolean;
      balance_infos?: Array<{
        currency: string;
        total_balance: string;
        granted_balance?: string;
        topped_up_balance?: string;
      }>;
    };

    const balances = (data.balance_infos ?? []).map((item) => ({
      currency: item.currency,
      totalBalance: Number(item.total_balance ?? '0'),
      grantedBalance: item.granted_balance !== undefined ? Number(item.granted_balance) : null,
      toppedUpBalance: item.topped_up_balance !== undefined ? Number(item.topped_up_balance) : null,
    }));

    return {
      enabled: true,
      ok: true,
      isAvailable: data.is_available !== false,
      balances,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * 全局 DeepSeek 客户端单例。
 * 所有模块通过此单例调用 AI，避免重复实现 fetch + 鉴权 + 错误处理。
 */
export const deepseek = new DeepSeekClient(
  env.DEEPSEEK_API_KEY,
  env.DEEPSEEK_BASE_URL,
  'deepseek-chat',
);
