import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Field } from '../ui';
import { formatLifeCardMoney } from '../../services/card';
import { getNotificationLogs } from '../../services/notificationCenter';
import { cardApi } from '../../services/cardApi';
import type { LifeCardPageState, LifeCardRecord } from '../../types/card';
import type { AutoDeductResult } from '../../services/cardApi';
import type { NotificationLogEntry } from '../../types/notifications';

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
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [deducting, setDeducting] = useState(false);
  const [deductResult, setDeductResult] = useState<AutoDeductResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await getNotificationLogs({
        page: 1,
        pageSize: 8,
        sceneIds: ['card.balance_low', 'card.billing_upcoming'],
      });

      if (!cancelled) {
        setLogs(result.items);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  const lowBalanceCards = cards.filter((card) => card.balance <= settings.balanceThreshold);
  const billingDayCards = cards.filter((card) => card.billingDay === dayjs().date());
  const billingWindowCards = cards.filter((card) => {
    const today = new Date();
    const currentDay = today.getDate();
    const nextBillingDay = card.billingDay >= currentDay ? card.billingDay : card.billingDay + 31;
    const diff = nextBillingDay - currentDay;
    return diff >= 0 && diff <= settings.notificationDaysBefore;
  });

  const triggerLowBalanceReminder = async () => {
    try {
      await cardApi.triggerReminders();
      const result = await getNotificationLogs({
        page: 1,
        pageSize: 8,
        sceneIds: ['card.balance_low', 'card.billing_upcoming'],
      });
      setLogs(result.items);
      showToast('低余额和账单日前提醒已触发。');
    } catch {
      showToast('提醒触发失败。', 'error');
    }
  };

  const handleAutoDeduct = async () => {
    if (!settings.autoDeductionEnabled) {
      showToast('请先开启自动扣费开关。', 'error');
      return;
    }

    setDeducting(true);
    setDeductResult(null);
    try {
      const result = await cardApi.autoDeduct();
      setDeductResult(result);
      const dCount = result.deductedCount;
      const sCount = result.skippedAlreadyBilled;
      showToast(
        `扣费完成：成功 ${dCount} 张，跳过（已存在）${sCount} 张，共扣除 ¥${result.totalDeducted.toFixed(2)}`,
        dCount > 0 ? 'success' : undefined,
      );
      const logResult = await getNotificationLogs({
        page: 1,
        pageSize: 8,
        sceneIds: ['card.balance_low', 'card.billing_upcoming'],
      });
      setLogs(logResult.items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '扣费执行失败';
      showToast(message, 'error');
    } finally {
      setDeducting(false);
    }
  };

  return (
    <SectionCard
      title="提醒设置"
      description="号卡页只维护业务规则和提醒窗口，真正的通知发送与日志统一交给通知中心。"
      action={(
        <div className="inline-row">
          <Btn tone="secondary" onClick={() => void handleAutoDeduct()} disabled={deducting}>
            {deducting ? '扣费中...' : `执行自动扣费 (${billingDayCards.length} 张待扣)`}
          </Btn>
          <Btn tone="ghost" onClick={() => void triggerLowBalanceReminder()}>模拟提醒</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="card-settings-grid">
          <SettingSwitchCard
            title="低余额提醒"
            description="当号卡余额低于阈值时，统一写入通知中心日志并按场景绑定的渠道发送。"
            checked={settings.balanceLowEnabled}
            onChange={(checked) => {
              onSettingsChange({ balanceLowEnabled: checked });
            }}
            statusText={settings.balanceLowEnabled ? '已开启' : '已关闭'}
            impact={`当前共有 ${lowBalanceCards.length} 张号卡低于 ${formatLifeCardMoney(settings.balanceThreshold)}。`}
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
            summary="查看当前场景是否启用以及绑定了多少渠道。"
          />

          <SettingSwitchCard
            title="账单日前提醒"
            description="在账单日前 N 天进入提醒窗口时，统一由通知中心写日志并处理发送。"
            checked={settings.billingUpcomingEnabled}
            onChange={(checked) => {
              onSettingsChange({ billingUpcomingEnabled: checked });
            }}
            statusText={settings.billingUpcomingEnabled ? '已开启' : '已关闭'}
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
            summary="查看当前场景是否启用以及绑定了多少渠道。"
          />

          <SettingSwitchCard
            title="自动扣费"
            description="账单日当天，系统按月租自动扣除余额并生成账单记录。需手动触发或配置定时任务。"
            checked={settings.autoDeductionEnabled}
            onChange={(checked) => {
              onSettingsChange({ autoDeductionEnabled: checked });
            }}
            statusText={settings.autoDeductionEnabled ? '已开启' : '已关闭'}
            impact={`今日有 ${billingDayCards.length} 张号卡到达账单日，${cards.filter((c) => c.monthlyFee > 0).length} 张设置了月租。`}
          />

          {deductResult && (
            <div className="section-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>最近一次扣费结果</h4>
              <p style={{ fontSize: '13px', color: 'var(--color-ink-subtle)', marginBottom: '12px' }}>
                {deductResult.billingMonth} 账单日 {deductResult.billingDay} 日 ·
                成功 {deductResult.deductedCount} 张 ·
                跳过已存在 {deductResult.skippedAlreadyBilled} 张 ·
                共扣除 ¥{deductResult.totalDeducted.toFixed(2)}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {deductResult.details.map((d) => (
                  <div key={d.simId} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: d.status === 'deducted' ? 'rgba(48,209,88,.08)' : 'var(--color-surface-2)',
                    fontSize: '13px',
                  }}>
                    <span>{d.phoneNumber} ({d.carrierName})</span>
                    <span style={{
                      fontWeight: 600,
                      color: d.status === 'deducted' ? 'var(--color-success)' : 'var(--color-ink-subtle)',
                    }}>
                      {d.status === 'deducted'
                        ? `-¥${d.deductedAmount.toFixed(2)} → ¥${d.remainingBalance.toFixed(2)}`
                        : d.reason ?? '跳过'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="page-stack">
          <div className="section-head-inline">
            <div>
              <h3 className="section-title">最近提醒日志摘要</h3>
              <p className="section-description">
                这里只展示号卡中心相关提醒日志，完整发送记录请前往通知中心查看。
              </p>
            </div>
            <Btn tone="ghost" onClick={() => navigate('/notifications?tab=scenes')}>
              前往通知中心
            </Btn>
          </div>
          <NotificationLogTable logs={logs} />
        </div>
      </div>
    </SectionCard>
  );
}
