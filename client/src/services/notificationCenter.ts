import { useSyncExternalStore } from 'react';

import type {
  NotificationCenterState,
  NotificationChannelConfig,
  NotificationChannelType,
  NotificationLogEntry,
  NotificationSceneConfig,
  NotificationSceneId,
  NotificationTestResult,
} from '../types/notifications';
import { readStorage, writeStorage } from '../utils/storage';

const STORAGE_KEY = 'lifeos_notification_center';
const EVENT_NAME = 'lifeos-notification-center';

const defaultChannels: Record<NotificationChannelType, NotificationChannelConfig> = {
  email: {
    type: 'email',
    label: '邮件通知',
    enabled: true,
    status: 'ready',
    recipient: 'owner@lifeos.local',
    senderName: 'LifeOS',
    notes: '适合日报、账单和审批提醒。',
  },
  wechatWork: {
    type: 'wechatWork',
    label: '企业微信',
    enabled: false,
    status: 'incomplete',
    webhookUrl: '',
    notes: '适合及时提醒和运维告警。',
  },
  webhook: {
    type: 'webhook',
    label: 'Webhook',
    enabled: false,
    status: 'incomplete',
    webhookUrl: '',
    secret: '',
    notes: '适合转发到自动化流程或第三方协作系统。',
  },
};

const defaultScenes: Record<NotificationSceneId, NotificationSceneConfig> = {
  'todo.reminder': {
    id: 'todo.reminder',
    label: '待办提醒',
    enabled: true,
    channels: ['email'],
    summary: '每天汇总今日待办和临近截止任务。',
    description: '用于提醒待办事项、拖延风险和当日优先级。',
  },
  'card.balance_low': {
    id: 'card.balance_low',
    label: '号卡低余额提醒',
    enabled: true,
    channels: ['email', 'wechatWork'],
    summary: '当余额低于阈值时提醒充值。',
    description: '保障常用号码不断联，适合余额低于阈值时通知。',
  },
  'card.billing_upcoming': {
    id: 'card.billing_upcoming',
    label: '号卡账单日前提醒',
    enabled: true,
    channels: ['email'],
    summary: '在账单日前若干天提醒确认扣费信息。',
    description: '帮助用户在月结日前完成余额检查和套餐核对。',
  },
  'loan.repayment_upcoming': {
    id: 'loan.repayment_upcoming',
    label: '贷款还款提醒',
    enabled: true,
    channels: ['email', 'wechatWork'],
    summary: '在还款日前提醒还款计划和金额。',
    description: '覆盖临期账单、还款计划和还款渠道确认。',
  },
  'loan.repayment_overdue': {
    id: 'loan.repayment_overdue',
    label: '贷款逾期提醒',
    enabled: true,
    channels: ['wechatWork', 'webhook'],
    summary: '账单逾期后立即发出高优先级提醒。',
    description: '覆盖逾期账单、风险提示和升级通知场景。',
  },
};

const defaultTemplates = {
  'todo.reminder': {
    sceneId: 'todo.reminder' as const,
    title: '今日待办提醒',
    body: '你今天有新的待办任务需要处理，请进入 LifeOS 查看详情。',
  },
  'card.balance_low': {
    sceneId: 'card.balance_low' as const,
    title: '号卡低余额提醒',
    body: '你的号卡余额已经低于预设阈值，请及时充值。',
  },
  'card.billing_upcoming': {
    sceneId: 'card.billing_upcoming' as const,
    title: '号卡账单日前提醒',
    body: '你的号卡即将进入账单日，请确认套餐与余额状态。',
  },
  'loan.repayment_upcoming': {
    sceneId: 'loan.repayment_upcoming' as const,
    title: '贷款还款提醒',
    body: '你有即将到期的贷款账单，请提前安排还款。',
  },
  'loan.repayment_overdue': {
    sceneId: 'loan.repayment_overdue' as const,
    title: '贷款逾期提醒',
    body: '你有已逾期的贷款账单，请尽快处理并关注风险影响。',
  },
};

function getDefaultState(): NotificationCenterState {
  return {
    channels: defaultChannels,
    scenes: defaultScenes,
    templates: defaultTemplates,
    logs: [],
  };
}

