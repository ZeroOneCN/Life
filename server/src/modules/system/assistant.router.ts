import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { ASSISTANT_TOOLS, handleAssistantToolCall } from './assistant.tools';

const SYSTEM_PROMPT = `你是 LifeOS 个人助理，可以调用后端工具查询用户的财务、健康、投资、生活数据。请基于工具返回的真实数据回答：
- 使用中文，Markdown 排版
- 给出具体数字 + 时间范围 + 单位
- 给出 1-2 条可执行建议
- 当工具返回为空或未配置时，明确说明`;

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
        { role: 'system', content: SYSTEM_PROMPT },
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

  return router;
}
