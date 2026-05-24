import { useMemo } from 'react';

import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { SectionCard } from '../page';
import { Btn, Checkbox, Field } from '../ui';
import { buildTodoReminderPayload } from '../../services/todo';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { TodoPageState, TodoTaskRecord } from '../../types/todo';

interface TodoSettingsSectionProps {
  tasks: TodoTaskRecord[];
  settings: TodoPageState['settings'];
  onSettingsChange: (patch: Partial<TodoPageState['settings']>) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function TodoSettingsSection({
  tasks,
  settings,
  onSettingsChange,
  showToast,
}: TodoSettingsSectionProps) {
  const reminderPayload = useMemo(
    () => buildTodoReminderPayload(tasks, settings),
    [tasks, settings],
  );

  const triggerReminder = () => {
    const result = enqueueSceneNotification('todo.reminder', {
      message: reminderPayload.message,
    });

    showToast(
      result.some((item) => item.status === 'success')
        ? '今日待办提醒已写入通知中心日志。'
        : '今日待办提醒未发送，请检查通知中心渠道状态。',
      result.some((item) => item.status === 'success') ? 'success' : 'error',
    );
  };

  return (
    <SectionCard
      title="提醒设置"
      description="待办页只维护提醒规则和触发条件，渠道、模板与发送日志继续统一交给通知中心。"
      action={<Btn tone="primary" onClick={triggerReminder}>手动发送今日提醒</Btn>}
    >
      <div className="page-stack">
        <div className="todo-settings-grid">
          <SettingSwitchCard
            title="待办提醒"
            description="到达设定时间后，每天自动扫描一次有效待办并发起统一提醒。"
            checked={settings.reminderEnabled}
            onChange={(checked) => {
              onSettingsChange({ reminderEnabled: checked });
              updateSceneConfig('todo.reminder', { enabled: checked });
              showToast(`待办提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={settings.reminderEnabled ? '已启用' : '已停用'}
            impact={`当前将在每天 ${settings.reminderTime} 后扫描提醒，窗口为未来 ${settings.leadDays} 天。`}
          >
            <div className="todo-settings-inline-grid">
              <Field
                label="每日提醒时间"
                type="time"
                value={settings.reminderTime}
                onChange={(event) => onSettingsChange({ reminderTime: event.target.value || '09:00' })}
              />
              <Field
                label="提前提醒天数"
                type="number"
                min="0"
                max="30"
                value={String(settings.leadDays)}
                onChange={(event) => onSettingsChange({ leadDays: Math.max(0, Math.min(30, Number(event.target.value) || 0)) })}
              />
              <label className="todo-checkbox-field">
                <span className="field-label">提醒口径</span>
                <Checkbox
                  checked={settings.includeDailyTasks}
                  onChange={(checked) => onSettingsChange({ includeDailyTasks: checked })}
                >
                  纳入每日任务
                </Checkbox>
              </label>
              <label className="todo-checkbox-field">
                <span className="field-label">提醒口径</span>
                <Checkbox
                  checked={settings.includeOverdueTasks}
                  onChange={(checked) => onSettingsChange({ includeOverdueTasks: checked })}
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

        <div className="todo-reminder-preview callout callout-neutral">
          <strong>当前提醒摘要预览</strong>
          <span>
            共 {reminderPayload.taskCount} 项任务会参与提醒，其中逾期 {reminderPayload.overdueCount} 项，
            今日到期 {reminderPayload.dueTodayCount} 项，提前窗口内 {reminderPayload.leadWindowCount} 项。
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