let notificationCenterCache: NotificationCenterState = readStorage<NotificationCenterState>(
  STORAGE_KEY,
  getDefaultState(),
);

function emitChange() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function saveState(nextState: NotificationCenterState) {
  notificationCenterCache = nextState;
  writeStorage(STORAGE_KEY, nextState);
  emitChange();
}

export function getNotificationCenterState() {
  return notificationCenterCache;
}

export function updateChannelConfig(
  type: NotificationChannelType,
  patch: Partial<NotificationChannelConfig>,
) {
  const state = getNotificationCenterState();
  const current = state.channels[type];
  const next: NotificationChannelConfig = {
    ...current,
    ...patch,
  };

  next.status = !next.enabled
    ? 'disabled'
    : isChannelReady(next)
      ? 'ready'
      : 'incomplete';

  saveState({
    ...state,
    channels: {
      ...state.channels,
      [type]: next,
    },
  });
}

export function updateSceneConfig(
  sceneId: NotificationSceneId,
  patch: Partial<NotificationSceneConfig>,
) {
  const state = getNotificationCenterState();

  saveState({
    ...state,
    scenes: {
      ...state.scenes,
      [sceneId]: {
        ...state.scenes[sceneId],
        ...patch,
      },
    },
  });
}

function isChannelReady(channel: NotificationChannelConfig) {
  if (channel.type === 'email') {
    return Boolean(channel.recipient);
  }

  return Boolean(channel.webhookUrl);
}

function buildLogEntry(entry: Omit<NotificationLogEntry, 'id' | 'createdAt'>): NotificationLogEntry {
  return {
    id: Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
    ...entry,
  };
}

function appendLog(logEntry: NotificationLogEntry) {
  const state = getNotificationCenterState();

  saveState({
    ...state,
    logs: [logEntry, ...state.logs].slice(0, 100),
  });
}

export function sendTestNotification(
  channel: NotificationChannelType,
  title = '通知中心测试发送',
): NotificationTestResult {
  const state = getNotificationCenterState();
  const config = state.channels[channel];
  const success = config.enabled && isChannelReady(config);
  const message = success
    ? `${config.label} 测试发送已记录。`
    : `${config.label} 未启用或配置不完整，测试发送已跳过。`;

  const logEntry = buildLogEntry({
    channel,
    sceneId: null,
    kind: 'test',
    status: success ? 'success' : 'error',
    title,
    message,
  });

  appendLog(logEntry);
  updateChannelConfig(channel, { lastTestAt: logEntry.createdAt });

  return {
    success,
    message,
    logEntry,
  };
}

export function enqueueSceneNotification(
  sceneId: NotificationSceneId,
  payload?: { message?: string; preferredChannels?: NotificationChannelType[] },
) {
  const state = getNotificationCenterState();
  const scene = state.scenes[sceneId];
  const allowedChannels = payload?.preferredChannels?.length
    ? scene.channels.filter((channel) => payload.preferredChannels?.includes(channel))
    : scene.channels;

  const results = allowedChannels.map((channel) => {
    const config = state.channels[channel];
    const isReady = scene.enabled && config.enabled && isChannelReady(config);
    const logEntry = buildLogEntry({
      channel,
      sceneId,
      kind: 'scene',
      status: isReady ? 'success' : 'skipped',
      title: scene.label,
      message: payload?.message ?? scene.summary,
    });

    appendLog(logEntry);

    return logEntry;
  });

  return results;
}

function subscribe(callback: () => void) {
  const handler = () => callback();
  const storageHandler = () => {
    notificationCenterCache = readStorage<NotificationCenterState>(STORAGE_KEY, getDefaultState());
    callback();
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', storageHandler);
  };
}

export function useNotificationCenterState() {
  return useSyncExternalStore(subscribe, getNotificationCenterState, getNotificationCenterState);
}

export function getBoundChannelCount(sceneId: NotificationSceneId) {
  const state = getNotificationCenterState();

  return state.scenes[sceneId].channels.filter((channel) => {
    const config = state.channels[channel];
    return config.enabled && isChannelReady(config);
  }).length;
}
