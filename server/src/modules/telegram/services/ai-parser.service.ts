import { deepseek } from '../../../shared/services/deepseek.client';
import { recordAssistantUsage, estimateTokens } from '../../system/assistant-usage.service';

/** AI 解析结果 */
interface AiParseResult {
  /** 目标模块名 */
  module: string;
  /** 结构化数据 */
  data: Record<string, unknown>;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * 使用 DeepSeek AI 解析自然语言输入（JSON mode）。
 * 仅在快捷指令无法匹配时作为 fallback。
 * @param text - 用户原始输入文本
 * @param userId - LifeOS 用户 ID（用于记录 Token 消耗）
 * @returns AI 解析结果，解析失败或未配置 API Key 返回 null
 */
export async function parseWithAi(text: string, userId?: string): Promise<AiParseResult | null> {
  if (!deepseek.enabled) {
    return null;
  }

  const systemPrompt = `你是 LifeOS 数据录入助手。将用户自然语言转换为结构化 JSON。
支持模块：step(步数), weight(体重), diet(饮食), exercise(运动), medication(用药), shopping(购物), todo(待办)。
只返回 JSON，不要其他文字。格式：{"module":"xxx","data":{...},"confidence":0.9}`;
  const userContent = text;

  try {
    const { data, promptTokens, completionTokens } = await deepseek.chatJson<AiParseResult>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { temperature: 0.1, maxTokens: 200 },
    );

    if (userId) {
      recordAssistantUsage({
        userId,
        scene: 'telegram',
        requestCount: 1,
        prompt: promptTokens,
        completion: completionTokens,
        status: 'success',
      });
    }

    return data;
  } catch (error) {
    if (userId) {
      recordAssistantUsage({
        userId,
        scene: 'telegram',
        requestCount: 1,
        prompt: estimateTokens(systemPrompt) + estimateTokens(userContent),
        completion: 0,
        status: 'error',
      });
    }
    return null;
  }
}
