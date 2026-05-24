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
    notes: '适合日报、账单、复查摘要和低频提醒。',
  },
  wechatWork: {
    type: 'wechatWork',
    label: '企业微信',
    enabled: false,
    status: 'incomplete',
    webhookUrl: '',
    notes: '适合即时提醒、异常预警和高优先级通知。',
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
    label: '借款还款提醒',
    enabled: true,
    channels: ['email', 'wechatWork'],
    summary: '在还款日前提醒还款计划和金额。',
    description: '覆盖临期账单、还款计划和还款渠道确认。',
  },
  'loan.repayment_overdue': {
    id: 'loan.repayment_overdue',
    label: '借款逾期提醒',
    enabled: true,
    channels: ['wechatWork', 'webhook'],
    summary: '账单逾期后立即发出高优先级提醒。',
    description: '覆盖逾期账单、风险提示和升级通知场景。',
  },
  'checkup.followup_reminder': {
    id: 'checkup.followup_reminder',
    label: '体检复查提醒',
    enabled: true,
    channels: ['email', 'wechatWork'],
    summary: '在复查日期临近或逾期时发出提醒。',
    description: '用于追踪异常或关注指标的复查窗口，避免遗漏后续检查。',
  },
  'checkup.abnormal_alert': {
    id: 'checkup.abnormal_alert',
    label: '体检异常指标提醒',
    enabled: true,
    channels: ['email'],
    summary: '当保存或更新异常指标时写入统一提醒日志。',
    description: '用于快速感知异常结果，并将异常档案统一纳入通知中心追踪。',
  },
  'medication.dose_reminder': {
    id: 'medication.dose_reminder',
    label: '服药提醒',
    enabled: true,
    channels: ['email', 'wechatWork'],
    summary: '按早餐、午餐、晚餐时段发送服药提醒，所有记录统一写入通知中心日志。',
    description: '用于提醒用户在指定时段完成当日服药，页面只维护时间和触发条件，渠道由通知中心统一管理。',
  },
  'medication.stock_low': {
    id: 'medication.stock_low',
    label: '低库存提醒',
    enabled: true,
    channels: ['email'],
    summary: '当药品剩余库存低于阈值时，统一写入通知中心并按渠道发送提醒。',
    description: '基于购药记录与累计服药量估算库存，只对单位一致的药品进行低库存检测。',
  },
};

