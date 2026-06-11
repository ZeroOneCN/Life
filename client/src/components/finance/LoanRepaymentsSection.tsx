import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, TextArea } from '../ui';
import { LOAN_ALL_PLATFORMS, LOAN_REPAYMENT_PAGE_SIZE, formatLoanAmount } from '../../services/loan';
import type { LoanBill, LoanPlatform, LoanRepayment, LoanRepaymentDraft } from '../../types/loan';

interface LoanRepaymentsSectionProps {
  bills: LoanBill[];
  platforms: LoanPlatform[];
  repayments: LoanRepayment[];
  onCreate: (draft: LoanRepaymentDraft) => Promise<void>;
  onUpdate: (repaymentId: string, draft: LoanRepaymentDraft) => Promise<void>;
  onDelete: (repaymentId: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface RepaymentFormState {
  billId: string;
  platformId: string;
  amount: string;
  interest: string;
  repaymentDate: string;
  notes: string;
}

function createDefaultFormState(platforms: LoanPlatform[]): RepaymentFormState {
  const firstPlatform = platforms[0] ?? null;

  return {
    billId: '',
    platformId: firstPlatform?.id ?? '',
    amount: '',
    interest: '',
    repaymentDate: dayjs().format('YYYY-MM-DD'),
    notes: '',
  };
}

function buildFormState(repayment: LoanRepayment): RepaymentFormState {
  return {
    billId: repayment.billId,
    platformId: repayment.platformId,
    amount: String(repayment.amount),
    interest: String(repayment.interest),
    repaymentDate: repayment.repaymentDate,
    notes: repayment.notes,
  };
}

function parseDraft(form: RepaymentFormState): LoanRepaymentDraft | null {
  const amount = Number(form.amount);
  const interest = form.interest ? Number(form.interest) : 0;

  if (!form.platformId || !dayjs(form.repaymentDate).isValid()) {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (form.interest && (!Number.isFinite(interest) || interest < 0)) {
    return null;
  }

  return {
    billId: form.billId || undefined,
    platformId: form.platformId,
    amount,
    interest,
    repaymentDate: form.repaymentDate,
    notes: form.notes.trim(),
  };
}

export function LoanRepaymentsSection({
  bills,
  platforms,
  repayments,
  onCreate,
  onUpdate,
  onDelete,
  showToast,
}: LoanRepaymentsSectionProps) {
  const [form, setForm] = useState<RepaymentFormState>(() => createDefaultFormState(platforms));
  const [editingRepayment, setEditingRepayment] = useState<LoanRepayment | null>(null);
  const [editingForm, setEditingForm] = useState<RepaymentFormState>(() => createDefaultFormState(platforms));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState(LOAN_ALL_PLATFORMS);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((previous) => previous.platformId ? previous : createDefaultFormState(platforms));
    if (editingRepayment && !editingForm.platformId) {
      setEditingForm(createDefaultFormState(platforms));
    }
  }, [editingForm.platformId, editingRepayment, platforms]);

  const filteredRepayments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return repayments
      .filter((repayment) => platformFilter === LOAN_ALL_PLATFORMS || repayment.platformId === platformFilter)
      .filter((repayment) => (!startDate || !dayjs(repayment.repaymentDate).isBefore(startDate, 'day')))
      .filter((repayment) => (!endDate || !dayjs(repayment.repaymentDate).isAfter(endDate, 'day')))
      .filter((repayment) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [repayment.platformName, repayment.notes, repayment.billId]
          .some((value) => value.toLowerCase().includes(normalizedKeyword));
      });
  }, [endDate, keyword, platformFilter, repayments, startDate]);

  useEffect(() => {
    setPage(1);
  }, [platformFilter, startDate, endDate, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRepayments.length / LOAN_REPAYMENT_PAGE_SIZE));
  const pageRepayments = useMemo(() => {
    const startIndex = (page - 1) * LOAN_REPAYMENT_PAGE_SIZE;
    return filteredRepayments.slice(startIndex, startIndex + LOAN_REPAYMENT_PAGE_SIZE);
  }, [filteredRepayments, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = useMemo(() => [
    { key: 'platformName', title: '平台', dataIndex: 'platformName' as const },
    { key: 'repaymentDate', title: '还款日期', dataIndex: 'repaymentDate' as const },
    {
      key: 'amount',
      title: '还款金额',
      render: (_value: unknown, row: LoanRepayment) => formatLoanAmount(row.amount),
    },
    {
      key: 'interest',
      title: '利息',
      render: (_value: unknown, row: LoanRepayment) => formatLoanAmount(row.interest),
    },
    {
      key: 'billId',
      title: '关联账单',
      render: (_value: unknown, row: LoanRepayment) => row.billId || '手动录入',
    },
    {
      key: 'notes',
      title: '备注',
      render: (_value: unknown, row: LoanRepayment) => row.notes || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: LoanRepayment) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRepayment(row);
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

  const handleBillSelection = (billId: string, editing = false) => {
    const matchedBill = bills.find((bill) => bill.id === billId) ?? null;

    if (editing) {
      setEditingForm((previous) => ({
        ...previous,
        billId,
        platformId: matchedBill?.platformId ?? previous.platformId,
        amount: matchedBill ? String(matchedBill.amount) : previous.amount,
        interest: matchedBill ? String(matchedBill.interest) : previous.interest,
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      billId,
      platformId: matchedBill?.platformId ?? previous.platformId,
      amount: matchedBill ? String(matchedBill.amount) : previous.amount,
      interest: matchedBill ? String(matchedBill.interest) : previous.interest,
    }));
  };

  const handleCreate = async () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全平台、还款金额和还款日期。', 'error');
      return;
    }

    setSaving(true);
    try {
      await onCreate(draft);
      setForm(createDefaultFormState(platforms));
      showToast('还款记录已保存。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRepayment) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的还款记录。', 'error');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(editingRepayment.id, draft);
      setEditingRepayment(null);
      setEditingForm(createDefaultFormState(platforms));
      showToast('还款记录已更新。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="还款"
      description="记录手动补录或自动联动生成的还款流水，后续趋势统计和提醒追踪都以这里为准。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          若选择关联账单，会自动带出平台、本金和利息。
        </div>

        <div className="loan-repayment-entry-grid">
          <SelectField label="关联账单" value={form.billId} onChange={(event) => handleBillSelection(event.target.value)}>
            <option value="">手动录入 / 不关联账单</option>
            {bills.map((bill) => (
              <option key={bill.id} value={bill.id}>
                {bill.platformName} / {bill.billingMonth} / {formatLoanAmount(bill.amount)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="贷款平台"
            value={form.platformId}
            onChange={(event) => setForm((previous) => ({ ...previous, platformId: event.target.value }))}
          >
            <option value="">请选择平台</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>{platform.name}</option>
            ))}
          </SelectField>
          <Field
            label="还款金额"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
          />
          <Field
            label="利息"
            type="number"
            min="0"
            step="0.01"
            value={form.interest}
            onChange={(event) => setForm((previous) => ({ ...previous, interest: event.target.value }))}
          />
          <div className="loan-modal-date-slot loan-modal-date-slot-end">
            <DatePickerField
              label="还款日期"
              value={form.repaymentDate}
              onChange={(value) => setForm((previous) => ({ ...previous, repaymentDate: value }))}
              clearable={false}
            />
          </div>
          <Field
            label="备注"
            value={form.notes}
            onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
            placeholder="例如：手动补录的历史还款"
          />
          <div className="loan-inline-action">
            <span className="field-label">保存还款</span>
            <Btn tone="primary" onClick={() => void handleCreate()} disabled={saving || !platforms.length}>保存还款记录</Btn>
          </div>
        </div>

        <div className="loan-filter-grid loan-filter-grid-repayments">
          <SelectField label="平台筛选" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
            <option value={LOAN_ALL_PLATFORMS}>全部平台</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>{platform.name}</option>
            ))}
          </SelectField>
          <div className="loan-modal-date-slot">
            <DatePickerField label="开始日期" value={startDate} onChange={setStartDate} placeholder="不限开始日期" />
          </div>
          <div className="loan-modal-date-slot loan-modal-date-slot-end">
            <DatePickerField label="结束日期" value={endDate} onChange={setEndDate} placeholder="不限结束日期" />
          </div>
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索平台、关联账单或备注"
          />
        </div>

        <div className="loan-summary-bar">
          <span className="subtle-text">共 {filteredRepayments.length} 笔还款</span>
          <span className="subtle-text">
            累计 {formatLoanAmount(filteredRepayments.reduce((sum, repayment) => sum + repayment.amount, 0))}
          </span>
          <span className="subtle-text">
            利息 {formatLoanAmount(filteredRepayments.reduce((sum, repayment) => sum + repayment.interest, 0))}
          </span>
        </div>

        {filteredRepayments.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pageRepayments} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无还款记录"
            description="可以先补录一笔还款，或调整当前平台、日期和关键词筛选条件。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRepayment)}
        onClose={() => {
          setEditingRepayment(null);
          setEditingForm(createDefaultFormState(platforms));
        }}
        title={editingRepayment ? `编辑还款：${editingRepayment.platformName}` : '编辑还款'}
        width={980}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingRepayment(null);
                setEditingForm(createDefaultFormState(platforms));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={() => void handleSaveEdit()} disabled={saving}>保存还款</Btn>
          </>
        )}
      >
        <div className="loan-modal-layout">
          <div className="loan-modal-grid loan-modal-grid-repayment">
            <SelectField label="关联账单" value={editingForm.billId} onChange={(event) => handleBillSelection(event.target.value, true)}>
              <option value="">手动录入 / 不关联账单</option>
              {bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.platformName} / {bill.billingMonth} / {formatLoanAmount(bill.amount)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="贷款平台"
              value={editingForm.platformId}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, platformId: event.target.value }))}
            >
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.name}</option>
              ))}
            </SelectField>
            <Field
              label="还款金额"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.amount}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, amount: event.target.value }))}
            />
            <Field
              label="利息"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.interest}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, interest: event.target.value }))}
            />
            <div className="loan-modal-date-slot loan-modal-date-slot-end">
              <DatePickerField
                label="还款日期"
                value={editingForm.repaymentDate}
                onChange={(value) => setEditingForm((previous) => ({ ...previous, repaymentDate: value }))}
                clearable={false}
              />
            </div>
          </div>
          <TextArea
            label="备注"
            value={editingForm.notes}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, notes: event.target.value }))}
            placeholder="补充支付渠道、补录来源或异常说明"
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

          setSaving(true);
          void onDelete(pendingDeleteId)
            .then(() => {
              setPendingDeleteId(null);
              showToast('还款记录已删除。');
            })
            .catch((error) => {
              console.error('删除还款记录失败:', error);
              showToast('删除还款记录失败，请重试。', 'error');
            })
            .finally(() => {
              setSaving(false);
            });
        }}
        title="确认删除这笔还款记录？"
      >
        删除后，这笔记录将不再参与还款趋势和累计统计，请确认是否继续。
      </DeleteModal>
    </SectionCard>
  );
}
