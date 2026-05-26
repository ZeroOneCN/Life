import 'reflect-metadata';

import bcrypt from 'bcrypt';

import { appDataSource } from './data-source';
import { FinanceSubscriptionCategoryEntity } from '../modules/finance/entities/finance-subscription-category.entity';
import { LifeCardCarrierEntity } from '../modules/life/entities/life-card-carrier.entity';
import { NotificationCenterChannelEntity } from '../modules/notifications/entities/notification-center-channel.entity';
import { NotificationCenterSceneChannelEntity } from '../modules/notifications/entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from '../modules/notifications/entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from '../modules/notifications/entities/notification-center-template.entity';
import { SystemUserAccountEntity } from '../modules/system/entities/system-user-account.entity';
import { SystemUserProfileEntity } from '../modules/system/entities/system-user-profile.entity';

const defaultUserId = 'user-001';

const notificationChannels = [
  {
    id: 'notification-channel-email',
    user_id: defaultUserId,
    channel_type: 'email',
    label: '邮件通知',
    enabled: true,
    status: 'ready',
    config_json: {
      recipient: 'owner@lifeos.local',
      senderName: 'LifeOS',
      notes: '适合日报、账单和复查摘要。',
    },
  },
  {
    id: 'notification-channel-wechat-work',
    user_id: defaultUserId,
    channel_type: 'wechatWork',
    label: '企业微信',
    enabled: false,
    status: 'incomplete',
    config_json: {
      webhookUrl: '',
      notes: '适合即时提醒和高优先级通知。',
    },
  },
  {
    id: 'notification-channel-webhook',
    user_id: defaultUserId,
    channel_type: 'webhook',
    label: 'Webhook',
    enabled: false,
    status: 'incomplete',
    config_json: {
      webhookUrl: '',
      secret: '',
      notes: '适合转发到自动化流程。',
    },
  },
];

const notificationScenes = [
  ['todo.reminder', '待办提醒', true, '每天汇总今日待办和临近截止任务。', '用于提醒待办事项、拖延风险和当日优先级。'],
  ['card.balance_low', '号卡低余额提醒', true, '当余额低于阈值时提醒充值。', '保障常用号码不断联。'],
  ['card.billing_upcoming', '号卡账单日前提醒', true, '在账单日前若干天提醒确认扣费信息。', '帮助用户在月结日前检查余额和套餐。'],
  ['loan.repayment_upcoming', '贷款还款提醒', true, '在还款日前提醒还款计划和金额。', '覆盖临期账单和还款计划。'],
  ['loan.repayment_overdue', '贷款逾期提醒', true, '账单逾期后立即发出高优先级提醒。', '覆盖逾期账单和风险提示。'],
  ['checkup.followup_reminder', '体检复查提醒', true, '在复查日期临近或逾期时发出提醒。', '用于追踪复查窗口。'],
  ['checkup.abnormal_alert', '体检异常指标提醒', true, '保存异常指标时写入提醒日志。', '快速感知异常结果。'],
  ['medication.dose_reminder', '服药提醒', true, '按时间段提醒服药。', '用于提醒用户完成当日用药安排。'],
  ['medication.stock_low', '低库存提醒', true, '当药品库存低于阈值时提醒补货。', '用于药品库存预警。'],
  ['subscription.renewal_upcoming', '订阅即将到期', true, '在订阅进入续费窗口时发送提醒。', '用于软件会员和云服务续费管理。'],
  ['subscription.expired', '订阅到期或逾期', true, '在到期当天或过期后生成提醒日志。', '用于避免关键服务中断。'],
] as const;

const sceneChannels = [
  ['todo.reminder', 'email'],
  ['card.balance_low', 'email'],
  ['card.balance_low', 'wechatWork'],
  ['card.billing_upcoming', 'email'],
  ['loan.repayment_upcoming', 'email'],
  ['loan.repayment_upcoming', 'wechatWork'],
  ['loan.repayment_overdue', 'wechatWork'],
  ['loan.repayment_overdue', 'webhook'],
  ['checkup.followup_reminder', 'email'],
  ['checkup.followup_reminder', 'wechatWork'],
  ['checkup.abnormal_alert', 'email'],
  ['medication.dose_reminder', 'email'],
  ['medication.dose_reminder', 'wechatWork'],
  ['medication.stock_low', 'email'],
  ['subscription.renewal_upcoming', 'email'],
  ['subscription.expired', 'email'],
  ['subscription.expired', 'wechatWork'],
] as const;

