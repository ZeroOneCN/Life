import { useMemo, useRef } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

import { EmptyState, SectionCard } from '../page';
import { Btn, Checkbox, SelectField } from '../ui';
import {
  TRAVEL_DEFAULT_REPORT_COLUMNS,
  buildTravelReportData,
  buildTravelTimeRangeLabel,
  exportTravelReportAsPdf,
  exportTravelReportAsPng,
  formatTravelAmount,
  formatTravelDateRange,
  formatTravelDuration,
  getTravelCategoryLabel,
  getTravelPayChannelLabel,
  sanitizeTravelFileName,
} from '../../services/travel';
import type { TravelBook, TravelExpenseRecord, TravelPayChannel, TravelReportColumnKey } from '../../types/travel';

interface TravelReportSectionProps {
  activeUserId: string;
  reportBookId: string;
  reportColumns: TravelReportColumnKey[];
  books: TravelBook[];
  records: TravelExpenseRecord[];
  payChannels: TravelPayChannel[];
  onReportBookIdChange: (bookId: string) => void;
  onReportColumnsChange: (columns: TravelReportColumnKey[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

const REPORT_COLUMN_OPTIONS: Array<{ value: TravelReportColumnKey; label: string }> = [
  { value: 'date', label: '日期' },
  { value: 'timeRange', label: '时间段' },
  { value: 'duration', label: '时长' },
  { value: 'category', label: '分类' },
  { value: 'title', label: '项目' },
  { value: 'paid', label: '实付' },
  { value: 'discount', label: '优惠' },
  { value: 'vehicleInfo', label: '交通信息' },
  { value: 'payChannel', label: '支付方式' },
  { value: 'remark', label: '备注' },
];

function renderRecordCell(record: TravelExpenseRecord, column: TravelReportColumnKey, payChannels: TravelPayChannel[]) {
  if (column === 'date') return record.date;
  if (column === 'timeRange') return buildTravelTimeRangeLabel(record);
  if (column === 'duration') return formatTravelDuration(record.durationMinutes);
  if (column === 'category') return getTravelCategoryLabel(record.category);
  if (column === 'title') return record.title;
  if (column === 'paid') return formatTravelAmount(record.amount - record.discountAmount < 0 ? 0 : record.amount - record.discountAmount);
  if (column === 'discount') return formatTravelAmount(record.discountAmount);
  if (column === 'vehicleInfo') return record.vehicleInfo || '-';
  if (column === 'payChannel') return getTravelPayChannelLabel(record.payChannel, payChannels);
  if (column === 'remark') return record.remark || '-';
  return '-';
}

export function TravelReportSection({
  activeUserId,
  reportBookId,
  reportColumns,
  books,
  records,
  payChannels,
  onReportBookIdChange,
  onReportColumnsChange,
  showToast,
}: TravelReportSectionProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const reportData = useMemo(
    () => buildTravelReportData(books, records, payChannels, activeUserId, reportBookId),
    [books, records, payChannels, activeUserId, reportBookId],
  );

  const handleToggleColumn = (column: TravelReportColumnKey, checked: boolean) => {
    if (checked) {
      onReportColumnsChange(Array.from(new Set([...reportColumns, column])));
      return;
    }

    const nextColumns = reportColumns.filter((item) => item !== column);
    if (!nextColumns.length) {
      showToast('报告明细至少保留一列。', 'error');
      return;
    }
    onReportColumnsChange(nextColumns);
  };

  const handleSelectAll = () => {
    onReportColumnsChange(REPORT_COLUMN_OPTIONS.map((col) => col.value));
  };

  const handleDeselectAll = () => {
    if (reportColumns.length <= 1) { showToast('至少保留一列'); return; }
    onReportColumnsChange([]);
  };

  const handleExportPng = async () => {
    if (!reportRef.current || !reportData.book) {
      showToast('请先选择一个具体账本，再导出报告。', 'error');
      return;
    }

    try {
      await exportTravelReportAsPng(reportRef.current, `${sanitizeTravelFileName(reportData.book.name)}-旅行报告`);
      showToast('PNG 报告已导出。');
    } catch (error) {
      showToast(`PNG 导出失败：${String(error)}`, 'error');
    }
  };

  const handleExportPdf = async () => {
    if (!reportRef.current || !reportData.book) {
      showToast('请先选择一个具体账本，再导出报告。', 'error');
      return;
    }

    try {
      await exportTravelReportAsPdf(reportRef.current, `${sanitizeTravelFileName(reportData.book.name)}-旅行报告`);
      showToast('PDF 报告已导出。');
    } catch (error) {
      showToast(`PDF 导出失败：${String(error)}`, 'error');
    }
  };

  return (
    <SectionCard
      title="报告导出"
      description="按单个行程账本生成旅行报告，支持明细列开关、长图导出和 PDF 导出。"
      action={(
        <div className="inline-row">
          <Btn tone="secondary" onClick={handleExportPng}>导出 PNG</Btn>
          <Btn tone="primary" onClick={handleExportPdf}>导出 PDF</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="travel-filter-grid travel-filter-grid-report">
          <SelectField label="报告账本" value={reportBookId} onChange={(event) => onReportBookIdChange(event.target.value)}>
            {books
              .filter((book) => book.userId === activeUserId)
              .map((book) => (
                <option key={book.id} value={book.id}>{book.name}</option>
              ))}
          </SelectField>
        </div>

        <div className="travel-report-column-picker">
          <span className="travel-col-picker-label">明细列</span>
          <div className="travel-col-picker-actions">
            <button type="button" className="travel-col-toggle" onClick={handleSelectAll}>全选</button>
            <span className="travel-col-divider">/</span>
            <button type="button" className="travel-col-toggle" onClick={handleDeselectAll}>反选</button>
          </div>
          <div className="travel-col-checkboxes">
            {REPORT_COLUMN_OPTIONS.map((column) => (
              <Checkbox
                key={column.value}
                checked={reportColumns.includes(column.value)}
                onChange={(checked) => handleToggleColumn(column.value, checked)}
              >
                {column.label}
              </Checkbox>
            ))}
          </div>
        </div>

        {reportData.book ? (
          <div ref={reportRef} className="travel-report-sheet">
            <div className="travel-report-header">
              <div>
                <h3>{reportData.book.name}</h3>
                <p>{formatTravelDateRange(reportData.book.startDate, reportData.book.endDate)}</p>
              </div>
              <div className="travel-report-meta">
                <span>生成时间：{reportData.generatedAt}</span>
                <span>记录数：{reportData.summary.totalCount} 条</span>
              </div>
            </div>

            <div className="travel-report-overview">
              <div className="travel-report-overview-card">
                <span>实付总花费</span>
                <strong>{formatTravelAmount(reportData.summary.totalPaidAmount)}</strong>
              </div>
              <div className="travel-report-overview-card">
                <span>总节省</span>
                <strong>{formatTravelAmount(reportData.summary.totalSaved)}</strong>
              </div>
              <div className="travel-report-overview-card">
                <span>最大分类</span>
                <strong>{reportData.summary.topCategoryName}</strong>
              </div>
              <div className="travel-report-overview-card">
                <span>记录数</span>
                <strong>{reportData.summary.totalCount}</strong>
              </div>
            </div>

            <div className="travel-report-grid">
              <section className="travel-report-panel">
                <strong>分类占比</strong>
                {(() => {
                  console.log('[travel-report] categoryBreakdown:', reportData.categoryBreakdown);
                  return null;
                })()}
                {reportData.categoryBreakdown.length ? (
                  <div className="travel-report-list">
                    {reportData.categoryBreakdown.slice(0, 8).map((item) => (
                      <div key={item.name} className="travel-report-list-row">
                        <span className="travel-list-name">{item.name}</span>
                        <span className="travel-list-count">{item.count}笔</span>
                        <strong>{formatTravelAmount(item.paidAmount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="travel-report-empty">暂无分类统计</div>
                )}
              </section>

              <section className="travel-report-panel">
                <strong>支付渠道</strong>
                {reportData.payChannelBreakdown.length ? (
                  <div className="travel-report-list">
                    {reportData.payChannelBreakdown.slice(0, 8).map((item) => (
                      <div key={item.name} className="travel-report-list-row">
                        <span className="travel-list-name">{item.name}</span>
                        <span className="travel-list-count">{item.count}笔</span>
                        <strong>{formatTravelAmount(item.paidAmount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="travel-report-empty">暂无支付渠道统计</div>
                )}
              </section>
            </div>

            <section className="travel-report-panel">
              <strong>每日消费趋势</strong>
              {reportData.dailyTrend.length ? (
                <div className="travel-report-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={reportData.dailyTrend}>
                      <CartesianGrid stroke="var(--color-surface-3)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [formatTravelAmount(Number(value ?? 0)), '实付']}
                      />
                      <Line
                        type="monotone"
                        dataKey="paidAmount"
                        stroke="var(--color-primary)"
                        strokeWidth={2.6}
                        dot={false}
                        name="实付"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="travel-report-empty">暂无趋势数据</div>
              )}
            </section>

            <section className="travel-report-panel">
              <strong>行程总结</strong>
              {reportData.book.summary ? (
                <p className="travel-report-summary">{reportData.book.summary}</p>
              ) : (
                <div className="travel-report-empty">暂无行程总结</div>
              )}
            </section>

            <section className="travel-report-panel">
              <strong>消费明细</strong>
              {reportData.records.length ? (
                <div className="travel-report-table-wrap">
                  <table className="travel-report-table">
                    <thead>
                      <tr>
                        {REPORT_COLUMN_OPTIONS
                          .filter((column) => reportColumns.includes(column.value))
                          .map((column) => (
                            <th key={column.value}>{column.label}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.records.map((record) => (
                        <tr key={record.id}>
                          {REPORT_COLUMN_OPTIONS
                            .filter((column) => reportColumns.includes(column.value))
                            .map((column) => (
                              <td key={`${record.id}-${column.value}`}>
                                {renderRecordCell(record, column.value, payChannels)}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="travel-report-empty">暂无消费明细</div>
              )}
            </section>
          </div>
        ) : (
          <EmptyState
            title="暂无可导出的报告"
            description="先为当前用户创建一个行程账本并录入旅行消费，报告导出才会生效。"
          />
        )}

        {!reportData.book && reportColumns.length !== TRAVEL_DEFAULT_REPORT_COLUMNS.length ? (
          <div className="callout callout-info">
            当前没有可用报告数据，但你的明细列选择会继续保留，后续创建账本后可直接复用。
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
