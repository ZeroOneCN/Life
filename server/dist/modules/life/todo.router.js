"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTodoRouter = createTodoRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../db/data-source");
const life_todo_task_entity_1 = require("./entities/life-todo-task.entity");
const life_todo_setting_entity_1 = require("./entities/life-todo-setting.entity");
const notification_center_log_entity_1 = require("../notifications/entities/notification-center-log.entity");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const app_error_1 = require("../../shared/errors/app-error");
const pagination_1 = require("../../shared/utils/pagination");
const text_1 = require("../../shared/utils/text");
const date_1 = require("../../shared/utils/date");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const todo_recurrence_1 = require("./todo-recurrence");
const recurrenceTypeSchema = zod_1.z.enum(['none', 'daily', 'weekly', 'monthly']);
const recurrenceConfigSchema = zod_1.z
    .object({
    weekdays: zod_1.z
        .array(zod_1.z.number().int().min(0).max(6))
        .max(7)
        .optional(),
    dayOfMonth: zod_1.z.number().int().min(1).max(31).optional(),
})
    .optional()
    .nullable();
const taskSchemaBase = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255),
    descriptionMarkdown: zod_1.z.string().optional().default(''),
    dueDate: zod_1.z.string().refine((val) => {
        if (!val || val.trim() === '')
            return true;
        return (0, dayjs_1.default)(val, 'YYYY-MM-DD', true).isValid() || (0, dayjs_1.default)(val, 'YYYY/MM/DD', true).isValid();
    }, { message: 'dueDate 格式无效，应为 YYYY-MM-DD 或 YYYY/MM/DD' }).optional().default(''),
    priority: zod_1.z.enum(['high', 'medium', 'low']).optional().default('medium'),
    tags: zod_1.z.array(zod_1.z.string().trim().min(1)).optional().default([]),
    isDaily: zod_1.z.boolean().optional().default(false),
    recurrenceType: recurrenceTypeSchema.optional().default('none'),
    recurrenceConfig: recurrenceConfigSchema,
    completed: zod_1.z.boolean().optional(),
});
const taskSchema = taskSchemaBase.refine((data) => {
    if (data.completed === true && !data.dueDate && (data.isDaily || data.recurrenceType !== 'none')) {
        return false;
    }
    return true;
}, { message: '重复任务必须设置到期日期' });
const settingsSchema = zod_1.z.object({
    reminderEnabled: zod_1.z.boolean().optional(),
    reminderTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    leadDays: zod_1.z.number().int().min(0).max(30).optional(),
    includeDailyTasks: zod_1.z.boolean().optional(),
    includeOverdueTasks: zod_1.z.boolean().optional(),
    lastAutoReminderDate: zod_1.z.string().optional(),
});
const batchCompleteSchema = zod_1.z.object({
    taskIds: zod_1.z.array(zod_1.z.string().min(1)).min(1),
});
const batchTrashSchema = zod_1.z.object({
    taskIds: zod_1.z.array(zod_1.z.string().min(1)).min(1),
});
const restoreSchema = zod_1.z.object({
    taskId: zod_1.z.string().min(1),
});
const triggerReminderSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255).optional(),
});
const toggleCompletedSchema = zod_1.z.object({
    completed: zod_1.z.boolean(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(life_todo_setting_entity_1.LifeTodoSettingEntity);
function normalizeRecurrenceConfig(config) {
    if (!config) {
        return null;
    }
    const result = {};
    if (Array.isArray(config.weekdays)) {
        const unique = [...new Set(config.weekdays.filter((value) => value >= 0 && value <= 6))];
        if (unique.length) {
            result.weekdays = unique.sort((left, right) => left - right);
        }
    }
    if (typeof config.dayOfMonth === 'number' && config.dayOfMonth >= 1 && config.dayOfMonth <= 31) {
        result.dayOfMonth = config.dayOfMonth;
    }
    return Object.keys(result).length ? result : null;
}
function mapTask(entity) {
    const recurrenceType = (0, todo_recurrence_1.resolveRecurrenceType)(entity.recurrence_type, entity.is_daily);
    return {
        id: entity.id,
        title: entity.title,
        descriptionMarkdown: entity.description_markdown,
        dueDate: entity.due_date ? (0, dayjs_1.default)(entity.due_date).format('YYYY-MM-DD') : '',
        priority: entity.priority,
        tags: entity.tags_json ?? [],
        isDaily: recurrenceType === 'daily',
        recurrenceType,
        recurrenceConfig: normalizeRecurrenceConfig(entity.recurrence_config),
        completed: entity.completed,
        completedAt: entity.completed_at ? (0, dayjs_1.default)(entity.completed_at).format('YYYY-MM-DD HH:mm:ss') : '',
        lastCompletedDate: entity.last_completed_date ? (0, dayjs_1.default)(entity.last_completed_date).format('YYYY-MM-DD') : '',
        trashedAt: entity.trashed_at ? (0, dayjs_1.default)(entity.trashed_at).format('YYYY-MM-DD HH:mm:ss') : '',
        sortOrder: entity.sort_order,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function buildTodoOverview(tasks) {
    const today = (0, dayjs_1.default)().startOf('day');
    return tasks.reduce((summary, task) => {
        if (task.trashed_at) {
            return summary;
        }
        const recurrenceType = (0, todo_recurrence_1.resolveRecurrenceType)(task.recurrence_type, task.is_daily);
        const recurring = (0, todo_recurrence_1.isRecurringType)(recurrenceType);
        summary.totalCount += 1;
        if (task.completed && !recurring) {
            summary.completedCount += 1;
        }
        else if (!task.completed) {
            summary.activeCount += 1;
        }
        if (recurring) {
            summary.recurringCount += 1;
            summary.dailyCount += recurrenceType === 'daily' ? 1 : 0;
        }
        if (task.priority === 'high') {
            summary.highPriorityCount += 1;
        }
        else if (task.priority === 'medium') {
            summary.mediumPriorityCount += 1;
        }
        else {
            summary.lowPriorityCount += 1;
        }
        if (task.due_date && (0, dayjs_1.default)(task.due_date).isSame(today, 'day')) {
            summary.dueTodayCount += 1;
        }
        return summary;
    }, {
        totalCount: 0,
        activeCount: 0,
        completedCount: 0,
        recurringCount: 0,
        dailyCount: 0,
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
        dueTodayCount: 0,
    });
}
function isRecurringEntity(task) {
    return (0, todo_recurrence_1.isRecurringType)((0, todo_recurrence_1.resolveRecurrenceType)(task.recurrence_type, task.is_daily));
}
function createTodoRouter() {
    const router = (0, express_1.Router)();
    router.get('/tasks', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const keyword = (0, text_1.normalizeText)(request.query.keyword).toLowerCase();
        const status = (0, text_1.normalizeText)(request.query.status, 'all');
        const priority = (0, text_1.normalizeText)(request.query.priority, 'all');
        const tag = (0, text_1.normalizeText)(request.query.tag);
        const dueStartDate = (0, text_1.normalizeText)(request.query.dueStartDate);
        const dueEndDate = (0, text_1.normalizeText)(request.query.dueEndDate);
        const trashed = (0, text_1.normalizeText)(request.query.trashed, 'false') === 'true';
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const items = await repository.find({
            where: {
                user_id: userId,
                trashed_at: trashed ? (0, typeorm_1.Not)((0, typeorm_1.IsNull)()) : (0, typeorm_1.IsNull)(),
            },
            order: {
                updated_at: 'DESC',
                due_date: 'DESC',
            },
        });
        const filtered = items.filter((item) => {
            if (trashed && !item.trashed_at) {
                return false;
            }
            if (keyword) {
                const haystack = [
                    item.title,
                    item.description_markdown,
                    ...(item.tags_json ?? []),
                ].join(' ').toLowerCase();
                if (!haystack.includes(keyword)) {
                    return false;
                }
            }
            if (status !== 'all') {
                if (status === 'daily' && (0, todo_recurrence_1.resolveRecurrenceType)(item.recurrence_type, item.is_daily) !== 'daily') {
                    return false;
                }
                if (status === 'recurring' && !isRecurringEntity(item)) {
                    return false;
                }
                if (status === 'completed' && !item.completed) {
                    return false;
                }
                if (status === 'active' && item.completed) {
                    return false;
                }
                if (status === 'overdue' && (item.completed || !item.due_date || !(0, dayjs_1.default)(item.due_date).isBefore((0, dayjs_1.default)(), 'day'))) {
                    return false;
                }
            }
            if (priority !== 'all' && item.priority !== priority) {
                return false;
            }
            if (tag && !(item.tags_json ?? []).includes(tag)) {
                return false;
            }
            if (dueStartDate && (!item.due_date || (0, dayjs_1.default)(item.due_date).isBefore(dueStartDate, 'day'))) {
                return false;
            }
            if (dueEndDate && (!item.due_date || (0, dayjs_1.default)(item.due_date).isAfter(dueEndDate, 'day'))) {
                return false;
            }
            return true;
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapTask), page, pageSize, filtered.length)));
    }));
    router.post('/tasks', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(taskSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const recurrenceType = payload.recurrenceType && payload.recurrenceType !== 'none'
            ? payload.recurrenceType
            : (payload.isDaily ? 'daily' : 'none');
        const recurrenceConfig = (0, todo_recurrence_1.isRecurringType)(recurrenceType)
            ? normalizeRecurrenceConfig(payload.recurrenceConfig ?? null)
            : null;
        const item = await repository.save(repository.create({
            user_id: userId,
            title: payload.title,
            description_markdown: payload.descriptionMarkdown,
            due_date: payload.dueDate ? (0, date_1.normalizeDate)(payload.dueDate) : null,
            priority: payload.priority,
            tags_json: payload.tags,
            is_daily: recurrenceType === 'daily',
            recurrence_type: recurrenceType,
            recurrence_config: recurrenceConfig,
            completed: payload.completed ?? false,
            completed_at: payload.completed ? new Date() : null,
            last_completed_date: payload.completed ? (0, dayjs_1.default)().format('YYYY-MM-DD') : null,
            trashed_at: null,
            sort_order: Date.now(),
        }));
        response.json((0, response_1.successResponse)(mapTask(item), 'create_todo_task_success'));
    }));
    router.patch('/tasks/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const taskId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(taskSchemaBase.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const current = await repository.findOne({
            where: {
                id: taskId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('todo_task_not_found', 404, 404);
        }
        const completed = payload.completed ?? current.completed;
        const wasCompleted = current.completed;
        const isNowCompleted = completed;
        const previousRecurrenceType = (0, todo_recurrence_1.resolveRecurrenceType)(current.recurrence_type, current.is_daily);
        const nextRecurrenceType = payload.recurrenceType !== undefined
            ? payload.recurrenceType
            : (payload.isDaily !== undefined
                ? (payload.isDaily ? 'daily' : 'none')
                : previousRecurrenceType);
        const nextRecurrenceConfig = payload.recurrenceConfig !== undefined
            ? normalizeRecurrenceConfig(payload.recurrenceConfig)
            : ((0, todo_recurrence_1.isRecurringType)(nextRecurrenceType)
                ? normalizeRecurrenceConfig(current.recurrence_config)
                : null);
        const next = await repository.save({
            ...current,
            title: payload.title ?? current.title,
            description_markdown: payload.descriptionMarkdown ?? current.description_markdown,
            due_date: payload.dueDate !== undefined ? (payload.dueDate ? (0, date_1.normalizeDate)(payload.dueDate) : null) : current.due_date,
            priority: payload.priority ?? current.priority,
            tags_json: payload.tags ?? current.tags_json,
            is_daily: payload.isDaily !== undefined
                ? payload.isDaily
                : (nextRecurrenceType === 'daily'),
            recurrence_type: nextRecurrenceType,
            recurrence_config: nextRecurrenceConfig,
            completed: isNowCompleted,
            completed_at: isNowCompleted
                ? (!wasCompleted ? new Date() : (current.completed_at ?? new Date()))
                : null,
            last_completed_date: isNowCompleted
                ? (!wasCompleted ? (0, dayjs_1.default)().format('YYYY-MM-DD') : (current.last_completed_date ?? (0, dayjs_1.default)().format('YYYY-MM-DD')))
                : current.last_completed_date,
        });
        response.json((0, response_1.successResponse)(mapTask(next), 'update_todo_task_success'));
    }));
    router.post('/tasks/:id/toggle-completed', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const taskId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(toggleCompletedSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const current = await repository.findOne({
            where: {
                id: taskId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('todo_task_not_found', 404, 404);
        }
        const recurrenceType = (0, todo_recurrence_1.resolveRecurrenceType)(current.recurrence_type, current.is_daily);
        const recurring = (0, todo_recurrence_1.isRecurringType)(recurrenceType);
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const lastCompletedDate = current.last_completed_date
            ? (0, dayjs_1.default)(current.last_completed_date).format('YYYY-MM-DD')
            : null;
        // 重复任务：完成即推进 due_date 到下一次，并清除当次完成态。
        if (payload.completed && recurring) {
            const baseDate = lastCompletedDate && lastCompletedDate >= today
                ? lastCompletedDate
                : (current.due_date ? (0, dayjs_1.default)(current.due_date).format('YYYY-MM-DD') : today);
            const nextDate = (0, todo_recurrence_1.computeNextRecurrenceDate)(recurrenceType, current.recurrence_config, baseDate, null) ?? today;
            const next = await repository.save({
                ...current,
                completed: false,
                completed_at: null,
                last_completed_date: today,
                due_date: nextDate,
            });
            response.json((0, response_1.successResponse)(mapTask(next), 'toggle_todo_task_completed_success'));
            return;
        }
        const next = await repository.save({
            ...current,
            completed: payload.completed,
            completed_at: payload.completed ? new Date() : null,
            last_completed_date: payload.completed ? today : current.last_completed_date,
        });
        response.json((0, response_1.successResponse)(mapTask(next), 'toggle_todo_task_completed_success'));
    }));
    router.delete('/tasks/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const taskId = String(request.params.id ?? '');
        const permanent = (0, text_1.normalizeText)(request.query.mode) === 'permanent';
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const current = await repository.findOne({
            where: {
                id: taskId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('todo_task_not_found', 404, 404);
        }
        if (permanent) {
            await repository.remove(current);
            response.json((0, response_1.successResponse)({ ok: true }, 'delete_todo_task_success'));
            return;
        }
        await repository.save({
            ...current,
            trashed_at: new Date(),
        });
        response.json((0, response_1.successResponse)({ ok: true }, 'trash_todo_task_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const items = await repository.find({
            where: {
                user_id: userId,
            },
        });
        response.json((0, response_1.successResponse)(buildTodoOverview(items)));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            reminder_enabled: true,
            reminder_time: '09:00',
            lead_days: 3,
            include_daily_tasks: true,
            include_overdue_tasks: true,
            last_auto_reminder_date: null,
        });
        response.json((0, response_1.successResponse)({
            reminderEnabled: settings.reminder_enabled,
            reminderTime: settings.reminder_time,
            leadDays: settings.lead_days,
            includeDailyTasks: settings.include_daily_tasks,
            includeOverdueTasks: settings.include_overdue_tasks,
            lastAutoReminderDate: settings.last_auto_reminder_date ?? '',
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            reminder_enabled: payload.reminderEnabled,
            reminder_time: payload.reminderTime,
            lead_days: payload.leadDays,
            include_daily_tasks: payload.includeDailyTasks,
            include_overdue_tasks: payload.includeOverdueTasks,
            last_auto_reminder_date: payload.lastAutoReminderDate ? (0, date_1.normalizeDate)(payload.lastAutoReminderDate) : undefined,
        }, {
            reminder_enabled: true,
            reminder_time: '09:00',
            lead_days: 3,
            include_daily_tasks: true,
            include_overdue_tasks: true,
            last_auto_reminder_date: null,
        });
        response.json((0, response_1.successResponse)({
            reminderEnabled: settings.reminder_enabled,
            reminderTime: settings.reminder_time,
            leadDays: settings.lead_days,
            includeDailyTasks: settings.include_daily_tasks,
            includeOverdueTasks: settings.include_overdue_tasks,
            lastAutoReminderDate: settings.last_auto_reminder_date ?? '',
        }, 'update_todo_settings_success'));
    }));
    router.post('/actions/batch-complete', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(batchCompleteSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const matched = await repository.find({
            where: {
                user_id: userId,
                id: (0, typeorm_1.In)(payload.taskIds),
            },
        });
        for (const item of matched) {
            const recurrenceType = (0, todo_recurrence_1.resolveRecurrenceType)(item.recurrence_type, item.is_daily);
            if ((0, todo_recurrence_1.isRecurringType)(recurrenceType)) {
                const lastCompletedDate = item.last_completed_date
                    ? (0, dayjs_1.default)(item.last_completed_date).format('YYYY-MM-DD')
                    : null;
                const baseDate = lastCompletedDate && lastCompletedDate >= today
                    ? lastCompletedDate
                    : (item.due_date ? (0, dayjs_1.default)(item.due_date).format('YYYY-MM-DD') : today);
                const nextDate = (0, todo_recurrence_1.computeNextRecurrenceDate)(recurrenceType, item.recurrence_config, baseDate, null) ?? today;
                await repository.save({
                    ...item,
                    completed: false,
                    completed_at: null,
                    last_completed_date: today,
                    due_date: nextDate,
                });
                continue;
            }
            await repository.update({ id: item.id }, {
                completed: true,
                completed_at: new Date(),
                last_completed_date: today,
            });
        }
        response.json((0, response_1.successResponse)({ ok: true }, 'batch_complete_todo_tasks_success'));
    }));
    router.post('/actions/batch-trash', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(batchTrashSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        await repository.update({
            user_id: userId,
            id: (0, typeorm_1.In)(payload.taskIds),
        }, {
            trashed_at: new Date(),
        });
        response.json((0, response_1.successResponse)({ ok: true }, 'batch_trash_todo_tasks_success'));
    }));
    router.post('/actions/restore', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(restoreSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        await repository.update({
            user_id: userId,
            id: payload.taskId,
        }, {
            trashed_at: null,
        });
        response.json((0, response_1.successResponse)({ ok: true }, 'restore_todo_task_success'));
    }));
    router.post('/actions/clear-trash', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const items = await repository.find({
            where: {
                user_id: userId,
            },
        });
        const trashedItems = items.filter((item) => item.trashed_at);
        if (trashedItems.length) {
            await repository.remove(trashedItems);
        }
        response.json((0, response_1.successResponse)({ ok: true }, 'clear_todo_trash_success'));
    }));
    router.post('/actions/trigger-reminder', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(triggerReminderSchema, request.body);
        const logRepo = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        const log = await logRepo.save(logRepo.create({
            user_id: userId,
            channel: 'email',
            scene_id: 'todo.reminder',
            kind: 'scene',
            status: 'success',
            title: payload.title ?? '待办提醒',
            message: payload.title ?? '已手动触发今日待办提醒。',
        }));
        response.json((0, response_1.successResponse)(log, 'trigger_todo_reminder_success'));
    }));
    router.get('/logs', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        const [items, total] = await repository.findAndCount({
            where: {
                user_id: userId,
                scene_id: 'todo.reminder',
            },
            order: {
                created_at: 'DESC',
            },
            skip,
            take: pageSize,
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items, page, pageSize, total)));
    }));
    return router;
}
