import { In } from 'typeorm';
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
import { sendEmail, sendWebhook, sendWechatWorkWebhook, sendDingTalkWebhook, sendFeishuWebhook, sendTelegramMessage } from '../../shared/services/notification-sender';
import { NotificationCenterChannelEntity } from './entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from './entities/notification-center-log.entity';
import { NotificationCenterSceneChannelEntity } from './entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from './entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from './entities/notification-center-template.entity';

const emailConfigSchema = z.object({
  recipient: z.string().email('请输入有效的邮箱地址').optional(),
  senderName: z.string().trim().max(64).optional(),
  webhookUrl: z.string().optional(),
  secret: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

const webhookConfigSchema = z.object({
  recipient: z.string().optional(),
  senderName: z.string().optional(),
  webhookUrl: z.string().url('请输入有效的 Webhook URL').optional(),
  secret: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

const wechatWorkConfigSchema = z.object({
  recipient: z.string().optional(),
  senderName: z.string().optional(),
  webhookUrl: z.string().url('请输入有效的企业微信 Webhook URL').optional(),
  secret: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

const dingTalkConfigSchema = z.object({
  recipient: z.string().optional(),
  senderName: z.string().optional(),
  webhookUrl: z.string().url('请输入有效的钉钉 Webhook URL').optional(),
  secret: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

const feishuConfigSchema = z.object({
  recipient: z.string().optional(),
  senderName: z.string().optional(),
  webhookUrl: z.string().url('请输入有效的飞书 Webhook URL').optional(),
  secret: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

const telegramConfigSchema = z.object({
  recipient: z.string().optional(),
  senderName: z.string().optional(),
  webhookUrl: z.string().optional(),
  secret: z.string().max(128).optional(),
  notes: z.string().max(500).optional(),
});

function validateChannelConfig(type: string, config: unknown) {
  if (type === 'email') return emailConfigSchema.parse(config ?? {});
  if (type === 'wechatWork') return wechatWorkConfigSchema.parse(config ?? {});
  if (type === 'dingTalk') return dingTalkConfigSchema.parse(config ?? {});
  if (type === 'feishu') return feishuConfigSchema.parse(config ?? {});
  if (type === 'telegram') return telegramConfigSchema.parse(config ?? {});
  return webhookConfigSchema.parse(config ?? {});
}

const channelSchema = z.object({
  type: z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook']),
  label: z.string().trim().min(1).max(64).optional(),
  enabled: z.coerce.boolean().optional(),
  status: z.enum(['ready', 'incomplete', 'disabled']).optional(),
  config: z.record(z.any()).optional(),
});

const sceneSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  channels: z.array(z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook'])).optional(),
  label: z.string().trim().max(128).optional(),
  summary: z.string().trim().max(255).optional(),
  description: z.string().trim().optional(),
});

const templateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1),
  format: z.enum(['text', 'html']).optional(),
  htmlBody: z.string().trim().max(65535).optional().nullable(),
});

/**
 * 通知场景的默认元数据。第一次进入时一次性 seed，后续新加的 scene 也会自动补齐到已有用户。
 */
const SCENE_SEED: ReadonlyArray<{
  scene_id: string;
  label: string;
  enabled: boolean;
  summary: string;
  description: string;
}> = [
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
  { scene_id: 'finance.report.monthly', label: '月度财务报告', enabled: false, summary: '', description: '' },
  { scene_id: 'travel.followup', label: '旅行归档跟进', enabled: false, summary: '', description: '' },
];

/**
 * 通知模板的默认数据。每个场景对应一份富文本模板，可在通知中心模板编辑器中调整。
 * 用 as const 保证 format 是字面量类型，与 entity 的 NotificationTemplateFormat 对齐。
 */
const TEMPLATE_SEED = [
  {
    scene_id: 'todo.reminder',
    title: '⏰ 待办提醒：{{title}}',
    body: '{{message}}\n\n截止：{{meta.dueDate}}\n优先级：{{meta.priority}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 待办提醒</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">⏰ {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 8px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px; color: #475569; margin-top: 12px;">
      <tr><td style="padding: 4px 0;">截止时间</td><td style="padding: 4px 0; font-weight: 600; color: #b45309;">{{meta.dueDate}}</td></tr>
      <tr><td style="padding: 4px 0;">优先级</td><td style="padding: 4px 0;">{{meta.priority}}</td></tr>
    </table>
  </div>
</div>`,
  },
  {
    scene_id: 'card.balance_low',
    title: '💳 号卡余额不足：{{title}}',
    body: '{{message}}\n\n当前余额：¥ {{meta.balance}}\n提醒阈值：¥ {{meta.threshold}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 号卡低余额</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">💳 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 6px;">
      <div style="font-size: 13px; color: #64748b;">当前余额</div>
      <div style="font-size: 22px; font-weight: 700; color: #b91c1c;">¥ {{meta.balance}}</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">提醒阈值：¥ {{meta.threshold}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'card.billing_upcoming',
    title: '📅 账单日临近：{{title}}',
    body: '{{message}}\n\n账单日：{{meta.billingDate}}\n金额：¥ {{meta.amount}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 账单提醒</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">📅 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #64748b;">账单日</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.billingDate}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">账单金额</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #1d4ed8;">¥ {{meta.amount}}</td></tr>
    </table>
  </div>
</div>`,
  },
  {
    scene_id: 'loan.repayment_upcoming',
    title: '🏦 贷款还款提醒：{{title}}',
    body: '{{message}}\n\n还款日：{{meta.dueDate}}\n金额：¥ {{meta.amount}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #0ea5e9, #0369a1); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 还款提醒</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">🏦 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr style="background: #f8fafc;"><td style="padding: 8px 12px; color: #64748b;">还款日</td><td style="padding: 8px 12px; font-weight: 600; text-align: right;">{{meta.dueDate}}</td></tr>
      <tr><td style="padding: 8px 12px; color: #64748b;">还款金额</td><td style="padding: 8px 12px; font-weight: 600; text-align: right; color: #0369a1;">¥ {{meta.amount}}</td></tr>
      <tr style="background: #f8fafc;"><td style="padding: 8px 12px; color: #64748b;">账户</td><td style="padding: 8px 12px; text-align: right;">{{meta.account}}</td></tr>
    </table>
  </div>
</div>`,
  },
  {
    scene_id: 'loan.repayment_overdue',
    title: '⚠️ 贷款已逾期：{{title}}',
    body: '{{message}}\n\n逾期天数：{{meta.overdueDays}} 天\n金额：¥ {{meta.amount}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #b91c1c, #7f1d1d); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .9; letter-spacing: .08em;">LifeOS · 逾期警告</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">⚠️ {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 14px;">
      <div style="font-size: 13px; color: #991b1b; font-weight: 600;">逾期 {{meta.overdueDays}} 天</div>
      <div style="font-size: 22px; font-weight: 700; color: #7f1d1d; margin-top: 4px;">¥ {{meta.amount}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'checkup.followup_reminder',
    title: '🩺 体检复查提醒：{{title}}',
    body: '{{message}}\n\n复查日期：{{meta.followupDate}}\n项目：{{meta.items}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #14b8a6, #0f766e); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 体检复查</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">🩺 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 10px 14px; border-radius: 6px;">
      <div style="font-size: 13px; color: #0f766e;">建议复查日期</div>
      <div style="font-size: 18px; font-weight: 600; color: #134e4a; margin-top: 4px;">{{meta.followupDate}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'checkup.abnormal_alert',
    title: '🚨 体检异常提醒：{{title}}',
    body: '{{message}}\n\n异常指标：{{meta.abnormalItems}}\n建议：{{meta.advice}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #f43f5e, #be123c); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 体检异常</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">🚨 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 10px 14px; font-size: 13px;">
      <div style="color: #be123c; font-weight: 600;">异常指标</div>
      <div style="color: #881337; margin-top: 4px;">{{meta.abnormalItems}}</div>
      <div style="color: #be123c; font-weight: 600; margin-top: 10px;">建议</div>
      <div style="color: #881337; margin-top: 4px;">{{meta.advice}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'medication.dose_reminder',
    title: '💊 服药提醒：{{title}}',
    body: '{{message}}\n\n药品：{{meta.drugName}}\n剂量：{{meta.dosage}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 服药提醒</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">💊 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 10px 14px; border-radius: 6px;">
      <div style="font-size: 13px; color: #6d28d9;">药品</div>
      <div style="font-size: 16px; font-weight: 600; color: #4c1d95; margin-top: 4px;">{{meta.drugName}}</div>
      <div style="font-size: 13px; color: #6d28d9; margin-top: 6px;">剂量：{{meta.dosage}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'medication.stock_low',
    title: '📦 药品库存不足：{{title}}',
    body: '{{message}}\n\n当前库存：{{meta.stock}}\n建议补货：{{meta.reorderSuggestion}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #f59e0b, #b45309); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 库存不足</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">📦 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 13px;">
      <div style="color: #92400e;">当前库存：<strong style="color: #78350f;">{{meta.stock}}</strong></div>
      <div style="color: #92400e; margin-top: 4px;">建议补货：{{meta.reorderSuggestion}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'subscription.renewal_upcoming',
    title: '🔔 订阅即将续费：{{title}}',
    body: '{{message}}\n\n续费日期：{{meta.renewalDate}}\n金额：¥ {{meta.amount}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #10b981, #047857); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 订阅续费</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">🔔 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #64748b;">续费日期</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.renewalDate}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">续费金额</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #047857;">¥ {{meta.amount}}</td></tr>
    </table>
  </div>
</div>`,
  },
  {
    scene_id: 'subscription.expired',
    title: '⏳ 订阅已到期：{{title}}',
    body: '{{message}}\n\n到期日期：{{meta.expiredDate}}\n金额：¥ {{meta.amount}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #6b7280, #374151); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 订阅到期</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">⏳ {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 10px 14px; border-radius: 6px;">
      <div style="font-size: 13px; color: #4b5563;">到期日期：{{meta.expiredDate}}</div>
      <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">未续费金额：¥ {{meta.amount}}</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: 'finance.report.monthly',
    title: '📊 {{title}}',
    body: '{{message}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 16px 22px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 财务月报</div>
    <div style="font-size: 20px; font-weight: 600; margin-top: 4px;">📊 {{title}}</div>
  </div>
  <div style="padding: 18px 22px; color: #1f2937; line-height: 1.7;">
    <pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f8fafc; border-radius: 8px; padding: 12px 14px; white-space: pre-wrap; font-size: 13px; color: #0f172a; margin: 0;">{{message}}</pre>
    <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">生成时间：{{date}}</div>
  </div>
</div>`,
  },
  {
    scene_id: 'travel.followup',
    title: '✈️ 旅行归档跟进：{{title}}',
    body: '{{message}}\n\n旅行日期：{{meta.travelDate}}\n总花费：¥ {{meta.amount}}',
    format: 'html' as const,
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #0ea5e9, #1d4ed8); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 旅行归档</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">✈️ {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #64748b;">旅行日期</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.travelDate}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">总花费</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #1d4ed8;">¥ {{meta.amount}}</td></tr>
    </table>
  </div>
</div>`,
  },
] as const;

const testChannelSchema = z.object({
  channel: z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook']),
  title: z.string().trim().min(1).max(255).optional(),
});

const sendSceneSchema = z.object({
  sceneId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).optional(),
  preferredChannels: z.array(z.enum(['email', 'wechatWork', 'dingTalk', 'feishu', 'telegram', 'webhook'])).optional(),
});

function normalizeChannelStatus(enabled: boolean, config: Record<string, unknown> | null, type: string) {
  if (!enabled) {
    return 'disabled';
  }

  if (type === 'email') {
    return config?.recipient ? 'ready' : 'incomplete';
  }

  if (type === 'telegram') {
    return (config?.recipient && config?.webhookUrl) ? 'ready' : 'incomplete';
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

    const ALL_CHANNEL_SEEDS = [
      { channel_type: 'email', label: '邮件通知', enabled: false, status: 'disabled', config_json: null },
      { channel_type: 'wechatWork', label: '企业微信', enabled: false, status: 'disabled', config_json: null },
      { channel_type: 'dingTalk', label: '钉钉', enabled: false, status: 'disabled', config_json: null },
      { channel_type: 'feishu', label: '飞书', enabled: false, status: 'disabled', config_json: null },
      { channel_type: 'telegram', label: 'Telegram', enabled: false, status: 'disabled', config_json: null },
      { channel_type: 'webhook', label: 'Webhook', enabled: false, status: 'disabled', config_json: null },
    ];

    const existingTypes = new Set(items.map((item) => item.channel_type));
    const missing = ALL_CHANNEL_SEEDS.filter((seed) => !existingTypes.has(seed.channel_type));

    if (missing.length > 0) {
      const added = await repository.save(
        missing.map((d) => repository.create({ user_id: userId, ...d })),
      );
      items = [...items, ...added];
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
      scenes = await sceneRepo.save(
        SCENE_SEED.map((d) => sceneRepo.create({ user_id: userId, ...d })),
      );
      relations = [];
    } else {
      // 用户已有场景记录，但可能在历史版本中遗漏了部分 seed 场景（如新增的 finance.report.monthly、travel.followup）。
      // 自动补齐缺失的 seed 场景，避免出现"代码里能 push 但前端看不见"的情况。
      const existingIds = new Set(scenes.map((scene) => scene.scene_id));
      const missing = SCENE_SEED.filter((seed) => !existingIds.has(seed.scene_id));
      if (missing.length > 0) {
        const created = await sceneRepo.save(
          missing.map((d) => sceneRepo.create({ user_id: userId, ...d })),
        );
        scenes = [...scenes, ...created].sort((left, right) => String(left.scene_id).localeCompare(String(right.scene_id)));
      }

      // 清理不在 SCENE_SEED 中的废弃场景（如历史遗留的外汇累计亏损预警、每日通知摘要等）
      const validIds = new Set(SCENE_SEED.map((s) => s.scene_id));
      const orphaned = scenes.filter((s) => !validIds.has(s.scene_id));
      if (orphaned.length > 0) {
        const orphanIds = orphaned.map((s) => s.id);
        await relationRepo.delete({ user_id: userId, scene_id: In(orphaned.map((o) => o.scene_id)) });
        await sceneRepo.delete(orphanIds);
        scenes = scenes.filter((s) => validIds.has(s.scene_id));
      }
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

    // 用户已有模板但可能遗漏了新增 seed（如 finance.report.monthly / travel.followup），
    // 自动补齐缺失的模板，避免前端"通知模板"tab 看不全。
    const existingIds = new Set(items.map((item) => item.scene_id));
    const missing = TEMPLATE_SEED.filter((seed) => !existingIds.has(seed.scene_id));
    if (missing.length > 0) {
      const created = await repository.save(
        missing.map((d) => repository.create({ user_id: userId, ...d })),
      );
      items = [...items, ...created].sort((left, right) => String(left.scene_id).localeCompare(String(right.scene_id)));
    }

    if (items.length === 0) {
      items = await repository.save(
        TEMPLATE_SEED.map((d) => repository.create({ user_id: userId, ...d })),
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
      format: payload.format ?? current.format ?? 'text',
      html_body: payload.htmlBody !== undefined ? payload.htmlBody : current.html_body,
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

  router.delete('/logs', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
    await logRepo.delete({ user_id: userId });
    response.json(successResponse(null, 'notification_logs_cleared'));
  }));

  router.post('/actions/test-channel', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(testChannelSchema, request.body);
    const channelRepo = appDataSource.getRepository(NotificationCenterChannelEntity);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);

    const channel = await channelRepo.findOne({
      where: { user_id: userId, channel_type: payload.channel },
    });

    const channelLabel = channel?.label ?? payload.channel;
    const title = payload.title ?? '通知中心测试发送';
    const config = channel?.config_json as Record<string, unknown> | null;

    if (!channel?.enabled) {
      const logEntry = await logRepo.save(logRepo.create({
        user_id: userId,
        channel: payload.channel,
        scene_id: null,
        kind: 'test',
        status: 'error',
        title,
        message: `${channelLabel} 未启用或配置不完整，测试发送已跳过。`,
      }));

      response.json(successResponse({
        success: false,
        message: `${channelLabel} 未启用或配置不完整，测试发送已跳过。`,
        logEntry,
      }, 'test_notification_channel_success'));
      return;
    }

    let sendResult: { success: boolean; error?: string };

    if (payload.channel === 'email') {
      const recipient = config?.recipient as string | undefined;
      if (!recipient) {
        const logEntry = await logRepo.save(logRepo.create({
          user_id: userId,
          channel: payload.channel,
          scene_id: null,
          kind: 'test',
          status: 'error',
          title,
          message: '邮件地址未配置',
        }));

        response.json(successResponse({
          success: false,
          message: '邮件地址未配置',
          logEntry,
        }, 'test_notification_channel_success'));
        return;
      }

      sendResult = await sendEmail({
        to: recipient,
        subject: title,
        text: '这是一封来自 LifeOS 通知中心的测试邮件。',
      });
    } else if (payload.channel === 'wechatWork') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      if (!webhookUrl) {
        const logEntry = await logRepo.save(logRepo.create({
          user_id: userId,
          channel: payload.channel,
          scene_id: null,
          kind: 'test',
          status: 'error',
          title,
          message: '企业微信 Webhook 地址未配置',
        }));

        response.json(successResponse({
          success: false,
          message: '企业微信 Webhook 地址未配置',
          logEntry,
        }, 'test_notification_channel_success'));
        return;
      }

      sendResult = await sendWechatWorkWebhook({
        webhookUrl,
        content: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
      });
    } else if (payload.channel === 'dingTalk') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      const secret = config?.secret as string | undefined;
      if (!webhookUrl) {
        const logEntry = await logRepo.save(logRepo.create({
          user_id: userId,
          channel: payload.channel,
          scene_id: null,
          kind: 'test',
          status: 'error',
          title,
          message: '钉钉 Webhook 地址未配置',
        }));

        response.json(successResponse({
          success: false,
          message: '钉钉 Webhook 地址未配置',
          logEntry,
        }, 'test_notification_channel_success'));
        return;
      }

      sendResult = await sendDingTalkWebhook({
        webhookUrl,
        secret,
        content: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
      });
    } else if (payload.channel === 'feishu') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      const secret = config?.secret as string | undefined;
      if (!webhookUrl) {
        const logEntry = await logRepo.save(logRepo.create({
          user_id: userId,
          channel: payload.channel,
          scene_id: null,
          kind: 'test',
          status: 'error',
          title,
          message: '飞书 Webhook 地址未配置',
        }));

        response.json(successResponse({
          success: false,
          message: '飞书 Webhook 地址未配置',
          logEntry,
        }, 'test_notification_channel_success'));
        return;
      }

      sendResult = await sendFeishuWebhook({
        webhookUrl,
        secret,
        content: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
      });
    } else if (payload.channel === 'telegram') {
      const botToken = config?.recipient as string | undefined;
      const chatId = config?.webhookUrl as string | undefined;
      if (!botToken || !chatId) {
        const logEntry = await logRepo.save(logRepo.create({
          user_id: userId,
          channel: payload.channel,
          scene_id: null,
          kind: 'test',
          status: 'error',
          title,
          message: 'Telegram Bot Token 或 Chat ID 未配置',
        }));

        response.json(successResponse({
          success: false,
          message: 'Telegram Bot Token 或 Chat ID 未配置',
          logEntry,
        }, 'test_notification_channel_success'));
        return;
      }

      sendResult = await sendTelegramMessage({
        botToken,
        chatId,
        text: `${title}\n这是一条来自 LifeOS 通知中心的测试消息。`,
      });
    } else if (payload.channel === 'webhook') {
      const webhookUrl = config?.webhookUrl as string | undefined;
      const secret = config?.secret as string | undefined;
      if (!webhookUrl) {
        const logEntry = await logRepo.save(logRepo.create({
          user_id: userId,
          channel: payload.channel,
          scene_id: null,
          kind: 'test',
          status: 'error',
          title,
          message: 'Webhook URL 未配置',
        }));

        response.json(successResponse({
          success: false,
          message: 'Webhook URL 未配置',
          logEntry,
        }, 'test_notification_channel_success'));
        return;
      }

      sendResult = await sendWebhook({
        url: webhookUrl,
        secret,
        payload: {
          title,
          message: '这是一条来自 LifeOS 通知中心的测试消息。',
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      const logEntry = await logRepo.save(logRepo.create({
        user_id: userId,
        channel: payload.channel,
        scene_id: null,
        kind: 'test',
        status: 'error',
        title,
        message: '不支持的通知渠道类型',
      }));

      response.json(successResponse({
        success: false,
        message: '不支持的通知渠道类型',
        logEntry,
      }, 'test_notification_channel_success'));
      return;
    }

    const logEntry = await logRepo.save(logRepo.create({
      user_id: userId,
      channel: payload.channel,
      scene_id: null,
      kind: 'test',
      status: sendResult.success ? 'success' : 'error',
      title,
      message: sendResult.success
        ? `${channelLabel} 测试发送成功`
        : `${channelLabel} 测试发送失败: ${sendResult.error}`,
    }));

    response.json(successResponse({
      success: sendResult.success,
      message: sendResult.success
        ? `${channelLabel} 测试发送成功`
        : `${channelLabel} 测试发送失败: ${sendResult.error}`,
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
