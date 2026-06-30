import { z } from 'zod';

import { env } from '../../config/env';

const ocrResultSchema = z.object({
  weight: z.number().min(10).max(300).optional(),
  height: z.number().min(50).max(300).optional(),
  bodyFat: z.number().min(0).max(100).optional(),
  bmi: z.number().min(10).max(50).optional(),
  visceralFat: z.number().min(1).max(50).optional(),
  fatMass: z.number().min(0).max(100).optional(),
  muscleRate: z.number().min(0).max(100).optional(),
  muscleMass: z.number().min(0).max(200).optional(),
  bodyWaterRate: z.number().min(0).max(100).optional(),
  bodyWaterMass: z.number().min(0).max(200).optional(),
  proteinRate: z.number().min(0).max(100).optional(),
  proteinMass: z.number().min(0).max(100).optional(),
  boneRate: z.number().min(0).max(50).optional(),
  boneMass: z.number().min(0).max(50).optional(),
  skeletalMuscleRate: z.number().min(0).max(100).optional(),
  skeletalMuscleMass: z.number().min(0).max(100).optional(),
  subcutaneousFatRate: z.number().min(0).max(100).optional(),
  subcutaneousFatMass: z.number().min(0).max(100).optional(),
});

export interface FitnessOcrResult {
  weight?: number;
  height?: number;
  bodyFat?: number;
  bmi?: number;
  visceralFat?: number;
  fatMass?: number;
  muscleRate?: number;
  muscleMass?: number;
  bodyWaterRate?: number;
  bodyWaterMass?: number;
  proteinRate?: number;
  proteinMass?: number;
  boneRate?: number;
  boneMass?: number;
  skeletalMuscleRate?: number;
  skeletalMuscleMass?: number;
  subcutaneousFatRate?: number;
  subcutaneousFatMass?: number;
}

async function callDeepSeekVision(base64Image: string): Promise<{ data: unknown; promptTokens: number; completionTokens: number }> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置，无法调用 AI 图片识别');
  }

  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/v1/chat/completions`, {
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
          content: '你是一名专业的健康数据识别助手。请从用户上传的体脂秤屏幕截图中识别各项身体指标数据。务必只返回 JSON 格式，不要包含任何其他文字。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
            {
              type: 'text',
              text: `请识别图片中的以下指标并以 JSON 返回：
{
  "weight": 体重(kg),
  "height": 身高(cm),
  "bodyFat": 体脂率(%),
  "bmi": BMI,
  "visceralFat": 内脏脂肪等级,
  "fatMass": 脂肪量(kg),
  "muscleRate": 肌肉率(%),
  "muscleMass": 肌肉量(kg),
  "bodyWaterRate": 体水分率(%),
  "bodyWaterMass": 体水分量(kg),
  "proteinRate": 蛋白量占比(%),
  "proteinMass": 蛋白量含量(kg),
  "boneRate": 骨量占比(%),
  "boneMass": 骨量(kg),
  "skeletalMuscleRate": 骨骼肌率(%),
  "skeletalMuscleMass": 骨骼肌量(kg),
  "subcutaneousFatRate": 皮下脂肪率(%),
  "subcutaneousFatMass": 皮下脂肪量(kg)
}
注意事项：
1. 只返回识别到的数值，无法识别的字段可以省略。
2. 百分比数值直接返回数字（如 21.0% 返回 21.0，不是 0.21）。
3. 数值范围：体重 10-300kg，身高 50-300cm，体脂率 0-100%，BMI 10-50。
4. 请仔细识别屏幕上的所有数字，不要遗漏。`,
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content || '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error(`AI 返回非 JSON：${content.slice(0, 200)}`);
  }

  return { data: parsed, promptTokens: 0, completionTokens: 0 };
}

export async function recognizeFitnessImage(base64Image: string): Promise<FitnessOcrResult> {
  if (!base64Image || !base64Image.trim()) {
    throw new Error('图片数据不能为空');
  }

  const { data } = await callDeepSeekVision(base64Image);

  try {
    const result = ocrResultSchema.parse(data);
    return result;
  } catch (error) {
    throw new Error('图片识别结果格式不符合要求');
  }
}