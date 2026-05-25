import { useEffect, useMemo } from 'react';

import { TodoLogsSection } from '../../components/life/TodoLogsSection';
import { TodoSettingsSection } from '../../components/life/TodoSettingsSection';
import { TodoTasksSection } from '../../components/life/TodoTasksSection';
import { TodoTrashSection } from '../../components/life/TodoTrashSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildDueTodoReminder,
  buildInitialTodoState,
  buildTodoOverview,
  normalizeTodoPageState,
} from '../../services/todo';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { TodoPageState, TodoTab } from '../../types/todo';

const STORAGE_KEY = 'lifeos_life_todo_page';

const TAB_OPTIONS: Array<{ value: TodoTab; label: string }> = [
  { value: 'tasks', label: '任务列表' },
  { value: 'settings', label: '提醒设置' },
  { value: 'logs', label: '通知日志' },
  { value: 'trash', label: '回收站' },
];

export default function TodoPage() {
  const [data, setData] = useLocalStorageState<TodoPageState>(STORAGE_KEY, buildInitialTodoState);
  const [tab, setTab] = usePageTab<TodoTab>('tasks', TAB_OPTIONS.map((item) => item.value), 'todoTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeTodoPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  useEffect(() => {
    void updateSceneConfig('todo.reminder', { enabled: normalizedData.settings.reminderEnabled });
  }, [normalizedData.settings.reminderEnabled]);

  useEffect(() => {
    const payload = buildDueTodoReminder(normalizedData.tasks, normalizedData.settings);

    if (!payload) {
      return;
    }

    void enqueueSceneNotification('todo.reminder', { message: payload.message }).then(() => {
      setData((previous) => ({
        ...previous,
        settings: {
          ...previous.settings,
          lastAutoReminderDate: payload.date,
        },
      }));
    });
  }, [normalizedData.settings, normalizedData.tasks, setData]);

  const overview = useMemo(() => buildTodoOverview(normalizedData.tasks), [normalizedData.tasks]);

  const updateSettings = (patch: Partial<TodoPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="待办事项中心"
        subtitle="把任务录入、提醒规则、通知日志和回收站统一收进当前 LifeOS 的正式前端体系，提醒场景继续复用通知中心。"
      />

      <StatGrid
        className="todo-overview-grid"
        items={[
          { label: '总任务', value: `${overview.totalCount}` },
          { label: '进行中', value: `${overview.activeCount}` },
          { label: '已完成', value: `${overview.completedCount}` },
          { label: '每日任务', value: `${overview.dailyCount}` },
          { label: '高优先级', value: `${overview.highPriorityCount}` },
          { label: '中优先级', value: `${overview.mediumPriorityCount}` },
          { label: '低优先级', value: `${overview.lowPriorityCount}` },
          { label: '今日到期', value: `${overview.dueTodayCount}` },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="任务列表、提醒设置、通知日志和回收站共用同一套本地状态模型与通知中心联动规则。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as TodoTab)} />
      </SectionCard>

      {tab === 'tasks' ? (
        <TodoTasksSection
          tasks={normalizedData.tasks}
          onChangeTasks={(updater) => {
            setData((previous) => ({
              ...previous,
              tasks: updater(previous.tasks),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <TodoSettingsSection
          tasks={normalizedData.tasks}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
          showToast={showToast}
        />
      ) : null}

      {tab === 'logs' ? (
        <TodoLogsSection showToast={showToast} />
      ) : null}

      {tab === 'trash' ? (
        <TodoTrashSection
          tasks={normalizedData.tasks}
          onChangeTasks={(updater) => {
            setData((previous) => ({
              ...previous,
              tasks: updater(previous.tasks),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
