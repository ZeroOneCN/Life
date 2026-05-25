import { useEffect, useMemo } from 'react';

import { StorageArchiveSection } from '../../components/life/StorageArchiveSection';
import { StorageDashboardSection } from '../../components/life/StorageDashboardSection';
import { StorageItemsSection } from '../../components/life/StorageItemsSection';
import { StorageSettingsSection } from '../../components/life/StorageSettingsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildInitialStorageState,
  buildStorageOverview,
  normalizeStoragePageState,
} from '../../services/storage';
import type { StoragePageState, StorageTab } from '../../types/storage';

const STORAGE_KEY = 'lifeos_life_storage_page';

const TAB_OPTIONS: Array<{ value: StorageTab; label: string }> = [
  { value: 'items', label: '物品列表' },
  { value: 'dashboard', label: '成本看板' },
  { value: 'archive', label: '归档记录' },
  { value: 'settings', label: '页面设置' },
];

export default function StoragePage() {
  const [data, setData] = useLocalStorageState<StoragePageState>(STORAGE_KEY, buildInitialStorageState);
  const [tab, setTab] = usePageTab<StorageTab>('items', TAB_OPTIONS.map((item) => item.value), 'storageTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeStoragePageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildStorageOverview(normalizedData.items, normalizedData.settings),
    [normalizedData.items, normalizedData.settings],
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="物品追踪"
        subtitle="把每件物品的购买时间、购买价格和结束使用时间收进同一套本地台账里，系统会自动按自然日摊销成本，帮你看清每样东西每天到底花了多少钱。"
      />

      <StatGrid
        className="storage-overview-grid"
        items={[
          { label: '总物品数', value: `${overview.totalCount} 件` },
          { label: '使用中物品数', value: `${overview.activeCount} 件` },
          { label: '已归档物品数', value: `${overview.archivedCount} 件` },
          { label: '累计购入金额', value: `¥${overview.totalPurchaseAmount.toFixed(2)}` },
          { label: '当前总日均成本', value: `¥${overview.currentDailyCostTotal.toFixed(2)}` },
          { label: '平均持有天数', value: `${overview.averageUsageDays} 天` },
          { label: '本月新增物品数', value: `${overview.currentMonthNewCount} 件` },
          {
            label: '当前最高日均成本物品',
            value: overview.highestDailyCostItemName,
            helper: overview.highestDailyCost ? `¥${overview.highestDailyCost.toFixed(2)} / 天` : '暂无数据',
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="物品列表、成本看板、归档记录和页面设置共享同一套本地状态模型，围绕“买入价格 ÷ 使用天数”的主线统一联动。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as StorageTab)} />
      </SectionCard>

      {tab === 'items' ? (
        <StorageItemsSection
          items={normalizedData.items}
          settings={normalizedData.settings}
          onChangeItems={(updater) => {
            setData((previous) => ({
              ...previous,
              items: updater(previous.items),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'dashboard' ? (
        <StorageDashboardSection
          items={normalizedData.items}
          settings={normalizedData.settings}
          onSettingsChange={(patch) => {
            setData((previous) => ({
              ...previous,
              settings: {
                ...previous.settings,
                ...patch,
              },
            }));
          }}
        />
      ) : null}

      {tab === 'archive' ? (
        <StorageArchiveSection
          items={normalizedData.items}
          settings={normalizedData.settings}
          onChangeItems={(updater) => {
            setData((previous) => ({
              ...previous,
              items: updater(previous.items),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <StorageSettingsSection
          settings={normalizedData.settings}
          onSettingsChange={(patch) => {
            setData((previous) => ({
              ...previous,
              settings: {
                ...previous.settings,
                ...patch,
              },
            }));
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
