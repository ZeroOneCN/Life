import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Checkbox, Field } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { todoApi } from '../../services/todoApi';
import type { TodoReminderSettings } from '../../types/todo';

interface TodoSettingsSectionProps {
  settings: TodoReminderSettings;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => Promise<void> | void;
}

export function TodoSettingsSection({
  settings,
  showToast,
  onChanged,
}: TodoSettingsSectionProps) {
  const savePatch = async (patch: Partial<TodoReminderSettings>, successMessage: string) => {
    try {
      await todoApi.updateSettings(patch);
      await onChanged();
      showToast(successMessage);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '提醒设置更新失败。'), 'error');
    }
  };

  const triggerReminder = async () => {
    try {
      await todoApi.triggerReminder();
      await onChanged();
      showToast('今日待办提醒已写入通知中心日志。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '手动发送提醒失败。'), 'error');
    }
  };

  return (
    <SectionCard
      title="提醒设置"
      description="待办页只维护提醒规则和触发入口，渠道、模板和完整日志统一归通知中心。"
      action={<Btn tone="primary" onClick={() => void triggerReminder()}>手动发送今日提醒</Btn>}
    >
      <div className="page-stack">
        <div className="todo-settings-grid">
          <SettingSwitchCard
            title="待办提醒"
            description="到达设定时间后，按后端规则扫描有效待办并生成统一提醒日志。"
            checked={settings.reminderEnabled}
            onChange={(checked) => {
              void savePatch({ reminderEnabled: checked }, `待办提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.reminderEnabled ? '已启用' : '已停用'}
            impact={`当前会在每天 ${settings.reminderTime} 后扫描提醒，提前窗口为 ${settings.leadDays} 天。`}
          >
            <div className="todo-settings-inline-grid">
              <Field
                label="每日提醒时间"
                type="time"
                value={settings.reminderTime}
                onChange={(event) => {
                  void savePatch({ reminderTime: event.target.value || '09:00' }, '提醒时间已更新。');
                }}
              />
              <Field
                label="提前提醒天数"
                type="number"
                min="0"
                max="30"
                value={String(settings.leadDays)}
                onChange={(event) => {
                  const leadDays = Math.max(0, Math.min(30, Number(event.target.value) || 0));
                  void savePatch({ leadDays }, '提醒窗口已更新。');
                }}
              />
              <label className="todo-checkbox-field">
                <span className="field-label">提醒口径</span>
                <Checkbox
                  checked={settings.includeDailyTasks}
                  onChange={(checked) => {
                    void savePatch({ includeDailyTasks: checked }, '每日任务提醒范围已更新。');
                  }}
                >
                  纳入每日任务
                </Checkbox>
              </label>
              <label className="todo-checkbox-field">
                <span className="field-label">提醒口径</span>
                <Checkbox
                  checked={settings.includeOverdueTasks}
                  onChange={(checked) => {
                    void savePatch({ includeOverdueTasks: checked }, '逾期任务提醒范围已更新。');
                  }}
                >
                  纳入逾期任务
                </Checkbox>
              </label>
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="todo.reminder"
            title="通知中心场景状态"
            summary="查看当前绑定渠道、启用状态和统一发送入口。"
          />
        </div>
      </div>
    </SectionCard>
  );
}
