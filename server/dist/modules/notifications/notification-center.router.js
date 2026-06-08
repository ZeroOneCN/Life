"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationCenterRouter = createNotificationCenterRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const data_source_1 = require("../../db/data-source");
const app_error_1 = require("../../shared/errors/app-error");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const notification_1 = require("../../shared/domain/notification");
const pagination_1 = require("../../shared/utils/pagination");
const notification_sender_1 = require("../../shared/services/notification-sender");
const notification_center_channel_entity_1 = require("./entities/notification-center-channel.entity");
const notification_center_log_entity_1 = require("./entities/notification-center-log.entity");
const notification_center_scene_channel_entity_1 = require("./entities/notification-center-scene-channel.entity");
const notification_center_scene_entity_1 = require("./entities/notification-center-scene.entity");
const notification_center_template_entity_1 = require("./entities/notification-center-template.entity");
const emailConfigSchema = zod_1.z.object({
    recipient: zod_1.z.string().email('请输入有效的邮箱地址').optional(),
    senderName: zod_1.z.string().trim().max(64).optional(),
    webhookUrl: zod_1.z.string().optional(),
    secret: zod_1.z.string().max(128).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
const webhookConfigSchema = zod_1.z.object({
    recipient: zod_1.z.string().optional(),
    senderName: zod_1.z.string().optional(),
    webhookUrl: zod_1.z.string().url('请输入有效的 Webhook URL').optional(),
    secret: zod_1.z.string().max(128).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
const wechatWorkConfigSchema = zod_1.z.object({
    recipient: zod_1.z.string().optional(),
    senderName: zod_1.z.string().optional(),
    webhookUrl: zod_1.z.string().url('请输入有效的企业微信 Webhook URL').optional(),
    secret: zod_1.z.string().max(128).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
const dingTalkConfigSchema = zod_1.z.object({
    recipient: zod_1.z.string().optional(),
    senderName: zod_1.z.string().optional(),
    webhookUrl: zod_1.z.string().url('请输入有效的钉钉 Webhook URL').optional(),
    secret: zod_1.z.string().max(128).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
const feishuConfigSchema = zod_1.z.object({
    recipient: zod_1.z.string().optional(),
    senderName: zod_1.z.string().optional(),
    webhookUrl: zod_1.z.string().url('请输入有效的飞书 Webhook URL').optional(),
    secret: zod_1.z.string().max(128).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
const telegramConfigSchema = zod_1.z.object({
    recipient: zod_1.z.string().optional(),
    senderName: zod_1.z.string().optional(),
    webhookUrl: zod_1.z.string().optional(),
    secret: zod_1.z.string().max(128).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
function validateChannelConfig(type, config) {
    if (type === 'email')
        return emailConfigSchema.parse(config ?? {});
    if (type === 'wechatWork')
        return wechatWorkConfigSchema.parse(config ?? {});
    if (type === 'dingTalk')
        return dingTalkConfigSchema.parse(config ?? {});
    if (type === 'feishu')
        return feishuConfigSchema.parse(config ?? {});
    if (type === 'telegram')
        return telegramConfigSchema.parse(config ?? {});
    return webhookConfigSchema.parse(config ?? {});
}
const channelSchema = zod_1.z.object({
    type: zod_1.z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook']),
    label: zod_1.z.string().trim().min(1).max(64).optional(),
    enabled: zod_1.z.coerce.boolean().optional(),
    status: zod_1.z.enum(['ready', 'incomplete', 'disabled']).optional(),
    config: zod_1.z.record(zod_1.z.any()).optional(),
});
const sceneSchema = zod_1.z.object({
    enabled: zod_1.z.coerce.boolean().optional(),
    channels: zod_1.z.array(zod_1.z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook'])).optional(),
    label: zod_1.z.string().trim().max(128).optional(),
    summary: zod_1.z.string().trim().max(255).optional(),
    description: zod_1.z.string().trim().optional(),
});
const templateSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255),
    body: zod_1.z.string().trim().min(1),
});
const testChannelSchema = zod_1.z.object({
    channel: zod_1.z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook']),
    title: zod_1.z.string().trim().min(1).max(255).optional(),
});
const sendSceneSchema = zod_1.z.object({
    sceneId: zod_1.z.string().trim().min(1).max(64),
    message: zod_1.z.string().trim().min(1).optional(),
    preferredChannels: zod_1.z.array(zod_1.z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook'])).optional(),
});
function normalizeChannelStatus(enabled, config, type) {
    if (!enabled) {
        return 'disabled';
    }
    if (type === 'email') {
        return config?.recipient ? 'ready' : 'incomplete';
    }
    if (type === 'telegram') {
        return (config?.recipient && config?.webhookUrl) ? 'ready' : 'incomplete';
    }
    return config?.webhookUrl ? 'ready' : 'incomplete';
}
function createNotificationCenterRouter() {
    const router = (0, express_1.Router)();
    router.get('/channels', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
        let items = await repository.find({
            where: { user_id: userId },
            order: { channel_type: 'ASC' },
        });
        const ALL_CHANNEL_SEEDS = [
            { channel_type: 'email', label: '邮件通知', enabled: false, status: 'disabled', config_json: null },
            { channel_type: 'wechatWork', label: '企业微信', enabled: false, status: 'disabled', config_json: null },
            { channel_type: 'dingTalk', label: '钉钉', enabled: false, status: 'disabled', config_json: null },
            { channel_type: 'feishu', label: '飞书', enabled: false, status: 'disabled', config_json: null },
            { channel_type: 'telegram', label: 'Telegram', enabled: false, status: 'disabled', config_json: null },
            { channel_type: 'webhook', label: 'Webhook', enabled: false, status: 'disabled', config_json: null },
        ];
        const existingTypes = new Set(items.map((item) => item.channel_type));
        const missing = ALL_CHANNEL_SEEDS.filter((seed) => !existingTypes.has(seed.channel_type));
        if (missing.length > 0) {
            const added = await repository.save(missing.map((d) => repository.create({ user_id: userId, ...d })));
            items = [...items, ...added];
        }
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
            where: { id: channelId, user_id: userId },
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
        let [scenes, relations] = await Promise.all([
            sceneRepo.find({
                where: { user_id: userId },
                order: { scene_id: 'ASC' },
            }),
            relationRepo.find({
                where: { user_id: userId },
            }),
        ]);
        if (scenes.length === 0) {
            const defaults = [
                { scene_id: 'todo.reminder', label: '待办提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'card.balance_low', label: '号卡低余额提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'card.billing_upcoming', label: '号卡账单日前提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'loan.repayment_upcoming', label: '贷款还款提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'loan.repayment_overdue', label: '贷款逾期提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'checkup.followup_reminder', label: '体检复查提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'checkup.abnormal_alert', label: '体检异常提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'medication.dose_reminder', label: '服药提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'medication.stock_low', label: '低库存提醒', enabled: false, summary: '', description: '' },
                { scene_id: 'subscription.renewal_upcoming', label: '订阅即将到期', enabled: false, summary: '', description: '' },
                { scene_id: 'subscription.expired', label: '订阅到期或逾期', enabled: false, summary: '', description: '' },
            ];
            scenes = await sceneRepo.save(defaults.map((d) => sceneRepo.create({ user_id: userId, ...d })));
            relations = [];
        }
        const items = scenes.map((scene) => ({
            ...scene,
            channels: relations
                .filter((relation) => relation.scene_id === scene.scene_id)
                .map((relation) => relation.channel_type),
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
            where: { scene_id: sceneId, user_id: userId },
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
            where: { scene_id: current.scene_id, user_id: userId },
        })).map((item) => item.channel_type);
        response.json((0, response_1.successResponse)({
            ...next,
            channels,
        }, 'update_notification_scene_success'));
    }));
    router.get('/templates', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(notification_center_template_entity_1.NotificationCenterTemplateEntity);
        let items = await repository.find({
            where: { user_id: userId },
            order: { scene_id: 'ASC' },
        });
        if (items.length === 0) {
            const defaults = [
                { scene_id: 'todo.reminder', title: '', body: '' },
                { scene_id: 'card.balance_low', title: '', body: '' },
                { scene_id: 'card.billing_upcoming', title: '', body: '' },
                { scene_id: 'loan.repayment_upcoming', title: '', body: '' },
                { scene_id: 'loan.repayment_overdue', title: '', body: '' },
                { scene_id: 'checkup.followup_reminder', title: '', body: '' },
                { scene_id: 'checkup.abnormal_alert', title: '', body: '' },
                { scene_id: 'medication.dose_reminder', title: '', body: '' },
                { scene_id: 'medication.stock_low', title: '', body: '' },
                { scene_id: 'subscription.renewal_upcoming', title: '', body: '' },
                { scene_id: 'subscription.expired', title: '', body: '' },
            ];
            items = await repository.save(defaults.map((d) => repository.create({ user_id: userId, ...d })));
        }
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items)));
    }));
    router.patch('/templates/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const sceneId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(templateSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(notification_center_template_entity_1.NotificationCenterTemplateEntity);
        const current = await repository.findOne({
            where: { scene_id: sceneId, user_id: userId },
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
        const sceneIds = String(request.query.sceneIds ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        const status = String(request.query.status ?? '').trim();
        const channel = String(request.query.channel ?? '').trim();
        const repository = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        const allItems = await repository.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
        });
        const filtered = allItems
            .filter((item) => {
            if (sceneId && item.scene_id !== sceneId) {
                return false;
            }
            if (sceneIds.length && (!item.scene_id || !sceneIds.includes(item.scene_id))) {
                return false;
            }
            return true;
        })
            .filter((item) => !status || item.status === status)
            .filter((item) => !channel || item.channel === channel);
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize), page, pageSize, filtered.length)));
    }));
    router.delete('/logs', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const logRepo = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        await logRepo.delete({ user_id: userId });
        response.json((0, response_1.successResponse)(null, 'notification_logs_cleared'));
    }));
    router.post('/actions/test-channel', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(testChannelSchema, request.body);
        const channelRepo = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
        const logRepo = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
        const channel = await channelRepo.findOne({
            where: { user_id: userId, channel_type: payload.channel },
        });
        const channelLabel = channel?.label ?? payload.channel;
        const title = payload.title ?? '通知中心测试发送';
        const config = channel?.config_json;
        if (!channel?.enabled) {
            const logEntry = await logRepo.save(logRepo.create({
                user_id: userId,
                channel: payload.channel,
                scene_id: null,
                kind: 'test',
                status: 'error',
                title,
                message: `${channelLabel} 未启用或配置不完整，测试发送已跳过。`,
            }));
            response.json((0, response_1.successResponse)({
                success: false,
                message: `${channelLabel} 未启用或配置不完整，测试发送已跳过。`,
                logEntry,
            }, 'test_notification_channel_success'));
            return;
        }
        let sendResult;
        if (payload.channel === 'email') {
            const recipient = config?.recipient;
            if (!recipient) {
                const logEntry = await logRepo.save(logRepo.create({
                    user_id: userId,
                    channel: payload.channel,
                    scene_id: null,
                    kind: 'test',
                    status: 'error',
                    title,
                    message: '邮件地址未配置',
                }));
                response.json((0, response_1.successResponse)({
                    success: false,
                    message: '邮件地址未配置',
                    logEntry,
                }, 'test_notification_channel_success'));
                return;
            }
            sendResult = await (0, notification_sender_1.sendEmail)({
                to: recipient,
                subject: title,
                text: '这是一封来自 LifeOS 通知中心的测试邮件。',
            });
        }
        else if (payload.channel === 'wechatWork') {
            const webhookUrl = config?.webhookUrl;
            if (!webhookUrl) {
                const logEntry = await logRepo.save(logRepo.create({
                    user_id: userId,
                    channel: payload.channel,
                    scene_id: null,
                    kind: 'test',
                    status: 'error',
                    title,
                    message: '企业微信 Webhook 地址未配置',
                }));
                response.json((0, response_1.successResponse)({
                    success: false,
                    message: '企业微信 Webhook 地址未配置',
                    logEntry,
                }, 'test_notification_channel_success'));
                return;
            }
            sendResult = await (0, notification_sender_1.sendWechatWorkWebhook)({
                webhookUrl,
                content: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
            });
        }
        else if (payload.channel === 'dingTalk') {
            const webhookUrl = config?.webhookUrl;
            const secret = config?.secret;
            if (!webhookUrl) {
                const logEntry = await logRepo.save(logRepo.create({
                    user_id: userId,
                    channel: payload.channel,
                    scene_id: null,
                    kind: 'test',
                    status: 'error',
                    title,
                    message: '钉钉 Webhook 地址未配置',
                }));
                response.json((0, response_1.successResponse)({
                    success: false,
                    message: '钉钉 Webhook 地址未配置',
                    logEntry,
                }, 'test_notification_channel_success'));
                return;
            }
            sendResult = await (0, notification_sender_1.sendDingTalkWebhook)({
                webhookUrl,
                secret,
                content: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
            });
        }
        else if (payload.channel === 'feishu') {
            const webhookUrl = config?.webhookUrl;
            const secret = config?.secret;
            if (!webhookUrl) {
                const logEntry = await logRepo.save(logRepo.create({
                    user_id: userId,
                    channel: payload.channel,
                    scene_id: null,
                    kind: 'test',
                    status: 'error',
                    title,
                    message: '飞书 Webhook 地址未配置',
                }));
                response.json((0, response_1.successResponse)({
                    success: false,
                    message: '飞书 Webhook 地址未配置',
                    logEntry,
                }, 'test_notification_channel_success'));
                return;
            }
            sendResult = await (0, notification_sender_1.sendFeishuWebhook)({
                webhookUrl,
                secret,
                content: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
            });
        }
        else if (payload.channel === 'telegram') {
            const botToken = config?.recipient;
            const chatId = config?.webhookUrl;
            if (!botToken || !chatId) {
                const logEntry = await logRepo.save(logRepo.create({
                    user_id: userId,
                    channel: payload.channel,
                    scene_id: null,
                    kind: 'test',
                    status: 'error',
                    title,
                    message: 'Telegram Bot Token 或 Chat ID 未配置',
                }));
                response.json((0, response_1.successResponse)({
                    success: false,
                    message: 'Telegram Bot Token 或 Chat ID 未配置',
                    logEntry,
                }, 'test_notification_channel_success'));
                return;
            }
            sendResult = await (0, notification_sender_1.sendTelegramMessage)({
                botToken,
                chatId,
                text: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
            });
        }
        else if (payload.channel === 'webhook') {
            const webhookUrl = config?.webhookUrl;
            const secret = config?.secret;
            if (!webhookUrl) {
                const logEntry = await logRepo.save(logRepo.create({
                    user_id: userId,
                    channel: payload.channel,
                    scene_id: null,
                    kind: 'test',
                    status: 'error',
                    title,
                    message: 'Webhook URL 未配置',
                }));
                response.json((0, response_1.successResponse)({
                    success: false,
                    message: 'Webhook URL 未配置',
                    logEntry,
                }, 'test_notification_channel_success'));
                return;
            }
            sendResult = await (0, notification_sender_1.sendWebhook)({
                url: webhookUrl,
                secret,
                payload: {
                    title,
                    message: '这是一条来自 LifeOS 通知中心的测试消息。',
                    timestamp: new Date().toISOString(),
                },
            });
        }
        else {
            const logEntry = await logRepo.save(logRepo.create({
                user_id: userId,
                channel: payload.channel,
                scene_id: null,
                kind: 'test',
                status: 'error',
                title,
                message: '不支持的通知渠道类型',
            }));
            response.json((0, response_1.successResponse)({
                success: false,
                message: '不支持的通知渠道类型',
                logEntry,
            }, 'test_notification_channel_success'));
            return;
        }
        const logEntry = await logRepo.save(logRepo.create({
            user_id: userId,
            channel: payload.channel,
            scene_id: null,
            kind: 'test',
            status: sendResult.success ? 'success' : 'error',
            title,
            message: sendResult.success
                ? `${channelLabel} 测试发送成功`
                : `${channelLabel} 测试发送失败: ${sendResult.error}`,
        }));
        response.json((0, response_1.successResponse)({
            success: sendResult.success,
            message: sendResult.success
                ? `${channelLabel} 测试发送成功`
                : `${channelLabel} 测试发送失败: ${sendResult.error}`,
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
