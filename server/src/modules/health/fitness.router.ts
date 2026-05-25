import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import type { ObjectLiteral, Repository } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { AppError } from '../../shared/errors/app-error';
import { HealthFitnessDietRecordEntity } from './entities/health-fitness-diet-record.entity';
import { HealthFitnessExerciseRecordEntity } from './entities/health-fitness-exercise-record.entity';
import { HealthFitnessSettingEntity } from './entities/health-fitness-setting.entity';
import { HealthFitnessShoppingRecordEntity } from './entities/health-fitness-shopping-record.entity';
import { HealthFitnessWeightRecordEntity } from './entities/health-fitness-weight-record.entity';

const dietSchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  mealType: z.string().trim().min(1).max(32),
  foodName: z.string().trim().min(1).max(255),
  grams: z.number().min(0),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
});

const exerciseSchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  exerciseType: z.string().trim().min(1).max(32),
  exerciseName: z.string().trim().min(1).max(255),
  duration: z.number().min(0),
  calories: z.number().min(0),
  intensity: z.string().trim().min(1).max(16),
});

const shoppingSchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  itemName: z.string().trim().min(1).max(255),
  specGrams: z.number().min(0),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  location: z.string().trim().optional().default(''),
});

const weightSchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  weight: z.number().min(0),
  height: z.number().min(0),
  bodyFat: z.number().min(0),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional(),
  dietFilterUserId: z.string().optional(),
  exerciseFilterUserId: z.string().optional(),
  shoppingFilterUserId: z.string().optional(),
  weightFilterUserId: z.string().optional(),
  dashboardUserId: z.string().optional(),
  defaultHeightCm: z.number().min(0).optional(),
});

const settingService = new BaseUserSettingService(HealthFitnessSettingEntity);

function mapDiet(entity: HealthFitnessDietRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: entity.date,
    mealType: entity.meal_type,
    foodName: entity.food_name,
    grams: Number(entity.grams),
    calories: Number(entity.calories),
    protein: Number(entity.protein),
    carbs: Number(entity.carbs),
    fat: Number(entity.fat),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapExercise(entity: HealthFitnessExerciseRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: entity.date,
    exerciseType: entity.exercise_type,
    exerciseName: entity.exercise_name,
    duration: Number(entity.duration),
    calories: Number(entity.calories),
    intensity: entity.intensity,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapShopping(entity: HealthFitnessShoppingRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: entity.date,
    itemName: entity.item_name,
    specGrams: Number(entity.spec_grams),
    quantity: Number(entity.quantity),
    unitPrice: Number(entity.unit_price),
    location: entity.location,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapWeight(entity: HealthFitnessWeightRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: entity.date,
    weight: Number(entity.weight),
    height: Number(entity.height),
    bodyFat: Number(entity.body_fat),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function calculateBmi(weight: number, heightCm: number) {
  if (weight <= 0 || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  return Number((weight / (heightM * heightM)).toFixed(1));
}

function buildSummary(
  dietRecords: HealthFitnessDietRecordEntity[],
  exerciseRecords: HealthFitnessExerciseRecordEntity[],
  shoppingRecords: HealthFitnessShoppingRecordEntity[],
  weightRecords: HealthFitnessWeightRecordEntity[],
  defaultHeightCm: number,
) {
  const today = dayjs().format('YYYY-MM-DD');
  const currentMonth = dayjs().format('YYYY-MM');
  const latestWeight = [...weightRecords].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())[0];
  const todayCaloriesIn = dietRecords.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.calories), 0);
  const todayCaloriesOut = exerciseRecords.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.calories), 0);
  const monthShoppingAmount = shoppingRecords
    .filter((item) => dayjs(item.date).format('YYYY-MM') === currentMonth)
    .reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);

  return {
    todayCaloriesIn: Number(todayCaloriesIn.toFixed(1)),
    todayCaloriesOut: Number(todayCaloriesOut.toFixed(1)),
    todayNetCalories: Number((todayCaloriesIn - todayCaloriesOut).toFixed(1)),
    latestWeightKg: latestWeight ? Number(latestWeight.weight) : null,
    bmi: latestWeight ? calculateBmi(Number(latestWeight.weight), Number(latestWeight.height) || defaultHeightCm) : null,
    weekAverageNetCalories: Number(((dietRecords.reduce((sum, item) => sum + Number(item.calories), 0) - exerciseRecords.reduce((sum, item) => sum + Number(item.calories), 0)) / Math.max(1, 7)).toFixed(0)),
    monthShoppingAmount: Number(monthShoppingAmount.toFixed(2)),
    todayDietCost: Number(shoppingRecords.filter((item) => item.date === today).reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0).toFixed(2)),
    trackedDays: new Set([
      ...dietRecords.map((item) => item.date),
      ...exerciseRecords.map((item) => item.date),
      ...shoppingRecords.map((item) => item.date),
      ...weightRecords.map((item) => item.date),
    ]).size,
  };
}

