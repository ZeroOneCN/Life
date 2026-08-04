import { EntityManager } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { FinanceSubscriptionCategoryEntity } from '../finance/entities/finance-subscription-category.entity';
import { LifeCardCarrierEntity } from '../life/entities/life-card-carrier.entity';
import { NotificationCenterChannelEntity } from '../notifications/entities/notification-center-channel.entity';
import { NotificationCenterSceneChannelEntity } from '../notifications/entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from '../notifications/entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from '../notifications/entities/notification-center-template.entity';
import {
  DEFAULT_CHANNEL_TYPES,
  NOTIFICATION_CHANNEL_TYPES,
  NOTIFICATION_SCENE_IDS,
  type NotificationChannelType,
} from '../notifications/notification-scenes';
import { SCENE_SEED } from '../notifications/scene-seed';
import { TEMPLATE_SEED } from '../notifications/template-seed';

interface ProvisionUserDefaultsOptions {
  userId: string;
  email: string;
  /** 可选：外部事务 manager，用于嵌套事务（注册流程）。不传则独立开启事务。 */
  manager?: EntityManager;
}

/**
 * 渠道元数据（label / 默认启用 / 默认状态 / config 构造器）。
 * 类型统一引用 DEFAULT_CHANNEL_TYPES，消除 3/6 渠道不一致。
 */
interface ChannelMeta {
  label: string;
  enabled: boolean;
  status: 'ready' | 'incomplete';
  buildConfig: (email: string) => Record<string, unknown>;
}

const CHANNEL_META: Record<NotificationChannelType, ChannelMeta> = {
  email: {
    label: '邮件通知',
    enabled: true,
    status: 'ready',
    buildConfig: (email) => ({
      recipient: email,
      senderName: 'LifeOS',
      notes: '适合日报、账单提醒和复查摘要。',
    }),
  },
  wechatWork: {
    label: '企业微信',
    enabled: false,
    status: 'incomplete',
    buildConfig: () => ({
      webhookUrl: '',
      notes: '适合即时提醒和高优先级通知。',
    }),
  },
  dingTalk: {
    label: '钉钉',
    enabled: false,
    status: 'incomplete',
    buildConfig: () => ({
      webhookUrl: '',
      secret: '',
      notes: '适合工作场景即时通知。',
    }),
  },
  feishu: {
    label: '飞书',
    enabled: false,
    status: 'incomplete',
    buildConfig: () => ({
      webhookUrl: '',
      secret: '',
      notes: '适合团队协作通知。',
    }),
  },
  telegram: {
    label: 'Telegram',
    enabled: false,
    status: 'incomplete',
    buildConfig: () => ({
      botToken: '',
      chatId: '',
      notes: '绑定 Telegram Bot 后自动填充。',
    }),
  },
  webhook: {
    label: 'Webhook',
    enabled: false,
    status: 'incomplete',
    buildConfig: () => ({
      webhookUrl: '',
      secret: '',
      notes: '适合转发到自动化流程。',
    }),
  },
};

/**
 * 默认场景-渠道关联（仅对默认启用的核心场景建立邮件+企业微信关联）。
 * scene_id 引用 NOTIFICATION_SCENE_IDS 常量。
 */
const DEFAULT_SCENE_CHANNELS: ReadonlyArray<{ scene: string; channel: NotificationChannelType }> = [
  { scene: NOTIFICATION_SCENE_IDS.TODO_REMINDER, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW, channel: NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK },
  { scene: NOTIFICATION_SCENE_IDS.CARD_BILLING_UPCOMING, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING, channel: NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK },
  { scene: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE, channel: NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK },
  { scene: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE, channel: NOTIFICATION_CHANNEL_TYPES.WEBHOOK },
  { scene: NOTIFICATION_SCENE_IDS.CHECKUP_FOLLOWUP_REMINDER, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.CHECKUP_FOLLOWUP_REMINDER, channel: NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK },
  { scene: NOTIFICATION_SCENE_IDS.CHECKUP_ABNORMAL_ALERT, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.MEDICATION_DOSE_REMINDER, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.MEDICATION_DOSE_REMINDER, channel: NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK },
  { scene: NOTIFICATION_SCENE_IDS.MEDICATION_STOCK_LOW, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_RENEWAL_UPCOMING, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_EXPIRED, channel: NOTIFICATION_CHANNEL_TYPES.EMAIL },
  { scene: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_EXPIRED, channel: NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK },
];

// 通知模板统一复用 TEMPLATE_SEED（20 个 HTML 富文本模板），消除 provision 双轨制。

