import { useEffect, useMemo } from 'react';

import { RentChannelsSection } from '../../components/finance/RentChannelsSection';
import { RentEntrySection } from '../../components/finance/RentEntrySection';
import { RentRecordsSection } from '../../components/finance/RentRecordsSection';
import { RentStatisticsSection } from '../../components/finance/RentStatisticsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Field, PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildInitialRentState,
  buildRentOverview,
  filterRentChannels,
  formatRentAmount,
  normalizeRentPageState,
} from '../../services/rent';
import type { RentPageState, RentTab } from '../../types/rent';

const STORAGE_KEY = 'lifeos_finance_rent_page';

const TAB_OPTIONS: Array<{ value: RentTab; label: string }> = [
  { value: 'records', label: '住房记录' },
  { value: 'entry', label: '录入编辑' },
  { value: 'statistics', label: '统计分析' },
  { value: 'channels', label: '渠道管理' },
];

export default function RentPage() {
  const [data, setData] = useLocalStorageState<RentPageState>(STORAGE_KEY, buildInitialRentState);
  const [tab, setTab] = usePageTab<RentTab>('records', TAB_OPTIONS.map((item) => item.value), 'rentTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeRentPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildRentOverview(
      normalizedData.records,
      normalizedData.channels,
      normalizedData.settings.activeUserId,
    ),
    [normalizedData.channels, normalizedData.records, normalizedData.settings.activeUserId],
  );

  const activeChannels = useMemo(
    () => filterRentChannels(normalizedData.channels, normalizedData.settings.activeUserId),
    [normalizedData.channels, normalizedData.settings.activeUserId],
  );

  const updateSettings = (patch: Partial<RentPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  const handleActiveUserChange = (value: string) => {
    updateSettings({
      activeUserId: value,
      recordsUserId: value,
      statisticsUserId: value,
      editingRecordId: '',
    });
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="房租水电"
        subtitle="把住房档案、费用录入、居住成本统计和渠道管理统一收进当前 LifeOS 财务体系，全部数据本地持久化，不依赖后端接口。"
      />

      <SectionCard
        title="当前上下文"
        description="这里决定房租水电页默认归属的用户。新增住房记录、渠道管理和统计分析都会沿用这组用户上下文。"
      >
        <div className="rent-context-grid">
          <Field
            label="当前用户 ID"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => handleActiveUserChange(event.target.value)}
            placeholder="例如：user-001"
          />
          <div className="rent-context-summary">
            <span>当前用户渠道 {activeChannels.length} 个</span>
            <span>住房记录 {overview.totalRecords} 条</span>
            <span>在住 {overview.activeRecords} 条</span>
          </div>
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizedData.settings.activeUserId || '未设置',
            helper: '录入、统计和渠道管理默认都跟随这位用户',
          },
          { label: '总记录数', value: `${overview.totalRecords} 条` },
          { label: '总居住天数', value: `${overview.totalStayDays} 天` },
          { label: '总成本', value: formatRentAmount(overview.totalCost), helper: '押金已排除在外' },
          { label: '平均单日成本', value: formatRentAmount(overview.avgDailyCost) },
          { label: '平均月租', value: formatRentAmount(overview.avgMonthlyCost) },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="住房记录负责查询与详情，录入编辑负责新增和修改，统计分析负责成本复盘，渠道管理提供录入与筛选来源。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as RentTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <RentRecordsSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.recordsUserId}
          records={normalizedData.records}
          channels={normalizedData.channels}
          onFilterUserIdChange={(value) => updateSettings({ recordsUserId: value })}
          onEditRecord={(recordId) => {
            updateSettings({ editingRecordId: recordId });
            setTab('entry');
          }}
          onCreateRecord={() => {
            updateSettings({ editingRecordId: '' });
            setTab('entry');
          }}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'entry' ? (
        <RentEntrySection
          activeUserId={normalizedData.settings.activeUserId}
          editingRecordId={normalizedData.settings.editingRecordId}
          records={normalizedData.records}
          channels={normalizedData.channels}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          onEditingRecordIdChange={(recordId) => updateSettings({ editingRecordId: recordId })}
          onFinishSave={() => setTab('records')}
          showToast={showToast}
        />
      ) : null}

      {tab === 'statistics' ? (
        <RentStatisticsSection
          userId={normalizedData.settings.statisticsUserId}
          records={normalizedData.records}
          channels={normalizedData.channels}
          onUserIdChange={(value) => updateSettings({ statisticsUserId: value })}
        />
      ) : null}

      {tab === 'channels' ? (
        <RentChannelsSection
          activeUserId={normalizedData.settings.activeUserId}
          records={normalizedData.records}
          channels={normalizedData.channels}
          onChangeChannels={(updater) => {
            setData((previous) => ({
              ...previous,
              channels: updater(previous.channels),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
