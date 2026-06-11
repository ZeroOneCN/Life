import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { DataTable, Btn, DeleteModal, Field, Modal, Pagination } from '../ui';
import { EmptyState, SectionCard } from '../page';
import {
  FITNESS_RECORD_PAGE_SIZE,
  createFitnessShoppingRecord,
  deleteFitnessShoppingRecord,
  filterRecordsByUserId,
  normalizeFitnessUserId,
  updateFitnessShoppingRecord,
} from '../../services/fitness';
import type { FitnessShoppingRecord, FitnessShoppingRecordDraft } from '../../types/fitness';

interface FitnessShoppingSectionProps {
  activeUserId: string;
  filterUserId: string;
  records: FitnessShoppingRecord[];
  onFilterUserIdChange: (value: string) => void;
  onChangeRecords: (updater: (records: FitnessShoppingRecord[]) => FitnessShoppingRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface ShoppingFormState {
  date: string;
  itemName: string;
  specGrams: string;
  quantity: string;
  unitPrice: string;
  location: string;
}

const defaultFormState = (): ShoppingFormState => ({
  date: dayjs().format('YYYY-MM-DD'),
  itemName: '',
  specGrams: '500',
  quantity: '1',
  unitPrice: '',
  location: '',
});

function parseDraft(form: ShoppingFormState, userId: string): FitnessShoppingRecordDraft | null {
  const normalizedUserId = normalizeFitnessUserId(userId);
  const specGrams = Number(form.specGrams);
  const quantity = Number(form.quantity);
  const unitPrice = Number(form.unitPrice);

  if (!normalizedUserId || !form.itemName.trim() || !dayjs(form.date).isValid()) {
    return null;
  }

  if (!Number.isFinite(specGrams) || specGrams <= 0 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return null;
  }

  return {
    userId: normalizedUserId,
    date: form.date,
    itemName: form.itemName.trim(),
    specGrams,
    quantity,
    unitPrice,
    location: form.location.trim(),
  };
}

export function FitnessShoppingSection({
  activeUserId,
  filterUserId,
  records,
  onFilterUserIdChange,
  onChangeRecords,
  showToast,
}: FitnessShoppingSectionProps) {
  const [form, setForm] = useState<ShoppingFormState>(defaultFormState);
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<FitnessShoppingRecord | null>(null);
  const [editingForm, setEditingForm] = useState<ShoppingFormState>(defaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const byUser = filterRecordsByUserId(records, filterUserId);

    if (!filterDate) {
      return byUser;
    }

    return byUser.filter((record) => record.date === filterDate);
  }, [filterDate, filterUserId, records]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / FITNESS_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * FITNESS_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + FITNESS_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    setPage(1);
  }, [filterDate, filterUserId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = useMemo(() => [
    { key: 'date', title: '日期', dataIndex: 'date' as const },
    { key: 'itemName', title: '食材名称', dataIndex: 'itemName' as const },
    {
      key: 'specGrams',
      title: '规格',
      render: (_value: unknown, record: FitnessShoppingRecord) => `${record.specGrams} g / 份`,
    },
    {
      key: 'quantity',
      title: '数量',
      render: (_value: unknown, record: FitnessShoppingRecord) => `${record.quantity} 份`,
    },
    {
      key: 'unitPrice',
      title: '单价',
      render: (_value: unknown, record: FitnessShoppingRecord) => `¥${record.unitPrice.toFixed(2)}`,
    },
    {
      key: 'total',
      title: '合计',
      render: (_value: unknown, record: FitnessShoppingRecord) => `¥${(record.quantity * record.unitPrice).toFixed(2)}`,
    },
    {
      key: 'location',
      title: '购买地点',
      dataIndex: 'location' as const,
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, record: FitnessShoppingRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(record);
              setEditingForm({
                date: record.date,
                itemName: record.itemName,
                specGrams: String(record.specGrams),
                quantity: String(record.quantity),
                unitPrice: String(record.unitPrice),
                location: record.location,
              });
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(record.id)}>删除</Btn>
        </div>
      ),
    },
  ], []);

