import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { calculateStorageDailyCost, calculateStorageUsageDays, formatStorageMoney, getStorageStatusLabel } from '../../services/storage';
import { storageApi } from '../../services/storageApi';
import type { StorageItemDraft, StorageItemRecord, StoragePageSettings } from '../../types/storage';

interface StorageItemsSectionProps {
  settings: StoragePageSettings;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

interface StorageFormState {
  itemName: string;
  purchasePrice: string;
  purchaseDate: string;
  endDate: string;
  notes: string;
}

const PAGE_SIZE = 10;

function createDefaultFormState(): StorageFormState {
  return {
    itemName: '',
    purchasePrice: '',
    purchaseDate: dayjs().format('YYYY-MM-DD'),
    endDate: '',
    notes: '',
  };
}

function buildFormState(item: StorageItemRecord): StorageFormState {
  return {
    itemName: item.itemName,
    purchasePrice: String(item.purchasePrice),
    purchaseDate: item.purchaseDate,
    endDate: item.endDate,
    notes: item.notes,
  };
}

function parseDraft(form: StorageFormState): StorageItemDraft | null {
  const purchasePrice = Number(form.purchasePrice);

  if (!form.itemName.trim() || !form.purchaseDate || !Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return null;
  }

  if (form.endDate && dayjs(form.endDate).isBefore(dayjs(form.purchaseDate), 'day')) {
    return null;
  }

  return {
    itemName: form.itemName.trim(),
    purchasePrice,
    purchaseDate: form.purchaseDate,
    endDate: form.endDate,
    notes: form.notes.trim(),
  };
}

function getStatusTone(status: StorageItemRecord['status']): 'green' | 'blue' {
  return status === 'archived' ? 'blue' : 'green';
}

export function StorageItemsSection({
  settings,
  showToast,
  onChanged,
}: StorageItemsSectionProps) {
  const [form, setForm] = useState<StorageFormState>(createDefaultFormState);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StorageItemRecord['status']>('active');
  const [purchaseStartDate, setPurchaseStartDate] = useState('');
  const [purchaseEndDate, setPurchaseEndDate] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StorageItemRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [editingItem, setEditingItem] = useState<StorageItemRecord | null>(null);
  const [editingForm, setEditingForm] = useState<StorageFormState>(createDefaultFormState);

  const loadItems = async () => {
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: PAGE_SIZE,
        status: statusFilter,
      };

      if (keyword) params.keyword = keyword;
      if (purchaseStartDate) params.purchaseStartDate = purchaseStartDate;
      if (purchaseEndDate) params.purchaseEndDate = purchaseEndDate;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      const result = await storageApi.list(params);
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '物品列表加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadItems();
  }, [page, keyword, statusFilter, purchaseStartDate, purchaseEndDate, minPrice, maxPrice]);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter, purchaseStartDate, purchaseEndDate, minPrice, maxPrice]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = useMemo(() => items.reduce((result, item) => {
    result.totalPurchase += item.purchasePrice;
    result.totalDailyCost += calculateStorageDailyCost(item);
    return result;
  }, {
    totalPurchase: 0,
    totalDailyCost: 0,
  }), [items]);

  const handleCreate = async () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请填写完整的物品名称、购买价格和购买日期，且结束日期不能早于购买日期。', 'error');
      return;
    }

    try {
      await storageApi.create(draft);
      setForm(createDefaultFormState());
      showToast('物品记录已保存。');
      onChanged();
      await loadItems();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '创建物品失败。'), 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('请先补全编辑表单中的必填项。', 'error');
      return;
    }

    try {
      await storageApi.update(editingItem.id, draft);
      setEditingItem(null);
      showToast('物品记录已更新。');
      onChanged();
      await loadItems();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '更新物品失败。'), 'error');
    }
  };

  const hasActiveFilters = Boolean(
    keyword
    || statusFilter !== 'active'
    || purchaseStartDate
    || purchaseEndDate
    || minPrice
    || maxPrice,
  );

  return (
    <SectionCard
      title="物品列表"
      description="新增、编辑、归档和筛选都直接调用后端接口，页面不再持有本地物品主状态。"
      action={<Btn tone="secondary" disabled={!hasActiveFilters} onClick={() => {
        setKeyword('');
        setStatusFilter('active');
        setPurchaseStartDate('');
        setPurchaseEndDate('');
        setMinPrice('');
        setMaxPrice('');
      }}
      >
        重置筛选
      </Btn>}
    >
      <div className="page-stack">
        <StatGrid
          className="storage-list-summary-grid"
          items={[
            { label: '当前页结果', value: `${items.length} 条` },
            { label: '当前页购入金额', value: formatStorageMoney(summary.totalPurchase) },
            { label: '当前页日均成本', value: formatStorageMoney(summary.totalDailyCost) },
            { label: '默认排序', value: settings.defaultSort === 'latest' ? '最近更新' : settings.defaultSort === 'purchasePrice' ? '购买价格' : '日均成本' },
          ]}
        />

        <div className="storage-entry-grid">
          <Field
            label="物品名称"
            value={form.itemName}
            onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))}
            placeholder="例如 跑步鞋"
          />
          <Field
            label="购买价格"
            type="number"
            min="0"
            step="0.01"
            value={form.purchasePrice}
            onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))}
            placeholder="例如 600"
          />
          <DatePickerField
            label="购买日期"
            value={form.purchaseDate}
            onChange={(value) => setForm((current) => ({ ...current, purchaseDate: value }))}
            clearable={false}
            popoverStrategy="floating"
          />
          <DatePickerField
            label="结束使用日期"
            value={form.endDate}
            onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
            clearable
            minValue={form.purchaseDate}
            placeholder="仍在使用可留空"
            popoverStrategy="floating"
          />
          <Field
            label="备注"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="记录用途或状态"
          />
          <div className="storage-inline-action">
            <Btn tone="primary" onClick={handleCreate}>保存物品</Btn>
          </div>
        </div>

        <div className="storage-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索物品名称或备注"
          />
          <SelectField
            label="状态"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="active">仅使用中</option>
            <option value="all">全部状态</option>
            <option value="archived">仅已归档</option>
          </SelectField>
          <DatePickerField label="购买开始" value={purchaseStartDate} onChange={setPurchaseStartDate} clearable popoverStrategy="floating" />
          <DatePickerField label="购买结束" value={purchaseEndDate} onChange={setPurchaseEndDate} clearable popoverStrategy="floating" />
          <Field
            label="最低价格"
            type="number"
            min="0"
            step="0.01"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="不限"
          />
          <Field
            label="最高价格"
            type="number"
            min="0"
            step="0.01"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="不限"
          />
        </div>

        {items.length ? (
          <>
            <DataTable
              columns={[
                {
                  key: 'itemName',
                  title: '物品名称',
                  dataIndex: 'itemName',
                  width: 160,
                  render: (_, row) => (
                    <div className="storage-item-name">
                      <strong>{row.itemName}</strong>
                      <span>{row.notes || '暂无备注'}</span>
                    </div>
                  ),
                },
                { key: 'purchaseDate', title: '购买日期', dataIndex: 'purchaseDate', width: 116 },
                {
                  key: 'purchasePrice',
                  title: '购买价格',
                  width: 110,
                  render: (_, row) => formatStorageMoney(row.purchasePrice),
                },
                {
                  key: 'endDate',
                  title: '结束使用',
                  width: 116,
                  render: (_, row) => row.endDate || '使用中',
                },
                {
                  key: 'usageDays',
                  title: '使用天数',
                  width: 96,
                  render: (_, row) => `${calculateStorageUsageDays(row)} 天`,
                },
                {
                  key: 'dailyCost',
                  title: '当前/最终日均成本',
                  width: 140,
                  render: (_, row) => formatStorageMoney(calculateStorageDailyCost(row)),
                },
                {
                  key: 'status',
                  title: '状态',
                  width: 92,
                  render: (_, row) => <Tag tone={getStatusTone(row.status)}>{getStorageStatusLabel(row.status)}</Tag>,
                },
                {
                  key: 'actions',
                  title: '操作',
                  width: 190,
                  render: (_, row) => (
                    <div className="storage-table-actions">
                      <Btn
                        tone="ghost"
                        onClick={() => {
                          setEditingItem(row);
                          setEditingForm(buildFormState(row));
                        }}
                      >
                        编辑
                      </Btn>
                      <Btn
                        tone="secondary"
                        onClick={async () => {
                          try {
                            await storageApi.archive(row.id, dayjs().format('YYYY-MM-DD'));
                            showToast('物品已归档，最终摊销结果已固定。');
                            onChanged();
                            await loadItems();
                          } catch (error) {
                            showToast(buildApiErrorMessage(error, '归档物品失败。'), 'error');
                          }
                        }}
                      >
                        结束使用
                      </Btn>
                    </div>
                  ),
                },
              ]}
              data={items}
              rowKey="id"
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无符合条件的物品" description="可以先录入一件正在使用的物品，或者放宽筛选条件后再查看。" />
        )}
      </div>

      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={editingItem ? `编辑物品：${editingItem.itemName}` : '编辑物品'}
        width={760}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingItem(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="storage-modal-grid">
          <Field
            label="物品名称"
            value={editingForm.itemName}
            onChange={(event) => setEditingForm((current) => ({ ...current, itemName: event.target.value }))}
          />
          <Field
            label="购买价格"
            type="number"
            min="0"
            step="0.01"
            value={editingForm.purchasePrice}
            onChange={(event) => setEditingForm((current) => ({ ...current, purchasePrice: event.target.value }))}
          />
          <DatePickerField
            label="购买日期"
            value={editingForm.purchaseDate}
            onChange={(value) => setEditingForm((current) => ({ ...current, purchaseDate: value }))}
            clearable={false}
            popoverStrategy="floating"
          />
          <DatePickerField
            label="结束使用日期"
            value={editingForm.endDate}
            onChange={(value) => setEditingForm((current) => ({ ...current, endDate: value }))}
            clearable
            minValue={editingForm.purchaseDate}
            popoverStrategy="floating"
          />
          <div className="storage-modal-grid-full">
            <TextArea
              label="备注"
              value={editingForm.notes}
              onChange={(event) => setEditingForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="记录用途、使用感受或归档原因"
            />
          </div>
        </div>
      </Modal>
    </SectionCard>
  );
}
