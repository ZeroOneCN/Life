import { env } from '../../../config/env';

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
 * 使用 DeepSeek AI 解析自然语言输入
 * 仅在快捷指令无法匹配时作为 fallback
 * @param text - 用户原始输入文本
 * @returns AI 解析结果，解析失败或未配置 API Key 返回 null
 */
export async function parseWithAi(text: string): Promise<AiParseResult | null> {
  if (!env.DEEPSEEK_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是 LifeOS 数据录入助手。将用户自然语言转换为结构化 JSON。
支持模块：step(步数), weight(体重), diet(饮食), exercise(运动), medication(用药), shopping(购物), todo(待办)。
只返回 JSON，不要其他文字。格式：{"module":"xxx","data":{...},"confidence":0.9}`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    // 提取 JSON（可能被 markdown 包裹）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AiParseResult;
  } catch {
    return null;
  }
}
