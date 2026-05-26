import { useSyncExternalStore } from 'react';

import { apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  NotificationCenterState,
  NotificationChannelConfig,
  NotificationChannelType,
  NotificationLogEntry,
  NotificationSceneConfig,
  NotificationSceneId,
  NotificationTemplate,
  NotificationTestResult,
} from '../types/notifications';

const listeners = new Set<() => void>();

const emptyState: NotificationCenterState = {
  channels: {
    email: {
      type: 'email',
      label: '邮件通知',
      enabled: false,
      status: 'disabled',
    },
    wechatWork: {
      type: 'wechatWork',
      label: '企业微信',
      enabled: false,
      status: 'disabled',
    },
    webhook: {
      type: 'webhook',
      label: 'Webhook',
      enabled: false,
      status: 'disabled',
    },
  },
  scenes: {
    'todo.reminder': {
      id: 'todo.reminder',
      label: '待办提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'card.balance_low': {
      id: 'card.balance_low',
      label: '号卡低余额提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'card.billing_upcoming': {
      id: 'card.billing_upcoming',
      label: '号卡账单日前提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'loan.repayment_upcoming': {
      id: 'loan.repayment_upcoming',
      label: '贷款还款提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'loan.repayment_overdue': {
      id: 'loan.repayment_overdue',
      label: '贷款逾期提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'checkup.followup_reminder': {
      id: 'checkup.followup_reminder',
      label: '体检复查提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'checkup.abnormal_alert': {
      id: 'checkup.abnormal_alert',
      label: '体检异常提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'medication.dose_reminder': {
      id: 'medication.dose_reminder',
      label: '服药提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'medication.stock_low': {
      id: 'medication.stock_low',
      label: '低库存提醒',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'subscription.renewal_upcoming': {
      id: 'subscription.renewal_upcoming',
      label: '订阅即将到期',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
    'subscription.expired': {
      id: 'subscription.expired',
      label: '订阅到期或逾期',
      enabled: false,
      channels: [],
      summary: '',
      description: '',
    },
  },
  templates: {
    'todo.reminder': { sceneId: 'todo.reminder', title: '', body: '' },
    'card.balance_low': { sceneId: 'card.balance_low', title: '', body: '' },
    'card.billing_upcoming': { sceneId: 'card.billing_upcoming', title: '', body: '' },
    'loan.repayment_upcoming': { sceneId: 'loan.repayment_upcoming', title: '', body: '' },
    'loan.repayment_overdue': { sceneId: 'loan.repayment_overdue', title: '', body: '' },
    'checkup.followup_reminder': { sceneId: 'checkup.followup_reminder', title: '', body: '' },
    'checkup.abnormal_alert': { sceneId: 'checkup.abnormal_alert', title: '', body: '' },
    'medication.dose_reminder': { sceneId: 'medication.dose_reminder', title: '', body: '' },
    'medication.stock_low': { sceneId: 'medication.stock_low', title: '', body: '' },
    'subscription.renewal_upcoming': { sceneId: 'subscription.renewal_upcoming', title: '', body: '' },
    'subscription.expired': { sceneId: 'subscription.expired', title: '', body: '' },
  },
  logs: [],
};

let notificationCenterCache = emptyState;
let notificationChannelIdMap: Partial<Record<NotificationChannelType, string>> = {};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeChannelConfig(raw: {
  id: string;
  channel_type: NotificationChannelType;
  label: string;
  enabled: boolean;
  status: 'ready' | 'incomplete' | 'disabled';
  config_json: Record<string, unknown> | null;
  updated_at?: string;
}) {
  return {
    type: raw.channel_type,
    label: raw.label,
    enabled: raw.enabled,
    status: raw.status,
    recipient: typeof raw.config_json?.recipient === 'string' ? raw.config_json.recipient : '',
    senderName: typeof raw.config_json?.senderName === 'string' ? raw.config_json.senderName : '',
    webhookUrl: typeof raw.config_json?.webhookUrl === 'string' ? raw.config_json.webhookUrl : '',
    secret: typeof raw.config_json?.secret === 'string' ? raw.config_json.secret : '',
    notes: typeof raw.config_json?.notes === 'string' ? raw.config_json.notes : '',
    lastTestAt: raw.updated_at,
  } satisfies NotificationChannelConfig;
}

function normalizeSceneConfig(raw: {
  scene_id: NotificationSceneId;
  label: string;
  enabled: boolean;
  summary: string;
  description: string;
  channels: NotificationChannelType[];
}) {
  return {
    id: raw.scene_id,
    label: raw.label,
    enabled: raw.enabled,
    channels: raw.channels,
    summary: raw.summary,
    description: raw.description,
  } satisfies NotificationSceneConfig;
}

function normalizeTemplate(raw: {
  scene_id: NotificationSceneId;
  title: string;
  body: string;
}) {
  return {
    sceneId: raw.scene_id,
    title: raw.title,
    body: raw.body,
  } satisfies NotificationTemplate;
}

function normalizeLogEntry(raw: {
  id: string;
  created_at: string;
  channel: NotificationChannelType;
  scene_id: NotificationSceneId | null;
  kind: 'test' | 'scene';
  status: 'success' | 'skipped' | 'error';
  title: string;
  message: string;
}) {
  return {
    id: raw.id,
    createdAt: raw.created_at,
    channel: raw.channel,
    sceneId: raw.scene_id,
    kind: raw.kind,
    status: raw.status,
    title: raw.title,
    message: raw.message,
  } satisfies NotificationLogEntry;
}

function setNotificationCenterState(nextState: NotificationCenterState) {
  notificationCenterCache = nextState;
  emitChange();
}

export function getNotificationCenterState() {
  return notificationCenterCache;
}

export async function hydrateNotificationCenterState() {
  const [channels, scenes, templates, logs] = await Promise.all([
    apiGet<PaginatedResponse<{
      id: string;
      channel_type: NotificationChannelType;
      label: string;
      enabled: boolean;
      status: 'ready' | 'incomplete' | 'disabled';
      config_json: Record<string, unknown> | null;
      updated_at?: string;
    }>>('/notifications/channels'),
    apiGet<PaginatedResponse<{
      scene_id: NotificationSceneId;
      label: string;
      enabled: boolean;
      summary: string;
      description: string;
      channels: NotificationChannelType[];
    }>>('/notifications/scenes'),
    apiGet<PaginatedResponse<{
      scene_id: NotificationSceneId;
      title: string;
      body: string;
    }>>('/notifications/templates'),
    apiGet<PaginatedResponse<{
      id: string;
      created_at: string;
      channel: NotificationChannelType;
      scene_id: NotificationSceneId | null;
      kind: 'test' | 'scene';
      status: 'success' | 'skipped' | 'error';
      title: string;
      message: string;
    }>>('/notifications/logs', undefined, { page: 1, page_size: 100 }),
  ]);

  setNotificationCenterState({
    channels: channels.items.reduce((accumulator, item) => {
      notificationChannelIdMap[item.channel_type] = item.id;
      accumulator[item.channel_type] = normalizeChannelConfig(item);
      return accumulator;
    }, { ...emptyState.channels }),
    scenes: scenes.items.reduce((accumulator, item) => {
      accumulator[item.scene_id] = normalizeSceneConfig(item);
      return accumulator;
    }, { ...emptyState.scenes }),
    templates: templates.items.reduce((accumulator, item) => {
      accumulator[item.scene_id] = normalizeTemplate(item);
      return accumulator;
    }, { ...emptyState.templates }),
    logs: logs.items.map(normalizeLogEntry),
  });

  return notificationCenterCache;
}

export async function getNotificationLogs(params?: {
  page?: number;
  pageSize?: number;
  sceneId?: string;
  sceneIds?: string[];
  status?: string;
  channel?: string;
}) {
  const result = await apiGet<PaginatedResponse<{
    id: string;
    created_at: string;
    channel: NotificationChannelType;
    scene_id: NotificationSceneId | null;
    kind: 'test' | 'scene';
    status: 'success' | 'skipped' | 'error';
    title: string;
    message: string;
  }>>('/notifications/logs', undefined, {
    page: params?.page ?? 1,
    page_size: params?.pageSize ?? 10,
    sceneId: params?.sceneId,
    sceneIds: params?.sceneIds?.join(','),
    status: params?.status,
    channel: params?.channel,
  });

  return {
    ...result,
    items: result.items.map(normalizeLogEntry),
  };
}

export async function updateChannelConfig(
  type: NotificationChannelType,
  patch: Partial<NotificationChannelConfig>,
) {
  const current = notificationCenterCache.channels[type];
  const channelId = notificationChannelIdMap[type];

  if (!current || !channelId) {
    throw new Error(`notification_channel_not_found:${type}`);
  }

  const config = {
    recipient: patch.recipient ?? current.recipient ?? '',
    senderName: patch.senderName ?? current.senderName ?? '',
    webhookUrl: patch.webhookUrl ?? current.webhookUrl ?? '',
    secret: patch.secret ?? current.secret ?? '',
    notes: patch.notes ?? current.notes ?? '',
  };

  await apiPatch(`/notifications/channels/${channelId}`, {
    label: patch.label ?? current.label,
    enabled: patch.enabled ?? current.enabled,
    config,
  });

  await hydrateNotificationCenterState();
}

export async function updateSceneConfig(
  sceneId: NotificationSceneId,
  patch: Partial<NotificationSceneConfig>,
) {
  const current = notificationCenterCache.scenes[sceneId];
  await apiPatch(`/notifications/scenes/${sceneId}`, {
    enabled: patch.enabled ?? current.enabled,
    label: patch.label ?? current.label,
    summary: patch.summary ?? current.summary,
    description: patch.description ?? current.description,
    channels: patch.channels ?? current.channels,
  });

  await hydrateNotificationCenterState();
}

export async function updateTemplateConfig(
  sceneId: NotificationSceneId,
  patch: Partial<NotificationTemplate>,
) {
  const current = notificationCenterCache.templates[sceneId];
  await apiPatch(`/notifications/templates/${sceneId}`, {
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
  });

  await hydrateNotificationCenterState();
}

export async function sendTestNotification(
  channel: NotificationChannelType,
  title = '通知中心测试发送',
): Promise<NotificationTestResult> {
  const result = await apiPost<{
    success: boolean;
    message: string;
    logEntry: {
      id: string;
      created_at: string;
      channel: NotificationChannelType;
      scene_id: NotificationSceneId | null;
      kind: 'test' | 'scene';
      status: 'success' | 'skipped' | 'error';
      title: string;
      message: string;
    };
  }, {
    channel: NotificationChannelType;
    title: string;
  }>('/notifications/actions/test-channel', {
    channel,
    title,
  });

  await hydrateNotificationCenterState();

  return {
    success: result.success,
    message: result.message,
    logEntry: normalizeLogEntry(result.logEntry),
  };
}

export async function enqueueSceneNotification(
  sceneId: NotificationSceneId,
  payload?: { message?: string; preferredChannels?: NotificationChannelType[] },
) {
  const results = await apiPost<Array<{
    id: string;
    created_at: string;
    channel: NotificationChannelType;
    scene_id: NotificationSceneId | null;
    kind: 'test' | 'scene';
    status: 'success' | 'skipped' | 'error';
    title: string;
    message: string;
  }>, {
    sceneId: NotificationSceneId;
    message?: string;
    preferredChannels?: NotificationChannelType[];
  }>('/notifications/actions/send-scene', {
    sceneId,
    message: payload?.message,
    preferredChannels: payload?.preferredChannels,
  });

  await hydrateNotificationCenterState();
  return results.map(normalizeLogEntry);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useNotificationCenterState() {
  return useSyncExternalStore(subscribe, getNotificationCenterState, getNotificationCenterState);
}

export function getBoundChannelCount(sceneId: NotificationSceneId) {
  const scene = notificationCenterCache.scenes[sceneId];

  if (!scene) {
    return 0;
  }

  return scene.channels.filter((channel) => {
    const config = notificationCenterCache.channels[channel];
    return config?.enabled && config.status === 'ready';
  }).length;
}
