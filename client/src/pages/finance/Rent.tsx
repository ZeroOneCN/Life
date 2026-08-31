import { useCallback, useEffect, useRef, useState } from 'react';
import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;

import { RentChannelsSection } from '../../components/finance/RentChannelsSection';
import { RentEntrySection } from '../../components/finance/RentEntrySection';
import { RentRecordsSection } from '../../components/finance/RentRecordsSection';
import { RentStatisticsSection } from '../../components/finance/RentStatisticsSection';
import { RentUtilityBillsSection } from '../../components/finance/RentUtilityBillsSection';
import { PageHeader, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { findCreated, findDeletedIds, findUpdated } from '../../lib/collection';
import { formatRentAmount } from '../../services/rent';
import { rentApi } from '../../services/rentApi';
import type {
  RentChannel,
  RentHousingRecord,
  RentOverviewSummary,
  RentPageState,
  RentTab,
  RentUtilityBill,
} from '../../types/rent';

const TAB_OPTIONS: Array<{ value: RentTab; label: string }> = [
  { value: 'records', label: '住房记录' },
  { value: 'entry', label: '录入编辑' },
  { value: 'statistics', label: '统计分析' },
  { value: 'channels', label: '渠道管理' },
  { value: 'utilityBills', label: '水电账单' },
];

const EMPTY_SETTINGS: RentPageState['settings'] = {
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

function hydrateSettings(
  incoming: Partial<RentPageState['settings']> | null | undefined,
): RentPageState['settings'] {
  return {
    ...EMPTY_SETTINGS,
    ...incoming,
  };
}

export default function RentPage({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = usePageTab<RentTab>(
    'records',
    TAB_OPTIONS.map((item) => item.value),
    'rentTab',
  );
  useBreadcrumbTail(TAB_OPTIONS.find((item) => item.value === tab)?.label);
  const [records, setRecords] = useState<RentHousingRecord[]>([]);
  const [channels, setChannels] = useState<RentChannel[]>([]);
  const [settings, setSettings] = useState<RentPageState['settings']>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<RentOverviewSummary>(EMPTY_OVERVIEW);
  const [utilityBills, setUtilityBills] = useState<RentUtilityBill[]>([]);
  const [activeBillRecordId, setActiveBillRecordId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const tempChannelIdsRef = useRef(new Map<string, Promise<string>>());
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [recordsResponse, channelsResponse, overviewResponse, settingsResponse, billsResponse] =
      await Promise.all([
        rentApi.listRecords({ page: 1, page_size: 1000 }),
        rentApi.listChannels(),
        rentApi.getOverview(),
        rentApi.getSettings(),
        rentApi.listUtilityBills(),
      ]);

    setRecords(recordsResponse.items);
    setChannels(channelsResponse.items);
    setOverview(overviewResponse);
    setSettings(hydrateSettings(settingsResponse));
    setUtilityBills(billsResponse);
  }, []);

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

  const updateSettings = useCallback(
    async (patch: Partial<RentPageState['settings']>) => {
      try {
        const next = await rentApi.updateSettings(patch);
        setSettings(hydrateSettings(next));
        const nextOverview = await rentApi.getOverview();
        setOverview(nextOverview);
      } catch (error) {
        showToast(buildApiErrorMessage(error, '租房设置保存失败。'), 'error');
      }
    },
    [showToast],
  );

  const resolveChannelId = useCallback(
    async (channelId: string) => {
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
    },
    [channels],
  );

  const handleRecordsChange = useCallback(
    async (updater: (items: RentHousingRecord[]) => RentHousingRecord[]) => {
      const previous = records;
      const next = updater(previous);
      setRecords(next);

      try {
        const created = findCreated(previous, next);
        const deletedIds = findDeletedIds(previous, next);
        const updated = findUpdated(previous, next);

        await Promise.all([
          ...created.map(async (item) =>
            rentApi.createRecord({
              address: item.address,
              addressShort: item.addressShort,
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
              orientation: item.orientation,
              notes: item.notes,
              payCycle: item.payCycle,
              rentPerMonth: item.rentPerMonth,
            }),
          ),
          ...updated.map(async (item) =>
            rentApi.updateRecord(item.id, {
              address: item.address,
              addressShort: item.addressShort,
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
              orientation: item.orientation,
              notes: item.notes,
              payCycle: item.payCycle,
              rentPerMonth: item.rentPerMonth,
            }),
          ),
          ...deletedIds.map((id) => rentApi.deleteRecord(id)),
        ]);

        await reload();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '住房记录保存失败。'), 'error');
        await reload();
      }
    },
    [records, reload, resolveChannelId, showToast],
  );

  const handleChannelsChange = useCallback(
    async (updater: (items: RentChannel[]) => RentChannel[]) => {
      const previous = channels;
      const next = updater(previous);
      setChannels(next);

      try {
        const created = findCreated(previous, next);
        const deletedIds = findDeletedIds(previous, next);
        const updated = findUpdated(previous, next);

        await Promise.all([
          ...created.map((item) => {
            const request = rentApi
              .createChannel({
                name: item.name,
              })
              .then((createdItem) => createdItem.id);
            tempChannelIdsRef.current.set(item.id, request);
            return request;
          }),
          ...updated.map((item) =>
            rentApi.updateChannel(item.id, {
              name: item.name,
            }),
          ),
          ...deletedIds.map((id) => rentApi.deleteChannel(id)),
        ]);

        await reload();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '租房渠道保存失败。'), 'error');
        await reload();
      }
    },
    [channels, reload, showToast],
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
                onChange={(value) => setTab(value as RentTab)}
              />
            </div>
          ) : (
            <PageHeader
              title="房租水电"
              subtitle="管理住房记录、水电账单与统计分析"
              actions={
                <PillTabs
                  options={TAB_OPTIONS}
                  value={tab}
                  onChange={(value) => setTab(value as RentTab)}
                />
              }
            />
          )}
        </Col>

        <Col span={24}>
          <StatGrid
            items={[
              { label: '总记录数', value: `${overview.totalRecords} 条` },
              { label: '总居住天数', value: `${overview.totalStayDays} 天` },
              {
                label: '总成本',
                value: formatRentAmount(overview.totalCost),
                helper: '押金不计入总成本',
              },
              { label: '平均单日成本', value: formatRentAmount(overview.avgDailyCost) },
              { label: '平均月租', value: formatRentAmount(overview.avgMonthlyCost) },
            ]}
          />
        </Col>

        <Col span={24}>
          {tab === 'records' ? (
            <RentRecordsSection
              records={records}
              channels={channels}
              utilityBills={utilityBills}
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
              onManageUtilityBills={(recordId) => {
                setActiveBillRecordId(recordId);
                setTab('utilityBills');
              }}
              showToast={showToast}
            />
          ) : null}
        </Col>

        <Col span={24}>
          {tab === 'entry' ? (
            <RentEntrySection
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
        </Col>

        <Col span={24}>
          {tab === 'statistics' ? (
            <RentStatisticsSection
              records={records}
              channels={channels}
              utilityBills={utilityBills}
            />
          ) : null}
        </Col>

        <Col span={24}>
          {tab === 'channels' ? (
            <RentChannelsSection
              records={records}
              channels={channels}
              onChangeChannels={(updater) => {
                void handleChannelsChange(updater);
              }}
              showToast={showToast}
            />
          ) : null}
        </Col>

        <Col span={24}>
          {tab === 'utilityBills' ? (
            <RentUtilityBillsSection
              recordId={activeBillRecordId}
              recordAddress={
                activeBillRecordId
                  ? (records.find((r) => r.id === activeBillRecordId)?.address ?? '')
                  : ''
              }
              showToast={showToast}
            />
          ) : null}
        </Col>
      </Row>

      <Toast toast={toast} />
    </div>
  );
}
