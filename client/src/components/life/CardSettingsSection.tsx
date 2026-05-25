import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Field } from '../ui';
import { formatLifeCardMoney } from '../../services/card';
import { enqueueSceneNotification, updateSceneConfig, useNotificationCenterState } from '../../services/notificationCenter';
import type { LifeCardPageState, LifeCardRecord } from '../../types/card';

interface CardSettingsSectionProps {
  cards: LifeCardRecord[];
  settings: LifeCardPageState['settings'];
  onSettingsChange: (patch: Partial<LifeCardPageState['settings']>) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function CardSettingsSection({
  cards,
  settings,
  onSettingsChange,
  showToast,
}: CardSettingsSectionProps) {
  const navigate = useNavigate();
  const notificationState = useNotificationCenterState();

  const lowBalanceCards = useMemo(
    () => cards.filter((card) => card.balance <= settings.balanceThreshold),
    [cards, settings.balanceThreshold],
  );

  const billingWindowCards = useMemo(() => cards.filter((card) => {
    const today = new Date();
    const currentDay = today.getDate();
    const nextBillingDay = card.billingDay >= currentDay ? card.billingDay : card.billingDay + 31;
    const diff = nextBillingDay - currentDay;
    return diff >= 0 && diff <= settings.notificationDaysBefore;
  }), [cards, settings.notificationDaysBefore]);

  const latestLogs = useMemo(
    () => (notificationState?.logs ?? [])
      .filter((log) => log.sceneId === 'card.balance_low' || log.sceneId === 'card.billing_upcoming')
      .slice(0, 8),
    [notificationState],
  );

  const triggerLowBalanceReminder = () => {
    const result = enqueueSceneNotification('card.balance_low', {
      message: lowBalanceCards.length
        ? `当前有 ${lowBalanceCards.length} 张号卡余额低于 ${formatLifeCardMoney(settings.balanceThreshold)}，请及时充值。`
        : `当前没有余额低于 ${formatLifeCardMoney(settings.balanceThreshold)} 的号卡。`,
    });

    showToast(
      result.some((item) => item.status === 'success')
        ? '低余额提醒已写入通知中心日志。'
        : '低余额提醒未发送，请检查通知中心渠道状态。',
      result.some((item) => item.status === 'success') ? 'success' : 'error',
    );
  };

  const triggerBillingReminder = () => {
    const result = enqueueSceneNotification('card.billing_upcoming', {
      message: billingWindowCards.length
        ? `当前有 ${billingWindowCards.length} 张号卡进入账单日前 ${settings.notificationDaysBefore} 天提醒窗口。`
        : `当前没有号卡进入账单日前 ${settings.notificationDaysBefore} 天提醒窗口。`,
    });

    showToast(
      result.some((item) => item.status === 'success')
        ? '账单日前提醒已写入通知中心日志。'
        : '账单日前提醒未发送，请检查通知中心渠道状态。',
      result.some((item) => item.status === 'success') ? 'success' : 'error',
    );
  };

  return (
    <SectionCard
      title="提醒设置"
      description="号卡页只维护业务规则和触发入口，真正的发送渠道、模板和完整日志继续统一归通知中心。"
      action={(
        <div className="inline-row">
          <Btn tone="secondary" onClick={triggerLowBalanceReminder}>模拟低余额提醒</Btn>
          <Btn tone="primary" onClick={triggerBillingReminder}>模拟账单提醒</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="card-settings-grid">
          <SettingSwitchCard
            title="低余额提醒"
            description="当号卡余额低于阈值时，统一写入通知中心日志并按场景绑定渠道发出提醒。"
            checked={settings.balanceLowEnabled}
            onChange={(checked) => {
              onSettingsChange({ balanceLowEnabled: checked });
              updateSceneConfig('card.balance_low', { enabled: checked });
              showToast(`低余额提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.balanceLowEnabled ? '已启用' : '已停用'}
            impact={`当前有 ${lowBalanceCards.length} 张号卡低于阈值 ${formatLifeCardMoney(settings.balanceThreshold)}。`}
          >
            <div className="card-settings-inline-grid">
              <Field
                label="余额阈值"
                type="number"
                min="0"
                step="0.01"
                value={String(settings.balanceThreshold)}
                onChange={(event) => onSettingsChange({ balanceThreshold: Number(event.target.value) || 0 })}
              />
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="card.balance_low"
            title="低余额提醒场景"
            summary="查看当前启用状态、绑定渠道数，以及统一通知中心的发送入口。"
          />

          <SettingSwitchCard
            title="账单日前提醒"
            description="当号卡进入账单日前 N 天窗口时，统一写入通知中心日志并按场景配置处理。"
            checked={settings.billingUpcomingEnabled}
            onChange={(checked) => {
              onSettingsChange({ billingUpcomingEnabled: checked });
              updateSceneConfig('card.billing_upcoming', { enabled: checked });
              showToast(`账单日前提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.billingUpcomingEnabled ? '已启用' : '已停用'}
            impact={`当前有 ${billingWindowCards.length} 张号卡落在未来 ${settings.notificationDaysBefore} 天的提醒窗口内。`}
          >
            <div className="card-settings-inline-grid">
              <Field
                label="提前提醒天数"
                type="number"
                min="0"
                max="31"
                value={String(settings.notificationDaysBefore)}
                onChange={(event) => onSettingsChange({ notificationDaysBefore: Number(event.target.value) || 0 })}
              />
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="card.billing_upcoming"
            title="账单日前提醒场景"
            summary="进入提醒窗口时，这个场景会统一接管日志写入和渠道发送。"
          />
        </div>

        <div className="page-stack">
          <div className="section-head-inline">
            <div>
              <h3 className="section-title">最近提醒日志摘要</h3>
              <p className="section-description">
                这里只显示号卡中心相关的提醒日志，完整发送记录和渠道绑定请前往通知中心查看。
              </p>
            </div>
            <Btn tone="ghost" onClick={() => navigate('/notifications?tab=scenes')}>
              前往通知中心
            </Btn>
          </div>
          <NotificationLogTable logs={latestLogs} />
        </div>
      </div>
    </SectionCard>
  );
}
