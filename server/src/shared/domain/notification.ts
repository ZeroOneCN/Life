import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { NotificationCenterChannelEntity } from '../../modules/notifications/entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from '../../modules/notifications/entities/notification-center-log.entity';
import { NotificationCenterSceneChannelEntity } from '../../modules/notifications/entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from '../../modules/notifications/entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from '../../modules/notifications/entities/notification-center-template.entity';
import {
  sendDingTalkWebhook,
  sendEmail,
  sendFeishuWebhook,
  sendTelegramMessage,
  sendWebhook,
  sendWechatWorkWebhook,
} from '../services/notification-sender';

export interface SendNotificationSceneOptions {
  userId: string;
  sceneId: string;
  title?: string;
  message?: string;
  /**
   * 额外元数据，可通过 {{meta.xxx}} 注入模板
   */
  meta?: Record<string, string | number | boolean | null | undefined>;
  preferredChannels?: string[];
}

export interface RenderedNotificationTemplate {
  title: string;
  /** 纯文本内容（始终返回） */
  text: string;
  /** HTML 内容（仅当 format=html 且 html_body 不为空时返回） */
  html: string | null;
  format: 'text' | 'html';
}

/**
 * 模板变量上下文。提供 {{title}} / {{message}} / {{date}} / {{userId}} / {{meta.xxx}} 等插值。
 */
export interface NotificationTemplateContext {
  userId: string;
  title: string;
  message: string;
  date: string;
  meta: Record<string, string | number | boolean | null | undefined>;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.\-]*)\s*\}\}/g;

/**
 * 将模板中 {{xxx}} 占位符替换为上下文变量值。未知变量保留为原文以方便排错。
 *
 * @param template 原始模板字符串
 * @param context  变量上下文
 * @returns 渲染后的字符串
 */
export function renderTemplateString(template: string, context: NotificationTemplateContext): string {
  if (!template) {
    return template;
  }

  return template.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = resolveTemplateKey(key, context);
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
}

function resolveTemplateKey(
  key: string,
  context: NotificationTemplateContext,
): string | number | boolean | null | undefined {
  if (key === 'userId') return context.userId;
  if (key === 'title') return context.title;
  if (key === 'message') return context.message;
  if (key === 'date') return context.date;

  if (key.startsWith('meta.')) {
    const metaKey = key.slice(5);
    if (!metaKey) return undefined;
    return context.meta[metaKey];
  }

  return undefined;
}

/**
 * 将数据库模板实体渲染为最终可发送的内容。
 *
 * @param template 模板实体（可为 null）
 * @param context  渲染上下文
 * @param fallbackTitle 无模板时的兜底标题
 * @param fallbackText  无模板时的兜底文本
 */
export function renderNotificationTemplate(
  template: NotificationCenterTemplateEntity | null,
  context: NotificationTemplateContext,
  fallbackTitle: string,
  fallbackText: string,
): RenderedNotificationTemplate {
  const title = renderTemplateString(template?.title ?? fallbackTitle, context);
  const baseText = template?.body ?? fallbackText;
  const text = renderTemplateString(baseText, context);

  if (template?.format === 'html' && template.html_body && template.html_body.trim().length > 0) {
    const html = renderTemplateString(template.html_body, context);
    return { title, text, html, format: 'html' };
  }

  return { title, text, html: null, format: template?.format ?? 'text' };
}

/**
 * 构造一个标准的模板渲染上下文。
 *
 * @param userId  当前用户 ID
 * @param title   渲染后的标题
 * @param message 渲染后的纯文本消息
 * @param meta    业务元数据
 */
