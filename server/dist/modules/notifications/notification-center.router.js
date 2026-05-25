"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationCenterRouter = createNotificationCenterRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const notification_center_channel_entity_1 = require("./entities/notification-center-channel.entity");
const notification_center_scene_entity_1 = require("./entities/notification-center-scene.entity");
const notification_center_template_entity_1 = require("./entities/notification-center-template.entity");
const notification_center_log_entity_1 = require("./entities/notification-center-log.entity");
const notification_center_scene_channel_entity_1 = require("./entities/notification-center-scene-channel.entity");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const app_error_1 = require("../../shared/errors/app-error");
const notification_1 = require("../../shared/domain/notification");
const channelSchema = zod_1.z.object({
    type: zod_1.z.enum(['email', 'wechatWork', 'webhook']),
    label: zod_1.z.string().trim().min(1).max(64).optional(),
    enabled: zod_1.z.boolean().optional(),
    status: zod_1.z.enum(['ready', 'incomplete', 'disabled']).optional(),
    config: zod_1.z.record(zod_1.z.any()).optional(),
});
const sceneSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    channels: zod_1.z.array(zod_1.z.enum(['email', 'wechatWork', 'webhook'])).optional(),
    label: zod_1.z.string().trim().min(1).max(128).optional(),
    summary: zod_1.z.string().trim().min(1).max(255).optional(),
    description: zod_1.z.string().trim().min(1).optional(),
});
const templateSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255),
    body: zod_1.z.string().trim().min(1),
});
const testChannelSchema = zod_1.z.object({
    channel: zod_1.z.enum(['email', 'wechatWork', 'webhook']),
    title: zod_1.z.string().trim().min(1).max(255).optional(),
});
const sendSceneSchema = zod_1.z.object({
    sceneId: zod_1.z.string().trim().min(1).max(64),
    message: zod_1.z.string().trim().min(1).optional(),
    preferredChannels: zod_1.z.array(zod_1.z.enum(['email', 'wechatWork', 'webhook'])).optional(),
});
function normalizeChannelStatus(enabled, config, type) {
    if (!enabled) {
        return 'disabled';
    }
    if (type === 'email') {
        return config?.recipient ? 'ready' : 'incomplete';
    }
    return config?.webhookUrl ? 'ready' : 'incomplete';
}
function createNotificationCenterRouter() {
    const router = (0, express_1.Router)();
    router.get('/channels', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
        const items = await repository.find({
            where: {
                user_id: userId,
            },
            order: {
                channel_type: 'ASC',
            },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items)));
    }));
    router.post('/channels', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(channelSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            channel_type: payload.type,
            label: payload.label ?? payload.type,
            enabled: payload.enabled ?? true,
            status: normalizeChannelStatus(payload.enabled ?? true, payload.config ?? null, payload.type),
            config_json: payload.config ?? null,
        }));
        response.json((0, response_1.successResponse)(item, 'create_notification_channel_success'));
    }));
    router.patch('/channels/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const channelId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(channelSchema.partial().omit({ type: true }), request.body);
        const repository = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
        const current = await repository.findOne({
            where: {
                id: channelId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('notification_channel_not_found', 404, 404);
        }
        const enabled = payload.enabled ?? current.enabled;
        const config = payload.config ?? current.config_json;
        const next = await repository.save({
            ...current,
            label: payload.label ?? current.label,
            enabled,
            status: payload.status ?? normalizeChannelStatus(enabled, config, current.channel_type),
            config_json: config,
        });
        response.json((0, response_1.successResponse)(next, 'update_notification_channel_success'));
    }));
    router.get('/scenes', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const sceneRepo = data_source_1.appDataSource.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity);
        const relationRepo = data_source_1.appDataSource.getRepository(notification_center_scene_channel_entity_1.NotificationCenterSceneChannelEntity);
        const scenes = await sceneRepo.find({
            where: {
                user_id: userId,
            },
            order: {
                scene_id: 'ASC',
            },
        });
        const relations = await relationRepo.find({
            where: {
                user_id: userId,
            },
        });
        const items = scenes.map((scene) => ({
            ...scene,
            channels: relations.filter((relation) => relation.scene_id === scene.scene_id).map((relation) => relation.channel_type),
        }));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items)));
    }));
    router.patch('/scenes/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const sceneId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(sceneSchema, request.body);
        const sceneRepo = data_source_1.appDataSource.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity);
        const relationRepo = data_source_1.appDataSource.getRepository(notification_center_scene_channel_entity_1.NotificationCenterSceneChannelEntity);
        const current = await sceneRepo.findOne({
            where: {
                scene_id: sceneId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('notification_scene_not_found', 404, 404);
        }
        const next = await sceneRepo.save({
            ...current,
            enabled: payload.enabled ?? current.enabled,
            label: payload.label ?? current.label,
            summary: payload.summary ?? current.summary,
            description: payload.description ?? current.description,
        });
        if (payload.channels) {
            await relationRepo.delete({
                scene_id: current.scene_id,
                user_id: userId,
            });
            await relationRepo.save(payload.channels.map((channel) => relationRepo.create({
                user_id: userId,
                scene_id: current.scene_id,
                channel_type: channel,
            })));
        }
        const channels = payload.channels ?? (await relationRepo.find({
            where: {
                scene_id: current.scene_id,
                user_id: userId,
            },
        })).map((item) => item.channel_type);
        response.json((0, response_1.successResponse)({
            ...next,
            channels,
        }, 'update_notification_scene_success'));
    }));
    router.get('/templates', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(notification_center_template_entity_1.NotificationCenterTemplateEntity);
        const items = await repository.find({
            where: {
                user_id: userId,
            },
            order: {
                scene_id: 'ASC',
            },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items)));
    }));
    router.patch('/templates/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const sceneId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(templateSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(notification_center_template_entity_1.NotificationCenterTemplateEntity);
        const current = await repository.findOne({
            where: {
                scene_id: sceneId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('notification_template_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            title: payload.title,
            body: payload.body,
        });
        response.json((0, response_1.successResponse)(next, 'update_notification_template_success'));
    }));
    router.get('/logs', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const sceneId = String(request.query.sceneId ?? '').trim();
        const status = String(request.query.status ?? '').trim();
        const channel = String(request.query.channel ?? '').trim();
        const repository = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        const allItems = await repository.find({
            where: {
                user_id: userId,
            },
            order: {
                created_at: 'DESC',
            },
        });
        const filtered = allItems
            .filter((item) => !sceneId || item.scene_id === sceneId)
            .filter((item) => !status || item.status === status)
            .filter((item) => !channel || item.channel === channel);
        const items = filtered.slice(skip, skip + pageSize);
        const total = filtered.length;
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items, page, pageSize, total)));
    }));
    router.post('/actions/test-channel', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(testChannelSchema, request.body);
        const channelRepo = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
        const logRepo = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        const channel = await channelRepo.findOne({
            where: {
                user_id: userId,
                channel_type: payload.channel,
            },
        });
        const success = Boolean(channel?.enabled);
        const message = success
            ? `${channel?.label ?? payload.channel} 测试发送已记录。`
            : `${channel?.label ?? payload.channel} 未启用或配置不完整，测试发送已跳过。`;
        const logEntry = await logRepo.save(logRepo.create({
            user_id: userId,
            channel: payload.channel,
            scene_id: null,
            kind: 'test',
            status: success ? 'success' : 'error',
            title: payload.title ?? '通知中心测试发送',
            message,
        }));
        response.json((0, response_1.successResponse)({
            success,
            message,
            logEntry,
        }, 'test_notification_channel_success'));
    }));
    router.post('/actions/send-scene', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(sendSceneSchema, request.body);
        const logs = await (0, notification_1.sendNotificationSceneLogs)({
            userId,
            sceneId: payload.sceneId,
            message: payload.message,
            preferredChannels: payload.preferredChannels,
        });
        response.json((0, response_1.successResponse)(logs, 'send_notification_scene_success'));
    }));
    return router;
}
