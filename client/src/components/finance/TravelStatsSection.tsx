import { useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, Field, Modal, SelectField } from '../ui';
import {
  TRAVEL_ALL_BOOKS,
  buildTravelCategoryBreakdown,
  buildTravelDailyTrend,
  buildTravelPayChannelBreakdown,
  buildTravelSummary,
  createTravelPayChannel,
  filterTravelBooksByUserId,
  filterTravelRecords,
  formatTravelAmount,
  getTravelPayChannelLabel,
  updateTravelPayChannel,
} from '../../services/travel';
import type { TravelBook, TravelExpenseRecord, TravelPayChannel } from '../../types/travel';

interface TravelStatsSectionProps {
  activeUserId: string;
  statsBookId: string;
  books: TravelBook[];
  records: TravelExpenseRecord[];
  payChannels: TravelPayChannel[];
  onStatsBookIdChange: (bookId: string) => void;
  onChangePayChannels: (updater: (payChannels: TravelPayChannel[]) => TravelPayChannel[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`chart-card ${className ?? ''}`.trim()}>
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

export function TravelStatsSection({
  activeUserId,
  statsBookId,
  books,
  records,
  payChannels,
  onStatsBookIdChange,
  onChangePayChannels,
  showToast,
}: TravelStatsSectionProps) {
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [createValue, setCreateValue] = useState('');
  const [createLabel, setCreateLabel] = useState('');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const availableBooks = useMemo(() => filterTravelBooksByUserId(books, activeUserId), [books, activeUserId]);
  const scopedRecords = useMemo(
    () => filterTravelRecords(records, activeUserId, statsBookId),
    [records, activeUserId, statsBookId],
  );
  const summary = useMemo(() => buildTravelSummary(scopedRecords, payChannels), [scopedRecords, payChannels]);
  const categoryRows = useMemo(() => buildTravelCategoryBreakdown(scopedRecords), [scopedRecords]);
  const payChannelRows = useMemo(() => buildTravelPayChannelBreakdown(scopedRecords, payChannels), [scopedRecords, payChannels]);
  const dailyTrend = useMemo(() => buildTravelDailyTrend(scopedRecords), [scopedRecords]);
  const currentBookName = availableBooks.find((book) => book.id === statsBookId)?.name ?? '全部行程账本';

  const categoryColumns = useMemo(() => [
    { key: 'name', title: '分类', dataIndex: 'name' as const },
    {
      key: 'count',
      title: '记录数',
      render: (_value: unknown, row: (typeof categoryRows)[number]) => `${row.count} 条`,
    },
    {
      key: 'amount',
      title: '原价 / 实付 / 优惠',
      render: (_value: unknown, row: (typeof categoryRows)[number]) => (
        <div className="travel-amount-stack">
          <strong>{formatTravelAmount(row.paidAmount)}</strong>
          <span>{formatTravelAmount(row.totalAmount)} / 优惠 {formatTravelAmount(row.savedAmount)}</span>
        </div>
      ),
    },
  ], [categoryRows]);

  const payChannelColumns = useMemo(() => [
    { key: 'name', title: '支付方式', dataIndex: 'name' as const },
    {
      key: 'count',
      title: '记录数',
      render: (_value: unknown, row: (typeof payChannelRows)[number]) => `${row.count} 条`,
    },
    {
      key: 'amount',
      title: '原价 / 实付 / 优惠',
      render: (_value: unknown, row: (typeof payChannelRows)[number]) => (
        <div className="travel-amount-stack">
          <strong>{formatTravelAmount(row.paidAmount)}</strong>
          <span>{formatTravelAmount(row.totalAmount)} / 优惠 {formatTravelAmount(row.savedAmount)}</span>
        </div>
      ),
    },
  ], [payChannelRows]);

  const handleCreateChannel = () => {
    const normalizedValue = createValue.trim().toUpperCase();
    const normalizedLabel = createLabel.trim();

    if (!normalizedValue || !normalizedLabel) {
      showToast('请补全支付渠道标识和显示名称。', 'error');
      return;
    }

    const duplicate = payChannels.some((channel) => channel.value === normalizedValue);
    if (duplicate) {
      showToast('支付渠道标识已存在。', 'error');
      return;
    }

    onChangePayChannels((previous) => createTravelPayChannel(previous, {
      value: normalizedValue,
      label: normalizedLabel,
    }));
    setCreateValue('');
    setCreateLabel('');
    showToast('支付渠道已新增。');
  };

  const handleSaveChannel = () => {
    if (!editingChannelId || !editingLabel.trim()) {
      showToast('请补全支付渠道名称。', 'error');
      return;
    }

    onChangePayChannels((previous) => updateTravelPayChannel(previous, editingChannelId, { label: editingLabel.trim() }));
    setEditingChannelId(null);
    setEditingLabel('');
    showToast('支付渠道已更新。');
  };

  return (
    <SectionCard
      title="统计看板"
      description="围绕当前用户和选中账本查看旅行消费结构、支付方式分布与最近 30 天每日消费趋势。"
      action={<Btn tone="secondary" onClick={() => setChannelModalOpen(true)}>支付渠道管理</Btn>}
    >
      <div className="page-stack">
        <div className="travel-filter-grid travel-filter-grid-stats">
          <Field
            label="统计用户 ID"
            value={activeUserId}
            readOnly
            hint="统计口径跟随页面顶部当前用户。"
          />
          <SelectField label="统计账本" value={statsBookId} onChange={(event) => onStatsBookIdChange(event.target.value)}>
            <option value={TRAVEL_ALL_BOOKS}>全部行程账本</option>
            {availableBooks.map((book) => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </SelectField>
        </div>

        <StatGrid
          items={[
            { label: '统计范围', value: currentBookName, helper: '当前账本切换会同步刷新趋势和结构统计' },
            { label: '实付总花费', value: formatTravelAmount(summary.totalPaidAmount) },
            { label: '总节省', value: formatTravelAmount(summary.totalSaved) },
            { label: '记录数', value: `${summary.totalCount}` },
            { label: '最大分类', value: summary.topCategoryName },
            { label: '最大支付渠道', value: summary.topPayChannelName },
          ]}
        />

        <div className="travel-dashboard-grid">
          <ChartCard title="分类统计" description="帮助识别本次旅行的主要消费去向。">
            {categoryRows.length ? (
              <DataTable rowKey="name" columns={categoryColumns} data={categoryRows} />
            ) : (
              <EmptyState title="暂无分类统计" description="先补充几条旅行消费记录，分类统计才会出现。" />
            )}
          </ChartCard>

          <ChartCard title="支付渠道统计" description="观察不同支付方式在本次旅行中的实际使用占比。">
            {payChannelRows.length ? (
              <DataTable rowKey="name" columns={payChannelColumns} data={payChannelRows} />
            ) : (
              <EmptyState title="暂无支付渠道统计" description="当有支付方式相关记录后，这里会展示渠道结构。" />
            )}
          </ChartCard>

          <ChartCard title="最近 30 天每日消费趋势" description="按日期观察消费节奏和高峰日。">
            {dailyTrend.length ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={dailyTrend}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => {
                        if (name === '实付') {
                          return [formatTravelAmount(Number(value ?? 0)), '实付'];
                        }

                        return [String(value ?? 0), '记录数'];
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="paidAmount"
                      name="实付"
                      stroke="var(--color-primary)"
                      fill="color-mix(in srgb, var(--color-primary) 18%, transparent)"
                      strokeWidth={2.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无趋势数据" description="先补充一些带日期的旅行消费记录，趋势图才会形成。" />
            )}
          </ChartCard>
        </div>
      </div>

      <Modal
        open={channelModalOpen}
        onClose={() => {
          setChannelModalOpen(false);
          setEditingChannelId(null);
          setEditingLabel('');
        }}
        title="支付渠道管理"
        width={720}
        footer={<Btn tone="secondary" onClick={() => setChannelModalOpen(false)}>关闭</Btn>}
      >
        <div className="page-stack">
          <div className="travel-channel-create">
            <Field
              label="渠道标识"
              value={createValue}
              onChange={(event) => setCreateValue(event.target.value)}
              placeholder="例如：DOUYIN_PAY"
            />
            <Field
              label="显示名称"
              value={createLabel}
              onChange={(event) => setCreateLabel(event.target.value)}
              placeholder="例如：抖音支付"
            />
            <div className="travel-inline-action">
              <span className="field-label">新增渠道</span>
              <Btn tone="primary" onClick={handleCreateChannel}>新增支付渠道</Btn>
            </div>
          </div>

          <div className="travel-pay-channel-list">
            {payChannels.map((channel) => (
              <div key={channel.id} className="travel-pay-channel-row">
                <div className="travel-pay-channel-copy">
                  <strong className="travel-pay-channel-label">{getTravelPayChannelLabel(channel.value, payChannels)}</strong>
                  <span className="travel-pay-channel-code">{channel.value}</span>
                </div>
                {editingChannelId === channel.id ? (
                  <div className="travel-pay-channel-actions">
                    <Field
                      value={editingLabel}
                      onChange={(event) => setEditingLabel(event.target.value)}
                      placeholder="输入新的支付渠道名称"
                    />
                    <Btn tone="primary" onClick={handleSaveChannel}>保存</Btn>
                    <Btn
                      tone="secondary"
                      onClick={() => {
                        setEditingChannelId(null);
                        setEditingLabel('');
                      }}
                    >
                      取消
                    </Btn>
                  </div>
                ) : (
                  <Btn
                    tone="secondary"
                    onClick={() => {
                      setEditingChannelId(channel.id);
                      setEditingLabel(channel.label);
                    }}
                  >
                    编辑名称
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </SectionCard>
  );
}
