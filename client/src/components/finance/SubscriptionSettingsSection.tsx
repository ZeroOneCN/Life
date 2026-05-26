import { useEffect, useState } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Checkbox, Field } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { getNotificationLogs } from '../../services/notificationCenter';
import { subscriptionApi } from '../../services/subscriptionApi';
import type { SubscriptionPageState } from '../../types/subscription';
import type { NotificationLogEntry } from '../../types/notifications';

interface SubscriptionSettingsSectionProps {
  settings: SubscriptionPageState['settings'];
  onSettingsChange: (patch: Partial<SubscriptionPageState['settings']>) => void;
}

export function SubscriptionSettingsSection({
  settings,
  onSettingsChange,
}: SubscriptionSettingsSectionProps) {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await getNotificationLogs({
          page: 1,
          pageSize: 8,
          sceneIds: ['subscription.renewal_upcoming', 'subscription.expired'],
        });

        if (!cancelled) {
          setLogs(result.items);
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  const triggerReminder = async () => {
    try {
      await subscriptionApi.triggerReminders();
      const result = await getNotificationLogs({
        page: 1,
        pageSize: 8,
        sceneIds: ['subscription.renewal_upcoming', 'subscription.expired'],
      });
      setLogs(result.items);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(buildApiErrorMessage(error, '订阅提醒触发失败。'));
    }
  };

  return (
    <SectionCard
      title="提醒设置"
      description="订阅提醒统一接入通知中心，本页只维护业务规则、提醒窗口和最近日志摘要。"
      action={<Btn tone="secondary" onClick={() => void triggerReminder()}>手动触发提醒</Btn>}
    >
      <div className="page-stack">
        <div className="subscription-settings-grid">
          <SettingSwitchCard
            title="续费提醒"
            description="在订阅距离到期前 N 天进入提醒窗口时触发通知场景。"
            checked={settings.reminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ reminderEnabled: checked });
            }}
            statusText={settings.reminderEnabled ? '已开启' : '已关闭'}
            impact={`当前会在到期前 ${settings.leadDays} 天内扫描订阅；${settings.includeAutoRenewInReminders ? '自动续费项目也会纳入提醒。' : '自动续费项目默认跳过。'}`}
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

          <NotificationStatusCard
            sceneId="subscription.renewal_upcoming"
            title="续费提醒场景"
            summary="查看当前场景的启用状态、绑定渠道数和通知中心入口。"
          />

          <SettingSwitchCard
            title="到期当天 / 已逾期提醒"
            description="当订阅到期当天或过期后记录提醒日志，方便及时处理。"
            checked={settings.expiryDayReminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ expiryDayReminderEnabled: checked });
            }}
            statusText={settings.expiryDayReminderEnabled ? '已开启' : '已关闭'}
            impact="该提醒更偏向风险兜底，适合关键软件、云服务或长期会员订阅。"
          />

          <NotificationStatusCard
            sceneId="subscription.expired"
            title="到期与逾期场景"
            summary="订阅到期后由通知中心统一记录发送日志。"
          />
        </div>

        <div className="page-stack">
          <div>
            <h3 className="section-title">最近提醒日志</h3>
            <p className="section-description">
              {loading ? '正在同步最近的提醒日志。' : '这里展示订阅中心最近触发的提醒记录。'}
            </p>
          </div>
          <NotificationLogTable logs={logs} />
        </div>
      </div>
    </SectionCard>
  );
}
