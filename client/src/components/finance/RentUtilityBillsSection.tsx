import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard, StatGrid } from '../page';
import {
  Btn,
  DataTable,
  DeleteIcon,
  DeleteModal,
  EditIcon,
  Field,
  IconBtn,
  SelectField,
  Tag,
} from '../ui';
import {
  formatRentAmount,
  formatYearMonth,
  getUtilityBillTotal,
  summarizeUtilityBills,
} from '../../services/rent';
import { rentApi } from '../../services/rentApi';
import type { RentHousingRecord, RentUtilityBill, RentUtilityBillDraft } from '../../types/rent';

interface RentUtilityBillsSectionProps {
  /** 当前选中的住房记录 ID */
  recordId: string;
  /** 住房地址（用于标题展示） */
  recordAddress: string;
  /** 全部住房记录列表（用于下拉选择） */
  records: RentHousingRecord[];
  showToast: (message: string, type?: 'success' | 'error') => void;
}

/** 表单状态 */
interface BillFormState {
  yearMonth: string;
  electricityFee: string;
  waterFee: string;
  gasFee: string;
}

/**
 * 创建空白的账单表单，默认选中当月
 */
function createDefaultBillForm(): BillFormState {
  return {
    yearMonth: dayjs().format('YYYY-MM'),
    electricityFee: '',
    waterFee: '',
    gasFee: '',
  };
}

/**
 * 从已有账单数据回填表单（编辑模式）
 */
function buildBillForm(bill: RentUtilityBill): BillFormState {
  return {
    yearMonth: bill.yearMonth,
    electricityFee: bill.electricityFee ? String(bill.electricityFee) : '',
    waterFee: bill.waterFee ? String(bill.waterFee) : '',
    gasFee: bill.gasFee ? String(bill.gasFee) : '',
  };
}

/**
 * 解析表单为草稿数据，校验失败返回 null
 */
function parseBillForm(form: BillFormState, recordId: string): RentUtilityBillDraft | null {
  if (!form.yearMonth || !/^\d{4}-\d{2}$/.test(form.yearMonth)) {
    return null;
  }

  const electricityFee = form.electricityFee.trim() ? Number(form.electricityFee) : 0;
  const waterFee = form.waterFee.trim() ? Number(form.waterFee) : 0;
  const gasFee = form.gasFee.trim() ? Number(form.gasFee) : 0;

  if (
    !Number.isFinite(electricityFee) ||
    electricityFee < 0 ||
    !Number.isFinite(waterFee) ||
    waterFee < 0 ||
    !Number.isFinite(gasFee) ||
    gasFee < 0
  ) {
    return null;
  }

  // 至少有一项费用大于 0 才允许保存
  if (electricityFee === 0 && waterFee === 0 && gasFee === 0) {
    return null;
  }

  return { recordId, yearMonth: form.yearMonth, electricityFee, waterFee, gasFee };
}