/**
 * 默认启用场景白名单（与 SCENE_SEED 的 enabled=false 区分）。
 * 仅核心场景默认启用，其余由用户按需开启。
 */
const DEFAULT_ENABLED_SCENES = new Set<string>([
  NOTIFICATION_SCENE_IDS.TODO_REMINDER,
  NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW,
  NOTIFICATION_SCENE_IDS.CARD_BILLING_UPCOMING,
  NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING,
  NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE,
  NOTIFICATION_SCENE_IDS.CHECKUP_FOLLOWUP_REMINDER,
  NOTIFICATION_SCENE_IDS.CHECKUP_ABNORMAL_ALERT,
  NOTIFICATION_SCENE_IDS.MEDICATION_DOSE_REMINDER,
  NOTIFICATION_SCENE_IDS.MEDICATION_STOCK_LOW,
  NOTIFICATION_SCENE_IDS.SUBSCRIPTION_RENEWAL_UPCOMING,
  NOTIFICATION_SCENE_IDS.SUBSCRIPTION_EXPIRED,
]);

/** 场景默认 summary/description（核心场景覆盖 SCENE_SEED 的空值） */
const SCENE_DESCRIPTIONS: Record<string, { summary: string; description: string }> = {
  [NOTIFICATION_SCENE_IDS.TODO_REMINDER]: { summary: '每天汇总今日待办和临近截止任务。', description: '用于提醒待办事项、拖延风险和当日优先级。' },
  [NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW]: { summary: '当余额低于阈值时提醒充值。', description: '保障常用号码不断联。' },
  [NOTIFICATION_SCENE_IDS.CARD_BILLING_UPCOMING]: { summary: '在账单日前若干天提醒确认扣费信息。', description: '帮助在月结日前检查余额和套餐。' },
  [NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING]: { summary: '在还款日前提醒还款计划和金额。', description: '覆盖临期账单和还款计划。' },
  [NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE]: { summary: '账单逾期后立即发出高优先级提醒。', description: '覆盖逾期账单和风险提示。' },
  [NOTIFICATION_SCENE_IDS.CHECKUP_FOLLOWUP_REMINDER]: { summary: '在复查日期临近或逾期时发出提醒。', description: '用于追踪复查窗口。' },
  [NOTIFICATION_SCENE_IDS.CHECKUP_ABNORMAL_ALERT]: { summary: '保存异常指标时写入提醒日志。', description: '快速感知异常结果。' },
  [NOTIFICATION_SCENE_IDS.MEDICATION_DOSE_REMINDER]: { summary: '按时间段提醒服药。', description: '用于提醒用户完成当日用药安排。' },
  [NOTIFICATION_SCENE_IDS.MEDICATION_STOCK_LOW]: { summary: '当药品库存低于阈值时提醒补货。', description: '用于药品库存预警。' },
  [NOTIFICATION_SCENE_IDS.SUBSCRIPTION_RENEWAL_UPCOMING]: { summary: '在订阅进入续费窗口时发送提醒。', description: '用于软件会员和云服务续费管理。' },
  [NOTIFICATION_SCENE_IDS.SUBSCRIPTION_EXPIRED]: { summary: '在到期当天或过期后生成提醒日志。', description: '用于避免关键服务中断。' },
};

const defaultCardCarriers = [
  ['life-card-carrier-cmcc', '中国移动', '适合日常通话与流量套餐管理。'],
  ['life-card-carrier-ct', '中国电信', '适合融合套餐和长期月租号卡。'],
  ['life-card-carrier-cu', '中国联通', '适合流量卡和副卡管理。'],
  ['life-card-carrier-cbn', '中国广电', '适合作为补充型套餐与副号。'],
] as const;

const defaultSubscriptionCategories = [
  ['subscription-cat-software', '软件工具', '效率与桌面应用。'],
  ['subscription-cat-entertainment', '影音娱乐', '视频、音乐与内容订阅。'],
  ['subscription-cat-cloud', '云服务', '主机、存储与部署资源。'],
  ['subscription-cat-ai', 'AI 工具', '模型、助手与生成式服务。'],
  ['subscription-cat-dev', '开发协作', '团队协作、代码与设计工具。'],
] as const;

