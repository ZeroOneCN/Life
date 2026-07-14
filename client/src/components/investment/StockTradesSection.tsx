import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { DatePickerField } from '../date';
import { SectionCard, EmptyState } from '../page';
import {
  Btn,
  DataTable,
  DeleteIcon,
  DeleteModal,
  EditIcon,
  Field,
  IconBtn,
  Modal,
  Pagination,
  SelectField,
  Tag,
  TextArea,
  useToastState,
} from '../ui';
import { formatMoney, estimatePnl } from '../../services/stockCalc';
import {
  type StockPlatform,
  type StockTrade,
  type StockTradeDraft,
  INVESTMENT_MARKET_CONFIG,
} from '../../types/investment';
import { type StockMarketType } from '../../services/stockStorage';

interface StockTradesSectionProps {
  trades: StockTrade[];
  platforms: StockPlatform[];
  market: StockMarketType;
  onAdd: (draft: StockTradeDraft) => void;
  onUpdate: (id: string, draft: Partial<StockTradeDraft>) => void;
  onDelete: (id: string) => void;
  onClose: (id: string, closePrice: number, closeDate: string, closeTime: string) => void;
  onReopen: (id: string) => void;
}

const PAGE_SIZE = 10;

export function StockTradesSection({ trades, platforms, market, onAdd, onUpdate, onDelete, onClose, onReopen }: StockTradesSectionProps) {
  const { showToast } = useToastState();
  const config = INVESTMENT_MARKET_CONFIG[market];

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<StockTrade | null>(null);
  const [closingTrade, setClosingTrade] = useState<StockTrade | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [keyword, platformFilter, statusFilter]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return trades.filter((t) => {
      if (platformFilter && t.platformId !== platformFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (kw) {
        const hay = `${t.symbol} ${t.name} ${t.platformName} ${t.remark} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [trades, keyword, platformFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const [addForm, setAddForm] = useState({
    platformId: platforms[0]?.id || '',
    symbol: '',
    name: '',
    side: 'buy' as 'buy' | 'sell',
    quantity: '',
    price: '',
    fee: '',
    tradeDate: dayjs().format('YYYY-MM-DD'),
    tradeTime: dayjs().format('HH:mm:ss'),
    status: 'open' as 'open' | 'closed',
    closePrice: '',
    closeDate: '',
    closeTime: '',
    closeFee: '',
    tags: '',
    remark: '',
  });

  const [editForm, setEditForm] = useState({
    platformId: '',
    symbol: '',
    name: '',
    side: 'buy' as 'buy' | 'sell',
    quantity: '',
    price: '',
    fee: '',
    tradeDate: '',
    tradeTime: '',
    status: 'open' as 'open' | 'closed',
    closePrice: '',
    closeDate: '',
    closeTime: '',
    closeFee: '',
    tags: '',
    remark: '',
  });

  const [closeForm, setCloseForm] = useState({
    closePrice: '',
    closeDate: dayjs().format('YYYY-MM-DD'),
    closeTime: dayjs().format('HH:mm:ss'),
    closeFee: '',
  });

  const handleAddSubmit = () => {
    if (!addForm.platformId) {
      showToast('请先添加交易平台', 'error');
      return;
    }
    if (!addForm.symbol.trim()) {
      showToast('请输入标的代码', 'error');
      return;
    }
    const quantity = Number(addForm.quantity);
    const price = Number(addForm.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast('请输入有效数量', 'error');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast('请输入有效价格', 'error');
      return;
    }

    const draft: StockTradeDraft = {
      market,
      platformId: addForm.platformId,
      symbol: addForm.symbol.trim().toUpperCase(),
      name: addForm.name.trim() || addForm.symbol.trim().toUpperCase(),
      side: addForm.side,
      quantity,
      price,
      fee: Number(addForm.fee) || 0,
      tradeDate: addForm.tradeDate,
      tradeTime: addForm.tradeTime,
      status: addForm.status,
    };

    if (addForm.status === 'closed') {
      const closePrice = Number(addForm.closePrice);
      if (!Number.isFinite(closePrice) || closePrice <= 0) {
        showToast('已平仓状态需要填写平仓价格', 'error');
        return;
      }
      draft.closePrice = closePrice;
      draft.closeDate = addForm.closeDate;
      draft.closeTime = addForm.closeTime;
      draft.closeFee = Number(addForm.closeFee) || 0;
      draft.realizedPnl = estimatePnl(addForm.side, price, quantity, closePrice, draft.fee, draft.closeFee);
    }

    onAdd(draft);
    showToast('交易已添加');
    setAddForm({
      platformId: platforms[0]?.id || '',
      symbol: '',
      name: '',
      side: 'buy',
      quantity: '',
      price: '',
      fee: '',
      tradeDate: dayjs().format('YYYY-MM-DD'),
      tradeTime: dayjs().format('HH:mm:ss'),
      status: 'open',
      closePrice: '',
      closeDate: '',
      closeTime: '',
      closeFee: '',
      tags: '',
      remark: '',
    });
    setShowAddModal(false);
  };

  const handleEditSubmit = () => {
    if (!editingTrade) return;
    if (!editForm.platformId) {
      showToast('请选择交易平台', 'error');
      return;
    }
    if (!editForm.symbol.trim()) {
      showToast('请输入标的代码', 'error');
      return;
    }
    const quantity = Number(editForm.quantity);
    const price = Number(editForm.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast('请输入有效数量', 'error');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      showToast('请输入有效价格', 'error');
      return;
    }

    const patch: Partial<StockTradeDraft> = {
      platformId: editForm.platformId,
      symbol: editForm.symbol.trim().toUpperCase(),
      name: editForm.name.trim() || editForm.symbol.trim().toUpperCase(),
      side: editForm.side,
      quantity,
      price,
      fee: Number(editForm.fee) || 0,
      tradeDate: editForm.tradeDate,
      tradeTime: editForm.tradeTime,
      status: editForm.status,
    };

    if (editForm.status === 'closed') {
      const closePrice = Number(editForm.closePrice);
      if (!Number.isFinite(closePrice) || closePrice <= 0) {
        showToast('已平仓状态需要填写平仓价格', 'error');
        return;
      }
      patch.closePrice = closePrice;
      patch.closeDate = editForm.closeDate;
      patch.closeTime = editForm.closeTime;
      patch.closeFee = Number(editForm.closeFee) || 0;
      patch.realizedPnl = estimatePnl(editForm.side, price, quantity, closePrice, patch.fee || 0, patch.closeFee || 0);
    }

    onUpdate(editingTrade.id, patch);
    showToast('交易已更新');
    setEditingTrade(null);
  };

  const handleCloseSubmit = () => {
    if (!closingTrade) return;
    const closePrice = Number(closeForm.closePrice);
    if (!Number.isFinite(closePrice) || closePrice <= 0) {
      showToast('请输入有效平仓价格', 'error');
      return;
    }
    onClose(closingTrade.id, closePrice, closeForm.closeDate, closeForm.closeTime);
    showToast('交易已平仓');
    setClosingTrade(null);
  };

  const handleDeleteConfirm = () => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      showToast('交易已删除');
      setPendingDeleteId(null);
    }
  };

  const columns = [
    {
      key: 'tradeDate',
      title: '日期',
      render: (_: unknown, row: StockTrade) => (
        <div>
          <strong>{row.tradeDate}</strong>
          <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--fs-caption)' }}>{row.tradeTime}</span>
        </div>
      ),
    },
    {
      key: 'platformName',
      title: '平台',
      render: (_: unknown, row: StockTrade) => row.platformName || '未知平台',
    },
    {
      key: 'symbol',
      title: '标的',
      render: (_: unknown, row: StockTrade) => (
        <div>
          <strong>{row.symbol}</strong>
          <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--fs-caption)' }}>{row.name}</span>
        </div>
      ),
    },
    {
      key: 'side',
      title: '方向',
      render: (_: unknown, row: StockTrade) => (
        <Tag tone={row.side === 'buy' ? 'green' : 'red'}>
          {row.side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      key: 'quantity',
      title: '数量',
      render: (_: unknown, row: StockTrade) => `${row.quantity} ${config.quantityUnit}`,
    },
    {
      key: 'price',
      title: '成交价',
      render: (_: unknown, row: StockTrade) => formatMoney(row.price, config.currencySymbol, 2),
    },
    {
      key: 'fee',
      title: '手续费',
      render: (_: unknown, row: StockTrade) => formatMoney(row.fee, config.currencySymbol, 2),
    },
    {
      key: 'status',
      title: '状态',
      render: (_: unknown, row: StockTrade) => (
        row.status === 'open' ? (
          <Tag tone="blue">持仓中</Tag>
        ) : (
          <Tag tone="green">已平仓</Tag>
        )
      ),
    },
    {
      key: 'pnl',
      title: '盈亏',
      render: (_: unknown, row: StockTrade) => {
        if (row.status === 'closed' && typeof row.realizedPnl === 'number') {
          return (
            <strong style={{ color: row.realizedPnl >= 0 ? config.upColor : config.downColor }}>
              {formatMoney(row.realizedPnl, config.currencySymbol)}
            </strong>
          );
        }
        return <span style={{ color: 'var(--color-ink-mute)' }}>—</span>;
      },
    },
    {
      key: 'actions',
      title: '操作',
      render: (_: unknown, row: StockTrade) => (
        <div className="fitness-row-actions">
          {row.status === 'open' ? (
            <Btn
              tone="primary"
              onClick={() => {
                setClosingTrade(row);
                setCloseForm({
                  closePrice: String(row.currentPrice ?? row.price),
                  closeDate: dayjs().format('YYYY-MM-DD'),
                  closeTime: dayjs().format('HH:mm:ss'),
                  closeFee: '',
                });
              }}
            >
              平仓
            </Btn>
          ) : (
            <Btn tone="secondary" onClick={() => onReopen(row.id)}>重开</Btn>
          )}
          <IconBtn
            tone="secondary"
            icon={<EditIcon />}
            title="编辑"
            onClick={() => {
              setEditingTrade(row);
              setEditForm({
                platformId: row.platformId,
                symbol: row.symbol,
                name: row.name,
                side: row.side,
                quantity: String(row.quantity),
                price: String(row.price),
                fee: String(row.fee),
                tradeDate: row.tradeDate,
                tradeTime: row.tradeTime,
                status: row.status,
                closePrice: String(row.closePrice ?? ''),
                closeDate: row.closeDate || dayjs().format('YYYY-MM-DD'),
                closeTime: row.closeTime || dayjs().format('HH:mm:ss'),
                closeFee: String(row.closeFee ?? ''),
                tags: row.tags.join(', '),
                remark: row.remark,
              });
            }}
          />
          <IconBtn
            tone="danger"
            icon={<DeleteIcon />}
            title="删除"
            onClick={() => setPendingDeleteId(row.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <SectionCard
        title="交易记录"
        description={`共 ${trades.length} 笔交易`}
        action={
          <Btn tone="primary" onClick={() => setShowAddModal(true)}>添加交易</Btn>
        }
      />

      <SectionCard title="交易列表">
        <div className="invest-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标的、平台、备注"
          />
          <SelectField
            label="平台"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <option value="">全部平台</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="状态"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="open">持仓中</option>
            <option value="closed">已平仓</option>
          </SelectField>
        </div>

        {pageRecords.length === 0 ? (
          <EmptyState
            title="暂无交易记录"
            description="点击上方「添加交易」按钮添加第一笔交易"
            icon="📊"
          />
        ) : (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </SectionCard>

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="新增交易"
        width={900}
        footer={
          <>
            <Btn tone="secondary" onClick={() => setShowAddModal(false)}>取消</Btn>
            <Btn tone="primary" onClick={handleAddSubmit}>保存交易</Btn>
          </>
        }
      >
        <div className="invest-trade-form">
          <SelectField
            label="交易平台 *"
            value={addForm.platformId}
            onChange={(e) => setAddForm((prev) => ({ ...prev, platformId: e.target.value }))}
          >
            <option value="">请选择平台</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </SelectField>
          <Field
            label="标的代码 *"
            value={addForm.symbol}
            onChange={(e) => setAddForm((prev) => ({ ...prev, symbol: e.target.value }))}
            placeholder="例如：AAPL 或 0700.HK"
          />
          <Field
            label="标的名称"
            value={addForm.name}
            onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="留空使用代码作为名称"
          />
          <SelectField
            label="方向 *"
            value={addForm.side}
            onChange={(e) => setAddForm((prev) => ({ ...prev, side: e.target.value as 'buy' | 'sell' }))}
          >
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </SelectField>
          <Field
            label={`数量 (${config.quantityUnit}) *`}
            value={addForm.quantity}
            onChange={(e) => setAddForm((prev) => ({ ...prev, quantity: e.target.value }))}
            placeholder="100"
          />
          <Field
            label="成交价 *"
            value={addForm.price}
            onChange={(e) => setAddForm((prev) => ({ ...prev, price: e.target.value }))}
            placeholder="0.00"
          />
          <Field
            label="手续费"
            value={addForm.fee}
            onChange={(e) => setAddForm((prev) => ({ ...prev, fee: e.target.value }))}
            placeholder="0.00"
          />
          <DatePickerField
            label="交易日期 *"
            value={addForm.tradeDate}
            onChange={(value) => setAddForm((prev) => ({ ...prev, tradeDate: value }))}
          />
          <Field
            label="交易时间 *"
            value={addForm.tradeTime}
            onChange={(e) => setAddForm((prev) => ({ ...prev, tradeTime: e.target.value }))}
            placeholder="HH:mm:ss"
          />
          <SelectField
            label="状态"
            value={addForm.status}
            onChange={(e) => setAddForm((prev) => ({ ...prev, status: e.target.value as 'open' | 'closed' }))}
          >
            <option value="open">持仓中</option>
            <option value="closed">已平仓</option>
          </SelectField>

          {addForm.status === 'closed' && (
            <>
              <Field
                label="平仓价 *"
                value={addForm.closePrice}
                onChange={(e) => setAddForm((prev) => ({ ...prev, closePrice: e.target.value }))}
              />
              <DatePickerField
                label="平仓日期"
                value={addForm.closeDate}
                onChange={(value) => setAddForm((prev) => ({ ...prev, closeDate: value }))}
              />
              <Field
                label="平仓时间"
                value={addForm.closeTime}
                onChange={(e) => setAddForm((prev) => ({ ...prev, closeTime: e.target.value }))}
              />
              <Field
                label="平仓手续费"
                value={addForm.closeFee}
                onChange={(e) => setAddForm((prev) => ({ ...prev, closeFee: e.target.value }))}
              />
            </>
          )}

          <div className="invest-form-field-full">
            <Field
              label="标签"
              value={addForm.tags}
              onChange={(e) => setAddForm((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="用逗号分隔"
            />
          </div>
          <div className="invest-form-field-full">
            <TextArea
              label="备注"
              value={addForm.remark}
              onChange={(e) => setAddForm((prev) => ({ ...prev, remark: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editingTrade}
        onClose={() => setEditingTrade(null)}
        title="编辑交易"
        width={900}
        footer={
          <>
            <Btn tone="secondary" onClick={() => setEditingTrade(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleEditSubmit}>保存</Btn>
          </>
        }
      >
        <div className="invest-trade-form">
          <SelectField
            label="交易平台"
            value={editForm.platformId}
            onChange={(e) => setEditForm((prev) => ({ ...prev, platformId: e.target.value }))}
          >
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </SelectField>
          <Field
            label="标的代码"
            value={editForm.symbol}
            onChange={(e) => setEditForm((prev) => ({ ...prev, symbol: e.target.value }))}
          />
          <Field
            label="标的名称"
            value={editForm.name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <SelectField
            label="方向"
            value={editForm.side}
            onChange={(e) => setEditForm((prev) => ({ ...prev, side: e.target.value as 'buy' | 'sell' }))}
          >
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </SelectField>
          <Field
            label="数量"
            value={editForm.quantity}
            onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: e.target.value }))}
          />
          <Field
            label="成交价"
            value={editForm.price}
            onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
          />
          <Field
            label="手续费"
            value={editForm.fee}
            onChange={(e) => setEditForm((prev) => ({ ...prev, fee: e.target.value }))}
          />
          <DatePickerField
            label="交易日期"
            value={editForm.tradeDate}
            onChange={(value) => setEditForm((prev) => ({ ...prev, tradeDate: value }))}
          />
          <Field
            label="交易时间"
            value={editForm.tradeTime}
            onChange={(e) => setEditForm((prev) => ({ ...prev, tradeTime: e.target.value }))}
          />
          <SelectField
            label="状态"
            value={editForm.status}
            onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as 'open' | 'closed' }))}
          >
            <option value="open">持仓中</option>
            <option value="closed">已平仓</option>
          </SelectField>

          {editForm.status === 'closed' && (
            <>
              <Field
                label="平仓价"
                value={editForm.closePrice}
                onChange={(e) => setEditForm((prev) => ({ ...prev, closePrice: e.target.value }))}
              />
              <DatePickerField
                label="平仓日期"
                value={editForm.closeDate}
                onChange={(value) => setEditForm((prev) => ({ ...prev, closeDate: value }))}
              />
              <Field
                label="平仓时间"
                value={editForm.closeTime}
                onChange={(e) => setEditForm((prev) => ({ ...prev, closeTime: e.target.value }))}
              />
              <Field
                label="平仓手续费"
                value={editForm.closeFee}
                onChange={(e) => setEditForm((prev) => ({ ...prev, closeFee: e.target.value }))}
              />
            </>
          )}

          <div className="invest-form-field-full">
            <Field
              label="标签"
              value={editForm.tags}
              onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
            />
          </div>
          <div className="invest-form-field-full">
            <TextArea
              label="备注"
              value={editForm.remark}
              onChange={(e) => setEditForm((prev) => ({ ...prev, remark: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!closingTrade}
        onClose={() => setClosingTrade(null)}
        title="平仓交易"
        footer={
          <>
            <Btn tone="secondary" onClick={() => setClosingTrade(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleCloseSubmit}>确认平仓</Btn>
          </>
        }
      >
        {closingTrade && (
          <div>
            <p>
              平仓 <strong>{closingTrade.symbol} {closingTrade.name}</strong>：
              持仓 {closingTrade.quantity} {config.quantityUnit} @ {formatMoney(closingTrade.price, config.currencySymbol)}
            </p>
            <Field
              label="平仓价格 *"
              value={closeForm.closePrice}
              onChange={(e) => setCloseForm((prev) => ({ ...prev, closePrice: e.target.value }))}
            />
            <DatePickerField
              label="平仓日期"
              value={closeForm.closeDate}
              onChange={(value) => setCloseForm((prev) => ({ ...prev, closeDate: value }))}
            />
            <Field
              label="平仓时间"
              value={closeForm.closeTime}
              onChange={(e) => setCloseForm((prev) => ({ ...prev, closeTime: e.target.value }))}
            />
            <Field
              label="平仓手续费"
              value={closeForm.closeFee}
              onChange={(e) => setCloseForm((prev) => ({ ...prev, closeFee: e.target.value }))}
            />
            {(() => {
              const closePrice = Number(closeForm.closePrice);
              if (!Number.isFinite(closePrice) || closePrice <= 0) return null;
              const pnl = estimatePnl(closingTrade.side, closingTrade.price, closingTrade.quantity, closePrice, closingTrade.fee, Number(closeForm.closeFee) || 0);
              return (
                <p>
                  预估盈亏：
                  <strong style={{ color: pnl >= 0 ? config.upColor : config.downColor }}>
                    {formatMoney(pnl, config.currencySymbol)}
                  </strong>
                </p>
              );
            })()}
          </div>
        )}
      </Modal>

      <DeleteModal
        open={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        title="删除交易"
        onConfirm={handleDeleteConfirm}
      >
        这笔交易会被永久删除，相关的统计会重算。
      </DeleteModal>
    </div>
  );
}