export function RentUtilityBillsSection({
  recordId,
  recordAddress,
  records,
  showToast,
}: RentUtilityBillsSectionProps) {
  const [bills, setBills] = useState<RentUtilityBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState(recordId);
  const [form, setForm] = useState<BillFormState>(createDefaultBillForm);
  const [editingBillId, setEditingBillId] = useState<string>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  /** 同步外部 recordId 到内部状态 */
  useEffect(() => {
    if (recordId) {
      setSelectedRecordId(recordId);
    }
  }, [recordId]);

  /** 加载指定住房记录的月度账单 */
  const reloadBills = useMemo(() => {
    return async () => {
      const targetId = selectedRecordId || recordId;
      if (!targetId) {
        setBills([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await rentApi.listUtilityBills(targetId);
        setBills(response);
      } catch {
        showToast('加载水电账单失败。', 'error');
      } finally {
        setLoading(false);
      }
    };
  }, [selectedRecordId, recordId, showToast]);

  useEffect(() => {
    void reloadBills();
  }, [reloadBills]);

  /** 汇总数据 */
  const summary = useMemo(() => summarizeUtilityBills(bills), [bills]);

  /** 列表列定义 */
  const columns = useMemo(
    () => [
      {
        key: 'yearMonth',
        title: '月份',
        dataIndex: 'yearMonth' as const,
        align: 'center' as const,
        render: (value: unknown) => formatYearMonth(value as string),
      },
      {
        key: 'electricityFee',
        title: '电费',
        align: 'right' as const,
        render: (_value: unknown, row: RentUtilityBill) => formatRentAmount(row.electricityFee),
      },
      {
        key: 'waterFee',
        title: '水费',
        align: 'right' as const,
        render: (_value: unknown, row: RentUtilityBill) => formatRentAmount(row.waterFee),
      },
      {
        key: 'gasFee',
        title: '燃气费',
        align: 'right' as const,
        render: (_value: unknown, row: RentUtilityBill) => formatRentAmount(row.gasFee),
      },
      {
        key: 'total',
        title: '小计',
        align: 'right' as const,
        render: (_value: unknown, row: RentUtilityBill) =>
          formatRentAmount(getUtilityBillTotal(row)),
      },
      {
        key: 'actions',
        title: '操作',
        render: (value: unknown, row: RentUtilityBill) => (
          <div className="fitness-row-actions">
            <IconBtn
              tone="secondary"
              icon={<EditIcon />}
              title="编辑"
              onClick={() => {
                setEditingBillId(row.id);
                setForm(buildBillForm(row));
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
    ],
    [],
  );

  /** 保存（新增或更新） */
  const handleSave = async () => {
    const targetId = selectedRecordId || recordId;
    if (!targetId) {
      showToast('请先选择住房记录。', 'error');
      return;
    }
    const draft = parseBillForm(form, targetId);
    if (!draft) {
      showToast('请填写有效的年月（格式：2026-01）且至少填写一项费用金额。', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingBillId) {
        await rentApi.updateUtilityBill(editingBillId, draft);
        showToast('账单已更新。');
      } else {
        await rentApi.createUtilityBill(draft);
        showToast('账单已新增。');
      }
      setForm(createDefaultBillForm());
      setEditingBillId('');
      await reloadBills();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('409') || msg.includes('duplicate')) {
        showToast('该月份已有账单记录，请直接编辑或选择其他月份。', 'error');
      } else {
        showToast(`保存失败：${msg}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** 重置表单 */
  const handleReset = () => {
    setForm(createDefaultBillForm());
    setEditingBillId('');
  };

  /** 删除确认 */
  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      await rentApi.deleteUtilityBill(pendingDeleteId);
      showToast('账单已删除。');
      setPendingDeleteId('');
      await reloadBills();
    } catch {
      showToast('删除账单失败。', 'error');
    }
  };

  /** 获取当前选中的住房地址 */
  const currentAddress = useMemo(() => {
    if (recordAddress) return recordAddress;
    const record = records.find((r) => r.id === selectedRecordId);
    return record ? record.addressShort?.trim() || record.address : '';
  }, [recordAddress, records, selectedRecordId]);

  if (!selectedRecordId && !recordId) {
    return (
      <SectionCard title="水电燃气账单" description="请先选择一条住房记录以管理其月度账单。">
        <div
          className="page-stack"
          style={{
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
              width: '100%',
              maxWidth: 400,
            }}
          >
            <EmptyState title="未选择住房记录" description="请从下方下拉列表中选择一条住房记录。" />
            <SelectField
              label="选择住房"
              value=""
              onChange={(e) => {
                setSelectedRecordId(e.target.value);
                setForm(createDefaultBillForm());
                setEditingBillId('');
              }}
              style={{ minWidth: 280 }}
            >
              <option value="">-- 请选择 --</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.addressShort?.trim() || r.address}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`水电燃气账单 · ${currentAddress}`}
      description="按月登记电费、水费、燃气费，程序自动汇总到该住房记录的总成本中。"
      action={editingBillId ? <Tag tone="orange">编辑模式</Tag> : <Tag tone="green">新增模式</Tag>}
    >
      <div className="page-stack">
        {/* 住房切换提示 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
          <SelectField
            label="切换住房"
            value={selectedRecordId || recordId}
            onChange={(e) => {
              setSelectedRecordId(e.target.value);
              setForm(createDefaultBillForm());
              setEditingBillId('');
              setBills([]);
            }}
            style={{ minWidth: 240 }}
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.addressShort?.trim() || r.address}
              </option>
            ))}
          </SelectField>
        </div>
        {/* 汇总卡片 */}
        <StatGrid
          className="rent-summary-grid"
          items={[
            { label: '账单笔数', value: `${bills.length} 笔` },
            { label: '电费合计', value: formatRentAmount(summary.electricityTotal) },
            { label: '水费合计', value: formatRentAmount(summary.waterTotal) },
            { label: '燃气费合计', value: formatRentAmount(summary.gasTotal) },
            { label: '总计', value: formatRentAmount(summary.grandTotal), helper: '三项费用之和' },
          ]}
        />

        {/* 录入表单 */}
        <div className="rent-entry-module">
          <div className="rent-entry-module-head">
            <h3>{editingBillId ? '编辑账单' : '新增账单'}</h3>
            <span>填写年月和各项费用金额</span>
          </div>
          <div className="rent-cost-grid">
            <Field
              label="年月"
              type="month"
              value={form.yearMonth}
              onChange={(e) => setForm((prev) => ({ ...prev, yearMonth: e.target.value }))}
              placeholder="YYYY-MM"
            />
            <Field
              label="电费（元）"
              type="number"
              min="0"
              step="0.01"
              value={form.electricityFee}
              onChange={(e) => setForm((prev) => ({ ...prev, electricityFee: e.target.value }))}
              placeholder="0.00"
            />
            <Field
              label="水费（元）"
              type="number"
              min="0"
              step="0.01"
              value={form.waterFee}
              onChange={(e) => setForm((prev) => ({ ...prev, waterFee: e.target.value }))}
              placeholder="0.00"
            />
            <Field
              label="燃气费（元）"
              type="number"
              min="0"
              step="0.01"
              value={form.gasFee}
              onChange={(e) => setForm((prev) => ({ ...prev, gasFee: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="rent-form-actions">
            <Btn tone="secondary" onClick={handleReset} disabled={submitting}>
              清空
            </Btn>
            <Btn tone="primary" onClick={handleSave} disabled={submitting}>
              {submitting ? '保存中...' : editingBillId ? '保存修改' : '新增账单'}
            </Btn>
          </div>
        </div>

        {/* 账单列表 */}
        {bills.length > 0 ? (
          <DataTable rowKey="id" columns={columns} data={bills} />
        ) : (
          !loading && (
            <EmptyState
              title="暂无账单记录"
              description="使用上方表单按月录入电费、水费、燃气费金额。"
            />
          )
        )}

        {/* 删除确认弹窗 */}
        <DeleteModal
          open={Boolean(pendingDeleteId)}
          onClose={() => setPendingDeleteId('')}
          onConfirm={handleDeleteConfirm}
          title="删除月度账单"
        >
          删除后该月的水电燃气费用将从总成本中扣除，此操作不可恢复。
        </DeleteModal>
      </div>
    </SectionCard>
  );
}
