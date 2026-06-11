import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField } from '../ui';
import {
  MEDICATION_CHANNELS,
  MEDICATION_PURCHASE_PAGE_SIZE,
  MEDICATION_UNITS,
  createMedicationPurchase,
  deleteMedicationPurchase,
  filterMedicationPurchasesByUserId,
  normalizeMedicationUserId,
  updateMedicationPurchase,
} from '../../services/medication';
import type { MedicationPurchaseDraft, MedicationPurchaseRecord } from '../../types/medication';

interface MedicationPurchasesSectionProps {
  activeUserId: string;
  filterUserId: string;
  purchases: MedicationPurchaseRecord[];
  onFilterUserIdChange: (value: string) => void;
  onChangePurchases: (updater: (records: MedicationPurchaseRecord[]) => MedicationPurchaseRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface PurchaseFormState {
  purchaseDate: string;
  medicineName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
  channel: string;
}

function createDefaultFormState(): PurchaseFormState {
  return {
    purchaseDate: dayjs().format('YYYY-MM-DD'),
    medicineName: '',
    quantity: '1',
    unit: MEDICATION_UNITS[0],
    unitPrice: '',
    totalPrice: '',
    channel: MEDICATION_CHANNELS[0],
  };
}

function buildFormState(record: MedicationPurchaseRecord): PurchaseFormState {
  return {
    purchaseDate: record.purchaseDate,
    medicineName: record.medicineName,
    quantity: String(record.quantity),
    unit: record.unit,
    unitPrice: String(record.unitPrice),
    totalPrice: String(record.totalPrice),
    channel: record.channel,
  };
}

function parseDraft(form: PurchaseFormState, userId: string): MedicationPurchaseDraft | null {
  const normalizedUserId = normalizeMedicationUserId(userId);
  const quantity = Number(form.quantity);
  const unitPrice = Number(form.unitPrice);
  const explicitTotalPrice = form.totalPrice ? Number(form.totalPrice) : undefined;

  if (!normalizedUserId || !form.medicineName.trim() || !dayjs(form.purchaseDate).isValid()) {
    return null;
  }

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }

  return {
    userId: normalizedUserId,
    purchaseDate: form.purchaseDate,
    medicineName: form.medicineName.trim(),
    quantity,
    unit: form.unit.trim() || MEDICATION_UNITS[0],
    unitPrice,
    totalPrice: Number.isFinite(explicitTotalPrice) ? explicitTotalPrice : quantity * unitPrice,
    channel: form.channel.trim() || MEDICATION_CHANNELS[0],
  };
}

function inferTotalPrice(quantity: string, unitPrice: string) {
  const parsedQuantity = Number(quantity);
  const parsedUnitPrice = Number(unitPrice);

  if (!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedUnitPrice)) {
    return '';
  }

  return (parsedQuantity * parsedUnitPrice).toFixed(2);
}