export function buildTemplateContext(
  userId: string,
  title: string,
  message: string,
  meta?: Record<string, string | number | boolean | null | undefined>,
): NotificationTemplateContext {
  return {
    userId,
    title,
    message,
    date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    meta: meta ?? {},
  };
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

  // 优先使用调用方传入的 title/message，否则从模板取（模板会再次插值）
  const baseTitle = options.title ?? template?.title ?? scene.label;
  const baseMessage = options.message ?? template?.body ?? scene.summary;

  const context = buildTemplateContext(options.userId, baseTitle, baseMessage, options.meta);
  const rendered = renderNotificationTemplate(template, context, baseTitle, baseMessage);
  // 若调用方显式传了 title/message（自定义推送），允许覆盖模板渲染结果
  const finalTitle = options.title ?? rendered.title;
  const finalText = options.message ?? rendered.text;
  const finalHtml = options.message ? null : rendered.html;

  const logs = await Promise.all(targetChannelTypes.map(async (channelType) => {
    const channel = channels.find((item) => item.channel_type === channelType);
    const config = channel?.config_json as Record<string, unknown> | null;

    if (!scene.enabled) {
      return logRepo.save(logRepo.create({
        user_id: options.userId,
        channel: channelType,
        scene_id: scene.scene_id,
        kind: 'scene',
        status: 'skipped',
        title: finalTitle,
        message: `${finalText}\n[已跳过：通知场景未启用]`,
      }));
    }

    if (!channel) {
      return logRepo.save(logRepo.create({
        user_id: options.userId,
        channel: channelType,
        scene_id: scene.scene_id,
        kind: 'scene',
        status: 'skipped',
        title: finalTitle,
        message: `${finalText}\n[已跳过：渠道尚未配置]`,
      }));
    }

    if (!channel.enabled) {
      return logRepo.save(logRepo.create({
        user_id: options.userId,
        channel: channelType,
        scene_id: scene.scene_id,
        kind: 'scene',
        status: 'skipped',
        title: finalTitle,
        message: `${finalText}\n[已跳过：渠道已停用]`,
      }));
    }

    let sendResult: { success: boolean; error?: string } = { success: false, error: '未知渠道类型' };

    if (channelType === 'email') {
      const recipient = config?.recipient as string | undefined;
      if (recipient) {
        sendResult = await sendEmail({
          to: recipient,
          subject: finalTitle,
          text: finalText,
          html: finalHtml ?? undefined,
        });
      } else {
        sendResult = { success: false, error: '邮件地址未配置' };
      }
    } else if (channelType === 'wechatWork') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      if (webhookUrl) {
        sendResult = await sendWechatWorkWebhook({
          webhookUrl,
          content: finalHtml
            ? finalText
            : `${finalTitle}\n${finalText}`,
        });
      } else {
        sendResult = { success: false, error: '企业微信 Webhook 地址未配置' };
      }
    } else if (channelType === 'dingTalk') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      const secret = config?.secret as string | undefined;
      if (webhookUrl) {
        sendResult = await sendDingTalkWebhook({
          webhookUrl,
          secret,
          content: finalHtml
            ? finalText
            : `${finalTitle}\n${finalText}`,
        });
      } else {
        sendResult = { success: false, error: '钉钉 Webhook 地址未配置' };
      }
    } else if (channelType === 'feishu') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      const secret = config?.secret as string | undefined;
      if (webhookUrl) {
        sendResult = await sendFeishuWebhook({
          webhookUrl,
          secret,
          content: finalHtml
            ? finalText
            : `${finalTitle}\n${finalText}`,
        });
      } else {
        sendResult = { success: false, error: '飞书 Webhook 地址未配置' };
      }
    } else if (channelType === 'telegram') {
      const botToken = config?.recipient as string | undefined;
      const chatId = config?.webhookUrl as string | undefined;
      if (botToken && chatId) {
        sendResult = await sendTelegramMessage({
          botToken,
          chatId,
          text: finalHtml ?? finalText,
        });
      } else {
        sendResult = { success: false, error: 'Telegram Bot Token 或 Chat ID 未配置' };
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
            title: finalTitle,
            message: finalText,
            html: finalHtml,
            format: finalHtml ? 'html' : 'text',
            meta: options.meta ?? {},
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
      title: finalTitle,
      message: sendResult.success
        ? finalText
        : `发送失败: ${sendResult.error}`,
    }));
  }));

  return logs;
}
