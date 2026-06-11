import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import {
  estimateTokens,
} from '../system/assistant-usage.service';
import { recordAssistantUsage } from '../system/assistant-usage.service';
import { HealthExerciseCalorieCacheEntity } from './entities/health-exercise-calorie-cache.entity';
import { HealthFoodNutritionCacheEntity } from './entities/health-food-nutrition-cache.entity';

const SCENE_FOOD = 'fitness.food';
const SCENE_EXERCISE = 'fitness.exercise';

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 128);
}

/**
 * 兜底建表：当 TypeORM 实体未被注册（生产 synchronize 关闭 / 编译产物与源不同步）时，
 * 直接用原生 SQL 建出食物/运动缓存表，确保 AI 写回不会因为「table not found」而失败。
 */
export async function ensureFitnessCacheTables(): Promise<void> {
  if (!appDataSource.isInitialized) return;
  try {
    await appDataSource.manager.query(`
      CREATE TABLE IF NOT EXISTS health_food_nutrition_cache (
        id varchar(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        food_key varchar(128) NOT NULL,
        food_name varchar(128) NOT NULL,
        calories_per_100g double NOT NULL DEFAULT 0,
        protein_per_100g double NOT NULL DEFAULT 0,
        carbs_per_100g double NOT NULL DEFAULT 0,
        fat_per_100g double NOT NULL DEFAULT 0,
        note varchar(255) NOT NULL DEFAULT '',
        hit_count int NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY uk_food_cache_key (food_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await appDataSource.manager.query(`
      CREATE TABLE IF NOT EXISTS health_exercise_calorie_cache (
        id varchar(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        exercise_key varchar(128) NOT NULL,
        exercise_name varchar(128) NOT NULL,
        suggested_duration_min double NOT NULL DEFAULT 0,
        calories_per_min double NOT NULL DEFAULT 0,
        suggested_type varchar(32) NOT NULL DEFAULT 'cardio',
        suggested_intensity varchar(16) NOT NULL DEFAULT 'medium',
        hit_count int NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY uk_exercise_cache_key (exercise_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (error) {
    console.error('[fitness-cache] ensure tables failed:', error);
  }
}

/**
 * 调用 DeepSeek 一次性 JSON 模式对话。
 * 失败时抛 Error（含状态码和提示）。
 */
async function callDeepSeekJson<T>(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<{
  data: T;
  promptTokens: number;
  completionTokens: number;
}> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置，无法调用 AI 营养查询');
  }

  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 256,
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
  let parsed: T;
  try {
    parsed = JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`AI 返回非 JSON：${content.slice(0, 200)}`);
  }

  const prompt = messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
  const completion = estimateTokens(content);

  return { data: parsed, promptTokens: prompt, completionTokens: completion };
}

const foodResultSchema = z.object({
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1000),
  fat: z.number().min(0).max(1000),
  note: z.string().max(255).optional().default(''),
});

export interface FoodNutritionInfo {
  foodName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  note: string;
  /** 'cache' = 命中本地缓存；'ai' = 调用 AI 实时获取 */
  source: 'cache' | 'ai';
}

export interface ExerciseCalorieInfo {
  exerciseName: string;
  suggestedDurationMin: number;
  caloriesPerMin: number;
  suggestedType: 'cardio' | 'strength' | 'flexibility';
  suggestedIntensity: 'low' | 'medium' | 'high';
  source: 'cache' | 'ai';
}

/**
 * 查询食物营养（100g 基准）。优先查缓存，命中失败再调 AI，AI 结果写回缓存。
 * 每次 AI 调用都会记录到 system_assistant_usage_logs（scene='fitness.food'）。
 */
export async function queryFoodNutrition(input: {
  userId: string;
  foodName: string;
}): Promise<FoodNutritionInfo> {
  const foodName = input.foodName.trim();
  if (!foodName) {
    throw new Error('食物名称不能为空');
  }
  const key = normalizeKey(foodName);
  if (!key) {
    throw new Error('食物名称不能为空');
  }

  const repo = appDataSource.getRepository(HealthFoodNutritionCacheEntity);
  await ensureFitnessCacheTables();
  const cached = await repo.findOne({ where: { food_key: key } });
  if (cached) {
    await repo.increment({ id: cached.id }, 'hit_count', 1);
    return {
      foodName: cached.food_name,
      caloriesPer100g: Number(cached.calories_per_100g),
      proteinPer100g: Number(cached.protein_per_100g),
      carbsPer100g: Number(cached.carbs_per_100g),
      fatPer100g: Number(cached.fat_per_100g),
      note: cached.note,
      source: 'cache',
    };
  }

  // 调用 AI
  try {
    const systemPrompt = '你是一名专业的营养师。请根据用户输入的食物名称，估算每 100g 该食物的热量（千卡）、蛋白质（克）、碳水（克）、脂肪（克）。务必只返回 JSON，格式：{"calories":number,"protein":number,"carbs":number,"fat":number,"note":string}。note 字段一句话备注烹饪方式或食用建议，不超过 30 字。';
    const userPrompt = `食物名称：${foodName}`;
    const { data, promptTokens, completionTokens } = await callDeepSeekJson<unknown>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    const parsed = foodResultSchema.parse(data);

    // 写回缓存
    try {
      await repo.insert({
        id: randomUUID(),
        food_key: key,
        food_name: foodName,
        calories_per_100g: parsed.calories,
        protein_per_100g: parsed.protein,
        carbs_per_100g: parsed.carbs,
        fat_per_100g: parsed.fat,
        note: parsed.note,
        hit_count: 1,
      });
    } catch (insertError) {
      // 并发场景下唯一索引可能冲突，忽略即可
    }

    recordAssistantUsage({
      userId: input.userId,
      scene: SCENE_FOOD,
      requestCount: 1,
      prompt: promptTokens,
      completion: completionTokens,
      status: 'success',
    });

    return {
      foodName,
      caloriesPer100g: parsed.calories,
      proteinPer100g: parsed.protein,
      carbsPer100g: parsed.carbs,
      fatPer100g: parsed.fat,
      note: parsed.note,
      source: 'ai',
    };
  } catch (error) {
    recordAssistantUsage({
      userId: input.userId,
      scene: SCENE_FOOD,
      requestCount: 1,
      prompt: 0,
      completion: 0,
      status: 'error',
    });
    throw error;
  }
}

const exerciseResultSchema = z.object({
  suggestedDurationMin: z.number().min(1).max(600),
  caloriesPerMin: z.number().min(0.1).max(50),
  suggestedType: z.enum(['cardio', 'strength', 'flexibility']),
  suggestedIntensity: z.enum(['low', 'medium', 'high']),
});

/**
 * 查询运动消耗参数。60kg 成人、中等强度的 cal/min。
 * 优先查缓存，AI 结果写回缓存；调用计入 system_assistant_usage_logs。
 */
export async function queryExerciseCalorie(input: {
  userId: string;
  exerciseName: string;
}): Promise<ExerciseCalorieInfo> {
  const exerciseName = input.exerciseName.trim();
  if (!exerciseName) {
    throw new Error('运动名称不能为空');
  }
  const key = normalizeKey(exerciseName);
  if (!key) {
    throw new Error('运动名称不能为空');
  }

  const repo = appDataSource.getRepository(HealthExerciseCalorieCacheEntity);
  await ensureFitnessCacheTables();
  const cached = await repo.findOne({ where: { exercise_key: key } });
  if (cached) {
    await repo.increment({ id: cached.id }, 'hit_count', 1);
    return {
      exerciseName: cached.exercise_name,
      suggestedDurationMin: Number(cached.suggested_duration_min),
      caloriesPerMin: Number(cached.calories_per_min),
      suggestedType: (cached.suggested_type as 'cardio' | 'strength' | 'flexibility') || 'cardio',
      suggestedIntensity: (cached.suggested_intensity as 'low' | 'medium' | 'high') || 'medium',
      source: 'cache',
    };
  }

  try {
    const systemPrompt = '你是一名专业的健身教练。请根据用户输入的运动名称，给出该运动的标准信息：1)建议单次时长（分钟，整数，常见 15-90）；2)每分钟消耗热量（千卡，60kg 成人中等强度，单数，保留 1 位小数）；3)运动分类（cardio 有氧 / strength 力量 / flexibility 柔韧）；4)推荐强度（low 轻 / medium 中 / high 高）。只返回 JSON：{"suggestedDurationMin":number,"caloriesPerMin":number,"suggestedType":"cardio|strength|flexibility","suggestedIntensity":"low|medium|high"}';
    const userPrompt = `运动名称：${exerciseName}`;
    const { data, promptTokens, completionTokens } = await callDeepSeekJson<unknown>([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    const parsed = exerciseResultSchema.parse(data);

    try {
      await repo.insert({
        id: randomUUID(),
        exercise_key: key,
        exercise_name: exerciseName,
        suggested_duration_min: parsed.suggestedDurationMin,
        calories_per_min: parsed.caloriesPerMin,
        suggested_type: parsed.suggestedType,
        suggested_intensity: parsed.suggestedIntensity,
        hit_count: 1,
      });
    } catch (insertError) {
      // 并发冲突忽略
    }

    recordAssistantUsage({
      userId: input.userId,
      scene: SCENE_EXERCISE,
      requestCount: 1,
      prompt: promptTokens,
      completion: completionTokens,
      status: 'success',
    });

    return {
      exerciseName,
      suggestedDurationMin: parsed.suggestedDurationMin,
      caloriesPerMin: parsed.caloriesPerMin,
      suggestedType: parsed.suggestedType,
      suggestedIntensity: parsed.suggestedIntensity,
      source: 'ai',
    };
  } catch (error) {
    recordAssistantUsage({
      userId: input.userId,
      scene: SCENE_EXERCISE,
      requestCount: 1,
      prompt: 0,
      completion: 0,
      status: 'error',
    });
    throw error;
  }
}
