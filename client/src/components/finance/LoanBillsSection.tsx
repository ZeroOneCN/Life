import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField, MonthPickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag } from '../ui';
import { LOAN_ALL_PLATFORMS, LOAN_BILL_PAGE_SIZE, formatLoanAmount, getLoanBillStatus, suggestLoanDueDate } from '../../services/loan';
import type { LoanBill, LoanBillDraft, LoanPlatform } from '../../types/loan';

interface LoanBillsSectionProps {
  bills: LoanBill[];
  platforms: LoanPlatform[];
  onCreate: (draft: LoanBillDraft) => Promise<void>;
  onUpdate: (billId: string, draft: LoanBillDraft) => Promise<void>;
  onDelete: (billId: string) => Promise<void>;
  onMarkPaid: (billId: string) => void;
  /** 部分还款回调，由父组件调用 API 并刷新数据 */
  onPartialRepay: (billId: string, amount: number, options?: { repaymentDate?: string; notes?: string }) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface BillFormState {
  platformId: string;
  amount: string;
  interest: string;
  billingMonth: string;
  dueDate: string;
}

function createDefaultFormState(platforms: LoanPlatform[]): BillFormState {
  const firstPlatform = platforms[0] ?? null;
  const billingMonth = dayjs().format('YYYY-MM');
  return {
    platformId: firstPlatform?.id ?? '',
    amount: '',
    interest: '',
    billingMonth,
    dueDate: firstPlatform ? suggestLoanDueDate(firstPlatform, billingMonth) : '',
  };
}

function buildFormState(bill: LoanBill): BillFormState {
  return {
    platformId: bill.platformId,
    amount: String(bill.amount),
    interest: String(bill.interest),
    billingMonth: bill.billingMonth,
    dueDate: bill.dueDate,
  };
}

function parseDraft(form: BillFormState): LoanBillDraft | null {
  const amount = Number(form.amount);
  const interest = form.interest ? Number(form.interest) : 0;

  if (!form.platformId || !dayjs(`${form.billingMonth}-01`).isValid()) {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (form.interest && (!Number.isFinite(interest) || interest < 0)) {
    return null;
  }

  return {
    platformId: form.platformId,
    amount,
    interest,
    billingMonth: form.billingMonth,
    dueDate: form.dueDate,
  };
}

export function LoanBillsSection({
  bills,
  platforms,
  onCreate,
  onUpdate,
  onDelete,
  onMarkPaid,
  onPartialRepay,
  showToast,
}: LoanBillsSectionProps) {
  const [form, setForm] = useState<BillFormState>(() => createDefaultFormState(platforms));
  const [editingBill, setEditingBill] = useState<LoanBill | null>(null);
  const [editingForm, setEditingForm] = useState<BillFormState>(() => createDefaultFormState(platforms));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState(LOAN_ALL_PLATFORMS);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
  const [monthFilter, setMonthFilter] = useState(dayjs().format('YYYY-MM'));
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  // 部分还款弹窗状态
  const [partialRepayBill, setPartialRepayBill] = useState<LoanBill | null>(null);
  const [partialRepayAmount, setPartialRepayAmount] = useState('');
  const [partialRepayDate, setPartialRepayDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    setForm((previous) => previous.platformId ? previous : createDefaultFormState(platforms));
    if (editingBill && !editingForm.platformId) {
      setEditingForm(createDefaultFormState(platforms));
    }
  }, [editingBill, editingForm.platformId, platforms]);

  const filteredBills = useMemo(
    () => bills
      .filter((bill) => platformFilter === LOAN_ALL_PLATFORMS || bill.platformId === platformFilter)
      .filter((bill) => {
        const status = getLoanBillStatus(bill);
        return statusFilter === 'all' ? true : status === statusFilter;
      })
      .filter((bill) => !monthFilter || bill.billingMonth === monthFilter),
    [bills, monthFilter, platformFilter, statusFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [platformFilter, statusFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / LOAN_BILL_PAGE_SIZE));
  const pageBills = useMemo(() => {
    const startIndex = (page - 1) * LOAN_BILL_PAGE_SIZE;
    return filteredBills.slice(startIndex, startIndex + LOAN_BILL_PAGE_SIZE);
  }, [filteredBills, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = useMemo(() => [
    { key: 'platformName', title: '平台', dataIndex: 'platformName' as const },
    { key: 'billingMonth', title: '账单月份', dataIndex: 'billingMonth' as const },
    { key: 'dueDate', title: '到期日', dataIndex: 'dueDate' as const },
    {
      key: 'amount',
      title: '欠款',
      render: (_value: unknown, row: LoanBill) => (
        <div className="travel-amount-stack">
          <strong>{formatLoanAmount(row.amount + row.interest)}</strong>
          {row.interest > 0 ? <span>含利息 {formatLoanAmount(row.interest)}</span> : null}
        </div>
      ),
    },
    {
      key: 'paid',
      title: '已还 / 剩余',
      render: (_value: unknown, row: LoanBill) => {
        const totalPaid = row.paidAmount + row.paidInterest;
        const totalRemaining = row.remainingAmount + row.remainingInterest;
        return (
          <div className="travel-amount-stack">
            <span className="loan-paid-amount">已还 {formatLoanAmount(totalPaid)}</span>
            <strong className="loan-remaining-amount">剩余 {formatLoanAmount(totalRemaining)}</strong>
          </div>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (_value: unknown, row: LoanBill) => {
        const status = getLoanBillStatus(row);
        return (
          <Tag tone={status === 'paid' ? 'green' : status === 'overdue' ? 'red' : 'orange'}>
            {status === 'paid' ? '已还' : status === 'overdue' ? '已逾期' : '待还'}
          </Tag>
        );
      },
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: LoanBill) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            disabled={row.isPaid}
            onClick={() => {
              setPartialRepayBill(row);
              setPartialRepayAmount('');
              setPartialRepayDate(dayjs().format('YYYY-MM-DD'));
            }}
          >
            部分还款
          </Btn>
          <Btn tone="secondary" disabled={row.isPaid} onClick={() => onMarkPaid(row.id)}>一次结清</Btn>
          <Btn
            tone="ghost"
            onClick={() => {
              setEditingBill(row);
              setEditingForm(buildFormState(row));
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], [onMarkPaid]);

  const resolveSuggestedDueDate = (platformId: string, billingMonth: string) => {
    const selectedPlatform = platforms.find((platform) => platform.id === platformId) ?? null;
    return selectedPlatform ? suggestLoanDueDate(selectedPlatform, billingMonth) : '';
  };

  const handleCreate = async () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全平台、本金、账单月份和到期日。', 'error');
      return;
    }

    setSaving(true);
    try {
      await onCreate(draft);
      // 连续录入：保留贷款平台与账单月份，仅清空金额/利息，方便快速录入下一笔
      setForm((previous) => ({
        ...createDefaultFormState(platforms),
        platformId: previous.platformId,
        billingMonth: previous.billingMonth,
        dueDate: resolveSuggestedDueDate(previous.platformId, previous.billingMonth) || previous.dueDate,
      }));
      showToast('贷款账单已创建。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBill) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的账单信息。', 'error');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(editingBill.id, draft);
      setEditingBill(null);
      setEditingForm(createDefaultFormState(platforms));
      showToast('贷款账单已更新。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  /**
   * 提交部分还款。
   *
   * 校验还款金额后调用父组件传入的 onPartialRepay，成功后关闭弹窗。
   * 抵扣明细由后端计算并返回，前端只负责展示成功提示。
   */
  const handlePartialRepay = async () => {
    if (!partialRepayBill) {
      return;
    }

    const amount = Number(partialRepayAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('请输入有效的还款金额。', 'error');
      return;
    }

    const totalRemaining = partialRepayBill.remainingAmount + partialRepayBill.remainingInterest;
    if (amount > totalRemaining + 0.01) {
      showToast(`还款金额不能超过剩余待还金额 ${formatLoanAmount(totalRemaining)}。`, 'error');
      return;
    }

    setSaving(true);
    try {
      await onPartialRepay(partialRepayBill.id, amount, {
        repaymentDate: partialRepayDate,
      });
      setPartialRepayBill(null);
      setPartialRepayAmount('');
      showToast('部分还款成功。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="账单"
      description="统一维护账单月份、到期日、本金和利息；标记已还时由后端决定是否自动生成还款记录。"
    >
      <div className="page-stack">
        <div className="loan-bill-entry-grid">
          <SelectField
            label="贷款平台"
            value={form.platformId}
            onChange={(event) => {
              const nextPlatformId = event.target.value;
              setForm((previous) => ({
                ...previous,
                platformId: nextPlatformId,
                dueDate: resolveSuggestedDueDate(nextPlatformId, previous.billingMonth) || previous.dueDate,
              }));
            }}
          >
            <option value="">请选择平台</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>{platform.name}</option>
            ))}
          </SelectField>
          <Field
            label="本金"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
            placeholder="例如：680"
          />
          <Field
            label="利息"
            type="number"
            min="0"
            step="0.01"
            value={form.interest}
            onChange={(event) => setForm((previous) => ({ ...previous, interest: event.target.value }))}
            placeholder="例如：12"
          />
          <div className="loan-modal-date-slot">
            <MonthPickerField
              label="账单月份"
              value={form.billingMonth}
              onChange={(value) => {
                setForm((previous) => ({
                  ...previous,
                  billingMonth: value,
                  dueDate: resolveSuggestedDueDate(previous.platformId, value) || previous.dueDate,
                }));
              }}
              clearable={false}
            />
          </div>
          <div className="loan-modal-date-slot loan-modal-date-slot-end">
            <DatePickerField
              label="到期日"
              value={form.dueDate}
              onChange={(value) => setForm((previous) => ({ ...previous, dueDate: value }))}
              clearable={false}
            />
          </div>
          <div className="loan-inline-action">
            <span className="field-label">保存账单</span>
            <Btn tone="primary" onClick={() => void handleCreate()} disabled={saving || !platforms.length}>新建账单</Btn>
          </div>
        </div>

        <div className="loan-filter-grid loan-filter-grid-bills">
          <SelectField label="平台筛选" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
            <option value={LOAN_ALL_PLATFORMS}>全部平台</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>{platform.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="状态筛选"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="all">全部状态</option>
            <option value="unpaid">待还</option>
            <option value="overdue">已逾期</option>
            <option value="paid">已还</option>
          </SelectField>
          <div className="loan-modal-date-slot loan-modal-date-slot-end">
            <MonthPickerField
              label="账单月份"
              value={monthFilter}
              onChange={setMonthFilter}
              placeholder="不限月份"
            />
          </div>
        </div>

        <div className="loan-summary-bar">
          <span className="subtle-text">共 {filteredBills.length} 笔账单</span>
          <span className="subtle-text">未还 {filteredBills.filter((bill) => !bill.isPaid).length} 笔</span>
          <span className="subtle-text">逾期 {filteredBills.filter((bill) => getLoanBillStatus(bill) === 'overdue').length} 笔</span>
        </div>

        {filteredBills.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pageBills} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无贷款账单"
            description="先新增一笔账单，或调整当前平台、状态和月份筛选条件。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingBill)}
        onClose={() => {
          setEditingBill(null);
          setEditingForm(createDefaultFormState(platforms));
        }}
        title={editingBill ? `编辑账单：${editingBill.platformName}` : '编辑账单'}
        width={980}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingBill(null);
                setEditingForm(createDefaultFormState(platforms));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={() => void handleSaveEdit()} disabled={saving}>保存账单</Btn>
          </>
        )}
      >
        <div className="loan-modal-layout">
          <div className="loan-modal-grid loan-modal-grid-bill">
            <SelectField
              label="贷款平台"
              value={editingForm.platformId}
              onChange={(event) => {
                const nextPlatformId = event.target.value;
                setEditingForm((previous) => ({
                  ...previous,
                  platformId: nextPlatformId,
                  dueDate: resolveSuggestedDueDate(nextPlatformId, previous.billingMonth) || previous.dueDate,
                }));
              }}
            >
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>{platform.name}</option>
              ))}
            </SelectField>
            <Field
              label="本金"
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
            <div className="loan-modal-date-slot">
              <MonthPickerField
                label="账单月份"
                value={editingForm.billingMonth}
                onChange={(value) => {
                  setEditingForm((previous) => ({
                    ...previous,
                    billingMonth: value,
                    dueDate: resolveSuggestedDueDate(previous.platformId, value) || previous.dueDate,
                  }));
                }}
                clearable={false}
              />
            </div>
            <div className="loan-modal-date-slot loan-modal-date-slot-end">
              <DatePickerField
                label="到期日"
                value={editingForm.dueDate}
                onChange={(value) => setEditingForm((previous) => ({ ...previous, dueDate: value }))}
                clearable={false}
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

          setSaving(true);
          void onDelete(pendingDeleteId)
            .then(() => {
              setPendingDeleteId(null);
              showToast('贷款账单已删除。');
            })
            .catch(() => undefined)
            .finally(() => {
              setSaving(false);
            });
        }}
        title="确认删除这笔贷款账单？"
      >
        删除后，这笔账单将不再参与总览、统计、提醒和自动还款联动，请确认是否继续。
      </DeleteModal>

      <Modal
        open={Boolean(partialRepayBill)}
        onClose={() => {
          setPartialRepayBill(null);
          setPartialRepayAmount('');
        }}
        title={partialRepayBill ? `部分还款：${partialRepayBill.platformName}` : '部分还款'}
        width={620}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setPartialRepayBill(null);
                setPartialRepayAmount('');
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={() => void handlePartialRepay()} disabled={saving}>
              确认还款
            </Btn>
          </>
        )}
      >
        {partialRepayBill ? (
          <div className="page-stack">
            <div className="loan-partial-repay-summary">
              <div className="loan-partial-repay-summary-row">
                <span>欠款总额</span>
                <strong>{formatLoanAmount(partialRepayBill.amount + partialRepayBill.interest)}</strong>
              </div>
              <div className="loan-partial-repay-summary-row">
                <span>已还金额</span>
                <span>{formatLoanAmount(partialRepayBill.paidAmount + partialRepayBill.paidInterest)}</span>
              </div>
              <div className="loan-partial-repay-summary-row loan-partial-repay-summary-highlight">
                <span>剩余待还</span>
                <strong>
                  {formatLoanAmount(partialRepayBill.remainingAmount + partialRepayBill.remainingInterest)}
                </strong>
              </div>
              <div className="loan-partial-repay-summary-hint">
                欠款已含利息 ¥{partialRepayBill.interest.toFixed(2)}（剩余利息 ¥{partialRepayBill.remainingInterest.toFixed(2)} 将优先抵扣，其余抵扣本金）
              </div>
            </div>
            <Field
              label="本次还款金额"
              type="number"
              min="0.01"
              step="0.01"
              value={partialRepayAmount}
              onChange={(event) => setPartialRepayAmount(event.target.value)}
              placeholder={`最多 ${formatLoanAmount(partialRepayBill.remainingAmount + partialRepayBill.remainingInterest)}`}
            />
            <div className="loan-partial-repay-quick">
              <span className="field-label">快捷填入</span>
              <Btn
                tone="ghost"
                onClick={() => setPartialRepayAmount(((partialRepayBill.remainingAmount + partialRepayBill.remainingInterest) / 4).toFixed(2))}
              >
                1/4
              </Btn>
              <Btn
                tone="ghost"
                onClick={() => setPartialRepayAmount(((partialRepayBill.remainingAmount + partialRepayBill.remainingInterest) / 2).toFixed(2))}
              >
                1/2
              </Btn>
              <Btn
                tone="ghost"
                onClick={() => setPartialRepayAmount((partialRepayBill.remainingAmount + partialRepayBill.remainingInterest).toFixed(2))}
              >
                全部结清
              </Btn>
            </div>
            <div className="loan-modal-date-slot">
              <DatePickerField
                label="还款日期"
                value={partialRepayDate}
                onChange={setPartialRepayDate}
                clearable={false}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </SectionCard>
  );
}
