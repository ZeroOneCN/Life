import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StorageArchiveSection } from '../../components/life/StorageArchiveSection';
import { StorageDashboardSection } from '../../components/life/StorageDashboardSection';
import { StorageItemsSection } from '../../components/life/StorageItemsSection';
import { StorageSettingsSection } from '../../components/life/StorageSettingsSection';
import { PageHeader, SectionCard } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { storageApi } from '../../services/storageApi';
import type { StorageOverviewSummary, StoragePageSettings, StorageTab } from '../../types/storage';

const TAB_OPTIONS: Array<{ value: StorageTab; label: string }> = [
  { value: 'items', label: '物品列表' },
  { value: 'dashboard', label: '成本看板' },
  { value: 'archive', label: '归档记录' },
  { value: 'settings', label: '页面设置' },
];

const EMPTY_OVERVIEW: StorageOverviewSummary = {
  totalCount: 0,
  activeCount: 0,
  archivedCount: 0,
  totalPurchaseAmount: 0,
  currentDailyCostTotal: 0,
  averageUsageDays: 0,
  currentMonthNewCount: 0,
  highestDailyCostItemName: '',
  highestDailyCost: 0,
};

const EMPTY_SETTINGS: StoragePageSettings = {
  includeArchivedInDashboard: true,
  defaultSort: 'latest',
  defaultDashboardRange: 'all',
};

export default function StoragePage() {
  const [tab, setTab] = usePageTab<StorageTab>('items', TAB_OPTIONS.map((item) => item.value), 'storageTab');
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [overview, setOverview] = useState<StorageOverviewSummary>(EMPTY_OVERVIEW);
  const [settings, setSettings] = useState<StoragePageSettings>(EMPTY_SETTINGS);
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
          storageApi.getOverview(),
          storageApi.getSettings(),
        ]);

        if (cancelled) {
          return;
        }

        setOverview(nextOverview);
        setSettings(nextSettings);
      } catch (error) {
        if (!cancelled) {
          showToast(buildApiErrorMessage(error, '物品追踪加载失败。'), 'error');
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
      ? '正在从后端加载物品、看板和设置。'
      : '物品追踪已经切到后端唯一数据源，页面只保留视图级内存状态。'
  ), [loading]);

  return (
    <div className="page-stack">
      <PageHeader
        title="物品追踪"
        subtitle={subtitle}
      />

      <SectionCard
        title="业务视图"
        description="物品列表、成本看板、归档记录和页面设置都以后端数据为准，tab 仅负责界面切换。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as StorageTab)} />
      </SectionCard>

      {tab === 'items' ? (
        <StorageItemsSection
          settings={settings}
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      {tab === 'dashboard' ? (
        <StorageDashboardSection
          settings={settings}
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      {tab === 'archive' ? (
        <StorageArchiveSection
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      {tab === 'settings' ? (
        <StorageSettingsSection
          settings={settings}
          showToast={showToast}
          onChanged={refreshPage}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
