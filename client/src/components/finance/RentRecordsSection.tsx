import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag } from '../ui';
import {
  RENT_ALL_CHANNELS,
  RENT_RECORD_PAGE_SIZE,
  buildRentRecordSnapshot,
  deleteRentRecord,
  filterBillsByRecordId,
  filterRentChannels,
  filterRentRecords,
  formatRentAmount,
  summarizeUtilityBills,
} from '../../services/rent';
import type { RentChannel, RentHousingRecord, RentUtilityBill } from '../../types/rent';

interface RentRecordsSectionProps {
  records: RentHousingRecord[];
  channels: RentChannel[];
  utilityBills: RentUtilityBill[];
  onEditRecord: (recordId: string) => void;
  onCreateRecord: () => void;
  onChangeRecords: (updater: (records: RentHousingRecord[]) => RentHousingRecord[]) => void;
  onManageUtilityBills: (recordId: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

function getOccupancyLabel(value: 'all' | 'active' | 'ended') {
  if (value === 'active') {
    return '在住';
  }

  if (value === 'ended') {
    return '已退租';
  }

  return '全部状态';
}

export function RentRecordsSection({
  records,
  channels,
  utilityBills,
  onEditRecord,
  onCreateRecord,
  onChangeRecords,
  onManageUtilityBills,
  showToast,
}: RentRecordsSectionProps) {
  const [keyword, setKeyword] = useState('');
  const [channelFilter, setChannelFilter] = useState(RENT_ALL_CHANNELS);
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [page, setPage] = useState(1);
  const [detailRecord, setDetailRecord] = useState<RentHousingRecord | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const availableChannels = useMemo(
    () => filterRentChannels(channels),
    [channels],
  );

  const filteredRecords = useMemo(
    () => filterRentRecords(records, {
      keyword,
      channelId: channelFilter,
      occupancy: occupancyFilter,
    }),
    [channelFilter, keyword, occupancyFilter, records],
  );

  useEffect(() => {
    setPage(1);
  }, [keyword, channelFilter, occupancyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / RENT_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * RENT_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + RENT_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const totals = filteredRecords.reduce((accumulator, record) => {
      const snapshot = buildRentRecordSnapshot(record);
      accumulator.totalCost += snapshot.totalCost;
      accumulator.totalStayDays += snapshot.stayDays;
      accumulator.activeCount += snapshot.occupancyStatus === 'active' ? 1 : 0;
      return accumulator;
    }, {
      totalCost: 0,
      totalStayDays: 0,
      activeCount: 0,
    });

    return {
      count: filteredRecords.length,
      totalCost: totals.totalCost,
      totalStayDays: totals.totalStayDays,
      activeCount: totals.activeCount,
    };
  }, [filteredRecords]);

  const columns = useMemo(() => [
    { key: 'address', title: '住房地址', dataIndex: 'address' as const },
    { key: 'channelName', title: '渠道', dataIndex: 'channelName' as const, align: 'center' as const },
    { key: 'moveInDate', title: '入住日期', dataIndex: 'moveInDate' as const, align: 'center' as const },
    {
      key: 'orientation',
      title: '朝向',
      dataIndex: 'orientation' as const,
      align: 'center' as const,
      render: (value: unknown) => (value as string) || '-',
    },
    {
      key: 'moveOutDate',
      title: '退租日期',
      align: 'center' as const,
      render: (_value: unknown, row: RentHousingRecord) => row.moveOutDate || '仍在住',
    },
    {
      key: 'totalCost',
      title: '总成本',
      align: 'right' as const,
      render: (_value: unknown, row: RentHousingRecord) => formatRentAmount(buildRentRecordSnapshot(row).totalCost),
    },
    {
      key: 'stayDays',
      title: '居住天数',
      align: 'center' as const,
      render: (_value: unknown, row: RentHousingRecord) => `${buildRentRecordSnapshot(row).stayDays} 天`,
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: RentHousingRecord) => (
        <div className="fitness-row-actions">
          <Btn tone="secondary" onClick={() => setDetailRecord(row)}>详情</Btn>
          <Btn tone="secondary" onClick={() => onEditRecord(row.id)}>编辑</Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], [onEditRecord]);

  const detailSnapshot = detailRecord ? buildRentRecordSnapshot(detailRecord) : null;

  return (
    <SectionCard
      title="住房记录"
      description="按用户维度查看住房档案，支持地址关键词、渠道和在住状态筛选，并可查看完整费用明细与派生成本。"
      action={<Btn tone="primary" onClick={onCreateRecord}>新增住房记录</Btn>}
    >
      <div className="page-stack">
        <div className="callout callout-info">
          押金会保留展示，但不会混入总成本、单日成本和渠道统计。
        </div>

        <div className="rent-records-filter-grid">
          <Field
            label="地址关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索地址、渠道或备注"
          />
          <SelectField
            label="渠道筛选"
            value={channelFilter}
            onChange={(event) => setChannelFilter(event.target.value)}
          >
            <option value={RENT_ALL_CHANNELS}>全部渠道</option>
            {availableChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="在住状态"
            value={occupancyFilter}
            onChange={(event) => setOccupancyFilter(event.target.value as 'all' | 'active' | 'ended')}
          >
            <option value="all">全部</option>
            <option value="active">在住</option>
            <option value="ended">已退租</option>
          </SelectField>
        </div>

        <StatGrid
          className="rent-summary-grid rent-record-summary-grid"
          items={[
            { label: '筛选结果', value: `${summary.count} 条`, helper: `当前状态：${getOccupancyLabel(occupancyFilter)}` },
            { label: '累计居住天数', value: `${summary.totalStayDays} 天` },
            { label: '累计总成本', value: formatRentAmount(summary.totalCost) },
            { label: '在住记录', value: `${summary.activeCount} 条`, helper: `${Math.max(summary.count - summary.activeCount, 0)} 条已退租` },
          ]}
        />

        {pageRecords.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pageRecords} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无住房记录" description="先新增一条住房档案，或放宽筛选条件后再查看。" />
        )}
      </div>

      <Modal
        open={Boolean(detailRecord && detailSnapshot)}
        onClose={() => setDetailRecord(null)}
        title={detailRecord ? `住房详情 · ${detailRecord.address}` : '住房详情'}
        width={820}
        footer={<Btn tone="secondary" onClick={() => setDetailRecord(null)}>关闭</Btn>}
      >
        {detailRecord && detailSnapshot ? (
          <div className="page-stack">
            {/* 当前记录的账单汇总 */}
            {(() => {
              const recordBills = filterBillsByRecordId(utilityBills, detailRecord.id);
              const billSummary = summarizeUtilityBills(recordBills);
              return recordBills.length > 0 ? (
                <StatGrid
                  className="rent-summary-grid"
                  items={[
                    { label: '账单笔数', value: `${recordBills.length} 笔` },
                    { label: '电费合计', value: formatRentAmount(billSummary.electricityTotal), helper: `共 ${recordBills.length} 个月` },
                    { label: '水费合计', value: formatRentAmount(billSummary.waterTotal) },
                    { label: '燃气费合计', value: formatRentAmount(billSummary.gasTotal) },
                    { label: '水电燃气总计', value: formatRentAmount(billSummary.grandTotal) },
                  ]}
                />
              ) : null;
            })()}

            <div className="rent-detail-grid">
              <div className="callout callout-neutral">
                <strong>渠道</strong>
                <span>{detailRecord.channelName}</span>
              </div>
              <div className="callout callout-neutral">
                <strong>入住日期</strong>
                <span>{detailRecord.moveInDate}</span>
              </div>
              <div className="callout callout-neutral">
                <strong>退租日期</strong>
                <span>{detailRecord.moveOutDate || '仍在住'}</span>
              </div>
              <div className="callout callout-neutral">
                <strong>房屋朝向</strong>
                <span>{detailRecord.orientation || '-'}</span>
              </div>
            </div>

            <StatGrid
              className="rent-summary-grid"
              items={[
                {
                  label: '居住状态',
                  value: detailSnapshot.occupancyStatus === 'active' ? '在住' : '已退租',
                  helper: `更新于 ${dayjs(detailRecord.updatedAt).format('YYYY-MM-DD HH:mm')}`,
                },
                { label: '居住天数', value: `${detailSnapshot.stayDays} 天` },
                { label: '总成本', value: formatRentAmount(detailSnapshot.totalCost) },
                { label: '单日成本', value: formatRentAmount(detailSnapshot.dailyCost) },
                { label: '折算月租', value: formatRentAmount(detailSnapshot.monthlyRent) },
                { label: '折算季度租金', value: formatRentAmount(detailSnapshot.quarterlyRent) },
              ]}
            />

            <div className="rent-cost-grid">
              {([
                ['房租', detailRecord.rent, false],
                ['押金', detailRecord.deposit, false],
                ['电费', detailRecord.electricityFee, true],
                ['水费', detailRecord.waterFee, true],
                ['燃气费', detailRecord.gasFee, true],
                ['中介费', detailRecord.agencyFee, false],
                ['保洁费', detailRecord.cleaningFee, false],
                ['洗衣费', detailRecord.laundryFee, false],
                ['服务费', detailRecord.serviceFee, false],
              ] as [string, number, boolean][]).map(([label, value, isUtility]) => (
                <div key={`cost-${label}`} className="callout callout-neutral">
                  <strong>{label}{isUtility ? '(按月汇总)' : ''}</strong>
                  <span>{formatRentAmount(Number(value))}</span>
                </div>
              ))}
            </div>

            {/* 水电账单管理入口 */}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Btn tone="secondary" onClick={() => onManageUtilityBills(detailRecord.id)}>
                管理水电账单
              </Btn>
            </div>

            {detailRecord.notes ? (
              <div className="callout callout-info">
                <strong>备注</strong>
                <span>{detailRecord.notes}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onChangeRecords((previous) => deleteRentRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('住房记录已删除。');
        }}
        title="删除住房记录"
      >
        删除后会同时失去这条住房档案的费用结构和统计来源，请确认是否继续。
      </DeleteModal>
    </SectionCard>
  );
}
