import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  SHOPPING_ALL_LEDGERS,
  SHOPPING_RECORD_PAGE_SIZE,
  createShoppingRecord,
  deleteShoppingRecord,
  filterShoppingRecords,
  formatShoppingAmount,
  normalizeShoppingUserId,
  updateShoppingRecord,
} from '../../services/shopping';
import type { ShoppingCurrencyMode, ShoppingLedger, ShoppingPlatform, ShoppingRecord, ShoppingRecordDraft } from '../../types/shopping';

interface ShoppingRecordsSectionProps {
  activeUserId: string;
  activeLedgerId: string;
  filterUserId: string;
  filterLedgerId: string;
  records: ShoppingRecord[];
  ledgers: ShoppingLedger[];
  platforms: ShoppingPlatform[];
  currencyMode: ShoppingCurrencyMode;
  usdtRate: number;
  onFilterUserIdChange: (value: string) => void;
  onFilterLedgerIdChange: (value: string) => void;
  onChangeRecords: (updater: (records: ShoppingRecord[]) => ShoppingRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface ShoppingFormState {
  userId: string;
  ledgerId: string;
  date: string;
  platform: string;
  itemName: string;
  spec: string;
  price: string;
  unitPrice: string;
  orderNo: string;
  note: string;
}

function createDefaultFormState(activeUserId: string, activeLedgerId: string, platforms: ShoppingPlatform[]): ShoppingFormState {
  return {
    userId: activeUserId,
    ledgerId: activeLedgerId,
    date: dayjs().format('YYYY-MM-DD'),
    platform: platforms[0]?.name ?? '其他',
    itemName: '',
    spec: '',
    price: '',
    unitPrice: '',
    orderNo: '',
    note: '',
  };
}

function buildFormState(record: ShoppingRecord): ShoppingFormState {
  return {
    userId: record.userId,
    ledgerId: record.ledgerId,
    date: record.date,
    platform: record.platform,
    itemName: record.itemName,
    spec: record.spec,
    price: String(record.price),
    unitPrice: record.unitPrice === null ? '' : String(record.unitPrice),
    orderNo: record.orderNo,
    note: record.note,
  };
}

function parseDraft(form: ShoppingFormState): ShoppingRecordDraft | null {
  const userId = normalizeShoppingUserId(form.userId);
  const price = Number(form.price);
  const unitPrice = form.unitPrice ? Number(form.unitPrice) : null;

  if (!userId || !form.ledgerId || !dayjs(form.date).isValid() || !form.platform.trim() || !form.itemName.trim()) {
    return null;
  }

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  if (form.unitPrice && (!Number.isFinite(unitPrice) || Number(unitPrice) <= 0)) {
    return null;
  }

  return {
    userId,
    ledgerId: form.ledgerId,
    date: form.date,
    platform: form.platform.trim(),
    itemName: form.itemName.trim(),
    spec: form.spec.trim(),
    price,
    unitPrice,
    orderNo: form.orderNo.trim(),
    note: form.note.trim(),
  };
}

export function ShoppingRecordsSection({
  activeUserId,
  activeLedgerId,
  filterUserId,
  filterLedgerId,
  records,
  ledgers,
  platforms,
  currencyMode,
  usdtRate,
  onFilterUserIdChange,
  onFilterLedgerIdChange,
  onChangeRecords,
  showToast,
}: ShoppingRecordsSectionProps) {
  const [form, setForm] = useState<ShoppingFormState>(() => createDefaultFormState(activeUserId, activeLedgerId, platforms));
  const [keyword, setKeyword] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<ShoppingRecord | null>(null);
  const [editingForm, setEditingForm] = useState<ShoppingFormState>(() => createDefaultFormState(activeUserId, activeLedgerId, platforms));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setForm((previous) => ({
      ...previous,
      userId: activeUserId,
      ledgerId: activeLedgerId,
      platform: previous.platform || platforms[0]?.name || '其他',
    }));
  }, [activeLedgerId, activeUserId, platforms]);

