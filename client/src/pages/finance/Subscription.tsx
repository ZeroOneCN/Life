import { useCallback, useEffect, useMemo, useState } from 'react';

import { SubscriptionCategoriesSection } from '../../components/finance/SubscriptionCategoriesSection';
import { SubscriptionDashboardSection } from '../../components/finance/SubscriptionDashboardSection';
import { SubscriptionRecordsSection } from '../../components/finance/SubscriptionRecordsSection';
import { SubscriptionSettingsSection } from '../../components/finance/SubscriptionSettingsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { getNotificationLogs, hydrateNotificationCenterState } from '../../services/notificationCenter';
import { subscriptionApi } from '../../services/subscriptionApi';
import type {
  SubscriptionCategory,
  SubscriptionOverviewSummary,
  SubscriptionPageState,
  SubscriptionRecord,
  SubscriptionTab,
} from '../../types/subscription';

const TAB_OPTIONS: Array<{ value: SubscriptionTab; label: string }> = [
  { value: 'records', label: '订阅记录' },
  { value: 'dashboard', label: '统计看板' },
  { value: 'categories', label: '分类管理' },
  { value: 'settings', label: '提醒设置' },
];

const EMPTY_OVERVIEW: SubscriptionOverviewSummary = {
  totalCount: 0,
  activeCount: 0,
  upcomingCount: 0,
  expiredCount: 0,
  autoRenewCount: 0,
  monthlyEstimate: 0,
  annualEstimate: 0,
  nearestExpiryDate: '',
};

const EMPTY_SETTINGS: SubscriptionPageState['settings'] = {
  recordsKeyword: '',
  recordsCategoryId: 'all',
  recordsStatus: 'all',
  recordsAutoRenewFilter: 'all',
  recordsExpiryStartDate: '',
  recordsExpiryEndDate: '',
  dashboardRangeDays: 90,
  reminderEnabled: true,
  expiryDayReminderEnabled: true,
  leadDays: 7,
  includeAutoRenewInReminders: false,
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

export default function SubscriptionPage() {
  const [tab, setTab] = usePageTab<SubscriptionTab>('records', TAB_OPTIONS.map((item) => item.value), 'subscriptionTab');
  const { toast, showToast } = useToastState();
  const [records, setRecords] = useState<SubscriptionRecord[]>([]);
  const [categories, setCategories] = useState<SubscriptionCategory[]>([]);
  const [overview, setOverview] = useState<SubscriptionOverviewSummary>(EMPTY_OVERVIEW);
  const [settings, setSettings] = useState<SubscriptionPageState['settings']>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(async () => {
    const [
      nextRecords,
      nextCategories,
      nextOverview,
      nextSettings,
    ] = await Promise.all([
      subscriptionApi.listRecords({ page: 1, page_size: 1000 }),
      subscriptionApi.listCategories(),
      subscriptionApi.getOverview(),
      subscriptionApi.getSettings(),
    ]);

    setRecords(nextRecords.items);
    setCategories(nextCategories.items);
    setOverview(nextOverview);
    setSettings(nextSettings);
  }, []);

  const refreshPage = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
        await hydrateNotificationCenterState();
      } catch (error) {
        if (!cancelled) {
          showToast(buildApiErrorMessage(error, '订阅中心加载失败。'), 'error');
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
  }, [reload, refreshToken, showToast]);

  const updateSettings = useCallback(async (patch: Partial<SubscriptionPageState['settings']>) => {
    try {
      const next = await subscriptionApi.updateSettings(patch);
      setSettings(next);
      await hydrateNotificationCenterState();
      showToast('订阅提醒设置已更新。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '订阅提醒设置更新失败。'), 'error');
    }
  }, [showToast]);

  const handleRecordsChange = useCallback(async (updater: (items: SubscriptionRecord[]) => SubscriptionRecord[]) => {
    const previous = records;
    const next = updater(previous);
    setRecords(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => subscriptionApi.createRecord({
          serviceName: item.serviceName,
          planName: item.planName,
          categoryId: item.categoryId,
          startDate: item.startDate,
          endDate: item.endDate,
          billingCycle: item.billingCycle,
          cyclePrice: item.cyclePrice,
          autoRenew: item.autoRenew,
          notes: item.notes,
        })),
        ...updated.map((item) => subscriptionApi.updateRecord(item.id, {
          serviceName: item.serviceName,
          planName: item.planName,
          categoryId: item.categoryId,
          startDate: item.startDate,
          endDate: item.endDate,
          billingCycle: item.billingCycle,
          cyclePrice: item.cyclePrice,
          autoRenew: item.autoRenew,
          notes: item.notes,
        })),
        ...deletedIds.map((id) => subscriptionApi.deleteRecord(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '订阅记录保存失败。'), 'error');
      await reload();
    }
  }, [records, reload, showToast]);

  const handleCategoriesChange = useCallback(async (updater: (items: SubscriptionCategory[]) => SubscriptionCategory[]) => {
    const previous = categories;
    const next = updater(previous);
    setCategories(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => subscriptionApi.createCategory({
          name: item.name,
          description: item.description,
        })),
        ...updated.map((item) => subscriptionApi.updateCategory(item.id, {
          name: item.name,
          description: item.description,
        })),
        ...deletedIds.map((id) => subscriptionApi.deleteCategory(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '分类保存失败。'), 'error');
      await reload();
    }
  }, [categories, reload, showToast]);

  const summaryCards = useMemo(() => ([
    { label: '总订阅数', value: `${overview.totalCount} 项` },
    { label: '活跃订阅', value: `${overview.activeCount} 项` },
    { label: '即将到期', value: `${overview.upcomingCount} 项` },
    { label: '自动续费', value: `${overview.autoRenewCount} 项` },
    { label: '月均支出', value: `¥${overview.monthlyEstimate.toFixed(2)}` },
    { label: '年度支出', value: `¥${overview.annualEstimate.toFixed(2)}` },
  ]), [overview]);

  const recentLogs = useCallback(async () => getNotificationLogs({
    page: 1,
    pageSize: 8,
    sceneIds: ['subscription.renewal_upcoming', 'subscription.expired'],
  }), []);

  return (
    <div className="page-stack">
      <PageHeader
        title="服务订阅中心"
        subtitle={loading ? '正在从后端加载订阅记录、分类和提醒设置。' : '订阅中心已切换为后端唯一数据源。'}
        actions={<Tag tone="blue">{loading ? '同步中' : '后端已接入'}</Tag>}
      />

      <StatGrid className="subscription-top-summary" items={summaryCards} />

      <SectionCard
        title="业务视图"
        description="订阅记录、看板、分类与提醒设置共用同一套后端数据模型，并统一联动通知中心。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as SubscriptionTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <SubscriptionRecordsSection
          records={records}
          categories={categories}
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
          onChangeRecords={(updater) => {
            void handleRecordsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'dashboard' ? (
        <SubscriptionDashboardSection
          records={records}
          categories={categories}
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
        />
      ) : null}

      {tab === 'categories' ? (
        <SubscriptionCategoriesSection
          categories={categories}
          records={records}
          onChangeCategories={(updater) => {
            void handleCategoriesChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <SubscriptionSettingsSection
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
