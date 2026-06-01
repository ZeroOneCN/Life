import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RentChannelsSection } from '../../components/finance/RentChannelsSection';
import { RentEntrySection } from '../../components/finance/RentEntrySection';
import { RentRecordsSection } from '../../components/finance/RentRecordsSection';
import { RentStatisticsSection } from '../../components/finance/RentStatisticsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { useAuthState } from '../../services/auth';
import { formatRentAmount } from '../../services/rent';
import { rentApi } from '../../services/rentApi';
import type {
  RentChannel,
  RentHousingRecord,
  RentOverviewSummary,
  RentPageState,
  RentTab,
} from '../../types/rent';

const TAB_OPTIONS: Array<{ value: RentTab; label: string }> = [
  { value: 'records', label: '住房记录' },
  { value: 'entry', label: '录入编辑' },
  { value: 'statistics', label: '统计分析' },
  { value: 'channels', label: '渠道管理' },
];

const EMPTY_SETTINGS: RentPageState['settings'] = {
  activeUserId: '',
  recordsUserId: '',
  statisticsUserId: '',
  editingRecordId: '',
};

const EMPTY_OVERVIEW: RentOverviewSummary = {
  totalRecords: 0,
  totalStayDays: 0,
  totalCost: 0,
  avgDailyCost: 0,
  avgMonthlyCost: 0,
  activeRecords: 0,
  endedRecords: 0,
  totalChannels: 0,
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

function hydrateSettings(
  incoming: Partial<RentPageState['settings']> | null | undefined,
  currentUserId: string,
): RentPageState['settings'] {
  return {
    ...EMPTY_SETTINGS,
    ...incoming,
    activeUserId: currentUserId || incoming?.activeUserId || '',
    recordsUserId: currentUserId || incoming?.recordsUserId || '',
    statisticsUserId: currentUserId || incoming?.statisticsUserId || '',
  };
}

export default function RentPage() {
  const authState = useAuthState();
  const currentUserId = authState.session?.user.id ?? '';
  const [tab, setTab] = usePageTab<RentTab>('records', TAB_OPTIONS.map((item) => item.value), 'rentTab');
  const [records, setRecords] = useState<RentHousingRecord[]>([]);
  const [channels, setChannels] = useState<RentChannel[]>([]);
  const [settings, setSettings] = useState<RentPageState['settings']>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<RentOverviewSummary>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const tempChannelIdsRef = useRef(new Map<string, Promise<string>>());
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [recordsResponse, channelsResponse, overviewResponse, settingsResponse] = await Promise.all([
      rentApi.listRecords({ page: 1, page_size: 1000 }),
      rentApi.listChannels(),
      rentApi.getOverview(),
      rentApi.getSettings(),
    ]);

    setRecords(recordsResponse.items);
    setChannels(channelsResponse.items);
    setOverview(overviewResponse);
    setSettings(hydrateSettings(settingsResponse, currentUserId));

    if (
      currentUserId
      && (
        settingsResponse.activeUserId !== currentUserId
        || settingsResponse.recordsUserId !== currentUserId
        || settingsResponse.statisticsUserId !== currentUserId
      )
    ) {
      void rentApi.updateSettings({
        activeUserId: currentUserId,
        recordsUserId: currentUserId,
        statisticsUserId: currentUserId,
      }).catch(() => undefined);
    }
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
      } catch (error) {
        if (!cancelled) {
          showToastRef.current(buildApiErrorMessage(error, '租房页面加载失败。'), 'error');
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
  }, [reload]);

  const updateSettings = useCallback(async (patch: Partial<RentPageState['settings']>) => {
    try {
      const next = await rentApi.updateSettings({
        ...patch,
        activeUserId: currentUserId || patch.activeUserId,
        recordsUserId: currentUserId || patch.recordsUserId,
        statisticsUserId: currentUserId || patch.statisticsUserId,
      });
      setSettings(hydrateSettings(next, currentUserId));
      const nextOverview = await rentApi.getOverview();
      setOverview(nextOverview);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '租房设置保存失败。'), 'error');
    }
  }, [currentUserId, showToast]);

  const resolveChannelId = useCallback(async (channelId: string) => {
    if (!channelId) {
      return channelId;
    }

    if (channels.some((item) => item.id === channelId)) {
      return channelId;
    }

    const pending = tempChannelIdsRef.current.get(channelId);
    if (pending) {
      return pending;
    }

    return channelId;
  }, [channels]);

  const handleRecordsChange = useCallback(async (updater: (items: RentHousingRecord[]) => RentHousingRecord[]) => {
    const previous = records;
    const next = updater(previous);
    setRecords(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map(async (item) => rentApi.createRecord({
          userId: currentUserId || item.userId,
          address: item.address,
          channelId: await resolveChannelId(item.channelId),
          moveInDate: item.moveInDate,
          moveOutDate: item.moveOutDate,
          rent: item.rent,
          deposit: item.deposit,
          electricityFee: item.electricityFee,
          waterFee: item.waterFee,
          gasFee: item.gasFee,
          agencyFee: item.agencyFee,
          cleaningFee: item.cleaningFee,
          laundryFee: item.laundryFee,
          serviceFee: item.serviceFee,
          notes: item.notes,
        })),
        ...updated.map(async (item) => rentApi.updateRecord(item.id, {
          userId: currentUserId || item.userId,
          address: item.address,
          channelId: await resolveChannelId(item.channelId),
          moveInDate: item.moveInDate,
          moveOutDate: item.moveOutDate,
          rent: item.rent,
          deposit: item.deposit,
          electricityFee: item.electricityFee,
          waterFee: item.waterFee,
          gasFee: item.gasFee,
          agencyFee: item.agencyFee,
          cleaningFee: item.cleaningFee,
          laundryFee: item.laundryFee,
          serviceFee: item.serviceFee,
          notes: item.notes,
        })),
        ...deletedIds.map((id) => rentApi.deleteRecord(id)),
      ]);

      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '住房记录保存失败。'), 'error');
      await reload();
    }
  }, [currentUserId, records, reload, resolveChannelId, showToast]);

  const handleChannelsChange = useCallback(async (updater: (items: RentChannel[]) => RentChannel[]) => {
    const previous = channels;
    const next = updater(previous);
    setChannels(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => {
          const request = rentApi.createChannel({
            userId: currentUserId || item.userId,
            name: item.name,
          }).then((createdItem) => createdItem.id);
          tempChannelIdsRef.current.set(item.id, request);
          return request;
        }),
        ...updated.map((item) => rentApi.updateChannel(item.id, {
          userId: currentUserId || item.userId,
          name: item.name,
        })),
        ...deletedIds.map((id) => rentApi.deleteChannel(id)),
      ]);

      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '租房渠道保存失败。'), 'error');
      await reload();
    }
  }, [channels, currentUserId, reload, showToast]);

  const activeUserLabel = authState.session?.user.nickname || authState.session?.user.username || '当前登录用户';
  const currentUserEmail = authState.session?.user.email || '页面仅展示当前登录用户的租房数据';
  const activeChannels = useMemo(
    () => channels.filter((channel) => !settings.activeUserId || channel.userId === settings.activeUserId),
    [channels, settings.activeUserId],
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="房租水电"
        subtitle={loading ? '正在从后端加载住房记录、渠道和统计。' : '租房页已切换为后端唯一业务数据源，刷新页面后数据直接来自数据库。'}
      />

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: activeUserLabel,
            helper: currentUserEmail,
          },
          { label: '总记录数', value: `${overview.totalRecords} 条` },
          { label: '总居住天数', value: `${overview.totalStayDays} 天` },
          { label: '总成本', value: formatRentAmount(overview.totalCost), helper: '押金不计入总成本' },
          { label: '平均单日成本', value: formatRentAmount(overview.avgDailyCost) },
          { label: '平均月租', value: formatRentAmount(overview.avgMonthlyCost) },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="住房记录、录入编辑、统计分析和渠道管理统一基于后端数据工作。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as RentTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <RentRecordsSection
          currentUserLabel={activeUserLabel}
          activeUserId={settings.activeUserId}
          filterUserId={settings.recordsUserId}
          records={records}
          channels={channels}
          onFilterUserIdChange={() => {
            void updateSettings({ recordsUserId: currentUserId || settings.recordsUserId });
          }}
          onEditRecord={(recordId) => {
            void updateSettings({ editingRecordId: recordId });
            setTab('entry');
          }}
          onCreateRecord={() => {
            void updateSettings({ editingRecordId: '' });
            setTab('entry');
          }}
          onChangeRecords={(updater) => {
            void handleRecordsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'entry' ? (
        <RentEntrySection
          currentUserLabel={activeUserLabel}
          activeUserId={settings.activeUserId}
          editingRecordId={settings.editingRecordId}
          records={records}
          channels={channels}
          onChangeRecords={(updater) => {
            void handleRecordsChange(updater);
          }}
          onEditingRecordIdChange={(recordId) => {
            void updateSettings({ editingRecordId: recordId });
          }}
          onFinishSave={() => setTab('records')}
          showToast={showToast}
        />
      ) : null}

      {tab === 'statistics' ? (
        <RentStatisticsSection
          userId={settings.statisticsUserId}
          records={records}
          channels={channels}
          onUserIdChange={() => {
            void updateSettings({ statisticsUserId: currentUserId || settings.statisticsUserId });
          }}
        />
      ) : null}

      {tab === 'channels' ? (
        <RentChannelsSection
          currentUserLabel={activeUserLabel}
          activeUserId={settings.activeUserId}
          records={records}
          channels={channels}
          onChangeChannels={(updater) => {
            void handleChannelsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