const defaultTemplates: Record<NotificationSceneId, { sceneId: NotificationSceneId; title: string; body: string }> = {
  'todo.reminder': {
    sceneId: 'todo.reminder',
    title: '今日待办提醒',
    body: '你今天有新的待办任务需要处理，请进入 LifeOS 查看详情。',
  },
  'card.balance_low': {
    sceneId: 'card.balance_low',
    title: '号卡低余额提醒',
    body: '你的号卡余额已经低于预设阈值，请及时充值。',
  },
  'card.billing_upcoming': {
    sceneId: 'card.billing_upcoming',
    title: '号卡账单日前提醒',
    body: '你的号卡即将进入账单日，请确认套餐与余额状态。',
  },
  'loan.repayment_upcoming': {
    sceneId: 'loan.repayment_upcoming',
    title: '借款还款提醒',
    body: '你有即将到期的借款账单，请提前安排还款。',
  },
  'loan.repayment_overdue': {
    sceneId: 'loan.repayment_overdue',
    title: '借款逾期提醒',
    body: '你有已逾期的借款账单，请尽快处理并关注风险影响。',
  },
  'checkup.followup_reminder': {
    sceneId: 'checkup.followup_reminder',
    title: '体检复查提醒',
    body: '你有进入复查窗口的体检项目，请尽快安排复查。',
  },
  'checkup.abnormal_alert': {
    sceneId: 'checkup.abnormal_alert',
    title: '体检异常指标提醒',
    body: '你的体检档案中新增了异常或需关注指标，请及时查看。',
  },
  'medication.dose_reminder': {
    sceneId: 'medication.dose_reminder',
    title: '服药提醒',
    body: '你有一条新的服药提醒，请按计划完成早餐、午餐或晚餐时段的用药安排。',
  },
  'medication.stock_low': {
    sceneId: 'medication.stock_low',
    title: '低库存提醒',
    body: '你的药品库存已低于提醒阈值，请及时补货并更新购药记录。',
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

function isChannelReady(channel: NotificationChannelConfig) {
  if (channel.type === 'email') {
    return Boolean(channel.recipient);
  }

  return Boolean(channel.webhookUrl);
}

function normalizeChannelConfig(
  type: NotificationChannelType,
  stored?: Partial<NotificationChannelConfig>,
): NotificationChannelConfig {
  const base = defaultChannels[type];
  const next: NotificationChannelConfig = {
    ...base,
    ...stored,
    type,
  };

  next.status = !next.enabled
    ? 'disabled'
    : isChannelReady(next)
      ? 'ready'
      : 'incomplete';

  return next;
}

function normalizeSceneConfig(
  sceneId: NotificationSceneId,
  stored?: Partial<NotificationSceneConfig>,
): NotificationSceneConfig {
  const base = defaultScenes[sceneId];
  const validChannels = Array.isArray(stored?.channels)
    ? stored.channels.filter((channel): channel is NotificationChannelType => channel in defaultChannels)
    : base.channels;

  return {
    ...base,
    ...stored,
    id: sceneId,
    channels: validChannels.length ? validChannels : base.channels,
  };
}

function normalizeTemplate(sceneId: NotificationSceneId) {
  const base = defaultTemplates[sceneId];

  return {
    ...base,
    sceneId,
  };
}

function normalizeLogEntry(log: NotificationLogEntry): NotificationLogEntry {
  return {
    ...log,
    sceneId: log.sceneId && log.sceneId in defaultScenes ? log.sceneId : null,
  };
}

function normalizeNotificationCenterState(
  state: NotificationCenterState | null | undefined,
): NotificationCenterState {
  const fallback = getDefaultState();
  const storedChannels = state?.channels ?? fallback.channels;
  const storedScenes = state?.scenes ?? fallback.scenes;
  const storedTemplates = state?.templates ?? fallback.templates;

  return {
    channels: {
      email: normalizeChannelConfig('email', storedChannels.email),
      wechatWork: normalizeChannelConfig('wechatWork', storedChannels.wechatWork),
      webhook: normalizeChannelConfig('webhook', storedChannels.webhook),
    },
    scenes: {
      'todo.reminder': normalizeSceneConfig('todo.reminder', storedScenes['todo.reminder']),
      'card.balance_low': normalizeSceneConfig('card.balance_low', storedScenes['card.balance_low']),
      'card.billing_upcoming': normalizeSceneConfig('card.billing_upcoming', storedScenes['card.billing_upcoming']),
      'loan.repayment_upcoming': normalizeSceneConfig('loan.repayment_upcoming', storedScenes['loan.repayment_upcoming']),
      'loan.repayment_overdue': normalizeSceneConfig('loan.repayment_overdue', storedScenes['loan.repayment_overdue']),
      'checkup.followup_reminder': normalizeSceneConfig('checkup.followup_reminder', storedScenes['checkup.followup_reminder']),
      'checkup.abnormal_alert': normalizeSceneConfig('checkup.abnormal_alert', storedScenes['checkup.abnormal_alert']),
      'medication.dose_reminder': normalizeSceneConfig('medication.dose_reminder', storedScenes['medication.dose_reminder']),
      'medication.stock_low': normalizeSceneConfig('medication.stock_low', storedScenes['medication.stock_low']),
    },
    templates: {
      'todo.reminder': { ...normalizeTemplate('todo.reminder'), ...storedTemplates['todo.reminder'] },
      'card.balance_low': { ...normalizeTemplate('card.balance_low'), ...storedTemplates['card.balance_low'] },
      'card.billing_upcoming': { ...normalizeTemplate('card.billing_upcoming'), ...storedTemplates['card.billing_upcoming'] },
      'loan.repayment_upcoming': { ...normalizeTemplate('loan.repayment_upcoming'), ...storedTemplates['loan.repayment_upcoming'] },
      'loan.repayment_overdue': { ...normalizeTemplate('loan.repayment_overdue'), ...storedTemplates['loan.repayment_overdue'] },
      'checkup.followup_reminder': { ...normalizeTemplate('checkup.followup_reminder'), ...storedTemplates['checkup.followup_reminder'] },
      'checkup.abnormal_alert': { ...normalizeTemplate('checkup.abnormal_alert'), ...storedTemplates['checkup.abnormal_alert'] },
      'medication.dose_reminder': { ...normalizeTemplate('medication.dose_reminder'), ...storedTemplates['medication.dose_reminder'] },
      'medication.stock_low': { ...normalizeTemplate('medication.stock_low'), ...storedTemplates['medication.stock_low'] },
    },
    logs: Array.isArray(state?.logs) ? state.logs.map(normalizeLogEntry) : [],
  };
}

let notificationCenterCache: NotificationCenterState = readStorage<NotificationCenterState>(
  STORAGE_KEY,
  getDefaultState(),
);
notificationCenterCache = normalizeNotificationCenterState(notificationCenterCache);

function emitChange() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function saveState(nextState: NotificationCenterState) {
  notificationCenterCache = normalizeNotificationCenterState(nextState);
  writeStorage(STORAGE_KEY, notificationCenterCache);
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
    notificationCenterCache = normalizeNotificationCenterState(
      readStorage<NotificationCenterState>(STORAGE_KEY, getDefaultState()),
    );
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
  const scene = state.scenes[sceneId];

  if (!scene) {
    return 0;
  }

  return scene.channels.filter((channel) => {
    const config = state.channels[channel];
    return config.enabled && isChannelReady(config);
  }).length;
}
