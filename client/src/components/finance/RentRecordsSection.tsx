import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteIcon, DeleteModal, EditIcon, ExportButton, EyeIcon, FilterBar, FilterTag, IconBtn, Modal, Pagination, SearchInput, SelectField, Tag } from '../ui';
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
    {
      key: 'address',
      title: '名称',
      dataIndex: 'addressShort' as const,
      render: (_value: unknown, row: RentHousingRecord) => {
        const short = (row.addressShort ?? '').trim();
        if (short) {
          return short;
        }
        const address = row.address ?? '';
        return address.length <= 12 ? address : `${address.slice(0, 12)}…`;
      },
    },
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
          <IconBtn tone="secondary" icon={<EyeIcon />} title="详情" onClick={() => setDetailRecord(row)} />
          <IconBtn tone="secondary" icon={<EditIcon />} title="编辑" onClick={() => onEditRecord(row.id)} />
          <IconBtn tone="danger" icon={<DeleteIcon />} title="删除" onClick={() => setPendingDeleteId(row.id)} />
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

        <FilterBar
          rightSlot={
            <ExportButton
              label="导出"
              onExport={(format) => {
                showToast(`${format.toUpperCase()} 导出功能开发中`, 'error');
              }}
            />
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ width: 260, flexShrink: 0 }}>
              <SearchInput
                value={keyword}
                onChange={setKeyword}
                placeholder="搜索地址、渠道、备注..."
              />
            </div>
            <FilterTag
              label="全部状态"
              active={occupancyFilter === 'all'}
              onClick={() => setOccupancyFilter('all')}
              count={filteredRecords.length}
            />
            <FilterTag
              label="在住"
              active={occupancyFilter === 'active'}
              onClick={() => setOccupancyFilter('active')}
              count={filteredRecords.filter((r) => buildRentRecordSnapshot(r).occupancyStatus === 'active').length}
            />
            <FilterTag
              label="已退租"
              active={occupancyFilter === 'ended'}
              onClick={() => setOccupancyFilter('ended')}
              count={filteredRecords.filter((r) => buildRentRecordSnapshot(r).occupancyStatus === 'ended').length}
            />
            <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />
            <SelectField
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              style={{ width: 130 }}
            >
              <option value={RENT_ALL_CHANNELS}>全部渠道</option>
              {availableChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </SelectField>
          </div>
        </FilterBar>

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
        title={detailRecord ? `住房详情 · ${detailRecord.addressShort?.trim() || detailRecord.address}` : '住房详情'}
        width={820}
        footer={<Btn tone="secondary" onClick={() => setDetailRecord(null)}>关闭</Btn>}
      >
        {detailRecord && detailSnapshot ? (
          <div className="rent-detail-content">
            {/* 地址信息卡 */}
            <div className="rent-detail-hero">
              <div className="rent-detail-hero-label">
                {detailSnapshot.occupancyStatus === 'active' ? (
                  <Tag tone="green">在住中</Tag>
                ) : (
                  <Tag tone="default">已退租</Tag>
                )}
              </div>
              <div className="rent-detail-hero-body">
                <h4>{detailRecord.addressShort?.trim() || detailRecord.address}</h4>
                {detailRecord.addressShort?.trim() ? (
                  <p>{detailRecord.address}</p>
                ) : null}
              </div>
            </div>

            {/* 基础信息 */}
            <div className="rent-detail-section">
              <div className="rent-detail-section-title">基础信息</div>
              <div className="rent-detail-info-grid">
                <div className="rent-detail-info-item">
                  <span className="rent-detail-info-label">渠道</span>
                  <span className="rent-detail-info-value">{detailRecord.channelName}</span>
                </div>
                <div className="rent-detail-info-item">
                  <span className="rent-detail-info-label">入住日期</span>
                  <span className="rent-detail-info-value">{detailRecord.moveInDate}</span>
                </div>
                <div className="rent-detail-info-item">
                  <span className="rent-detail-info-label">退租日期</span>
                  <span className="rent-detail-info-value">{detailRecord.moveOutDate || '仍在住'}</span>
                </div>
                <div className="rent-detail-info-item">
                  <span className="rent-detail-info-label">房屋朝向</span>
                  <span className="rent-detail-info-value">{detailRecord.orientation || '-'}</span>
                </div>
              </div>
            </div>

            {/* 派生指标 */}
            <div className="rent-detail-section">
              <div className="rent-detail-section-title">成本概览</div>
              <div className="rent-detail-metrics">
                <div className="rent-detail-metric">
                  <span className="rent-detail-metric-value">{detailSnapshot.stayDays}</span>
                  <span className="rent-detail-metric-label">居住天数</span>
                </div>
                <div className="rent-detail-metric rent-detail-metric-accent">
                  <span className="rent-detail-metric-value">{formatRentAmount(detailSnapshot.totalCost)}</span>
                  <span className="rent-detail-metric-label">总成本</span>
                </div>
                <div className="rent-detail-metric">
                  <span className="rent-detail-metric-value">{formatRentAmount(detailSnapshot.dailyCost)}</span>
                  <span className="rent-detail-metric-label">单日成本</span>
                </div>
                <div className="rent-detail-metric">
                  <span className="rent-detail-metric-value">{formatRentAmount(detailSnapshot.monthlyRent)}</span>
                  <span className="rent-detail-metric-label">折算月租</span>
                </div>
              </div>
            </div>

            {/* 水电账单汇总 */}
            {(() => {
              const recordBills = filterBillsByRecordId(utilityBills, detailRecord.id);
              const billSummary = summarizeUtilityBills(recordBills);
              if (recordBills.length === 0) return null;
              return (
                <div className="rent-detail-section">
                  <div className="rent-detail-section-title">水电账单（{recordBills.length} 个月）</div>
                  <div className="rent-detail-bills">
                    <div className="rent-detail-bill-item">
                      <span className="rent-detail-bill-label">电费</span>
                      <span className="rent-detail-bill-value">{formatRentAmount(billSummary.electricityTotal)}</span>
                    </div>
                    <div className="rent-detail-bill-item">
                      <span className="rent-detail-bill-label">水费</span>
                      <span className="rent-detail-bill-value">{formatRentAmount(billSummary.waterTotal)}</span>
                    </div>
                    <div className="rent-detail-bill-item">
                      <span className="rent-detail-bill-label">燃气费</span>
                      <span className="rent-detail-bill-value">{formatRentAmount(billSummary.gasTotal)}</span>
                    </div>
                    <div className="rent-detail-bill-item rent-detail-bill-total">
                      <span className="rent-detail-bill-label">合计</span>
                      <span className="rent-detail-bill-value">{formatRentAmount(billSummary.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 费用明细 */}
            <div className="rent-detail-section">
              <div className="rent-detail-section-title">费用明细</div>
              <div className="rent-detail-costs">
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
                  <div key={`cost-${label}`} className="rent-detail-cost-item">
                    <span className="rent-detail-cost-label">
                      {label}
                      {isUtility ? <em>按月汇总</em> : null}
                    </span>
                    <span className="rent-detail-cost-value">{formatRentAmount(Number(value))}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 备注 */}
            {detailRecord.notes ? (
              <div className="rent-detail-notes">
                <div className="rent-detail-notes-label">备注</div>
                <div className="rent-detail-notes-body">{detailRecord.notes}</div>
              </div>
            ) : null}

            {/* 操作入口 */}
            <div className="rent-detail-actions">
              <Btn tone="secondary" onClick={() => onManageUtilityBills(detailRecord.id)}>
                管理水电账单
              </Btn>
            </div>
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
