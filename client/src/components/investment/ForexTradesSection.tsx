import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  FOREX_INSTRUMENT_OPTIONS,
  FOREX_ORDER_TYPE_OPTIONS,
  FOREX_TRADE_PAGE_SIZE,
  buildForexImportTemplateWorkbook,
  calculateForexCommission,
  calculateForexHoldTime,
  calculateForexTradePnl,
  createForexTrade,
  deleteForexTrade,
  downloadBlob,
  filterForexTrades,
  formatForexAmount,
  formatForexMoney,
  getForexInstrumentLabel,
  getForexOrderTypeLabel,
  importForexWorkbook,
  normalizeForexTimeInput,
  updateForexTrade,
} from '../../services/forex';
import type { ForexImportResult, ForexInstrument, ForexOrderType, ForexTradeDraft, ForexTradeRecord } from '../../types/forex';

interface ForexTradesSectionProps {
  trades: ForexTradeRecord[];
  onChangeTrades: (updater: (records: ForexTradeRecord[]) => ForexTradeRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface TradeFormState {
  tradeDate: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: string;
  lotSize: string;
  commission: string;
  closePrice: string;
  pnl: string;
  openTime: string;
  closeTime: string;
  holdTime: string;
  remark: string;
}

function createDefaultFormState(): TradeFormState {
  return {
    tradeDate: dayjs().format('YYYY-MM-DD'),
    instrument: 'XAUUSD',
    orderType: 'buy',
    openPrice: '',
    lotSize: '0.01',
    commission: '-0.06',
    closePrice: '',
    pnl: '',
    openTime: '09:00',
    closeTime: '10:00',
    holdTime: '1小时',
    remark: '',
  };
}

function buildFormState(record: ForexTradeRecord): TradeFormState {
  return {
    tradeDate: record.tradeDate,
    instrument: record.instrument,
    orderType: record.orderType,
    openPrice: String(record.openPrice),
    lotSize: String(record.lotSize),
    commission: String(record.commission),
    closePrice: String(record.closePrice),
    pnl: String(record.pnl),
    openTime: record.openTime,
    closeTime: record.closeTime,
    holdTime: record.holdTime,
    remark: record.remark,
  };
}

function hydrateDerivedFields(form: TradeFormState): TradeFormState {
  const lotSize = Number(form.lotSize);
  const openPrice = Number(form.openPrice);
  const closePrice = Number(form.closePrice);
  const commission = Number.isFinite(lotSize) && lotSize > 0 ? calculateForexCommission(lotSize) : 0;
  const pnl = (
    Number.isFinite(openPrice)
    && openPrice > 0
    && Number.isFinite(closePrice)
    && closePrice > 0
    && Number.isFinite(lotSize)
    && lotSize > 0
  )
    ? calculateForexTradePnl(form.instrument, form.orderType, openPrice, closePrice, lotSize)
    : 0;
  const openTime = normalizeForexTimeInput(form.openTime, '09:00');
  const closeTime = normalizeForexTimeInput(form.closeTime, '10:00');

  return {
    ...form,
    commission: String(commission),
    pnl: form.openPrice && form.closePrice && form.lotSize ? String(pnl) : '',
    openTime,
    closeTime,
    holdTime: calculateForexHoldTime(openTime, closeTime) || '',
  };
}

function parseDraft(form: TradeFormState): ForexTradeDraft | null {
  const openPrice = Number(form.openPrice);
  const closePrice = Number(form.closePrice);
  const lotSize = Number(form.lotSize);

  if (
    !dayjs(form.tradeDate).isValid()
    || !Number.isFinite(openPrice)
    || openPrice <= 0
    || !Number.isFinite(closePrice)
    || closePrice <= 0
    || !Number.isFinite(lotSize)
    || lotSize <= 0
  ) {
    return null;
  }

  const openTime = normalizeForexTimeInput(form.openTime);
  const closeTime = normalizeForexTimeInput(form.closeTime);

  if (!openTime || !closeTime) {
    return null;
  }

  return {
    tradeDate: form.tradeDate,
    instrument: form.instrument,
    orderType: form.orderType,
    openPrice,
    lotSize,
    commission: Number(form.commission),
    closePrice,
    pnl: Number(form.pnl),
    openTime,
    closeTime,
    holdTime: form.holdTime,
    remark: form.remark.trim(),
  };
}

export function ForexTradesSection({
  trades,
  onChangeTrades,
  showToast,
}: ForexTradesSectionProps) {
  const [form, setForm] = useState<TradeFormState>(() => createDefaultFormState());
  const [editingRecord, setEditingRecord] = useState<ForexTradeRecord | null>(null);
  const [editingForm, setEditingForm] = useState<TradeFormState>(() => createDefaultFormState());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [tradeDateFilter, setTradeDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [importResult, setImportResult] = useState<ForexImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredTrades = useMemo(
    () => filterForexTrades(trades, {
      keyword,
      instrument: instrumentFilter,
      orderType: orderTypeFilter,
      tradeDate: tradeDateFilter,
    }),
    [instrumentFilter, keyword, orderTypeFilter, tradeDateFilter, trades],
  );

  useEffect(() => {
    setPage(1);
  }, [keyword, instrumentFilter, orderTypeFilter, tradeDateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / FOREX_TRADE_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * FOREX_TRADE_PAGE_SIZE;
    return filteredTrades.slice(startIndex, startIndex + FOREX_TRADE_PAGE_SIZE);
  }, [filteredTrades, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const netPnl = filteredTrades.reduce((sum, trade) => sum + trade.pnl + trade.commission, 0);
    const grossPnl = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalCommission = filteredTrades.reduce((sum, trade) => sum + trade.commission, 0);

    return {
      count: filteredTrades.length,
      netPnl,
      grossPnl,
      totalCommission,
    };
  }, [filteredTrades]);

  const columns = useMemo(() => [
    { key: 'tradeDate', title: '日期时间', dataIndex: 'tradeDate' as const },
    {
      key: 'instrument',
      title: '交易品种',
      render: (_value: unknown, row: ForexTradeRecord) => getForexInstrumentLabel(row.instrument),
    },
    {
      key: 'orderType',
      title: '订单类型',
      render: (_value: unknown, row: ForexTradeRecord) => (
        <Tag tone={row.orderType === 'buy' ? 'green' : 'orange'}>
          {getForexOrderTypeLabel(row.orderType)}
        </Tag>
      ),
    },
    {
      key: 'openPrice',
      title: '开仓价格',
      render: (_value: unknown, row: ForexTradeRecord) => formatForexMoney(row.openPrice),
    },
    {
      key: 'lotSize',
      title: '手数',
      render: (_value: unknown, row: ForexTradeRecord) => row.lotSize.toFixed(2),
    },
    {
      key: 'commission',
      title: '手续费',
      render: (_value: unknown, row: ForexTradeRecord) => formatForexMoney(row.commission),
    },
    {
      key: 'closePrice',
      title: '平仓价格',
      render: (_value: unknown, row: ForexTradeRecord) => formatForexMoney(row.closePrice),
    },
    {
      key: 'pnl',
      title: '盈亏金额',
      render: (_value: unknown, row: ForexTradeRecord) => (
        <strong style={{ color: row.pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {formatForexAmount(row.pnl)}
        </strong>
      ),
    },
    { key: 'openTime', title: '开仓时间', dataIndex: 'openTime' as const },
    { key: 'closeTime', title: '平仓时间', dataIndex: 'closeTime' as const },
    { key: 'holdTime', title: '持仓时间', dataIndex: 'holdTime' as const },
    {
      key: 'remark',
      title: '备注',
      render: (_value: unknown, row: ForexTradeRecord) => row.remark || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: ForexTradeRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(row);
              setEditingForm(buildFormState(row));
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], []);

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全日期时间、开平仓价格、手数和时间字段。', 'error');
      return;
    }

    onChangeTrades((current) => createForexTrade(current, draft));
    setForm(createDefaultFormState());
    setImportResult(null);
    showToast('交易记录已保存。');
  };

  const handleUpdate = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全编辑中的交易字段。', 'error');
      return;
    }

    onChangeTrades((current) => updateForexTrade(current, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(createDefaultFormState());
    showToast('交易记录已更新。');
  };

  const handleImportSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImporting(true);

    try {
      const result = await importForexWorkbook(file, { trades });
      setImportResult(result);

      if (result.importedCount > 0) {
        onChangeTrades(() => result.nextTrades);
      }

      showToast(
        `导入完成：成功 ${result.importedCount}，重复 ${result.duplicateCount}，无效 ${result.invalidCount}。`,
        result.invalidCount > 0 ? 'error' : 'success',
      );
    } catch (_error) {
      showToast('导入失败，请检查文件格式。', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = async () => {
    const blob = await buildForexImportTemplateWorkbook();
    downloadBlob(blob, 'forex-trades-template.xlsx');
    showToast('模板已下载。');
  };

  return (
    <SectionCard
      title="交易记录"
      description="字段顺序已统一为：日期时间、交易品种、订单类型、开仓价格、手数、手续费、平仓价格、盈亏金额、开仓时间、平仓时间、持仓时间、备注。"
      action={(
        <div className="forex-action-row">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="visually-hidden"
            onChange={handleImportSelect}
          />
          <Btn tone="secondary" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? '导入中...' : '导入 Excel / CSV'}
          </Btn>
          <Btn tone="secondary" onClick={handleDownloadTemplate}>下载模板</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="forex-compact-grid">
          <DatePickerField
            label="日期时间"
            value={form.tradeDate}
            onChange={(value) => setForm((current) => hydrateDerivedFields({ ...current, tradeDate: value }))}
            placeholder="选择日期"
          />
          <SelectField
            label="交易品种"
            value={form.instrument}
            onChange={(event) => setForm((current) => hydrateDerivedFields({ ...current, instrument: event.target.value as ForexInstrument }))}
          >
            {FOREX_INSTRUMENT_OPTIONS.map((instrument) => (
              <option key={instrument} value={instrument}>{getForexInstrumentLabel(instrument)}</option>
            ))}
          </SelectField>
          <SelectField
            label="订单类型"
            value={form.orderType}
            onChange={(event) => setForm((current) => hydrateDerivedFields({ ...current, orderType: event.target.value as ForexOrderType }))}
          >
            {FOREX_ORDER_TYPE_OPTIONS.map((orderType) => (
              <option key={orderType} value={orderType}>{getForexOrderTypeLabel(orderType)}</option>
            ))}
          </SelectField>
          <Field
            label="开仓价格"
            value={form.openPrice}
            onChange={(event) => setForm((current) => hydrateDerivedFields({ ...current, openPrice: event.target.value }))}
            placeholder="2340.50"
          />
          <Field
            label="手数"
            value={form.lotSize}
            onChange={(event) => setForm((current) => hydrateDerivedFields({ ...current, lotSize: event.target.value }))}
            placeholder="0.01"
          />
          <Field
            label="手续费"
            value={form.commission}
            readOnly
          />
          <Field
            label="平仓价格"
            value={form.closePrice}
            onChange={(event) => setForm((current) => hydrateDerivedFields({ ...current, closePrice: event.target.value }))}
            placeholder="2346.20"
          />
          <Field
            label="盈亏金额"
            value={form.pnl}
            readOnly
          />
          <Field
            label="开仓时间"
            value={form.openTime}
            onChange={(event) => setForm((current) => ({ ...current, openTime: event.target.value }))}
            onBlur={(event) => setForm((current) => hydrateDerivedFields({ ...current, openTime: event.target.value }))}
            placeholder="09:35"
          />
          <Field
            label="平仓时间"
            value={form.closeTime}
            onChange={(event) => setForm((current) => ({ ...current, closeTime: event.target.value }))}
            onBlur={(event) => setForm((current) => hydrateDerivedFields({ ...current, closeTime: event.target.value }))}
            placeholder="11:10"
          />
          <Field label="持仓时间" value={form.holdTime} readOnly />
          <Field
            label="备注"
            value={form.remark}
            onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
            placeholder="例如：欧盘突破单"
          />
          <div className="forex-submit-cell">
            <Btn tone="primary" onClick={handleCreate}>保存交易记录</Btn>
          </div>
        </div>

        <StatGrid
          items={[
            { label: '筛选结果', value: `${summary.count} 笔`, helper: '当前列表统计' },
            { label: '盈亏金额', value: formatForexAmount(summary.grossPnl), accent: summary.grossPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: '手续费', value: formatForexMoney(summary.totalCommission), accent: 'var(--color-warning)' },
            { label: '净收益', value: formatForexAmount(summary.netPnl), accent: summary.netPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
          ]}
          className="forex-mini-stat-grid"
        />

        {importResult ? (
          <div className="forex-import-result">
            <strong>{`最近一次导入：总行数 ${importResult.totalRows}，成功 ${importResult.importedCount}，重复 ${importResult.duplicateCount}，无效 ${importResult.invalidCount}`}</strong>
            {importResult.invalidRows.length ? (
              <span>{`示例错误：第 ${importResult.invalidRows[0].rowNumber} 行，${importResult.invalidRows[0].reason}`}</span>
            ) : (
              <span>当前文件没有解析错误。</span>
            )}
          </div>
        ) : null}

        <div className="forex-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索备注、日期时间或订单类型"
          />
          <SelectField
            label="交易品种筛选"
            value={instrumentFilter}
            onChange={(event) => setInstrumentFilter(event.target.value)}
          >
            <option value="">全部交易品种</option>
            {FOREX_INSTRUMENT_OPTIONS.map((instrument) => (
              <option key={instrument} value={instrument}>{getForexInstrumentLabel(instrument)}</option>
            ))}
          </SelectField>
          <SelectField
            label="订单类型筛选"
            value={orderTypeFilter}
            onChange={(event) => setOrderTypeFilter(event.target.value)}
          >
            <option value="">全部订单类型</option>
            {FOREX_ORDER_TYPE_OPTIONS.map((orderType) => (
              <option key={orderType} value={orderType}>{getForexOrderTypeLabel(orderType)}</option>
            ))}
          </SelectField>
          <DatePickerField
            label="按日期时间筛选"
            value={tradeDateFilter}
            onChange={setTradeDateFilter}
            placeholder="选择日期"
            clearable
          />
        </div>

        {pageRecords.length ? (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无交易记录" description="先录入一笔贵金属交易，或者放宽筛选条件后再查看。" />
        )}

        <Modal
          open={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title="编辑交易记录"
          width={980}
          footer={(
            <>
              <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
              <Btn tone="primary" onClick={handleUpdate}>保存修改</Btn>
            </>
          )}
        >
          <div className="forex-modal-grid">
            <DatePickerField
              label="日期时间"
              value={editingForm.tradeDate}
              onChange={(value) => setEditingForm((current) => hydrateDerivedFields({ ...current, tradeDate: value }))}
              placeholder="选择日期"
            />
            <SelectField
              label="交易品种"
              value={editingForm.instrument}
              onChange={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, instrument: event.target.value as ForexInstrument }))}
            >
              {FOREX_INSTRUMENT_OPTIONS.map((instrument) => (
                <option key={instrument} value={instrument}>{getForexInstrumentLabel(instrument)}</option>
              ))}
            </SelectField>
            <SelectField
              label="订单类型"
              value={editingForm.orderType}
              onChange={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, orderType: event.target.value as ForexOrderType }))}
            >
              {FOREX_ORDER_TYPE_OPTIONS.map((orderType) => (
                <option key={orderType} value={orderType}>{getForexOrderTypeLabel(orderType)}</option>
              ))}
            </SelectField>
            <Field
              label="开仓价格"
              value={editingForm.openPrice}
              onChange={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, openPrice: event.target.value }))}
            />
            <Field
              label="手数"
              value={editingForm.lotSize}
              onChange={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, lotSize: event.target.value }))}
            />
            <Field label="手续费" value={editingForm.commission} readOnly />
            <Field
              label="平仓价格"
              value={editingForm.closePrice}
              onChange={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, closePrice: event.target.value }))}
            />
            <Field label="盈亏金额" value={editingForm.pnl} readOnly />
            <Field
              label="开仓时间"
              value={editingForm.openTime}
              onChange={(event) => setEditingForm((current) => ({ ...current, openTime: event.target.value }))}
              onBlur={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, openTime: event.target.value }))}
            />
            <Field
              label="平仓时间"
              value={editingForm.closeTime}
              onChange={(event) => setEditingForm((current) => ({ ...current, closeTime: event.target.value }))}
              onBlur={(event) => setEditingForm((current) => hydrateDerivedFields({ ...current, closeTime: event.target.value }))}
            />
            <Field label="持仓时间" value={editingForm.holdTime} readOnly />
            <TextArea
              label="备注"
              value={editingForm.remark}
              onChange={(event) => setEditingForm((current) => ({ ...current, remark: event.target.value }))}
              rows={4}
              placeholder="补充这笔交易的入场理由、执行偏差或复盘要点"
            />
          </div>
        </Modal>

        <DeleteModal
          open={Boolean(pendingDeleteId)}
          onClose={() => setPendingDeleteId(null)}
          title="删除交易记录"
          onConfirm={() => {
            if (!pendingDeleteId) {
              return;
            }

            onChangeTrades((current) => deleteForexTrade(current, pendingDeleteId));
            setPendingDeleteId(null);
            showToast('交易记录已删除。');
          }}
        >
          这条交易记录会从本地统计和复盘结果中一并移除。
        </DeleteModal>
      </div>
    </SectionCard>
  );
}
