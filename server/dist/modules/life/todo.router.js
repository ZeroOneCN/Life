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
const date_1 = require("../../shared/utils/date");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const taskSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255),
    descriptionMarkdown: zod_1.z.string().optional().default(''),
    dueDate: zod_1.z.string().optional().default(''),
    priority: zod_1.z.enum(['high', 'medium', 'low']).optional().default('medium'),
    tags: zod_1.z.array(zod_1.z.string().trim().min(1)).optional().default([]),
    isDaily: zod_1.z.boolean().optional().default(false),
    completed: zod_1.z.boolean().optional(),
});
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
const settingService = new base_user_setting_service_1.BaseUserSettingService(life_todo_setting_entity_1.LifeTodoSettingEntity);
function mapTask(entity) {
    return {
        id: entity.id,
        title: entity.title,
        descriptionMarkdown: entity.description_markdown,
        dueDate: entity.due_date ?? '',
        priority: entity.priority,
        tags: entity.tags_json ?? [],
        isDaily: entity.is_daily,
        completed: entity.completed,
        completedAt: entity.completed_at?.toISOString() ?? '',
        lastCompletedDate: entity.last_completed_date ?? '',
        trashedAt: entity.trashed_at?.toISOString() ?? '',
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
        summary.totalCount += 1;
        if (task.completed) {
            summary.completedCount += 1;
        }
        else {
            summary.activeCount += 1;
        }
        if (task.is_daily) {
            summary.dailyCount += 1;
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
        dailyCount: 0,
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
        dueTodayCount: 0,
    });
}
function createTodoRouter() {
    const router = (0, express_1.Router)();
    router.get('/tasks', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const [items, total] = await repository.findAndCount({
            where: {
                user_id: userId,
            },
            order: {
                completed: 'ASC',
                due_date: 'ASC',
                updated_at: 'DESC',
            },
            skip,
            take: pageSize,
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapTask), page, pageSize, total)));
    }));
    router.post('/tasks', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(taskSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            title: payload.title,
            description_markdown: payload.descriptionMarkdown,
            due_date: payload.dueDate ? (0, date_1.normalizeDate)(payload.dueDate) : null,
            priority: payload.priority,
            tags_json: payload.tags,
            is_daily: payload.isDaily,
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
        const payload = (0, validation_1.validateBody)(taskSchema.partial(), request.body);
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
        const next = await repository.save({
            ...current,
            title: payload.title ?? current.title,
            description_markdown: payload.descriptionMarkdown ?? current.description_markdown,
            due_date: payload.dueDate !== undefined ? (payload.dueDate ? (0, date_1.normalizeDate)(payload.dueDate) : null) : current.due_date,
            priority: payload.priority ?? current.priority,
            tags_json: payload.tags ?? current.tags_json,
            is_daily: payload.isDaily ?? current.is_daily,
            completed,
            completed_at: completed ? (current.completed_at ?? new Date()) : null,
            last_completed_date: completed ? (0, dayjs_1.default)().format('YYYY-MM-DD') : current.last_completed_date,
        });
        response.json((0, response_1.successResponse)(mapTask(next), 'update_todo_task_success'));
    }));
    router.delete('/tasks/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const taskId = String(request.params.id ?? '');
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
        await repository.update({
            user_id: userId,
            id: (0, typeorm_1.In)(payload.taskIds),
        }, {
            completed: true,
            completed_at: new Date(),
            last_completed_date: (0, dayjs_1.default)().format('YYYY-MM-DD'),
        });
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
