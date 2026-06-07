import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Field, SelectField } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { getNotificationLogs } from '../../services/notificationCenter';
import { loanApi } from '../../services/loanApi';
import type { LoanBill, LoanSettings } from '../../types/loan';
import type { NotificationLogEntry } from '../../types/notifications';

interface LoanSettingsSectionProps {
  bills: LoanBill[];
  settings: LoanSettings;
  onSettingsChange: (patch: Partial<LoanSettings>) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function LoanSettingsSection({
  bills,
  settings,
  onSettingsChange,
  showToast,
}: LoanSettingsSectionProps) {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const upcomingBills = useMemo(() => bills.filter((bill) => !bill.isPaid), [bills]);
  const overdueBills = useMemo(
    () => bills.filter((bill) => !bill.isPaid && dayjs(bill.dueDate).isBefore(dayjs(), 'day')),
    [bills],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await getNotificationLogs({
          page: 1,
          pageSize: 8,
          sceneIds: ['loan.repayment_upcoming', 'loan.repayment_overdue'],
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
      await loanApi.triggerReminders();
      const result = await getNotificationLogs({
        page: 1,
        pageSize: 8,
        sceneIds: ['loan.repayment_upcoming', 'loan.repayment_overdue'],
      });
      setLogs(result.items);
      showToast('贷款提醒已触发。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '贷款提醒触发失败。'), 'error');
    }
  };

  return (
    <SectionCard
      title="设置"
      description="统一维护提醒规则、自动联动开关和通知中心状态，不再在页面内单独维护场景配置。"
      action={<Btn tone="secondary" onClick={() => void triggerReminder()}>手动触发提醒</Btn>}
    >
      <div className="page-stack">
        <div className="loan-settings-grid">
          <SettingSwitchCard
            title="还款提醒"
            description="在账单到期前按设置的提前天数写入提醒日志，并由通知中心统一发送。"
            checked={settings.repaymentReminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ repaymentReminderEnabled: checked });
            }}
            statusText={settings.repaymentReminderEnabled ? '已开启' : '已关闭'}
            impact={`当前共有 ${upcomingBills.length} 笔待还账单会参与提醒判断。`}
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
                <option value="always">每次进入都提醒</option>
              </SelectField>
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="loan.repayment_upcoming"
            title="还款提醒场景"
            summary="查看场景是否启用，以及当前绑定的通知渠道数量。"
          />

          <SettingSwitchCard
            title="逾期提醒"
            description="用于高优先级风险提醒，适合逾期账单和严重待还风险。"
            checked={settings.overdueReminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ overdueReminderEnabled: checked });
            }}
            statusText={settings.overdueReminderEnabled ? '已开启' : '已关闭'}
            impact={`当前共有 ${overdueBills.length} 笔逾期账单。`}
          />

          <NotificationStatusCard
            sceneId="loan.repayment_overdue"
            title="逾期提醒场景"
            summary="查看场景是否启用，以及当前绑定的通知渠道数量。"
          />

          <SettingSwitchCard
            title="标记已还时自动生成还款记录"
            description="控制在账单页标记已还后，是否同步创建一笔还款记录。"
            checked={settings.autoRepaymentOnMarkPaid}
            onChange={(checked) => {
              onSettingsChange({ autoRepaymentOnMarkPaid: checked });
            }}
            statusText={settings.autoRepaymentOnMarkPaid ? '已开启' : '仅更新账单'}
            impact="这是业务联动开关，不会直接发送通知，但会影响账单标记后的数据完整性。"
          />
        </div>

        <div className="chart-card">
          <div className="fitness-chart-header">
            <strong>最近提醒日志</strong>
            <span>{loading ? '正在同步贷款提醒日志。' : '这里只展示贷款相关场景的最新提醒记录。'}</span>
          </div>
          <NotificationLogTable logs={logs} />
        </div>
      </div>
    </SectionCard>
  );
}
