import { apiPost } from '../lib/api';

export interface FoodNutritionInfo {
  foodName: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  note: string;
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
 * 食物营养 AI 查询。
 * 后端优先命中 health_food_nutrition_cache，未命中再调 DeepSeek 写回缓存。
 * 失败抛出 ApiError。
 */
export function fetchFoodNutrition(foodName: string) {
  return apiPost<FoodNutritionInfo>('/health/fitness/ai/food', { foodName });
}

/**
 * 运动消耗 AI 查询。
 * 后端优先命中 health_exercise_calorie_cache，未命中再调 DeepSeek 写回缓存。
 * 失败抛出 ApiError。
 */
export function fetchExerciseCalorie(exerciseName: string) {
  return apiPost<ExerciseCalorieInfo>('/health/fitness/ai/exercise', { exerciseName });
}
