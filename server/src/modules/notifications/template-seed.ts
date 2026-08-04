/**
 * 通知模板的默认数据种子（唯一真相源）。
 *
 * 每个场景对应一份富文本模板，可在通知中心模板编辑器中调整。
 * 抽取到独立文件是为了让 provision-user-defaults.ts 与 notification-center.router.ts
 * 复用同一份种子数据，消除 provision 双轨制（纯文本模板 vs HTML 富文本模板）。
 *
 * 用 as const 保证 format 是字面量类型，与 entity 的 NotificationTemplateFormat 对齐。
 */
import { NOTIFICATION_SCENE_IDS } from './notification-scenes';

export interface NotificationTemplateSeed {
  scene_id: string;
  title: string;
  body: string;
  format: 'text' | 'html';
  html_body: string;
}

export const TEMPLATE_SEED: ReadonlyArray<NotificationTemplateSeed> = [
  {
    scene_id: NOTIFICATION_SCENE_IDS.TODO_REMINDER,
    title: '⏰ 待办提醒：{{title}}',
    body: '{{message}}\n\n截止：{{meta.dueDate}}\n优先级：{{meta.priority}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW,
    title: '💳 号卡余额不足：{{title}}',
    body: '{{message}}\n\n当前余额：¥ {{meta.balance}}\n提醒阈值：¥ {{meta.threshold}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.CARD_BILLING_UPCOMING,
    title: '📅 账单日临近：{{title}}',
    body: '{{message}}\n\n账单日：{{meta.billingDate}}\n金额：¥ {{meta.amount}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING,
    title: '🏦 贷款还款提醒：{{title}}',
    body: '{{message}}\n\n还款日：{{meta.dueDate}}\n金额：¥ {{meta.amount}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE,
    title: '⚠️ 贷款已逾期：{{title}}',
    body: '{{message}}\n\n逾期天数：{{meta.overdueDays}} 天\n金额：¥ {{meta.amount}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.CHECKUP_FOLLOWUP_REMINDER,
    title: '🩺 体检复查提醒：{{title}}',
    body: '{{message}}\n\n复查日期：{{meta.followupDate}}\n项目：{{meta.items}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.CHECKUP_ABNORMAL_ALERT,
    title: '🚨 体检异常提醒：{{title}}',
    body: '{{message}}\n\n异常指标：{{meta.abnormalItems}}\n建议：{{meta.advice}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.MEDICATION_DOSE_REMINDER,
    title: '💊 服药提醒：{{title}}',
    body: '{{message}}\n\n药品：{{meta.drugName}}\n剂量：{{meta.dosage}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.MEDICATION_STOCK_LOW,
    title: '📦 药品库存不足：{{title}}',
    body: '{{message}}\n\n当前库存：{{meta.stock}}\n建议补货：{{meta.reorderSuggestion}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_RENEWAL_UPCOMING,
    title: '🔔 订阅即将续费：{{title}}',
    body: '{{message}}\n\n续费日期：{{meta.renewalDate}}\n金额：¥ {{meta.amount}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_EXPIRED,
    title: '⏳ 订阅已到期：{{title}}',
    body: '{{message}}\n\n到期日期：{{meta.expiredDate}}\n金额：¥ {{meta.amount}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_REPORT_MONTHLY,
    title: '📊 {{title}}',
    body: '{{message}}',
    format: 'html',
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
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BUDGET_WARNING,
    title: '⚠️ 预算预警：{{title}}',
    body: '{{message}}\n\n预算金额：¥ {{meta.budgetAmount}}\n实际支出：¥ {{meta.actualAmount}}\n进度：{{meta.progressPercent}}%\n分类：{{meta.categoryName}}',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #fbbf24; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 预算预警</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">⚠️ {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #64748b;">预算金额</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">¥ {{meta.budgetAmount}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">实际支出</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #d97706;">¥ {{meta.actualAmount}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">进度</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #d97706;">{{meta.progressPercent}}%</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">分类</td><td style="padding: 4px 0; text-align: right;">{{meta.categoryName}}</td></tr>
    </table>
  </div>
</div>`,
  },
  {
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BUDGET_OVERSPEND,
    title: '🚨 预算超支：{{title}}',
    body: '{{message}}\n\n预算金额：¥ {{meta.budgetAmount}}\n实际支出：¥ {{meta.actualAmount}}\n超支金额：¥ {{meta.overAmount}}\n分类：{{meta.categoryName}}',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #ef4444; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 预算超支</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">🚨 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #64748b;">预算金额</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">¥ {{meta.budgetAmount}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">实际支出</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #dc2626;">¥ {{meta.actualAmount}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">超支金额</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #dc2626;">¥ {{meta.overAmount}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">分类</td><td style="padding: 4px 0; text-align: right;">{{meta.categoryName}}</td></tr>
    </table>
  </div>
</div>`,
  },
  {
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING,
    title: '📅 账单提醒：{{title}}',
    body: '{{message}}\n\n账单数量：{{meta.billCount}}\n待付总金额：¥ {{meta.totalAmount}}\n提醒天数：{{meta.leadDays}} 天',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 账单提醒</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">📅 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px; white-space: pre-line;">{{message}}</p>
    <div style="background: #eef2ff; border-left: 4px solid #6366f1; padding: 10px 14px; border-radius: 6px; margin-top: 12px;">
      <div style="font-size: 13px; color: #64748b;">待付总金额</div>
      <div style="font-size: 22px; font-weight: 700; color: #4338ca;">¥ {{meta.totalAmount}}</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">共 {{meta.billCount}} 笔账单</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BILL_OVERDUE,
    title: '⚠️ 账单逾期：{{title}}',
    body: '{{message}}\n\n逾期数量：{{meta.overdueCount}}\n逾期金额：¥ {{meta.overdueAmount}}\n待付总金额：¥ {{meta.totalAmount}}',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #ef4444; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 账单逾期</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">⚠️ {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px; white-space: pre-line;">{{message}}</p>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 6px; margin-top: 12px;">
      <div style="font-size: 13px; color: #64748b;">逾期金额</div>
      <div style="font-size: 22px; font-weight: 700; color: #b91c1c;">¥ {{meta.overdueAmount}}</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">逾期 {{meta.overdueCount}} 笔 / 共 {{meta.billCount}} 笔待付</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_GOAL_COMPLETED,
    title: '🎉 目标达成：{{title}}',
    body: '{{message}}\n\n目标名称：{{meta.goalName}}\n目标金额：¥ {{meta.targetAmount}}\n已存金额：¥ {{meta.currentAmount}}',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #10b981; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 财务目标</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">🎉 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px; white-space: pre-line;">{{message}}</p>
    <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 10px 14px; border-radius: 6px; margin-top: 12px;">
      <div style="font-size: 13px; color: #64748b;">目标名称</div>
      <div style="font-size: 16px; font-weight: 600; color: #065f46; margin-top: 2px;">{{meta.goalName}}</div>
      <div style="font-size: 13px; color: #64748b; margin-top: 8px;">目标金额</div>
      <div style="font-size: 22px; font-weight: 700; color: #059669;">¥ {{meta.targetAmount}}</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">已达成 🎊</div>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: NOTIFICATION_SCENE_IDS.FINANCE_GOAL_WARNING,
    title: '💰 储蓄进度预警：{{title}}',
    body: '{{message}}\n\n目标名称：{{meta.goalName}}\n当前进度：{{meta.progressPercent}}%\n时间进度：{{meta.timeProgressPercent}}%\n剩余天数：{{meta.daysRemaining}} 天',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #f59e0b; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 财务目标</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">💰 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px; white-space: pre-line;">{{message}}</p>
    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 6px; margin-top: 12px;">
      <div style="font-size: 13px; color: #64748b;">目标名称</div>
      <div style="font-size: 16px; font-weight: 600; color: #92400e; margin-top: 2px;">{{meta.goalName}}</div>
      <table style="width: 100%; font-size: 13px; margin-top: 8px;">
        <tr><td style="padding: 4px 0; color: #64748b;">储蓄进度</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.progressPercent}}%</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">时间进度</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.timeProgressPercent}}%</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">剩余天数</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #d97706;">{{meta.daysRemaining}} 天</td></tr>
      </table>
    </div>
  </div>
</div>`,
  },
  {
    scene_id: NOTIFICATION_SCENE_IDS.TRAVEL_FOLLOWUP,
    title: '✈️ 旅行归档跟进：{{title}}',
    body: '{{message}}\n\n旅行日期：{{meta.travelDate}}\n总花费：¥ {{meta.amount}}',
    format: 'html',
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
  {
    scene_id: NOTIFICATION_SCENE_IDS.SCHEDULE_REMINDER,
    title: '📅 日程提醒：{{title}}',
    body: '{{message}}\n\n日期：{{meta.today}}\n今日日程：{{meta.todayCount}} 项\n明日预告：{{meta.tomorrowCount}} 项',
    format: 'html',
    html_body: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #6366f1, #4338ca); color: #fff; padding: 14px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS · 日程提醒</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">📅 {{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 12px;">{{message}}</p>
    <table style="width: 100%; font-size: 13px;">
      <tr><td style="padding: 4px 0; color: #64748b;">日期</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.today}}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">今日日程</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #4338ca;">{{meta.todayCount}} 项</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">明日预告</td><td style="padding: 4px 0; font-weight: 600; text-align: right;">{{meta.tomorrowCount}} 项</td></tr>
    </table>
  </div>
</div>`,
  },
];
