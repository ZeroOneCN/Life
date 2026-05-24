import { useMemo } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Checkbox, Field } from '../ui';
import { updateSceneConfig, useNotificationCenterState } from '../../services/notificationCenter';
import type { SubscriptionPageState } from '../../types/subscription';

interface SubscriptionSettingsSectionProps {
  settings: SubscriptionPageState['settings'];
  onSettingsChange: (patch: Partial<SubscriptionPageState['settings']>) => void;
}

export function SubscriptionSettingsSection({
  settings,
  onSettingsChange,
}: SubscriptionSettingsSectionProps) {
  const notificationState = useNotificationCenterState();

  const latestLogs = useMemo(
    () => (notificationState?.logs ?? [])
      .filter((log) => log.sceneId === 'subscription.renewal_upcoming' || log.sceneId === 'subscription.expired')
      .slice(0, 8),
    [notificationState],
  );

  return (
    <SectionCard
      title="提醒设置"
      description="订阅提醒统一接到通知中心，本页只负责业务开关、提醒窗口和最近触发摘要。"
    >
      <div className="page-stack">
        <div className="subscription-settings-grid">
          <SettingSwitchCard
            title="续费提醒"
            description="在订阅距离到期前 N 天进入提醒窗口时触发通知场景。"
            checked={settings.reminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ reminderEnabled: checked });
              updateSceneConfig('subscription.renewal_upcoming', { enabled: checked });
            }}
            statusText={settings.reminderEnabled ? '已开启' : '已关闭'}
            impact={`当前会在到期前 ${settings.leadDays} 天内扫描订阅，${settings.includeAutoRenewInReminders ? '自动续费项也会纳入提醒。' : '默认跳过自动续费项。'}`}
          >
            <div className="subscription-settings-inline">
              <Field
                label="提前提醒天数"
                type="number"
                min="0"
                max="90"
                value={String(settings.leadDays)}
                onChange={(event) => onSettingsChange({ leadDays: Number(event.target.value) || 0 })}
              />
              <label className="subscription-toggle-field">
                <span className="field-label">提醒范围</span>
                <Checkbox
                  checked={settings.includeAutoRenewInReminders}
                  onChange={(checked) => onSettingsChange({ includeAutoRenewInReminders: checked })}
                >
                  包含自动续费订阅
                </Checkbox>
              </label>
            </div>
          </SettingSwitchCard>

          <SettingSwitchCard
            title="到期当天 / 已逾期提醒"
            description="在订阅到期当天或已过期后记录提醒日志，便于尽快处理。"
            checked={settings.expiryDayReminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ expiryDayReminderEnabled: checked });
              updateSceneConfig('subscription.expired', { enabled: checked });
            }}
            statusText={settings.expiryDayReminderEnabled ? '已开启' : '已关闭'}
            impact="该提醒更偏向风险兜底，适合关键软件、云服务或容易影响工作流的订阅。"
          />
        </div>

        <div className="subscription-notification-grid">
          <NotificationStatusCard
            sceneId="subscription.renewal_upcoming"
            title="续费提醒场景"
            summary="订阅进入提醒窗口时，通过通知中心统一选择渠道发送。"
          />
          <NotificationStatusCard
            sceneId="subscription.expired"
            title="到期与逾期场景"
            summary="订阅到期当天或逾期后，会统一写入通知日志并按场景配置处理。"
          />
        </div>

        <div className="page-stack">
          <div>
            <h3 className="section-title">最近提醒日志</h3>
            <p className="section-description">
              这里会显示服务订阅中心最近触发的提醒记录，完整日志可前往通知中心查看。
            </p>
          </div>
          <NotificationLogTable logs={latestLogs} />
        </div>
      </div>
    </SectionCard>
  );
}
