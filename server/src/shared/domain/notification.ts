import { appDataSource } from '../../db/data-source';
import { NotificationCenterChannelEntity } from '../../modules/notifications/entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from '../../modules/notifications/entities/notification-center-log.entity';
import { NotificationCenterSceneChannelEntity } from '../../modules/notifications/entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from '../../modules/notifications/entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from '../../modules/notifications/entities/notification-center-template.entity';

export interface SendNotificationSceneOptions {
  userId: string;
  sceneId: string;
  title?: string;
  message?: string;
  preferredChannels?: string[];
}

export async function sendNotificationSceneLogs(options: SendNotificationSceneOptions) {
  const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);
  const relationRepo = appDataSource.getRepository(NotificationCenterSceneChannelEntity);
  const channelRepo = appDataSource.getRepository(NotificationCenterChannelEntity);
  const templateRepo = appDataSource.getRepository(NotificationCenterTemplateEntity);
  const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);

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
