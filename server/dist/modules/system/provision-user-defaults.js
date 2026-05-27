"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionUserDefaults = provisionUserDefaults;
const data_source_1 = require("../../db/data-source");
const finance_subscription_category_entity_1 = require("../finance/entities/finance-subscription-category.entity");
const life_card_carrier_entity_1 = require("../life/entities/life-card-carrier.entity");
const notification_center_channel_entity_1 = require("../notifications/entities/notification-center-channel.entity");
const notification_center_scene_channel_entity_1 = require("../notifications/entities/notification-center-scene-channel.entity");
const notification_center_scene_entity_1 = require("../notifications/entities/notification-center-scene.entity");
const notification_center_template_entity_1 = require("../notifications/entities/notification-center-template.entity");
const defaultChannels = [
    {
        suffix: 'channel-email',
        type: 'email',
        label: '邮件通知',
        enabled: true,
        status: 'ready',
        buildConfig: (email) => ({
            recipient: email,
            senderName: 'LifeOS',
            notes: '适合日报、账单提醒和复查摘要。',
        }),
    },
    {
        suffix: 'channel-wechat-work',
        type: 'wechatWork',
        label: '企业微信',
        enabled: false,
        status: 'incomplete',
        buildConfig: () => ({
            webhookUrl: '',
            notes: '适合即时提醒和高优先级通知。',
        }),
    },
    {
        suffix: 'channel-webhook',
        type: 'webhook',
        label: 'Webhook',
        enabled: false,
        status: 'incomplete',
        buildConfig: () => ({
            webhookUrl: '',
            secret: '',
            notes: '适合转发到自动化流程。',
        }),
    },
];
const defaultScenes = [
    ['todo.reminder', '待办提醒', true, '每天汇总今日待办和临近截止任务。', '用于提醒待办事项、拖延风险和当日优先级。'],
    ['card.balance_low', '号卡低余额提醒', true, '当余额低于阈值时提醒充值。', '保障常用号码不断联。'],
    ['card.billing_upcoming', '号卡账单日前提醒', true, '在账单日前若干天提醒确认扣费信息。', '帮助在月结日前检查余额和套餐。'],
    ['loan.repayment_upcoming', '贷款还款提醒', true, '在还款日前提醒还款计划和金额。', '覆盖临期账单和还款计划。'],
    ['loan.repayment_overdue', '贷款逾期提醒', true, '账单逾期后立即发出高优先级提醒。', '覆盖逾期账单和风险提示。'],
    ['checkup.followup_reminder', '体检复查提醒', true, '在复查日期临近或逾期时发出提醒。', '用于追踪复查窗口。'],
    ['checkup.abnormal_alert', '体检异常指标提醒', true, '保存异常指标时写入提醒日志。', '快速感知异常结果。'],
    ['medication.dose_reminder', '服药提醒', true, '按时间段提醒服药。', '用于提醒用户完成当日用药安排。'],
    ['medication.stock_low', '低库存提醒', true, '当药品库存低于阈值时提醒补货。', '用于药品库存预警。'],
    ['subscription.renewal_upcoming', '订阅即将到期', true, '在订阅进入续费窗口时发送提醒。', '用于软件会员和云服务续费管理。'],
    ['subscription.expired', '订阅到期或逾期', true, '在到期当天或过期后生成提醒日志。', '用于避免关键服务中断。'],
];
const defaultSceneChannels = [
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
];
const defaultTemplates = [
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
];
const defaultCardCarriers = [
    ['life-card-carrier-cmcc', '中国移动', '适合日常通话与流量套餐管理。'],
    ['life-card-carrier-ct', '中国电信', '适合融合套餐和长期月租号卡。'],
    ['life-card-carrier-cu', '中国联通', '适合流量卡和副卡管理。'],
    ['life-card-carrier-cbn', '中国广电', '适合作为补充型套餐与副号。'],
];
const defaultSubscriptionCategories = [
    ['subscription-cat-software', '软件工具', '效率与桌面应用。'],
    ['subscription-cat-entertainment', '影音娱乐', '视频、音乐与内容订阅。'],
    ['subscription-cat-cloud', '云服务', '主机、存储与部署资源。'],
    ['subscription-cat-ai', 'AI 工具', '模型、助手与生成式服务。'],
    ['subscription-cat-dev', '开发协作', '团队协作、代码与设计工具。'],
];
async function ensureNotificationChannels(manager, userId, email) {
    const repository = manager.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity);
    const existing = await repository.find({
        where: { user_id: userId },
    });
    const existingTypes = new Set(existing.map((item) => item.channel_type));
    const next = defaultChannels
        .filter((item) => !existingTypes.has(item.type))
        .map((item) => repository.create({
        id: `${userId}-${item.suffix}`,
        user_id: userId,
        channel_type: item.type,
        label: item.label,
        enabled: item.enabled,
        status: item.status,
        config_json: item.buildConfig(email),
    }));
    if (next.length) {
        await repository.save(next);
    }
}
async function ensureNotificationScenes(manager, userId) {
    const sceneRepo = manager.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity);
    const templateRepo = manager.getRepository(notification_center_template_entity_1.NotificationCenterTemplateEntity);
    const relationRepo = manager.getRepository(notification_center_scene_channel_entity_1.NotificationCenterSceneChannelEntity);
    const [existingScenes, existingTemplates, existingRelations] = await Promise.all([
        sceneRepo.find({ where: { user_id: userId } }),
        templateRepo.find({ where: { user_id: userId } }),
        relationRepo.find({ where: { user_id: userId } }),
    ]);
    const existingSceneIds = new Set(existingScenes.map((item) => item.scene_id));
    const existingTemplateSceneIds = new Set(existingTemplates.map((item) => item.scene_id));
    const existingRelationKeys = new Set(existingRelations.map((item) => `${item.scene_id}:${item.channel_type}`));
    const scenesToCreate = defaultScenes
        .filter(([sceneId]) => !existingSceneIds.has(sceneId))
        .map(([sceneId, label, enabled, summary, description]) => sceneRepo.create({
        id: `${userId}-${sceneId}`,
        user_id: userId,
        scene_id: sceneId,
        label,
        enabled,
        summary,
        description,
    }));
    if (scenesToCreate.length) {
        await sceneRepo.save(scenesToCreate);
    }
    const templatesToCreate = defaultTemplates
        .filter(([sceneId]) => !existingTemplateSceneIds.has(sceneId))
        .map(([sceneId, title, body]) => templateRepo.create({
        id: `${userId}-${sceneId}`,
        user_id: userId,
        scene_id: sceneId,
        title,
        body,
    }));
    if (templatesToCreate.length) {
        await templateRepo.save(templatesToCreate);
    }
    const relationsToCreate = defaultSceneChannels
        .filter(([sceneId, channelType]) => !existingRelationKeys.has(`${sceneId}:${channelType}`))
        .map(([sceneId, channelType]) => relationRepo.create({
        id: `${userId}-${sceneId}-${channelType}`,
        user_id: userId,
        scene_id: sceneId,
        channel_type: channelType,
    }));
    if (relationsToCreate.length) {
        await relationRepo.save(relationsToCreate);
    }
}
async function ensureCardCarriers(manager, userId) {
    const repository = manager.getRepository(life_card_carrier_entity_1.LifeCardCarrierEntity);
    const existingIds = new Set((await repository.find({ where: { user_id: userId } })).map((item) => item.id));
    const next = defaultCardCarriers
        .filter(([id]) => !existingIds.has(`${userId}-${id}`))
        .map(([id, name, description]) => repository.create({
        id: `${userId}-${id}`,
        user_id: userId,
        name,
        description,
    }));
    if (next.length) {
        await repository.save(next);
    }
}
async function ensureSubscriptionCategories(manager, userId) {
    const repository = manager.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
    const existingIds = new Set((await repository.find({ where: { user_id: userId } })).map((item) => item.id));
    const next = defaultSubscriptionCategories
        .filter(([id]) => !existingIds.has(`${userId}-${id}`))
        .map(([id, name, description]) => repository.create({
        id: `${userId}-${id}`,
        user_id: userId,
        name,
        description,
    }));
    if (next.length) {
        await repository.save(next);
    }
}
async function provisionUserDefaults(options) {
    await data_source_1.appDataSource.transaction(async (manager) => {
        await ensureNotificationChannels(manager, options.userId, options.email);
        await ensureNotificationScenes(manager, options.userId);
        await ensureCardCarriers(manager, options.userId);
        await ensureSubscriptionCategories(manager, options.userId);
    });
}
