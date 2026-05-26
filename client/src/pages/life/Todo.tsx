import { useCallback, useEffect, useMemo, useState } from 'react';

import { TodoLogsSection } from '../../components/life/TodoLogsSection';
import { TodoSettingsSection } from '../../components/life/TodoSettingsSection';
import { TodoTasksSection } from '../../components/life/TodoTasksSection';
import { TodoTrashSection } from '../../components/life/TodoTrashSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { hydrateNotificationCenterState } from '../../services/notificationCenter';
import { todoApi } from '../../services/todoApi';
import type { TodoOverviewSummary, TodoReminderSettings, TodoTab } from '../../types/todo';

const TAB_OPTIONS: Array<{ value: TodoTab; label: string }> = [
  { value: 'tasks', label: '任务列表' },
  { value: 'settings', label: '提醒设置' },
  { value: 'logs', label: '通知日志' },
  { value: 'trash', label: '回收站' },
];

const EMPTY_OVERVIEW: TodoOverviewSummary = {
  totalCount: 0,
  activeCount: 0,
  completedCount: 0,
  dailyCount: 0,
  highPriorityCount: 0,
  mediumPriorityCount: 0,
  lowPriorityCount: 0,
  dueTodayCount: 0,
};

const EMPTY_SETTINGS: TodoReminderSettings = {
  reminderEnabled: true,
  reminderTime: '09:00',
  leadDays: 3,
  includeDailyTasks: true,
  includeOverdueTasks: true,
  lastAutoReminderDate: '',
};

export default function TodoPage() {
  const [tab, setTab] = usePageTab<TodoTab>('tasks', TAB_OPTIONS.map((item) => item.value), 'todoTab');
  const { toast, showToast } = useToastState();
  const [overview, setOverview] = useState<TodoOverviewSummary>(EMPTY_OVERVIEW);
  const [settings, setSettings] = useState<TodoReminderSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshPage = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextOverview, nextSettings] = await Promise.all([
          todoApi.getOverview(),
          todoApi.getSettings(),
          hydrateNotificationCenterState(),
        ]);

        if (cancelled) {
          return;
        }

        setOverview(nextOverview);
        setSettings(nextSettings);
      } catch (error) {
        if (!cancelled) {
          showToast(buildApiErrorMessage(error, '待办中心加载失败。'), 'error');
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
  }, [refreshToken, showToast]);

  const subtitle = useMemo(() => (
    loading
      ? '正在从后端加载任务、提醒规则和通知日志。'
      : '待办中心已经切到后端唯一数据源，页面只保留视图级内存状态。'
  ), [loading]);

  return (
    <div className="page-stack">
      <PageHeader
        title="待办中心"
        subtitle={subtitle}
      />

      <StatGrid
        className="todo-overview-grid"
        items={[
          { label: '总任务数', value: `${overview.totalCount}` },
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
        description="任务列表、提醒设置、通知日志和回收站全部以后端数据为准，tab 仅负责界面切换。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as TodoTab)} />
      </SectionCard>

      {tab === 'tasks' ? (
        <TodoTasksSection
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      {tab === 'settings' ? (
        <TodoSettingsSection
          settings={settings}
          showToast={showToast}
          onChanged={async () => {
            await hydrateNotificationCenterState();
            refreshPage();
          }}
        />
      ) : null}

      {tab === 'logs' ? (
        <TodoLogsSection
          showToast={showToast}
          refreshToken={refreshToken}
        />
      ) : null}

      {tab === 'trash' ? (
        <TodoTrashSection
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