export function MedicationPurchasesSection({
  activeUserId,
  filterUserId,
  purchases,
  onFilterUserIdChange,
  onChangePurchases,
  showToast,
}: MedicationPurchasesSectionProps) {
  const [form, setForm] = useState<PurchaseFormState>(createDefaultFormState);
  const [medicineKeyword, setMedicineKeyword] = useState('');
  const [channel, setChannel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingPurchase, setEditingPurchase] = useState<MedicationPurchaseRecord | null>(null);
  const [editingForm, setEditingForm] = useState<PurchaseFormState>(createDefaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setForm((previous) => ({
      ...previous,
      totalPrice: inferTotalPrice(previous.quantity, previous.unitPrice),
    }));
  }, [form.quantity, form.unitPrice]);

  useEffect(() => {
    if (!editingPurchase) {
      return;
    }

    setEditingForm((previous) => ({
      ...previous,
      totalPrice: inferTotalPrice(previous.quantity, previous.unitPrice),
    }));
  }, [editingPurchase, editingForm.quantity, editingForm.unitPrice]);

  const filteredPurchases = useMemo(() => {
    const normalizedKeyword = medicineKeyword.trim().toLowerCase();

    return filterMedicationPurchasesByUserId(purchases, filterUserId)
      .filter((record) => (!normalizedKeyword || record.medicineName.toLowerCase().includes(normalizedKeyword)))
      .filter((record) => (!channel || record.channel === channel))
      .filter((record) => (!startDate || record.purchaseDate >= startDate))
      .filter((record) => (!endDate || record.purchaseDate <= endDate));
  }, [purchases, filterUserId, medicineKeyword, channel, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [filterUserId, medicineKeyword, channel, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / MEDICATION_PURCHASE_PAGE_SIZE));
  const pagePurchases = useMemo(() => {
    const startIndex = (page - 1) * MEDICATION_PURCHASE_PAGE_SIZE;
    return filteredPurchases.slice(startIndex, startIndex + MEDICATION_PURCHASE_PAGE_SIZE);
  }, [filteredPurchases, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const editingTotalPrice = useMemo(() => (
    inferTotalPrice(editingForm.quantity, editingForm.unitPrice) || editingForm.totalPrice || '0.00'
  ), [editingForm.quantity, editingForm.totalPrice, editingForm.unitPrice]);

  const purchaseSummary = useMemo(() => ({
    totalCount: filteredPurchases.length,
    totalQuantity: filteredPurchases.reduce((sum, record) => sum + record.quantity, 0),
    totalAmount: Number(filteredPurchases.reduce((sum, record) => sum + record.totalPrice, 0).toFixed(2)),
  }), [filteredPurchases]);

  const columns = useMemo(() => [
    { key: 'purchaseDate', title: '购买日期', dataIndex: 'purchaseDate' as const },
    { key: 'medicineName', title: '药品名称', dataIndex: 'medicineName' as const },
    { key: 'quantity', title: '数量', render: (_value: unknown, row: MedicationPurchaseRecord) => `${row.quantity}` },
    { key: 'unit', title: '单位', dataIndex: 'unit' as const },
    { key: 'unitPrice', title: '单价', render: (_value: unknown, row: MedicationPurchaseRecord) => `¥${row.unitPrice.toFixed(2)}` },
    { key: 'totalPrice', title: '总价', render: (_value: unknown, row: MedicationPurchaseRecord) => `¥${row.totalPrice.toFixed(2)}` },
    { key: 'channel', title: '购买渠道', dataIndex: 'channel' as const },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: MedicationPurchaseRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingPurchase(row);
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
    const draft = parseDraft(form, activeUserId);

    if (!draft) {
      showToast('请补全购药日期、药品名称、数量和单价。', 'error');
      return;
    }

    onChangePurchases((previous) => createMedicationPurchase(previous, draft));
    setForm(createDefaultFormState());
    showToast('购药记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingPurchase) {
      return;
    }

    const draft = parseDraft(editingForm, editingPurchase.userId);
    if (!draft) {
      showToast('请补全要保存的购药记录。', 'error');
      return;
    }

    onChangePurchases((previous) => updateMedicationPurchase(previous, editingPurchase.id, draft));
    setEditingPurchase(null);
    setEditingForm(createDefaultFormState());
    showToast('购药记录已更新。');
  };

  return (
    <SectionCard
      title="购药记录"
      description="独立记录购药数量、渠道和金额，用于统计花费并为低库存提醒提供估算依据。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          若想让库存估算更准确，建议及时同步录入每次购药记录。
        </div>

        <StatGrid
          items={[
            { label: '购药次数', value: `${purchaseSummary.totalCount}` },
            { label: '累计数量', value: `${purchaseSummary.totalQuantity}` },
            { label: '累计花费', value: `¥${purchaseSummary.totalAmount.toFixed(2)}` },
          ]}
        />

        <form className="medication-purchase-grid" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <DatePickerField
            label="购买日期"
            value={form.purchaseDate}
            onChange={(value) => setForm((previous) => ({ ...previous, purchaseDate: value }))}
            clearable={false}
          />
          <Field
            label="药品名称"
            value={form.medicineName}
            onChange={(event) => setForm((previous) => ({ ...previous, medicineName: event.target.value }))}
            placeholder="例如：感冒灵"
          />
          <Field
            label="数量"
            type="number"
            min="0"
            value={form.quantity}
            onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))}
          />
          <SelectField
            label="单位"
            value={form.unit}
            onChange={(event) => setForm((previous) => ({ ...previous, unit: event.target.value }))}
          >
            {MEDICATION_UNITS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectField>
          <Field
            label="单价"
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(event) => setForm((previous) => ({ ...previous, unitPrice: event.target.value }))}
            placeholder="例如：12.50"
          />
          <Field
            label="总价"
            type="number"
            min="0"
            step="0.01"
            value={form.totalPrice}
            onChange={(event) => setForm((previous) => ({ ...previous, totalPrice: event.target.value }))}
          />
          <SelectField
            label="购买渠道"
            value={form.channel}
            onChange={(event) => setForm((previous) => ({ ...previous, channel: event.target.value }))}
          >
            {MEDICATION_CHANNELS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectField>
          <div className="medication-inline-action">
            <span className="field-label">保存</span>
            <Btn tone="primary" type="submit">保存购药记录</Btn>
          </div>
        </form>

        <div className="medication-filter-grid medication-filter-grid-purchase">
          <Field
            label="记录用户 ID"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
          />
          <Field
            label="药品名称"
            value={medicineKeyword}
            onChange={(event) => setMedicineKeyword(event.target.value)}
            placeholder="搜索药品名称"
          />
          <SelectField label="购买渠道" value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="">全部渠道</option>
            {MEDICATION_CHANNELS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectField>
          <DatePickerField label="开始日期" value={startDate} onChange={setStartDate} placeholder="不限" />
          <DatePickerField label="结束日期" value={endDate} onChange={setEndDate} placeholder="不限" />
        </div>

        {filteredPurchases.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pagePurchases} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无购药记录"
            description="先记录一次购药信息，后续总花费和低库存判断才有可靠来源。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingPurchase)}
        onClose={() => {
          setEditingPurchase(null);
          setEditingForm(createDefaultFormState());
        }}
        title={editingPurchase ? `编辑购药记录：${editingPurchase.medicineName}` : '编辑购药记录'}
        width={900}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingPurchase(null);
                setEditingForm(createDefaultFormState());
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="medication-modal-layout">
          <div className="medication-modal-summary">
            <div className="medication-modal-summary-card">
              <span className="medication-modal-summary-label">估算总价</span>
              <strong>¥{editingTotalPrice}</strong>
            </div>
            <div className="medication-modal-summary-card">
              <span className="medication-modal-summary-label">购买渠道</span>
              <strong>{editingForm.channel || '-'}</strong>
            </div>
          </div>

          <div className="medication-modal-section">
            <div className="medication-modal-section-head">
              <strong>基础信息</strong>
              <span>先确认日期、药品和单位，再继续调整数量与价格。</span>
            </div>
            <div className="medication-modal-grid medication-modal-grid-purchase-main">
              <DatePickerField
                label="购买日期"
                value={editingForm.purchaseDate}
                onChange={(value) => setEditingForm((previous) => ({ ...previous, purchaseDate: value }))}
                clearable={false}
              />
              <Field
                label="药品名称"
                value={editingForm.medicineName}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, medicineName: event.target.value }))}
                placeholder="例如：感冒灵"
              />
              <SelectField
                label="购买渠道"
                value={editingForm.channel}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, channel: event.target.value }))}
              >
                {MEDICATION_CHANNELS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
            </div>
          </div>

          <div className="medication-modal-section">
            <div className="medication-modal-section-head">
              <strong>数量与金额</strong>
              <span>金额会根据数量与单价自动联动，你仍然可以按实际支付金额覆盖总价。</span>
            </div>
            <div className="medication-modal-grid medication-modal-grid-purchase-pricing">
              <Field
                label="数量"
                type="number"
                min="0"
                value={editingForm.quantity}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, quantity: event.target.value }))}
              />
              <SelectField
                label="单位"
                value={editingForm.unit}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, unit: event.target.value }))}
              >
                {MEDICATION_UNITS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </SelectField>
              <Field
                label="单价"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.unitPrice}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, unitPrice: event.target.value }))}
              />
              <Field
                label="总价"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.totalPrice}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, totalPrice: event.target.value }))}
              />
            </div>
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

          onChangePurchases((previous) => deleteMedicationPurchase(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('购药记录已删除。');
        }}
        title="删除这条购药记录？"
      >
        删除后会影响购药统计和低库存估算，请确认该记录确实不再需要。
      </DeleteModal>
    </SectionCard>
  );
}
