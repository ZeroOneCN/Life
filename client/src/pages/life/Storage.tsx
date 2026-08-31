import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;

import { StorageArchiveSection } from '../../components/life/StorageArchiveSection';
import { StorageDashboardSection } from '../../components/life/StorageDashboardSection';
import { StorageItemsSection } from '../../components/life/StorageItemsSection';
import { StorageSettingsSection } from '../../components/life/StorageSettingsSection';
import { PageHeader } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { storageApi } from '../../services/storageApi';
import type { StorageOverviewSummary, StoragePageSettings, StorageTab } from '../../types/storage';

const TAB_OPTIONS: Array<{ value: StorageTab; label: string }> = [
  { value: 'items', label: '物品列表' },
  { value: 'dashboard', label: '成本看板' },
  { value: 'retired', label: '停用记录' },
  { value: 'settings', label: '页面设置' },
];

const EMPTY_OVERVIEW: StorageOverviewSummary = {
  totalCount: 0,
  activeCount: 0,
  retiredCount: 0,
  totalPurchaseAmount: 0,
  currentDailyCostTotal: 0,
  averageUsageDays: 0,
  currentMonthNewCount: 0,
  highestDailyCostItemName: '',
  highestDailyCost: 0,
};

const EMPTY_SETTINGS: StoragePageSettings = {
  includeRetiredInDashboard: true,
  defaultSort: 'latest',
  defaultDashboardRange: 'all',
};

export default function StoragePage() {
  const [tab, setTab] = usePageTab<StorageTab>(
    'items',
    TAB_OPTIONS.map((item) => item.value),
    'storageTab',
  );
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

  const subtitle = useMemo(() => '追踪个人物品位置、状态与关联信息', []);

  return (
    <div className="page-grid-wrapper">
      <Row gutter={[24, 20]}>
        <Col span={24}>
          <PageHeader
            title="物品追踪"
            subtitle={subtitle}
            actions={
              <PillTabs
                options={TAB_OPTIONS}
                value={tab}
                onChange={(value) => setTab(value as StorageTab)}
              />
            }
          />
        </Col>

        <Col span={24}>
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

          {tab === 'retired' ? (
            <StorageArchiveSection showToast={showToast} onChanged={refreshPage} />
          ) : null}

          {tab === 'settings' ? (
            <StorageSettingsSection
              settings={settings}
              showToast={showToast}
              onChanged={refreshPage}
            />
          ) : null}
        </Col>

        <Col span={24}>
          <Toast toast={toast} />
        </Col>
      </Row>
    </div>
  );
}
