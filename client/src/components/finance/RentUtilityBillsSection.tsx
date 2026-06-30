import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteModal, Field, Tag } from '../ui';
import {
  formatRentAmount,
  formatYearMonth,
  getUtilityBillTotal,
  summarizeUtilityBills,
} from '../../services/rent';
import { rentApi } from '../../services/rentApi';
import type { RentUtilityBill, RentUtilityBillDraft } from '../../types/rent';

interface RentUtilityBillsSectionProps {
  /** 当前选中的住房记录 ID */
  recordId: string;
  /** 住房地址（用于标题展示） */
  recordAddress: string;
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

  if (!Number.isFinite(electricityFee) || electricityFee < 0
    || !Number.isFinite(waterFee) || waterFee < 0
    || !Number.isFinite(gasFee) || gasFee < 0) {
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
  showToast,
}: RentUtilityBillsSectionProps) {
  const [bills, setBills] = useState<RentUtilityBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<BillFormState>(createDefaultBillForm);
  const [editingBillId, setEditingBillId] = useState<string>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  /** 加载指定住房记录的月度账单 */
  const reloadBills = useMemo(() => {
    return async () => {
      if (!recordId) {
        setBills([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await rentApi.listUtilityBills(recordId);
        setBills(response);
      } catch {
        showToast('加载水电账单失败。', 'error');
      } finally {
        setLoading(false);
      }
    };
  }, [recordId, showToast]);

  useEffect(() => {
    void reloadBills();
  }, [reloadBills]);

  /** 汇总数据 */
  const summary = useMemo(() => summarizeUtilityBills(bills), [bills]);

  /** 列表列定义 */
  const columns = useMemo(() => [
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
      render: (_value: unknown, row: RentUtilityBill) => formatRentAmount(getUtilityBillTotal(row)),
    },
    {
      key: 'actions',
      title: '操作',
      render: (value: unknown, row: RentUtilityBill) => (
        <div className="fitness-row-actions">
          <Btn tone="secondary" onClick={() => { setEditingBillId(row.id); setForm(buildBillForm(row)); }}>编辑</Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], []);

  /** 保存（新增或更新） */
  const handleSave = async () => {
    const draft = parseBillForm(form, recordId);
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

  if (!recordId) {
    return (
      <SectionCard
        title="水电燃气账单"
        description="请先从「住房记录」中选择一条记录以管理其月度账单。"
      >
        <EmptyState title="未选择住房记录" description="请先在住房记录列表中选中一条记录，再进入此页面进行账单管理。" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`水电燃气账单 · ${recordAddress}`}
      description="按月登记电费、水费、燃气费，程序自动汇总到该住房记录的总成本中。"
      action={editingBillId ? <Tag tone="orange">编辑模式</Tag> : <Tag tone="green">新增模式</Tag>}
    >
      <div className="page-stack">
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
            <Btn tone="secondary" onClick={handleReset} disabled={submitting}>清空</Btn>
            <Btn tone="primary" onClick={handleSave} disabled={submitting}>
              {submitting ? '保存中...' : (editingBillId ? '保存修改' : '新增账单')}
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