const notificationTemplates = [
  ['todo.reminder', '今日待办提醒', '你今天有新的待办任务需要处理，请进入 LifeOS 查看详情。'],
  ['card.balance_low', '号卡低余额提醒', '你的号卡余额已经低于预设阈值，请及时充值。'],
  ['card.billing_upcoming', '号卡账单日前提醒', '你的号卡即将进入账单日，请确认套餐与余额状态。'],
  ['loan.repayment_upcoming', '贷款还款提醒', '你有即将到期的贷款账单，请提前安排还款。'],
  ['loan.repayment_overdue', '贷款逾期提醒', '你有已逾期的贷款账单，请尽快处理并关注风险影响。'],
  ['checkup.followup_reminder', '体检复查提醒', '你有进入复查窗口的体检项目，请尽快安排复查。'],
  ['checkup.abnormal_alert', '体检异常指标提醒', '你的体检档案中新增了异常或需关注指标，请及时查看。'],
  ['medication.dose_reminder', '服药提醒', '你有一条新的服药提醒，请按计划完成用药安排。'],
  ['medication.stock_low', '低库存提醒', '你的药品库存已经低于提醒阈值，请及时补货。'],
  ['subscription.renewal_upcoming', '服务订阅即将到期', '检测到订阅进入续费提醒窗口，请及时确认是否续费。'],
  ['subscription.expired', '服务订阅已到期', '检测到订阅已到期或已逾期，请尽快处理。'],
] as const;

const cardCarriers = [
  ['life-card-carrier-cmcc', '中国移动', '适合日常通话与流量套餐管理。'],
  ['life-card-carrier-ct', '中国电信', '适合融合套餐和长期月租号卡。'],
  ['life-card-carrier-cu', '中国联通', '适合流量卡和副卡管理。'],
  ['life-card-carrier-cbn', '中国广电', '适合作为补充型套餐与副号。'],
] as const;

const subscriptionCategories = [
  ['subscription-cat-software', '软件工具', '效率与桌面应用。'],
  ['subscription-cat-entertainment', '影音娱乐', '视频、音乐与内容订阅。'],
  ['subscription-cat-cloud', '云服务', '主机、存储与部署资源。'],
  ['subscription-cat-ai', 'AI 工具', '模型、助手与生成式服务。'],
  ['subscription-cat-dev', '开发协作', '团队协作、代码与设计工具。'],
] as const;

async function seed() {
  await appDataSource.initialize();

  const userRepo = appDataSource.getRepository(SystemUserAccountEntity);
  const profileRepo = appDataSource.getRepository(SystemUserProfileEntity);
  const channelRepo = appDataSource.getRepository(NotificationCenterChannelEntity);
  const sceneRepo = appDataSource.getRepository(NotificationCenterSceneEntity);
  const templateRepo = appDataSource.getRepository(NotificationCenterTemplateEntity);
  const sceneChannelRepo = appDataSource.getRepository(NotificationCenterSceneChannelEntity);
  const carrierRepo = appDataSource.getRepository(LifeCardCarrierEntity);
  const categoryRepo = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);

  const defaultPasswordHash = await bcrypt.hash('12345678', 10);

  await userRepo.save({
    id: defaultUserId,
    username: 'demo',
    email: 'demo@lifeos.local',
    password_hash: defaultPasswordHash,
    is_active: true,
  });

  await profileRepo.save({
    id: defaultUserId,
    user_id: defaultUserId,
    nickname: 'LifeOS Demo',
    avatar_url: '',
    timezone: 'Asia/Shanghai',
  });

  for (const item of notificationChannels) {
    await channelRepo.save(item);
  }

  for (const [sceneId, label, enabled, summary, description] of notificationScenes) {
    await sceneRepo.save({
      id: `${defaultUserId}-${sceneId}`,
      user_id: defaultUserId,
      scene_id: sceneId,
      label,
      enabled,
      summary,
      description,
    });
  }

  for (const [sceneId, channelType] of sceneChannels) {
    await sceneChannelRepo.save({
      id: `${defaultUserId}-${sceneId}-${channelType}`,
      user_id: defaultUserId,
      scene_id: sceneId,
      channel_type: channelType,
    });
  }

  for (const [sceneId, title, body] of notificationTemplates) {
    await templateRepo.save({
      id: `${defaultUserId}-${sceneId}`,
      user_id: defaultUserId,
      scene_id: sceneId,
      title,
      body,
    });
  }

  for (const [id, name, description] of cardCarriers) {
    await carrierRepo.save({
      id,
      user_id: defaultUserId,
      name,
      description,
    });
  }

  for (const [id, name, description] of subscriptionCategories) {
    await categoryRepo.save({
      id,
      user_id: defaultUserId,
      name,
      description,
    });
  }

  await appDataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('Seed completed');
}

void seed();
