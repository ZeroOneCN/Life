import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ScheduleCalendarSection } from '../../components/life/ScheduleCalendarSection';
import { ScheduleEventsSection } from '../../components/life/ScheduleEventsSection';
import { ScheduleLogsSection } from '../../components/life/ScheduleLogsSection';
import { ScheduleSettingsSection } from '../../components/life/ScheduleSettingsSection';
import { ScheduleTrashSection } from '../../components/life/ScheduleTrashSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { hydrateNotificationCenterState } from '../../services/notificationCenter';
import { scheduleApi } from '../../services/scheduleApi';
import type { ScheduleOverviewSummary, ScheduleSettings, ScheduleTab } from '../../types/schedule';

const TAB_OPTIONS: Array<{ value: ScheduleTab; label: string }> = [
  { value: 'calendar', label: '日历视图' },
  { value: 'list', label: '事件列表' },
  { value: 'settings', label: '提醒设置' },
  { value: 'logs', label: '通知日志' },
  { value: 'trash', label: '回收站' },
];

const EMPTY_OVERVIEW: ScheduleOverviewSummary = {
  totalCount: 0,
  activeCount: 0,
  completedCount: 0,
  recurringCount: 0,
  reminderCount: 0,
  dueTodayCount: 0,
  dueThisWeekCount: 0,
  overdueCount: 0,
};

const EMPTY_SETTINGS: ScheduleSettings = {
  defaultReminderMinutes: 30,
  defaultView: 'month',
  weekStartsOn: 1,
  reminderEnabled: true,
  reminderTime: '08:00',
  lastAutoReminderDate: '',
};

/**
 * 日程管理主页面：聚合统计、Tab 切换、5 个子区块。
 */
export default function SchedulePage() {
  const [tab, setTab] = usePageTab<ScheduleTab>('calendar', TAB_OPTIONS.map((item) => item.value), 'scheduleTab');
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [overview, setOverview] = useState<ScheduleOverviewSummary>(EMPTY_OVERVIEW);
  const [settings, setSettings] = useState<ScheduleSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  /**
   * 刷新页面数据：拉取概览和设置。
   */
  const refreshPage = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextOverview, nextSettings] = await Promise.all([
          scheduleApi.getOverview(),
          scheduleApi.getSettings(),
          hydrateNotificationCenterState(),
        ]);

        if (cancelled) {
          return;
        }

        setOverview(nextOverview);
        setSettings(nextSettings);
      } catch (error) {
        if (!cancelled) {
          showToastRef.current(buildApiErrorMessage(error, '日程中心加载失败。'), 'error');
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
  }, [refreshToken]);

  const subtitle = useMemo(() => (
    loading
      ? '正在从后端加载日程、提醒规则和通知日志。'
      : '管理日常日程，追踪事件完成进度，支持重复事件和提醒。'
  ), [loading]);

  return (
    <div className="page-stack">
      <PageHeader
        title="日程管理"
        subtitle={subtitle}
      />

      <StatGrid
        className="schedule-overview-grid"
        items={[
          { label: '总日程数', value: `${overview.totalCount}` },
          { label: '进行中', value: `${overview.activeCount}` },
          { label: '已完成', value: `${overview.completedCount}` },
          { label: '重复事件', value: `${overview.recurringCount}`, helper: `提醒 ${overview.reminderCount} 项` },
          { label: '今日到期', value: `${overview.dueTodayCount}`, helper: `本周 ${overview.dueThisWeekCount} / 逾期 ${overview.overdueCount}` },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="日历视图、事件列表、提醒设置、通知日志和回收站全部以后端数据为准，tab 仅负责界面切换。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as ScheduleTab)} />
      </SectionCard>

      {tab === 'calendar' ? (
        <ScheduleCalendarSection
          settings={settings}
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      {tab === 'list' ? (
        <ScheduleEventsSection
          settings={settings}
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      {tab === 'settings' ? (
        <ScheduleSettingsSection
          settings={settings}
          showToast={showToast}
          onChanged={async () => {
            await hydrateNotificationCenterState();
            refreshPage();
          }}
        />
      ) : null}

      {tab === 'logs' ? (
        <ScheduleLogsSection
          showToast={showToast}
          refreshToken={refreshToken}
        />
      ) : null}

      {tab === 'trash' ? (
        <ScheduleTrashSection
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
