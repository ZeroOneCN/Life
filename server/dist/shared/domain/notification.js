"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncNotificationSceneEnabled = syncNotificationSceneEnabled;
exports.syncNotificationScenesEnabled = syncNotificationScenesEnabled;
exports.sendNotificationSceneLogs = sendNotificationSceneLogs;
const data_source_1 = require("../../db/data-source");
const notification_center_channel_entity_1 = require("../../modules/notifications/entities/notification-center-channel.entity");
const notification_center_log_entity_1 = require("../../modules/notifications/entities/notification-center-log.entity");
const notification_center_scene_channel_entity_1 = require("../../modules/notifications/entities/notification-center-scene-channel.entity");
const notification_center_scene_entity_1 = require("../../modules/notifications/entities/notification-center-scene.entity");
const notification_center_template_entity_1 = require("../../modules/notifications/entities/notification-center-template.entity");
const notification_sender_1 = require("../services/notification-sender");
async function syncNotificationSceneEnabled(userId, sceneId, enabled) {
    const sceneRepo = data_source_1.appDataSource.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity);
    const scene = await sceneRepo.findOne({
        where: {
            user_id: userId,
            scene_id: sceneId,
        },
    });
    if (!scene) {
        return null;
    }
    if (scene.enabled === enabled) {
        return scene;
    }
    scene.enabled = enabled;
    return sceneRepo.save(scene);
}
async function syncNotificationScenesEnabled(userId, scenes) {
    return Promise.all(scenes.map((scene) => syncNotificationSceneEnabled(userId, scene.sceneId, scene.enabled)));
}
async function sendNotificationSceneLogs(options) {
    const sceneRepo = data_source_1.appDataSource.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity);
    const relationRepo = data_source_1.appDataSource.getRepository(notification_center_scene_channel_entity_1.NotificationCenterSceneChannelEntity);
    const channelRepo = data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
    const templateRepo = data_source_1.appDataSource.getRepository(notification_center_template_entity_1.NotificationCenterTemplateEntity);
    const logRepo = data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity);
    const scene = await sceneRepo.findOne({
        where: {
            user_id: options.userId,
            scene_id: options.sceneId,
        },
    });
    if (!scene) {
        return [];
    }
    const [relations, channels, template] = await Promise.all([
        relationRepo.find({
            where: {
                user_id: options.userId,
                scene_id: options.sceneId,
            },
        }),
        channelRepo.find({
            where: {
                user_id: options.userId,
            },
        }),
        templateRepo.findOne({
            where: {
                user_id: options.userId,
                scene_id: options.sceneId,
            },
        }),
    ]);
    const relatedChannelTypes = relations.map((item) => item.channel_type);
    const targetChannelTypes = options.preferredChannels?.length
        ? relatedChannelTypes.filter((item) => options.preferredChannels?.includes(item))
        : relatedChannelTypes;
    const title = options.title ?? template?.title ?? scene.label;
    const message = options.message ?? template?.body ?? scene.summary;
    const logs = await Promise.all(targetChannelTypes.map(async (channelType) => {
        const channel = channels.find((item) => item.channel_type === channelType);
        const config = channel?.config_json;
        if (!scene.enabled || !channel?.enabled) {
            return logRepo.save(logRepo.create({
                user_id: options.userId,
                channel: channelType,
                scene_id: scene.scene_id,
                kind: 'scene',
                status: 'skipped',
                title,
                message: message ?? '',
            }));
        }
        let sendResult = { success: false, error: '未知渠道类型' };
        if (channelType === 'email') {
            const recipient = config?.recipient;
            if (recipient) {
                sendResult = await (0, notification_sender_1.sendEmail)({
                    to: recipient,
                    subject: title ?? '',
                    text: message ?? '',
                });
            }
            else {
                sendResult = { success: false, error: '邮件地址未配置' };
            }
        }
        else if (channelType === 'wechatWork') {
            const webhookUrl = config?.webhookUrl;
            if (webhookUrl) {
                sendResult = await (0, notification_sender_1.sendWechatWorkWebhook)({
                    webhookUrl,
                    content: `${title}\n${message ?? ''}`,
                });
            }
            else {
                sendResult = { success: false, error: '企业微信 Webhook 地址未配置' };
            }
        }
        else if (channelType === 'webhook') {
            const webhookUrl = config?.webhookUrl;
            const secret = config?.secret;
            if (webhookUrl) {
                sendResult = await (0, notification_sender_1.sendWebhook)({
                    url: webhookUrl,
                    secret,
                    payload: {
                        sceneId: options.sceneId,
                        title,
                        message,
                        timestamp: new Date().toISOString(),
                    },
                });
            }
            else {
                sendResult = { success: false, error: 'Webhook URL 未配置' };
            }
        }
        return logRepo.save(logRepo.create({
            user_id: options.userId,
            channel: channelType,
            scene_id: scene.scene_id,
            kind: 'scene',
            status: sendResult.success ? 'success' : 'error',
            title,
            message: sendResult.success
                ? message ?? ''
                : `发送失败: ${sendResult.error}`,
        }));
    }));
    return logs;
}