  const ledgerNameMap = useMemo(
    () => Object.fromEntries(ledgers.map((ledger) => [ledger.id, ledger.name])),
    [ledgers],
  );

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return filterShoppingRecords(records, filterUserId, filterLedgerId)
      .filter((record) => (!platformFilter || record.platform === platformFilter))
      .filter((record) => (!dateFilter || record.date === dateFilter))
      .filter((record) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [
          record.itemName,
          record.spec,
          record.orderNo,
          record.note,
          record.platform,
          ledgerNameMap[record.ledgerId] ?? '',
        ].some((value) => value.toLowerCase().includes(normalizedKeyword));
      });
  }, [records, filterUserId, filterLedgerId, platformFilter, dateFilter, keyword, ledgerNameMap]);

  useEffect(() => {
    setPage(1);
  }, [filterUserId, filterLedgerId, platformFilter, dateFilter, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / SHOPPING_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * SHOPPING_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + SHOPPING_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => ({
    count: filteredRecords.length,
    amount: filteredRecords.reduce((sum, record) => sum + record.price, 0),
  }), [filteredRecords]);

  const columns = useMemo(() => [
    { key: 'date', title: '日期', dataIndex: 'date' as const },
    { key: 'platform', title: '平台', dataIndex: 'platform' as const },
    { key: 'itemName', title: '商品名称', dataIndex: 'itemName' as const },
    { key: 'spec', title: '规格', dataIndex: 'spec' as const },
    {
      key: 'price',
      title: '总价',
      render: (_value: unknown, row: ShoppingRecord) => formatShoppingAmount(row.price, currencyMode, usdtRate),
    },
    {
      key: 'unitPrice',
      title: '单价',
      render: (_value: unknown, row: ShoppingRecord) => (
        row.unitPrice === null ? '-' : formatShoppingAmount(row.unitPrice, currencyMode, usdtRate)
      ),
    },
    { key: 'orderNo', title: '订单号', dataIndex: 'orderNo' as const },
    {
      key: 'ledgerId',
      title: '账本',
      render: (_value: unknown, row: ShoppingRecord) => ledgerNameMap[row.ledgerId] ?? row.ledgerId,
    },
    {
      key: 'note',
      title: '备注',
      render: (_value: unknown, row: ShoppingRecord) => row.note || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: ShoppingRecord) => (
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
  ], [currencyMode, ledgerNameMap, usdtRate]);

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全用户、账本、日期、平台、商品名称和价格。', 'error');
      return;
    }

    onChangeRecords((previous) => createShoppingRecord(previous, draft));
    setForm(createDefaultFormState(activeUserId, activeLedgerId, platforms));
    showToast('购物记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的购物记录信息。', 'error');
      return;
    }

    onChangeRecords((previous) => updateShoppingRecord(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(createDefaultFormState(activeUserId, activeLedgerId, platforms));
    showToast('购物记录已更新。');
  };

  return (
    <SectionCard
      title="购物记录"
      description="按用户和账本维护网购记录，保留平台、规格、订单号和备注，供后续统计和导入去重复用。"
      action={<Tag tone="blue">{currencyMode === 'USDT' ? 'USDT 视图' : '人民币视图'}</Tag>}
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前默认账本为 <strong>{ledgerNameMap[activeLedgerId] ?? '未选择账本'}</strong>。
          如需导入 Excel，请使用页面右上角的导入入口。
        </div>

        <form className="shopping-entry-grid shopping-entry-grid-records" onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <DatePickerField
            label="下单日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <SelectField
            label="购买平台"
            value={form.platform}
            onChange={(event) => setForm((previous) => ({ ...previous, platform: event.target.value }))}
          >
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.name}>{platform.name}</option>
            ))}
          </SelectField>
          <Field
            label="商品名称"
            value={form.itemName}
            onChange={(event) => setForm((previous) => ({ ...previous, itemName: event.target.value }))}
            placeholder="例如：桌面收纳架"
          />
          <Field
            label="规格"
            value={form.spec}
            onChange={(event) => setForm((previous) => ({ ...previous, spec: event.target.value }))}
            placeholder="例如：黑色双层"
          />
          <Field
            label="总价"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) => setForm((previous) => ({ ...previous, price: event.target.value }))}
            placeholder="例如：199.00"
          />
          <Field
            label="单价"
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(event) => setForm((previous) => ({ ...previous, unitPrice: event.target.value }))}
            placeholder="可选"
          />
          <Field
            label="订单号"
            value={form.orderNo}
            onChange={(event) => setForm((previous) => ({ ...previous, orderNo: event.target.value }))}
            placeholder="可选"
          />
          <Field
            label="备注"
            value={form.note}
            onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
            placeholder="例如：活动补贴后下单"
          />
          <div className="shopping-inline-action">
            <span className="field-label">保存记录</span>
            <Btn tone="primary" type="submit">保存购物记录</Btn>
          </div>
        </form>

        <div className="shopping-filter-grid">
          <Field
            label="筛选用户 ID"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
          />
          <SelectField
            label="筛选账本"
            value={filterLedgerId}
            onChange={(event) => onFilterLedgerIdChange(event.target.value)}
          >
            <option value={SHOPPING_ALL_LEDGERS}>全部账本</option>
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
            ))}
          </SelectField>
          <SelectField label="平台筛选" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
            <option value="">全部平台</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.name}>{platform.name}</option>
            ))}
          </SelectField>
          <DatePickerField label="日期筛选" value={dateFilter} onChange={setDateFilter} placeholder="不限日期" />
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索商品、规格、订单号或备注"
          />
        </div>

        <div className="shopping-summary-bar">
          <span className="subtle-text">
            共 {summary.count} 条记录，累计金额 {formatShoppingAmount(summary.amount, currencyMode, usdtRate)}
          </span>
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pageRecords} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无购物记录"
            description="先新增一条购物记录，或调整用户、账本、平台与日期筛选条件。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => {
          setEditingRecord(null);
          setEditingForm(createDefaultFormState(activeUserId, activeLedgerId, platforms));
        }}
        title={editingRecord ? `编辑购物记录：${editingRecord.itemName}` : '编辑购物记录'}
        width={900}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingRecord(null);
                setEditingForm(createDefaultFormState(activeUserId, activeLedgerId, platforms));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="shopping-modal-layout">
          <div className="shopping-modal-grid">
            <SelectField
              label="所属账本"
              value={editingForm.ledgerId}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, ledgerId: event.target.value }))}
            >
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
              ))}
            </SelectField>
            <DatePickerField
              label="下单日期"
              value={editingForm.date}
              onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
              clearable={false}
            />
            <SelectField
              label="购买平台"
              value={editingForm.platform}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, platform: event.target.value }))}
            >
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.name}>{platform.name}</option>
              ))}
            </SelectField>
            <Field
              label="商品名称"
              value={editingForm.itemName}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, itemName: event.target.value }))}
            />
            <Field
              label="规格"
              value={editingForm.spec}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, spec: event.target.value }))}
            />
            <Field
              label="总价"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.price}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, price: event.target.value }))}
            />
            <Field
              label="单价"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.unitPrice}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, unitPrice: event.target.value }))}
            />
            <Field
              label="订单号"
              value={editingForm.orderNo}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, orderNo: event.target.value }))}
            />
          </div>
          <TextArea
            label="备注"
            value={editingForm.note}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, note: event.target.value }))}
            placeholder="补充活动信息、物流说明或购买背景"
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onChangeRecords((previous) => deleteShoppingRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('购物记录已删除。');
        }}
        title="确认删除这条购物记录？"
      >
        删除后，这条记录将不再参与购物统计、导入去重和账本汇总。
      </DeleteModal>
    </SectionCard>
  );
}
