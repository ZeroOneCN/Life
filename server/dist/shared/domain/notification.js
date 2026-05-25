"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationSceneLogs = sendNotificationSceneLogs;
const data_source_1 = require("../../db/data-source");
const notification_center_channel_entity_1 = require("../../modules/notifications/entities/notification-center-channel.entity");
const notification_center_log_entity_1 = require("../../modules/notifications/entities/notification-center-log.entity");
const notification_center_scene_channel_entity_1 = require("../../modules/notifications/entities/notification-center-scene-channel.entity");
const notification_center_scene_entity_1 = require("../../modules/notifications/entities/notification-center-scene.entity");
const notification_center_template_entity_1 = require("../../modules/notifications/entities/notification-center-template.entity");
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
        return logRepo.save(logRepo.create({
            user_id: options.userId,
            channel: channelType,
            scene_id: scene.scene_id,
            kind: 'scene',
            status: scene.enabled && channel?.enabled ? 'success' : 'skipped',
            title,
            message,
        }));
    }));
    return logs;
}
