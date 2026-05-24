import { useEffect, useMemo } from 'react';

import { SubscriptionCategoriesSection } from '../../components/finance/SubscriptionCategoriesSection';
import { SubscriptionDashboardSection } from '../../components/finance/SubscriptionDashboardSection';
import { SubscriptionRecordsSection } from '../../components/finance/SubscriptionRecordsSection';
import { SubscriptionSettingsSection } from '../../components/finance/SubscriptionSettingsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  applySubscriptionReminderMarkers,
  buildDueSubscriptionReminders,
  buildInitialSubscriptionState,
  buildSubscriptionOverview,
  formatSubscriptionAmount,
  normalizeSubscriptionPageState,
} from '../../services/subscription';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { SubscriptionPageState, SubscriptionTab } from '../../types/subscription';

const STORAGE_KEY = 'lifeos_finance_subscription_page';

const TAB_OPTIONS: Array<{ value: SubscriptionTab; label: string }> = [
  { value: 'records', label: '订阅记录' },
  { value: 'dashboard', label: '统计看板' },
  { value: 'categories', label: '分类管理' },
  { value: 'settings', label: '提醒设置' },
];

export default function SubscriptionPage() {
  const [data, setData] = useLocalStorageState<SubscriptionPageState>(STORAGE_KEY, buildInitialSubscriptionState);
  const [tab, setTab] = usePageTab<SubscriptionTab>('records', TAB_OPTIONS.map((item) => item.value), 'subscriptionTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeSubscriptionPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildSubscriptionOverview(normalizedData.records, normalizedData.settings.leadDays),
    [normalizedData.records, normalizedData.settings.leadDays],
  );

  useEffect(() => {
    updateSceneConfig('subscription.renewal_upcoming', { enabled: normalizedData.settings.reminderEnabled });
    updateSceneConfig('subscription.expired', { enabled: normalizedData.settings.expiryDayReminderEnabled });
  }, [normalizedData.settings.expiryDayReminderEnabled, normalizedData.settings.reminderEnabled]);

  useEffect(() => {
    const dueReminders = buildDueSubscriptionReminders(normalizedData.records, normalizedData.settings);

    if (!dueReminders.length) {
      return;
    }

    dueReminders.forEach((item) => {
      enqueueSceneNotification(item.sceneId, { message: item.message });
    });

    setData((previous) => ({
      ...previous,
      records: applySubscriptionReminderMarkers(previous.records, dueReminders),
    }));
  }, [normalizedData.records, normalizedData.settings, setData]);

  const updateSettings = (patch: Partial<SubscriptionPageState['settings']>) => {
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
        title="服务订阅中心"
        subtitle="把软件会员、内容订阅和云服务统一收进当前 LifeOS 财务体系，续费提醒和逾期日志都接到通知中心统一处理。"
      />

      <SectionCard
        title="当前订阅摘要"
        description="这里会从整个订阅池里提炼出最值得关注的状态，方便快速看清支出压力、自动续费比例和临近到期情况。"
        action={<Tag tone="blue">{overview.nearestExpiryDate ? `最近到期：${overview.nearestExpiryDate}` : '暂无到期记录'}</Tag>}
      >
        <div className="subscription-context-summary">
          <div className="callout callout-neutral">
            <strong>续费提醒规则</strong>
            <span>
              {normalizedData.settings.reminderEnabled
                ? `提前 ${normalizedData.settings.leadDays} 天提醒`
                : '续费提醒已关闭'}
            </span>
          </div>
          <div className="callout callout-neutral">
            <strong>到期提醒</strong>
            <span>{normalizedData.settings.expiryDayReminderEnabled ? '到期当天与逾期都会记录' : '到期提醒已关闭'}</span>
          </div>
          <div className="callout callout-neutral">
            <strong>自动续费策略</strong>
            <span>{normalizedData.settings.includeAutoRenewInReminders ? '自动续费项也纳入提醒' : '默认跳过自动续费项'}</span>
          </div>
        </div>
      </SectionCard>

      <StatGrid
        className="subscription-top-summary"
        items={[
          { label: '总订阅数', value: `${overview.totalCount} 个` },
          { label: '活跃订阅', value: `${overview.activeCount} 个` },
          { label: '即将到期', value: `${overview.upcomingCount} 个`, accent: 'var(--color-warning)' },
          { label: '自动续费', value: `${overview.autoRenewCount} 个` },
          { label: '月均支出', value: formatSubscriptionAmount(overview.monthlyEstimate) },
          { label: '年度估算', value: formatSubscriptionAmount(overview.annualEstimate) },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="订阅记录、统计、分类和提醒设置共用同一套本地状态模型与通知中心联动规则。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as SubscriptionTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <SubscriptionRecordsSection
          records={normalizedData.records}
          categories={normalizedData.categories}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'dashboard' ? (
        <SubscriptionDashboardSection
          records={normalizedData.records}
          categories={normalizedData.categories}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
        />
      ) : null}

      {tab === 'categories' ? (
        <SubscriptionCategoriesSection
          categories={normalizedData.categories}
          records={normalizedData.records}
          onChangeCategories={(updater) => {
            setData((previous) => ({
              ...previous,
              categories: updater(previous.categories),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <SubscriptionSettingsSection
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