export function createFitnessRouter() {
  const router = Router();

  function buildCrudRoutes<TEntity extends ObjectLiteral, TSchema extends z.AnyZodObject, TResponse>(
    path: string,
    repositoryFactory: () => Repository<TEntity>,
    schema: TSchema,
    mapper: (entity: TEntity) => TResponse,
    creator: (payload: z.infer<TSchema>, authUserId: string) => Partial<TEntity>,
    updater: (current: TEntity, payload: Partial<z.infer<TSchema>>) => Partial<TEntity>,
  ) {
    router.get(`/${path}`, asyncHandler(async (request: AuthenticatedRequest, response) => {
      const authUserId = requireAuthUser(request);
      const userId = String(request.query.userId ?? authUserId);
      const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
      const repository = repositoryFactory();
      const items = await repository.find({
        where: { user_id: userId } as never,
        order: { date: 'DESC', updated_at: 'DESC' } as never,
      });

      response.json(successResponse(buildListData(items.slice(skip, skip + pageSize).map((item) => mapper(item)), page, pageSize, items.length)));
    }));

    router.post(`/${path}`, asyncHandler(async (request: AuthenticatedRequest, response) => {
      const authUserId = requireAuthUser(request);
      const payload = validateBody(schema, request.body);
      const repository = repositoryFactory();
      const item = await repository.save(repository.create(creator(payload, authUserId) as never)) as unknown as TEntity;
      response.json(successResponse(mapper(item), `create_${path.replace(/-/g, '_')}_success`));
    }));

    router.patch(`/${path}/:id`, asyncHandler(async (request: AuthenticatedRequest, response) => {
      const authUserId = requireAuthUser(request);
      const payload = validateBody(schema.partial(), request.body) as Partial<z.infer<TSchema>>;
      const entityId = String(request.params.id ?? '');
      const repository = repositoryFactory();
      const current = await repository.findOne({
        where: { id: entityId, user_id: authUserId } as never,
      }) as TEntity | null;

      if (!current) {
        throw new AppError(`${path.replace(/-/g, '_')}_not_found`, 404, 404);
      }

      const item = await repository.save({
        ...(current as object),
        ...(updater(current, payload) as object),
      } as never) as unknown as TEntity;
      response.json(successResponse(mapper(item), `update_${path.replace(/-/g, '_')}_success`));
    }));

    router.delete(`/${path}/:id`, asyncHandler(async (request: AuthenticatedRequest, response) => {
      const authUserId = requireAuthUser(request);
      const entityId = String(request.params.id ?? '');
      const repository = repositoryFactory();
      const current = await repository.findOne({
        where: { id: entityId, user_id: authUserId } as never,
      }) as TEntity | null;

      if (!current) {
        throw new AppError(`${path.replace(/-/g, '_')}_not_found`, 404, 404);
      }

      await repository.remove(current);
      response.json(successResponse({ ok: true }, `delete_${path.replace(/-/g, '_')}_success`));
    }));
  }

  buildCrudRoutes(
    'diet-records',
    () => appDataSource.getRepository(HealthFitnessDietRecordEntity),
    dietSchema,
    mapDiet,
    (payload, authUserId) => ({
      user_id: payload.userId ?? authUserId,
      date: normalizeDate(payload.date),
      meal_type: payload.mealType,
      food_name: payload.foodName,
      grams: payload.grams,
      calories: payload.calories,
      protein: payload.protein,
      carbs: payload.carbs,
      fat: payload.fat,
    }),
    (current, payload) => ({
      user_id: payload.userId ?? current.user_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      meal_type: payload.mealType ?? current.meal_type,
      food_name: payload.foodName ?? current.food_name,
      grams: payload.grams ?? current.grams,
      calories: payload.calories ?? current.calories,
      protein: payload.protein ?? current.protein,
      carbs: payload.carbs ?? current.carbs,
      fat: payload.fat ?? current.fat,
    }),
  );

  buildCrudRoutes(
    'exercise-records',
    () => appDataSource.getRepository(HealthFitnessExerciseRecordEntity),
    exerciseSchema,
    mapExercise,
    (payload, authUserId) => ({
      user_id: payload.userId ?? authUserId,
      date: normalizeDate(payload.date),
      exercise_type: payload.exerciseType,
      exercise_name: payload.exerciseName,
      duration: payload.duration,
      calories: payload.calories,
      intensity: payload.intensity,
    }),
    (current, payload) => ({
      user_id: payload.userId ?? current.user_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      exercise_type: payload.exerciseType ?? current.exercise_type,
      exercise_name: payload.exerciseName ?? current.exercise_name,
      duration: payload.duration ?? current.duration,
      calories: payload.calories ?? current.calories,
      intensity: payload.intensity ?? current.intensity,
    }),
  );

  buildCrudRoutes(
    'shopping-records',
    () => appDataSource.getRepository(HealthFitnessShoppingRecordEntity),
    shoppingSchema,
    mapShopping,
    (payload, authUserId) => ({
      user_id: payload.userId ?? authUserId,
      date: normalizeDate(payload.date),
      item_name: payload.itemName,
      spec_grams: payload.specGrams,
      quantity: payload.quantity,
      unit_price: payload.unitPrice,
      location: payload.location,
    }),
    (current, payload) => ({
      user_id: payload.userId ?? current.user_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      item_name: payload.itemName ?? current.item_name,
      spec_grams: payload.specGrams ?? current.spec_grams,
      quantity: payload.quantity ?? current.quantity,
      unit_price: payload.unitPrice ?? current.unit_price,
      location: payload.location ?? current.location,
    }),
  );

  buildCrudRoutes(
    'weight-records',
    () => appDataSource.getRepository(HealthFitnessWeightRecordEntity),
    weightSchema,
    mapWeight,
    (payload, authUserId) => ({
      user_id: payload.userId ?? authUserId,
      date: normalizeDate(payload.date),
      weight: payload.weight,
      height: payload.height,
      body_fat: payload.bodyFat,
    }),
    (current, payload) => ({
      user_id: payload.userId ?? current.user_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      weight: payload.weight ?? current.weight,
      height: payload.height ?? current.height,
      body_fat: payload.bodyFat ?? current.body_fat,
    }),
  );

  router.get('/summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const settings = await settingService.getOrCreate(authUserId, {
      active_user_id: authUserId,
      diet_filter_user_id: authUserId,
      exercise_filter_user_id: authUserId,
      shopping_filter_user_id: authUserId,
      weight_filter_user_id: authUserId,
      dashboard_user_id: authUserId,
      default_height_cm: 170,
    });
    const [dietRecords, exerciseRecords, shoppingRecords, weightRecords] = await Promise.all([
      appDataSource.getRepository(HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessShoppingRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse(buildSummary(
      dietRecords,
      exerciseRecords,
      shoppingRecords,
      weightRecords,
      Number(settings.default_height_cm ?? 170),
    )));
  }));

  router.get('/insights', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [dietRecords, exerciseRecords, shoppingRecords, weightRecords] = await Promise.all([
      appDataSource.getRepository(HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessShoppingRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
    ]);

    const todayNet = dietRecords.filter((item) => item.date === dayjs().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)
      - exerciseRecords.filter((item) => item.date === dayjs().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0);
    const workoutDays = new Set(exerciseRecords.filter((item) => dayjs(item.date).isAfter(dayjs().subtract(7, 'day'))).map((item) => item.date)).size;
    const currentMonthSpend = shoppingRecords
      .filter((item) => dayjs(item.date).format('YYYY-MM') === dayjs().format('YYYY-MM'))
      .reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
    const latestWeights = [...weightRecords].sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()).slice(-2);

    const insights = [];
    if (todayNet > 500) {
      insights.push({
        id: 'net-high',
        title: '今日净热量偏高',
        description: '今日摄入明显高于消耗，建议晚间控制加餐或增加轻运动。',
        metric: `${todayNet.toFixed(0)} kcal`,
        tone: 'warning',
      });
    }
    if (workoutDays < 2) {
      insights.push({
        id: 'exercise-low',
        title: '近一周运动频次偏低',
        description: '最近 7 天有效训练天数不足，建议至少安排 2 到 3 次训练。',
        metric: `${workoutDays} 天`,
        tone: 'warning',
      });
    }
    if (currentMonthSpend > 900) {
      insights.push({
        id: 'shopping-high',
        title: '本月食材采购偏高',
        description: '本月食材支出已偏高，可以复核采购频次与备餐策略。',
        metric: `￥${currentMonthSpend.toFixed(0)}`,
        tone: 'neutral',
      });
    }
    if (latestWeights.length === 2) {
      const delta = Number((Number(latestWeights[1].weight) - Number(latestWeights[0].weight)).toFixed(1));
      if (Math.abs(delta) < 0.3) {
        insights.push({
          id: 'weight-flat',
          title: '近期体重变化不大',
          description: '最近两次体重记录变化较小，可以关注饮食执行和训练强度是否到位。',
          metric: `${delta >= 0 ? '+' : ''}${delta} kg`,
          tone: 'neutral',
        });
      }
    }

    if (!insights.length) {
      insights.push({
        id: 'balanced',
        title: '当前状态相对稳定',
        description: '饮食、训练和体重记录没有出现明显风险信号，可以继续保持记录节奏。',
        tone: 'positive',
      });
    }

    response.json(successResponse(insights));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      diet_filter_user_id: userId,
      exercise_filter_user_id: userId,
      shopping_filter_user_id: userId,
      weight_filter_user_id: userId,
      dashboard_user_id: userId,
      default_height_cm: 170,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      dietFilterUserId: settings.diet_filter_user_id ?? userId,
      exerciseFilterUserId: settings.exercise_filter_user_id ?? userId,
      shoppingFilterUserId: settings.shopping_filter_user_id ?? userId,
      weightFilterUserId: settings.weight_filter_user_id ?? userId,
      dashboardUserId: settings.dashboard_user_id ?? userId,
      defaultHeightCm: Number(settings.default_height_cm ?? 170),
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      active_user_id: payload.activeUserId,
      diet_filter_user_id: payload.dietFilterUserId,
      exercise_filter_user_id: payload.exerciseFilterUserId,
      shopping_filter_user_id: payload.shoppingFilterUserId,
      weight_filter_user_id: payload.weightFilterUserId,
      dashboard_user_id: payload.dashboardUserId,
      default_height_cm: payload.defaultHeightCm,
    }, {
      active_user_id: userId,
      diet_filter_user_id: userId,
      exercise_filter_user_id: userId,
      shopping_filter_user_id: userId,
      weight_filter_user_id: userId,
      dashboard_user_id: userId,
      default_height_cm: 170,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      dietFilterUserId: settings.diet_filter_user_id ?? userId,
      exerciseFilterUserId: settings.exercise_filter_user_id ?? userId,
      shoppingFilterUserId: settings.shopping_filter_user_id ?? userId,
      weightFilterUserId: settings.weight_filter_user_id ?? userId,
      dashboardUserId: settings.dashboard_user_id ?? userId,
      defaultHeightCm: Number(settings.default_height_cm ?? 170),
    }, 'update_fitness_settings_success'));
  }));

  return router;
}