async function ensureNotificationChannels(manager: EntityManager, userId: string, email: string) {
  const repository = manager.getRepository(NotificationCenterChannelEntity);
  const existing = await repository.find({
    where: { user_id: userId },
  });
  const existingTypes = new Set(existing.map((item) => item.channel_type));

  const next = DEFAULT_CHANNEL_TYPES
    .filter((type) => !existingTypes.has(type))
    .map((type) => {
      const meta = CHANNEL_META[type];
      return repository.create({
        user_id: userId,
        channel_type: type,
        label: meta.label,
        enabled: meta.enabled,
        status: meta.status,
        config_json: meta.buildConfig(email),
      });
    });

  if (next.length) {
    await repository.save(next);
  }
}

async function ensureNotificationScenes(manager: EntityManager, userId: string) {
  const sceneRepo = manager.getRepository(NotificationCenterSceneEntity);
  const templateRepo = manager.getRepository(NotificationCenterTemplateEntity);
  const relationRepo = manager.getRepository(NotificationCenterSceneChannelEntity);

  const [existingScenes, existingTemplates, existingRelations] = await Promise.all([
    sceneRepo.find({ where: { user_id: userId } }),
    templateRepo.find({ where: { user_id: userId } }),
    relationRepo.find({ where: { user_id: userId } }),
  ]);

  const existingSceneIds = new Set(existingScenes.map((item) => item.scene_id));
  const existingTemplateSceneIds = new Set(existingTemplates.map((item) => item.scene_id));
  const existingRelationKeys = new Set(existingRelations.map((item) => `${item.scene_id}:${item.channel_type}`));

  // 复用 SCENE_SEED（20 个全量场景），核心场景默认启用
  const scenesToCreate = SCENE_SEED
    .filter((seed) => !existingSceneIds.has(seed.scene_id))
    .map((seed) => {
      const desc = SCENE_DESCRIPTIONS[seed.scene_id];
      return sceneRepo.create({
        user_id: userId,
        scene_id: seed.scene_id,
        label: seed.label,
        enabled: DEFAULT_ENABLED_SCENES.has(seed.scene_id),
        summary: desc?.summary ?? seed.summary,
        description: desc?.description ?? seed.description,
      });
    });

  if (scenesToCreate.length) {
    await sceneRepo.save(scenesToCreate);
  }

  // 复用 TEMPLATE_SEED（20 个 HTML 富文本模板），与通知中心 router 共用同一份种子
  const templatesToCreate = TEMPLATE_SEED
    .filter((seed) => !existingTemplateSceneIds.has(seed.scene_id))
    .map((seed) => templateRepo.create({
      user_id: userId,
      scene_id: seed.scene_id,
      title: seed.title,
      body: seed.body,
      format: seed.format,
      html_body: seed.html_body,
    }));

  if (templatesToCreate.length) {
    await templateRepo.save(templatesToCreate);
  }

  const relationsToCreate = DEFAULT_SCENE_CHANNELS
    .filter((item) => !existingRelationKeys.has(`${item.scene}:${item.channel}`))
    .map((item) => relationRepo.create({
      user_id: userId,
      scene_id: item.scene,
      channel_type: item.channel,
    }));

  if (relationsToCreate.length) {
    await relationRepo.save(relationsToCreate);
  }
}

async function ensureCardCarriers(manager: EntityManager, userId: string) {
  const repository = manager.getRepository(LifeCardCarrierEntity);
  const existingNames = new Set((await repository.find({ where: { user_id: userId } })).map((item) => item.name));
  const next = defaultCardCarriers
    .filter(([, name]) => !existingNames.has(name))
    .map(([, name, description]) => repository.create({
      user_id: userId,
      name,
      description,
    }));

  if (next.length) {
    await repository.save(next);
  }
}

async function ensureSubscriptionCategories(manager: EntityManager, userId: string) {
  const repository = manager.getRepository(FinanceSubscriptionCategoryEntity);
  const existingNames = new Set((await repository.find({ where: { user_id: userId } })).map((item) => item.name));
  const next = defaultSubscriptionCategories
    .filter(([, name]) => !existingNames.has(name))
    .map(([, name, description]) => repository.create({
      user_id: userId,
      name,
      description,
    }));

  if (next.length) {
    await repository.save(next);
  }
}

export async function provisionUserDefaults(options: ProvisionUserDefaultsOptions) {
  const run = async (manager: EntityManager) => {
    await ensureNotificationChannels(manager, options.userId, options.email);
    await ensureNotificationScenes(manager, options.userId);
    await ensureCardCarriers(manager, options.userId);
    await ensureSubscriptionCategories(manager, options.userId);
  };

  if (options.manager) {
    // 嵌套事务：复用外部 manager（TypeORM 在事务内 transaction 会用 savepoint）
    await options.manager.transaction(run);
  } else {
    await appDataSource.transaction(run);
  }
}