  const handleCreate = () => {
    const draft = parseDraft(form, activeUserId);

    if (!draft) {
      showToast('请补全食材采购记录的用户、日期、名称、规格、数量和单价。', 'error');
      return;
    }

    onChangeRecords((previous) => createFitnessShoppingRecord(previous, draft));
    setForm(defaultFormState());
    showToast('食材采购记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm, editingRecord.userId);

    if (!draft) {
      showToast('请补全要保存的食材采购记录。', 'error');
      return;
    }

    onChangeRecords((previous) => updateFitnessShoppingRecord(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(defaultFormState());
    showToast('食材采购记录已更新。');
  };

  return (
    <SectionCard
      title="食材采购"
      description="管理减脂相关的食材采购记录，用于估算饮食成本和月度支出。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          这些采购记录只服务于健康页食材成本分析，不与财务模块共用。
        </div>

        <form className="form-grid fitness-entry-grid fitness-entry-grid-shopping" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <DatePickerField
            label="采购日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <Field
            label="食材名称"
            placeholder="例如：鸡胸肉"
            value={form.itemName}
            onChange={(event) => setForm((previous) => ({ ...previous, itemName: event.target.value }))}
          />
          <Field
            label="规格（g / 份）"
            type="number"
            min="1"
            value={form.specGrams}
            onChange={(event) => setForm((previous) => ({ ...previous, specGrams: event.target.value }))}
          />
          <Field
            label="数量（份）"
            type="number"
            min="1"
            step="0.1"
            value={form.quantity}
            onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))}
          />
          <Field
            label="单价（元 / 份）"
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(event) => setForm((previous) => ({ ...previous, unitPrice: event.target.value }))}
          />
          <Field
            label="购买地点"
            placeholder="例如：山姆"
            value={form.location}
            onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
          />
          <div className="fitness-save-cell">
            <Btn tone="primary" type="submit">新增采购记录</Btn>
          </div>
        </form>

        <div className="step-filter-grid">
          <Field
            label="筛选用户 ID"
            placeholder="留空查看全部用户"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
          />
          <DatePickerField
            label="筛选日期"
            value={filterDate}
            onChange={setFilterDate}
            placeholder="按日期筛选"
            hint="留空时显示该用户的全部采购记录。"
          />
        </div>

        <div className="fitness-section-summary">
          <span className="subtle-text">
            共 {filteredRecords.length} 条食材采购记录
            {filterUserId.trim() ? `（用户 ${filterUserId.trim()}）` : '（全部用户）'}
          </span>
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无食材采购记录"
            description="先录入一条食材采购数据，这里会展示可筛选和可编辑的列表。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="编辑食材采购记录"
        width={760}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="page-stack">
          <DatePickerField
            label="采购日期"
            value={editingForm.date}
            onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
            popoverStrategy="inline"
          />
          <div className="form-grid">
            <Field
              label="食材名称"
              value={editingForm.itemName}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, itemName: event.target.value }))}
            />
            <Field
              label="规格（g / 份）"
              type="number"
              min="1"
              value={editingForm.specGrams}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, specGrams: event.target.value }))}
            />
            <Field
              label="数量（份）"
              type="number"
              min="1"
              step="0.1"
              value={editingForm.quantity}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, quantity: event.target.value }))}
            />
            <Field
              label="单价（元 / 份）"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.unitPrice}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, unitPrice: event.target.value }))}
            />
            <Field
              label="购买地点"
              value={editingForm.location}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, location: event.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onChangeRecords((previous) => deleteFitnessShoppingRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('食材采购记录已删除。');
        }}
        title="确认删除这条食材采购记录？"
      >
        删除后，月度采购金额和饮食成本趋势会同步更新。
      </DeleteModal>
    </SectionCard>
  );
}
