"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFitnessRouter = createFitnessRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const date_1 = require("../../shared/utils/date");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const app_error_1 = require("../../shared/errors/app-error");
const health_fitness_diet_record_entity_1 = require("./entities/health-fitness-diet-record.entity");
const health_fitness_exercise_record_entity_1 = require("./entities/health-fitness-exercise-record.entity");
const health_fitness_setting_entity_1 = require("./entities/health-fitness-setting.entity");
const health_fitness_shopping_record_entity_1 = require("./entities/health-fitness-shopping-record.entity");
const health_fitness_weight_record_entity_1 = require("./entities/health-fitness-weight-record.entity");
const dietSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().min(1),
    mealType: zod_1.z.string().trim().min(1).max(32),
    foodName: zod_1.z.string().trim().min(1).max(255),
    grams: zod_1.z.number().min(0),
    calories: zod_1.z.number().min(0),
    protein: zod_1.z.number().min(0),
    carbs: zod_1.z.number().min(0),
    fat: zod_1.z.number().min(0),
});
const exerciseSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().min(1),
    exerciseType: zod_1.z.string().trim().min(1).max(32),
    exerciseName: zod_1.z.string().trim().min(1).max(255),
    duration: zod_1.z.number().min(0),
    calories: zod_1.z.number().min(0),
    intensity: zod_1.z.string().trim().min(1).max(16),
});
const shoppingSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().min(1),
    itemName: zod_1.z.string().trim().min(1).max(255),
    specGrams: zod_1.z.number().min(0),
    quantity: zod_1.z.number().min(0),
    unitPrice: zod_1.z.number().min(0),
    location: zod_1.z.string().trim().optional().default(''),
});
const weightSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().min(1),
    weight: zod_1.z.number().min(0),
    height: zod_1.z.number().min(0),
    bodyFat: zod_1.z.number().min(0),
});
const settingsSchema = zod_1.z.object({
    activeUserId: zod_1.z.string().optional(),
    dietFilterUserId: zod_1.z.string().optional(),
    exerciseFilterUserId: zod_1.z.string().optional(),
    shoppingFilterUserId: zod_1.z.string().optional(),
    weightFilterUserId: zod_1.z.string().optional(),
    dashboardUserId: zod_1.z.string().optional(),
    defaultHeightCm: zod_1.z.number().min(0).optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(health_fitness_setting_entity_1.HealthFitnessSettingEntity);
function mapDiet(entity) {
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
function mapExercise(entity) {
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
function mapShopping(entity) {
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
function mapWeight(entity) {
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
function calculateBmi(weight, heightCm) {
    if (weight <= 0 || heightCm <= 0) {
        return null;
    }
    const heightM = heightCm / 100;
    return Number((weight / (heightM * heightM)).toFixed(1));
}
function buildSummary(dietRecords, exerciseRecords, shoppingRecords, weightRecords, defaultHeightCm) {
    const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
    const currentMonth = (0, dayjs_1.default)().format('YYYY-MM');
    const latestWeight = [...weightRecords].sort((a, b) => (0, dayjs_1.default)(b.date).valueOf() - (0, dayjs_1.default)(a.date).valueOf())[0];
    const todayCaloriesIn = dietRecords.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.calories), 0);
    const todayCaloriesOut = exerciseRecords.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.calories), 0);
    const monthShoppingAmount = shoppingRecords
        .filter((item) => (0, dayjs_1.default)(item.date).format('YYYY-MM') === currentMonth)
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
function createFitnessRouter() {
    const router = (0, express_1.Router)();
    function buildCrudRoutes(path, repositoryFactory, schema, mapper, creator, updater) {
        router.get(`/${path}`, (0, async_handler_1.asyncHandler)(async (request, response) => {
            const authUserId = (0, request_1.requireAuthUser)(request);
            const userId = String(request.query.userId ?? authUserId);
            const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
            const repository = repositoryFactory();
            const items = await repository.find({
                where: { user_id: userId },
                order: { date: 'DESC', updated_at: 'DESC' },
            });
            response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.slice(skip, skip + pageSize).map((item) => mapper(item)), page, pageSize, items.length)));
        }));
        router.post(`/${path}`, (0, async_handler_1.asyncHandler)(async (request, response) => {
            const authUserId = (0, request_1.requireAuthUser)(request);
            const payload = (0, validation_1.validateBody)(schema, request.body);
            const repository = repositoryFactory();
            const item = await repository.save(repository.create(creator(payload, authUserId)));
            response.json((0, response_1.successResponse)(mapper(item), `create_${path.replace(/-/g, '_')}_success`));
        }));
        router.patch(`/${path}/:id`, (0, async_handler_1.asyncHandler)(async (request, response) => {
            const authUserId = (0, request_1.requireAuthUser)(request);
            const payload = (0, validation_1.validateBody)(schema.partial(), request.body);
            const entityId = String(request.params.id ?? '');
            const repository = repositoryFactory();
            const current = await repository.findOne({
                where: { id: entityId, user_id: authUserId },
            });
            if (!current) {
                throw new app_error_1.AppError(`${path.replace(/-/g, '_')}_not_found`, 404, 404);
            }
            const item = await repository.save({
                ...current,
                ...updater(current, payload),
            });
            response.json((0, response_1.successResponse)(mapper(item), `update_${path.replace(/-/g, '_')}_success`));
        }));
        router.delete(`/${path}/:id`, (0, async_handler_1.asyncHandler)(async (request, response) => {
            const authUserId = (0, request_1.requireAuthUser)(request);
            const entityId = String(request.params.id ?? '');
            const repository = repositoryFactory();
            const current = await repository.findOne({
                where: { id: entityId, user_id: authUserId },
            });
            if (!current) {
                throw new app_error_1.AppError(`${path.replace(/-/g, '_')}_not_found`, 404, 404);
            }
            await repository.remove(current);
            response.json((0, response_1.successResponse)({ ok: true }, `delete_${path.replace(/-/g, '_')}_success`));
        }));
    }
    buildCrudRoutes('diet-records', () => data_source_1.appDataSource.getRepository(health_fitness_diet_record_entity_1.HealthFitnessDietRecordEntity), dietSchema, mapDiet, (payload, authUserId) => ({
        user_id: payload.userId ?? authUserId,
        date: (0, date_1.normalizeDate)(payload.date),
        meal_type: payload.mealType,
        food_name: payload.foodName,
        grams: payload.grams,
        calories: payload.calories,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
    }), (current, payload) => ({
        user_id: payload.userId ?? current.user_id,
        date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
        meal_type: payload.mealType ?? current.meal_type,
        food_name: payload.foodName ?? current.food_name,
        grams: payload.grams ?? current.grams,
        calories: payload.calories ?? current.calories,
        protein: payload.protein ?? current.protein,
        carbs: payload.carbs ?? current.carbs,
        fat: payload.fat ?? current.fat,
    }));
    buildCrudRoutes('exercise-records', () => data_source_1.appDataSource.getRepository(health_fitness_exercise_record_entity_1.HealthFitnessExerciseRecordEntity), exerciseSchema, mapExercise, (payload, authUserId) => ({
        user_id: payload.userId ?? authUserId,
        date: (0, date_1.normalizeDate)(payload.date),
        exercise_type: payload.exerciseType,
        exercise_name: payload.exerciseName,
        duration: payload.duration,
        calories: payload.calories,
        intensity: payload.intensity,
    }), (current, payload) => ({
        user_id: payload.userId ?? current.user_id,
        date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
        exercise_type: payload.exerciseType ?? current.exercise_type,
        exercise_name: payload.exerciseName ?? current.exercise_name,
        duration: payload.duration ?? current.duration,
        calories: payload.calories ?? current.calories,
        intensity: payload.intensity ?? current.intensity,
    }));
    buildCrudRoutes('shopping-records', () => data_source_1.appDataSource.getRepository(health_fitness_shopping_record_entity_1.HealthFitnessShoppingRecordEntity), shoppingSchema, mapShopping, (payload, authUserId) => ({
        user_id: payload.userId ?? authUserId,
        date: (0, date_1.normalizeDate)(payload.date),
        item_name: payload.itemName,
        spec_grams: payload.specGrams,
        quantity: payload.quantity,
        unit_price: payload.unitPrice,
        location: payload.location,
    }), (current, payload) => ({
        user_id: payload.userId ?? current.user_id,
        date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
        item_name: payload.itemName ?? current.item_name,
        spec_grams: payload.specGrams ?? current.spec_grams,
        quantity: payload.quantity ?? current.quantity,
        unit_price: payload.unitPrice ?? current.unit_price,
        location: payload.location ?? current.location,
    }));
    buildCrudRoutes('weight-records', () => data_source_1.appDataSource.getRepository(health_fitness_weight_record_entity_1.HealthFitnessWeightRecordEntity), weightSchema, mapWeight, (payload, authUserId) => ({
        user_id: payload.userId ?? authUserId,
        date: (0, date_1.normalizeDate)(payload.date),
        weight: payload.weight,
        height: payload.height,
        body_fat: payload.bodyFat,
    }), (current, payload) => ({
        user_id: payload.userId ?? current.user_id,
        date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
        weight: payload.weight ?? current.weight,
        height: payload.height ?? current.height,
        body_fat: payload.bodyFat ?? current.body_fat,
    }));
    router.get('/summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
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
            data_source_1.appDataSource.getRepository(health_fitness_diet_record_entity_1.HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_exercise_record_entity_1.HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_shopping_record_entity_1.HealthFitnessShoppingRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_weight_record_entity_1.HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)(buildSummary(dietRecords, exerciseRecords, shoppingRecords, weightRecords, Number(settings.default_height_cm ?? 170))));
    }));
    router.get('/insights', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [dietRecords, exerciseRecords, shoppingRecords, weightRecords] = await Promise.all([
            data_source_1.appDataSource.getRepository(health_fitness_diet_record_entity_1.HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_exercise_record_entity_1.HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_shopping_record_entity_1.HealthFitnessShoppingRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_weight_record_entity_1.HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
        ]);
        const todayNet = dietRecords.filter((item) => item.date === (0, dayjs_1.default)().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)
            - exerciseRecords.filter((item) => item.date === (0, dayjs_1.default)().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0);
        const workoutDays = new Set(exerciseRecords.filter((item) => (0, dayjs_1.default)(item.date).isAfter((0, dayjs_1.default)().subtract(7, 'day'))).map((item) => item.date)).size;
        const currentMonthSpend = shoppingRecords
            .filter((item) => (0, dayjs_1.default)(item.date).format('YYYY-MM') === (0, dayjs_1.default)().format('YYYY-MM'))
            .reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
        const latestWeights = [...weightRecords].sort((a, b) => (0, dayjs_1.default)(a.date).valueOf() - (0, dayjs_1.default)(b.date).valueOf()).slice(-2);
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
        response.json((0, response_1.successResponse)(insights));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            active_user_id: userId,
            diet_filter_user_id: userId,
            exercise_filter_user_id: userId,
            shopping_filter_user_id: userId,
            weight_filter_user_id: userId,
            dashboard_user_id: userId,
            default_height_cm: 170,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            dietFilterUserId: settings.diet_filter_user_id ?? userId,
            exerciseFilterUserId: settings.exercise_filter_user_id ?? userId,
            shoppingFilterUserId: settings.shopping_filter_user_id ?? userId,
            weightFilterUserId: settings.weight_filter_user_id ?? userId,
            dashboardUserId: settings.dashboard_user_id ?? userId,
            defaultHeightCm: Number(settings.default_height_cm ?? 170),
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
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
        response.json((0, response_1.successResponse)({
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
