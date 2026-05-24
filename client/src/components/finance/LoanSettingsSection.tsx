import { useMemo } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Field, SelectField } from '../ui';
import { filterLoanBills, getLoanBillStatus } from '../../services/loan';
import { enqueueSceneNotification, updateSceneConfig, useNotificationCenterState } from '../../services/notificationCenter';
import type { LoanBill, LoanPageState } from '../../types/loan';

interface LoanSettingsSectionProps {
  bills: LoanBill[];
  settings: LoanPageState['settings'];
  onSettingsChange: (patch: Partial<LoanPageState['settings']>) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function LoanSettingsSection({
  bills,
  settings,
  onSettingsChange,
  showToast,
}: LoanSettingsSectionProps) {
  const notificationState = useNotificationCenterState();

  const scopedBills = useMemo(
    () => filterLoanBills(bills, settings.activeUserId),
    [bills, settings.activeUserId],
  );

  const upcomingBills = useMemo(
    () => scopedBills.filter((bill) => getLoanBillStatus(bill) === 'unpaid'),
    [scopedBills],
  );

  const overdueBills = useMemo(
    () => scopedBills.filter((bill) => getLoanBillStatus(bill) === 'overdue'),
    [scopedBills],
  );

  const latestLogs = useMemo(
    () => (notificationState?.logs ?? [])
      .filter((log) => log.sceneId === 'loan.repayment_upcoming' || log.sceneId === 'loan.repayment_overdue')
      .slice(0, 6),
    [notificationState],
  );

  const triggerUpcomingReminder = () => {
    const result = enqueueSceneNotification('loan.repayment_upcoming', {
      message: `当前有 ${upcomingBills.length} 笔待还账单，建议在 ${settings.upcomingDays} 天窗口内优先处理。`,
    });

    showToast(
      result.some((item) => item.status === 'success')
        ? '还款提醒已写入通知中心日志。'
        : '还款提醒未发送，请检查通知中心渠道配置。',
      result.some((item) => item.status === 'success') ? 'success' : 'error',
    );
  };

  const triggerOverdueReminder = () => {
    const result = enqueueSceneNotification('loan.repayment_overdue', {
      message: `当前有 ${overdueBills.length} 笔逾期账单，请尽快处理并评估风险。`,
    });

    showToast(
      result.some((item) => item.status === 'success')
        ? '逾期提醒已写入通知中心日志。'
        : '逾期提醒未发送，请检查通知中心渠道配置。',
      result.some((item) => item.status === 'success') ? 'success' : 'error',
    );
  };

  return (
    <SectionCard
      title="设置"
      description="统一维护提醒规则、自动联动开关和通知中心状态，不在页面内单独维护渠道配置。"
      action={(
        <div className="inline-row">
          <Btn tone="secondary" onClick={triggerUpcomingReminder}>模拟还款提醒</Btn>
          <Btn tone="primary" onClick={triggerOverdueReminder}>模拟逾期提醒</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="loan-settings-grid">
          <SettingSwitchCard
            title="还款提醒"
            description="在账单到期前按设定频率写入通知中心，由通知中心统一选择渠道发送。"
            checked={settings.repaymentReminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ repaymentReminderEnabled: checked });
              updateSceneConfig('loan.repayment_upcoming', { enabled: checked });
              showToast(`还款提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.repaymentReminderEnabled ? '已启用' : '已停用'}
            impact={`当前用户 ${settings.activeUserId || '未设置'} 下共有 ${upcomingBills.length} 笔待还账单，会按这里的提醒频率和提前天数参与触发。`}
          >
            <div className="loan-settings-inline-grid">
              <Field
                label="提前提醒天数"
                type="number"
                min="0"
                max="30"
                value={String(settings.upcomingDays)}
                onChange={(event) => onSettingsChange({ upcomingDays: Math.max(0, Math.min(30, Number(event.target.value) || 0)) })}
              />
              <SelectField
                label="提醒频率"
                value={settings.notificationFrequency}
                onChange={(event) => onSettingsChange({ notificationFrequency: event.target.value as 'daily' | 'always' })}
              >
                <option value="daily">每天一次</option>
                <option value="always">每次进入</option>
              </SelectField>
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="loan.repayment_upcoming"
            title="还款提醒场景"
            summary="查看当前已绑定的渠道数、场景开关状态和统一发送入口。"
          />

          <SettingSwitchCard
            title="逾期提醒"
            description="用于逾期账单的高优先级提醒，适合和企业微信或 Webhook 联动。"
            checked={settings.overdueReminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ overdueReminderEnabled: checked });
              updateSceneConfig('loan.repayment_overdue', { enabled: checked });
              showToast(`逾期提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.overdueReminderEnabled ? '已启用' : '已停用'}
            impact={`当前用户下共有 ${overdueBills.length} 笔逾期账单。关闭后，页面依然会显示逾期状态，但不会再向通知中心发起逾期提醒请求。`}
          />

          <NotificationStatusCard
            sceneId="loan.repayment_overdue"
            title="逾期提醒场景"
            summary="建议至少绑定一个高优先级渠道，便于逾期账单及时被感知。"
          />

          <SettingSwitchCard
            title="标记已还时自动生成还款记录"
            description="控制账单页手动标记已还时，是否同步写入一笔还款流水。"
            checked={settings.autoRepaymentOnMarkPaid}
            onChange={(checked) => {
              onSettingsChange({ autoRepaymentOnMarkPaid: checked });
              showToast(`自动生成还款记录已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.autoRepaymentOnMarkPaid ? '账单状态与还款记录联动中' : '仅更新账单状态'}
            impact="这是业务联动开关，不会直接发送通知，但会影响账单标记后的数据完整性和统计口径，因此同样需要明显提示。"
          />
        </div>

        <div className="fitness-chart-card">
          <div className="fitness-chart-header">
            <strong>最近触发日志</strong>
            <span>只展示借款场景相关的通知发送和测试记录，便于回到通知中心继续追踪。</span>
          </div>
          <NotificationLogTable logs={latestLogs} />
        </div>
      </div>
    </SectionCard>
  );
}
