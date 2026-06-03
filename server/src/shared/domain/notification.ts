import { appDataSource } from '../../db/data-source';
import { NotificationCenterChannelEntity } from '../../modules/notifications/entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from '../../modules/notifications/entities/notification-center-log.entity';
import { NotificationCenterSceneChannelEntity } from '../../modules/notifications/entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from '../../modules/notifications/entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from '../../modules/notifications/entities/notification-center-template.entity';
import { sendEmail, sendWebhook, sendWechatWorkWebhook } from '../services/notification-sender';

export interface SendNotificationSceneOptions {
  userId: string;
  sceneId: string;
  title?: string;
  message?: string;
  preferredChannels?: string[];
}

export async function syncNotificationSceneEnabled(userId: string, sceneId: string, enabled: boolean) {
  const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);
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

export async function syncNotificationScenesEnabled(
  userId: string,
  scenes: Array<{ sceneId: string; enabled: boolean }>,
) {
  return Promise.all(scenes.map((scene) => syncNotificationSceneEnabled(userId, scene.sceneId, scene.enabled)));
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
    const config = channel?.config_json as Record<string, unknown> | null;

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

    let sendResult: { success: boolean; error?: string } = { success: false, error: '未知渠道类型' };

    if (channelType === 'email') {
      const recipient = config?.recipient as string | undefined;
      if (recipient) {
        sendResult = await sendEmail({
          to: recipient,
          subject: title ?? '',
          text: message ?? '',
        });
      } else {
        sendResult = { success: false, error: '邮件地址未配置' };
      }
    } else if (channelType === 'wechatWork') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      if (webhookUrl) {
        sendResult = await sendWechatWorkWebhook({
          webhookUrl,
          content: `${title}\n${message ?? ''}`,
        });
      } else {
        sendResult = { success: false, error: '企业微信 Webhook 地址未配置' };
      }
    } else if (channelType === 'webhook') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      const secret = config?.secret as string | undefined;
      if (webhookUrl) {
        sendResult = await sendWebhook({
          url: webhookUrl,
          secret,
          payload: {
            sceneId: options.sceneId,
            title,
            message,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
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
