import { Router } from 'express';
import { z } from 'zod';

import { appDataSource } from '../../db/data-source';
import { AppError } from '../../shared/errors/app-error';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { buildListData, successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { parsePagination } from '../../shared/utils/pagination';
import { NotificationCenterChannelEntity } from './entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from './entities/notification-center-log.entity';
import { NotificationCenterSceneChannelEntity } from './entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from './entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from './entities/notification-center-template.entity';

const channelSchema = z.object({
  type: z.enum(['email', 'wechatWork', 'webhook']),
  label: z.string().trim().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(['ready', 'incomplete', 'disabled']).optional(),
  config: z.record(z.any()).optional(),
});

const sceneSchema = z.object({
  enabled: z.boolean().optional(),
  channels: z.array(z.enum(['email', 'wechatWork', 'webhook'])).optional(),
  label: z.string().trim().min(1).max(128).optional(),
  summary: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().min(1).optional(),
});

const templateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
});

const testChannelSchema = z.object({
  channel: z.enum(['email', 'wechatWork', 'webhook']),
  title: z.string().trim().min(1).max(255).optional(),
});

const sendSceneSchema = z.object({
  sceneId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).optional(),
  preferredChannels: z.array(z.enum(['email', 'wechatWork', 'webhook'])).optional(),
});

function normalizeChannelStatus(enabled: boolean, config: Record<string, unknown> | null, type: string) {
  if (!enabled) {
    return 'disabled';
  }

  if (type === 'email') {
    return config?.recipient ? 'ready' : 'incomplete';
  }

  return config?.webhookUrl ? 'ready' : 'incomplete';
}

export function createNotificationCenterRouter() {
  const router = Router();

  router.get('/channels', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(NotificationCenterChannelEntity);
    let items = await repository.find({
      where: { user_id: userId },
      order: { channel_type: 'ASC' },
    });

    if (items.length === 0) {
      const defaults = [
        { channel_type: 'email', label: '邮件通知', enabled: false, status: 'disabled', config_json: null },
        { channel_type: 'wechatWork', label: '企业微信', enabled: false, status: 'disabled', config_json: null },
        { channel_type: 'webhook', label: 'Webhook', enabled: false, status: 'disabled', config_json: null },
      ];
      items = await repository.save(
        defaults.map((d) => repository.create({ user_id: userId, ...d })),
      );
    }

    response.json(successResponse(buildListData(items)));
  }));

  router.post('/channels', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(channelSchema, request.body);
    const repository = appDataSource.getRepository(NotificationCenterChannelEntity);

    const item = await repository.save(repository.create({
      user_id: userId,
      channel_type: payload.type,
      label: payload.label ?? payload.type,
      enabled: payload.enabled ?? true,
      status: normalizeChannelStatus(payload.enabled ?? true, payload.config ?? null, payload.type),
      config_json: payload.config ?? null,
    }));

    response.json(successResponse(item, 'create_notification_channel_success'));
  }));

  router.patch('/channels/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const channelId = String(request.params.id ?? '');
    const payload = validateBody(channelSchema.partial().omit({ type: true }), request.body);
    const repository = appDataSource.getRepository(NotificationCenterChannelEntity);
    const current = await repository.findOne({
      where: { id: channelId, user_id: userId },
    });

    if (!current) {
      throw new AppError('notification_channel_not_found', 404, 404);
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

    response.json(successResponse(next, 'update_notification_channel_success'));
  }));

  router.get('/scenes', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);
    const relationRepo = appDataSource.getRepository(NotificationCenterSceneChannelEntity);
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
      scenes = await sceneRepo.save(
        defaults.map((d) => sceneRepo.create({ user_id: userId, ...d })),
      );
      relations = [];
    }

    const items = scenes.map((scene) => ({
      ...scene,
      channels: relations
        .filter((relation) => relation.scene_id === scene.scene_id)
        .map((relation) => relation.channel_type),
    }));

    response.json(successResponse(buildListData(items)));
  }));

  router.patch('/scenes/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const sceneId = String(request.params.id ?? '');
    const payload = validateBody(sceneSchema, request.body);
    const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);
    const relationRepo = appDataSource.getRepository(NotificationCenterSceneChannelEntity);
    const current = await sceneRepo.findOne({
      where: { scene_id: sceneId, user_id: userId },
    });

    if (!current) {
      throw new AppError('notification_scene_not_found', 404, 404);
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

    response.json(successResponse({
      ...next,
      channels,
    }, 'update_notification_scene_success'));
  }));

  router.get('/templates', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(NotificationCenterTemplateEntity);
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
      items = await repository.save(
        defaults.map((d) => repository.create({ user_id: userId, ...d })),
      );
    }

    response.json(successResponse(buildListData(items)));
  }));

  router.patch('/templates/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const sceneId = String(request.params.id ?? '');
    const payload = validateBody(templateSchema, request.body);
    const repository = appDataSource.getRepository(NotificationCenterTemplateEntity);
    const current = await repository.findOne({
      where: { scene_id: sceneId, user_id: userId },
    });

    if (!current) {
      throw new AppError('notification_template_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      title: payload.title,
      body: payload.body,
    });

    response.json(successResponse(next, 'update_notification_template_success'));
  }));

  router.get('/logs', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const sceneId = String(request.query.sceneId ?? '').trim();
    const sceneIds = String(request.query.sceneIds ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const status = String(request.query.status ?? '').trim();
    const channel = String(request.query.channel ?? '').trim();
    const repository = appDataSource.getRepository(NotificationCenterLogEntity);
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

    response.json(successResponse(buildListData(
      filtered.slice(skip, skip + pageSize),
      page,
      pageSize,
      filtered.length,
    )));
  }));

  router.post('/actions/test-channel', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(testChannelSchema, request.body);
    const channelRepo = appDataSource.getRepository(NotificationCenterChannelEntity);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);

    const channel = await channelRepo.findOne({
      where: { user_id: userId, channel_type: payload.channel },
    });

    const success = Boolean(channel?.enabled);
    const channelLabel = channel?.label ?? payload.channel;
    const message = success
      ? `${channelLabel} 测试发送已记录。`
      : `${channelLabel} 未启用或配置不完整，测试发送已跳过。`;

    const logEntry = await logRepo.save(logRepo.create({
      user_id: userId,
      channel: payload.channel,
      scene_id: null,
      kind: 'test',
      status: success ? 'success' : 'error',
      title: payload.title ?? '通知中心测试发送',
      message,
    }));

    response.json(successResponse({
      success,
      message,
      logEntry,
    }, 'test_notification_channel_success'));
  }));

  router.post('/actions/send-scene', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(sendSceneSchema, request.body);
    const logs = await sendNotificationSceneLogs({
      userId,
      sceneId: payload.sceneId,
      message: payload.message,
      preferredChannels: payload.preferredChannels,
    });

    response.json(successResponse(logs, 'send_notification_scene_success'));
  }));

  return router;
}
