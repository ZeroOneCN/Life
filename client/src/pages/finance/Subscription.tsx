import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;

import { SubscriptionCategoriesSection } from '../../components/finance/SubscriptionCategoriesSection';
import { SubscriptionDashboardSection } from '../../components/finance/SubscriptionDashboardSection';
import { SubscriptionRecordsSection } from '../../components/finance/SubscriptionRecordsSection';
import { SubscriptionSettingsSection } from '../../components/finance/SubscriptionSettingsSection';
import { PageHeader, StatGrid } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { findCreated, findDeletedIds, findUpdated } from '../../lib/collection';
import {
  getNotificationLogs,
  hydrateNotificationCenterState,
} from '../../services/notificationCenter';
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

export default function SubscriptionPage({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = usePageTab<SubscriptionTab>(
    'records',
    TAB_OPTIONS.map((item) => item.value),
    'subscriptionTab',
  );
  useBreadcrumbTail(TAB_OPTIONS.find((item) => item.value === tab)?.label);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [records, setRecords] = useState<SubscriptionRecord[]>([]);
  const [categories, setCategories] = useState<SubscriptionCategory[]>([]);
  const [overview, setOverview] = useState<SubscriptionOverviewSummary>(EMPTY_OVERVIEW);
  const [settings, setSettings] = useState<SubscriptionPageState['settings']>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(async () => {
    const [nextRecords, nextCategories, nextOverview, nextSettings] = await Promise.all([
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
  }, [reload, refreshToken]);

  const updateSettings = useCallback(
    async (patch: Partial<SubscriptionPageState['settings']>) => {
      try {
        const next = await subscriptionApi.updateSettings(patch);
        setSettings(next);
        await hydrateNotificationCenterState();
        showToast('订阅提醒设置已更新。');
      } catch (error) {
        showToast(buildApiErrorMessage(error, '订阅提醒设置更新失败。'), 'error');
      }
    },
    [showToast],
  );

  const handleRecordsChange = useCallback(
    async (updater: (items: SubscriptionRecord[]) => SubscriptionRecord[]) => {
      const previous = records;
      const next = updater(previous);
      setRecords(next);

      try {
        const created = findCreated(previous, next);
        const deletedIds = findDeletedIds(previous, next);
        const updated = findUpdated(previous, next);

        await Promise.all([
          ...created.map((item) =>
            subscriptionApi.createRecord({
              serviceName: item.serviceName,
              planName: item.planName,
              categoryId: item.categoryId,
              startDate: item.startDate,
              endDate: item.endDate,
              billingCycle: item.billingCycle,
              cyclePrice: item.cyclePrice,
              autoRenew: item.autoRenew,
              notes: item.notes,
            }),
          ),
          ...updated.map((item) =>
            subscriptionApi.updateRecord(item.id, {
              serviceName: item.serviceName,
              planName: item.planName,
              categoryId: item.categoryId,
              startDate: item.startDate,
              endDate: item.endDate,
              billingCycle: item.billingCycle,
              cyclePrice: item.cyclePrice,
              autoRenew: item.autoRenew,
              notes: item.notes,
            }),
          ),
          ...deletedIds.map((id) => subscriptionApi.deleteRecord(id)),
        ]);
        await reload();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '订阅记录保存失败。'), 'error');
        await reload();
      }
    },
    [records, reload, showToast],
  );

  const handleCategoriesChange = useCallback(
    async (updater: (items: SubscriptionCategory[]) => SubscriptionCategory[]) => {
      const previous = categories;
      const next = updater(previous);
      setCategories(next);

      try {
        const created = findCreated(previous, next);
        const deletedIds = findDeletedIds(previous, next);
        const updated = findUpdated(previous, next);

        await Promise.all([
          ...created.map((item) =>
            subscriptionApi.createCategory({
              name: item.name,
              description: item.description,
            }),
          ),
          ...updated.map((item) =>
            subscriptionApi.updateCategory(item.id, {
              name: item.name,
              description: item.description,
            }),
          ),
          ...deletedIds.map((id) => subscriptionApi.deleteCategory(id)),
        ]);
        await reload();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '分类保存失败。'), 'error');
        await reload();
      }
    },
    [categories, reload, showToast],
  );

  const summaryCards = useMemo(
    () => [
      { label: '总订阅数', value: `${overview.totalCount} 项` },
      { label: '活跃订阅', value: `${overview.activeCount} 项` },
      { label: '即将到期', value: `${overview.upcomingCount} 项` },
      { label: '自动续费', value: `${overview.autoRenewCount} 项` },
      { label: '月均支出', value: `¥${overview.monthlyEstimate.toFixed(2)}` },
      { label: '年度支出', value: `¥${overview.annualEstimate.toFixed(2)}` },
    ],
    [overview],
  );

  const recentLogs = useCallback(
    async () =>
      getNotificationLogs({
        page: 1,
        pageSize: 8,
        sceneIds: ['subscription.renewal_upcoming', 'subscription.expired'],
      }),
    [],
  );

  return (
    <div className="page-grid-wrapper">
      <Row gutter={[24, 20]}>
        <Col span={24}>
          {embedded ? (
            <div className="merged-tabs-top">
              <PillTabs
                options={TAB_OPTIONS}
                value={tab}
                onChange={(value) => setTab(value as SubscriptionTab)}
              />
            </div>
          ) : (
            <PageHeader
              title="服务订阅"
              subtitle="跟踪服务订阅、到期提醒与支出统计"
              actions={
                <>
                  <PillTabs
                    options={TAB_OPTIONS}
                    value={tab}
                    onChange={(value) => setTab(value as SubscriptionTab)}
                  />
                  <Tag tone="blue">{loading ? '同步中' : '后端已接入'}</Tag>
                </>
              }
            />
          )}
        </Col>

        <Col span={24}>
          <StatGrid className="subscription-top-summary" items={summaryCards} />
        </Col>

        <Col span={24}>
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
        </Col>

        <Col span={24}>
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
        </Col>

        <Col span={24}>
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
        </Col>

        <Col span={24}>
          {tab === 'settings' ? (
            <SubscriptionSettingsSection
              settings={settings}
              onSettingsChange={(patch) => {
                void updateSettings(patch);
              }}
            />
          ) : null}
        </Col>
      </Row>

      <Toast toast={toast} />
    </div>
  );
}
