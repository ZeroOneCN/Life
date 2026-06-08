import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';

import { env } from '../../config/env';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { ASSISTANT_TOOLS, handleAssistantToolCall } from './assistant.tools';

function buildSystemPrompt() {
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const monthStart = now.startOf('month').format('YYYY-MM-DD');
  const monthEnd = now.endOf('month').format('YYYY-MM-DD');
  const lastMonth = now.subtract(1, 'month').format('YYYY-MM');
  const thisYear = now.format('YYYY');
  const lastYear = String(Number(thisYear) - 1);
  const currentHour = now.hour();

  return `你是 LifeOS 个人助理，可以调用后端工具查询用户的财务、健康、投资、生活数据。请基于工具返回的真实数据回答：
- 使用中文，Markdown 排版
- 给出具体数字 + 时间范围 + 单位
- 给出 1-2 条可执行建议
- 当工具返回为空或未配置时，明确说明

## 关键时间上下文
- 当前服务器时间：${now.format('YYYY-MM-DD HH:mm:ss')}（${currentHour >= 0 && currentHour < 12 ? '上午' : currentHour < 18 ? '下午' : '晚上'}）
- 今天：${today}
- 本月：${monthStart} ~ ${monthEnd}
- 上个月：${lastMonth}
- 今年：${thisYear}
- 去年：${lastYear}

## 数据查询约束
- 当用户说"本月/上月/今年/去年"时，必须按上述时间区间调用工具的 startDate / endDate 参数
- 任何与时间相关的数据必须使用上方今天的日期作为基准，避免使用 LLM 自带知识
- 体重、步数、运动、用药为健康模块；盈亏为外汇交易模块；
  购物/旅行/贷款/订阅/房租为财务模块；待办/物品/号卡为生活模块
- 步数统计口径：每日 MAX(steps) 后求和（与 /api/health/step/summary 一致），不要把同一日的多条记录重复累加
- 外汇盈亏口径：
  * realizedNetPnl = 毛 pnl + 手续费（手续费为负数），不等于账户余额
  * 账户当前净值 ≈ netCapital（入金-出金） + realizedNetPnl（区间累计利润）
  * 当用户问"我赚了多少"时同时返回 realizedNetPnl + totalDeposit + netCapital，让用户 cross-check
  * 数据源 = /api/investment/forex/dashboard-summary（数据库真实流水），禁止使用任何 mock/估测数字`;
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().default(''),
  toolCallId: z.string().optional(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
});

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

async function callDeepSeek(messages: DeepSeekMessage[], tools = ASSISTANT_TOOLS) {
  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.5,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: DeepSeekMessage }>;
  };
  return data.choices?.[0]?.message;
}

/**
 * 查询 DeepSeek 账户余额（官方 `/user/balance` 端点）。
 * 用于在个人中心展示 Token / 余额消耗组件。
 * 返回值单位为「元」，遵循 DeepSeek 官方余额字段定义。
 */
async function fetchDeepSeekBalance() {
  if (!env.DEEPSEEK_API_KEY) {
    return {
      enabled: false,
      reason: 'DEEPSEEK_API_KEY 未配置',
    } as const;
  }

  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/user/balance`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      enabled: true,
      ok: false,
      reason: `HTTP ${response.status}: ${text.slice(0, 200)}`,
    } as const;
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

  const infos = (data.balance_infos ?? []).map((item) => ({
    currency: item.currency,
    totalBalance: Number(item.total_balance ?? '0'),
    grantedBalance: item.granted_balance !== undefined ? Number(item.granted_balance) : null,
    toppedUpBalance: item.topped_up_balance !== undefined ? Number(item.topped_up_balance) : null,
  }));

  return {
    enabled: true,
    ok: true,
    isAvailable: data.is_available !== false,
    balances: infos,
    fetchedAt: new Date().toISOString(),
  } as const;
}

export function createAssistantRouter() {
  const router = Router();

  router.post(
    '/chat',
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      const userId = requireAuthUser(request);
      const payload = validateBody(chatSchema, request.body);

      if (!env.DEEPSEEK_API_KEY) {
        response.json(successResponse({
          content: '## 暂未启用 AI 助理\n\n请在服务端 `.env` 中设置 `DEEPSEEK_API_KEY` 后重启服务。\n\n与此同时，你仍可使用各模块的独立查询。',
          toolCalls: [],
        }));
        return;
      }

      const conversation: DeepSeekMessage[] = [
        { role: 'system', content: buildSystemPrompt() },
        ...payload.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'tool')
          .map<DeepSeekMessage>((message) => {
            if (message.role === 'tool') {
              return {
                role: 'tool',
                content: message.content,
                tool_call_id: message.toolCallId ?? '',
              };
            }
            if (message.role === 'assistant') {
              return {
                role: 'assistant',
                content: message.content,
                tool_calls: message.toolCalls,
              };
            }
            return { role: 'user', content: message.content };
          }),
      ];

      const toolCallsLog: Array<{ tool: string; args: unknown; result: unknown }> = [];

      try {
        let reply = await callDeepSeek(conversation);
        let safety = 0;
        while (reply?.tool_calls && reply.tool_calls.length && safety < 4) {
          safety += 1;
          conversation.push({
            role: 'assistant',
            content: reply.content,
            tool_calls: reply.tool_calls,
          });
          for (const call of reply.tool_calls) {
            let parsedArgs: unknown = {};
            try {
              parsedArgs = JSON.parse(call.function.arguments);
            } catch (error) {
              parsedArgs = {};
            }
            const tool = call.function.name as Parameters<typeof handleAssistantToolCall>[0];
            try {
              const result = await handleAssistantToolCall(tool, userId, parsedArgs);
              toolCallsLog.push({ tool, args: parsedArgs, result });
              conversation.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result ?? {}),
              });
            } catch (error) {
              toolCallsLog.push({ tool, args: parsedArgs, result: { error: String(error) } });
              conversation.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ error: String(error) }),
              });
            }
          }
          reply = await callDeepSeek(conversation);
        }

        response.json(successResponse({
          content: reply?.content || '已收到你的问题，但 AI 暂未给出回答。',
          toolCalls: toolCallsLog,
        }));
      } catch (error) {
        response.json(successResponse({
          content: `## AI 调用失败\n\n${String(error)}\n\n请检查 DEEPSEEK_API_KEY 或网络连接。`,
          toolCalls: toolCallsLog,
        }));
      }
    }),
  );

  /**
   * GET /assistant/usage
   * 查询 DeepSeek 账户余额，供个人中心小组件使用。
   * 返回 DeepSeek 官方 `/user/balance` 端点数据，包含 total_balance / granted_balance / topped_up_balance。
   */
  router.get(
    '/usage',
    asyncHandler(async (_request: AuthenticatedRequest, response) => {
      const snapshot = await fetchDeepSeekBalance();
      response.json(successResponse(snapshot));
    }),
  );

  return router;
}
