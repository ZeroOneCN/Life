import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField, MonthPickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  LOAN_ALL_PLATFORMS,
  LOAN_BILL_PAGE_SIZE,
  createLoanBill,
  deleteLoanBill,
  filterLoanBills,
  formatLoanAmount,
  getLoanBillStatus,
  suggestLoanDueDate,
  updateLoanBill,
} from '../../services/loan';
import type { LoanBill, LoanBillDraft, LoanPlatform } from '../../types/loan';

interface LoanBillsSectionProps {
  activeUserId: string;
  filterUserId: string;
  bills: LoanBill[];
  platforms: LoanPlatform[];
  onFilterUserIdChange: (value: string) => void;
  onChangeBills: (updater: (bills: LoanBill[]) => LoanBill[]) => void;
  onMarkPaid: (billId: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface BillFormState {
  userId: string;
  platformId: string;
  amount: string;
  interest: string;
  billingMonth: string;
  dueDate: string;
  notes: string;
}

function createDefaultFormState(activeUserId: string, platforms: LoanPlatform[]): BillFormState {
  const firstPlatform = platforms.find((platform) => platform.userId === activeUserId) ?? platforms[0] ?? null;
  const billingMonth = dayjs().format('YYYY-MM');
  return {
    userId: activeUserId,
    platformId: firstPlatform?.id ?? '',
    amount: '',
    interest: '',
    billingMonth,
    dueDate: firstPlatform ? suggestLoanDueDate(firstPlatform, billingMonth) : '',
    notes: '',
  };
}

function buildFormState(bill: LoanBill): BillFormState {
  return {
    userId: bill.userId,
    platformId: bill.platformId,
    amount: String(bill.amount),
    interest: String(bill.interest),
    billingMonth: bill.billingMonth,
    dueDate: bill.dueDate,
    notes: bill.notes,
  };
}

function parseDraft(form: BillFormState): LoanBillDraft | null {
  const amount = Number(form.amount);
  const interest = form.interest ? Number(form.interest) : 0;

  if (!form.userId.trim() || !form.platformId || !dayjs(`${form.billingMonth}-01`).isValid()) {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (form.interest && (!Number.isFinite(interest) || interest < 0)) {
    return null;
  }

  return {
    userId: form.userId.trim(),
    platformId: form.platformId,
    amount,
    interest,
    billingMonth: form.billingMonth,
    dueDate: form.dueDate,
    notes: form.notes.trim(),
  };
}

export function LoanBillsSection({
  activeUserId,
  filterUserId,
  bills,
  platforms,
  onFilterUserIdChange,
  onChangeBills,
  onMarkPaid,
  showToast,
}: LoanBillsSectionProps) {
  const [form, setForm] = useState<BillFormState>(() => createDefaultFormState(activeUserId, platforms));
  const [editingBill, setEditingBill] = useState<LoanBill | null>(null);
  const [editingForm, setEditingForm] = useState<BillFormState>(() => createDefaultFormState(activeUserId, platforms));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState(LOAN_ALL_PLATFORMS);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [page, setPage] = useState(1);

  const activePlatforms = useMemo(
    () => platforms.filter((platform) => platform.userId === activeUserId),
    [activeUserId, platforms],
  );

  const filterPlatforms = useMemo(() => {
    const targetUserId = filterUserId.trim();
    return targetUserId ? platforms.filter((platform) => platform.userId === targetUserId) : platforms;
  }, [filterUserId, platforms]);

  useEffect(() => {
    setForm(createDefaultFormState(activeUserId, platforms));
  }, [activeUserId, platforms]);

  const filteredBills = useMemo(() => filterLoanBills(bills, filterUserId, platformFilter)
    .filter((bill) => {
      const status = getLoanBillStatus(bill);
      return statusFilter === 'all' ? true : status === statusFilter;
    })
    .filter((bill) => !monthFilter || bill.billingMonth === monthFilter), [bills, filterUserId, monthFilter, platformFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [filterUserId, platformFilter, statusFilter, monthFilter]);

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
      title: '本金 / 利息',
      render: (_value: unknown, row: LoanBill) => (
        <div className="travel-amount-stack">
          <strong>{formatLoanAmount(row.amount)}</strong>
          <span>利息 {formatLoanAmount(row.interest)}</span>
        </div>
      ),
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
      key: 'notes',
      title: '备注',
      render: (_value: unknown, row: LoanBill) => row.notes || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: LoanBill) => (
        <div className="fitness-row-actions">
          <Btn tone="secondary" disabled={row.isPaid} onClick={() => onMarkPaid(row.id)}>标记已还</Btn>
          <Btn
            tone="secondary"
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

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全平台、本金、账单月份和到期日。', 'error');
      return;
    }

    onChangeBills((previous) => createLoanBill(platforms, previous, draft));
    setForm(createDefaultFormState(activeUserId, platforms));
    showToast('借款账单已创建。');
  };

  const handleSaveEdit = () => {
    if (!editingBill) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的账单信息。', 'error');
      return;
    }

    onChangeBills((previous) => updateLoanBill(platforms, previous, editingBill.id, draft));
    setEditingBill(null);
    setEditingForm(createDefaultFormState(activeUserId, platforms));
    showToast('借款账单已更新。');
  };

  const resolveSuggestedDueDate = (platformId: string, billingMonth: string, list: LoanPlatform[]) => {
    const selectedPlatform = list.find((platform) => platform.id === platformId) ?? null;
    return selectedPlatform ? suggestLoanDueDate(selectedPlatform, billingMonth) : '';
  };

  return (
    <SectionCard
      title="账单"
      description="统一维护账单月份、到期日、金额和利息，标记已还时可联动自动生成还款记录。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          新建账单默认归属 <strong>{activeUserId || '未设置用户'}</strong>。当你选择平台和账单月份后，会按平台规则自动给出默认到期日。
        </div>

        <div className="loan-bill-entry-grid">
          <SelectField
            label="借款平台"
            value={form.platformId}
            onChange={(event) => {
              const nextPlatformId = event.target.value;
              setForm((previous) => ({
                ...previous,
                platformId: nextPlatformId,
                dueDate: resolveSuggestedDueDate(nextPlatformId, previous.billingMonth, activePlatforms) || previous.dueDate,
              }));
            }}
          >
            {activePlatforms.map((platform) => (
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
            placeholder="例如：1680"
          />
          <Field
            label="利息"
            type="number"
            min="0"
            step="0.01"
            value={form.interest}
            onChange={(event) => setForm((previous) => ({ ...previous, interest: event.target.value }))}
            placeholder="例如：42"
          />
          <div className="loan-modal-date-slot">
            <MonthPickerField
              label="账单月份"
              value={form.billingMonth}
              onChange={(value) => {
                setForm((previous) => ({
                  ...previous,
                  billingMonth: value,
                  dueDate: resolveSuggestedDueDate(previous.platformId, value, activePlatforms) || previous.dueDate,
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
          <Field
            label="备注"
            value={form.notes}
            onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
            placeholder="例如：家居和数码配件分期"
          />
          <div className="loan-inline-action">
            <span className="field-label">保存账单</span>
            <Btn tone="primary" onClick={handleCreate}>新建账单</Btn>
          </div>
        </div>

        <div className="loan-filter-grid loan-filter-grid-bills">
          <Field
            label="筛选用户 ID"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
          />
          <SelectField label="平台筛选" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
            <option value={LOAN_ALL_PLATFORMS}>全部平台</option>
            {filterPlatforms.map((platform) => (
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
            title="暂无借款账单"
            description="先新建一笔账单，或调整当前用户、平台、状态和月份筛选条件。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingBill)}
        onClose={() => {
          setEditingBill(null);
          setEditingForm(createDefaultFormState(activeUserId, platforms));
        }}
        title={editingBill ? `编辑账单：${editingBill.platformName}` : '编辑账单'}
        width={980}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingBill(null);
                setEditingForm(createDefaultFormState(activeUserId, platforms));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存账单</Btn>
          </>
        )}
      >
        <div className="loan-modal-layout">
          <div className="loan-modal-grid loan-modal-grid-bill">
            <Field
              label="用户 ID"
              value={editingForm.userId}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, userId: event.target.value }))}
            />
            <SelectField
              label="借款平台"
              value={editingForm.platformId}
              onChange={(event) => {
                const nextPlatformId = event.target.value;
                setEditingForm((previous) => ({
                  ...previous,
                  platformId: nextPlatformId,
                  dueDate: resolveSuggestedDueDate(
                    nextPlatformId,
                    previous.billingMonth,
                    platforms.filter((platform) => !previous.userId.trim() || platform.userId === previous.userId.trim()),
                  ) || previous.dueDate,
                }));
              }}
            >
              {platforms
                .filter((platform) => !editingForm.userId.trim() || platform.userId === editingForm.userId.trim())
                .map((platform) => (
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
                    dueDate: resolveSuggestedDueDate(
                      previous.platformId,
                      value,
                      platforms.filter((platform) => !previous.userId.trim() || platform.userId === previous.userId.trim()),
                    ) || previous.dueDate,
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
          <TextArea
            label="备注"
            value={editingForm.notes}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, notes: event.target.value }))}
            placeholder="补充这个账单的消费背景、分期说明或后续处理备注"
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

          onChangeBills((previous) => deleteLoanBill(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('借款账单已删除。');
        }}
        title="确认删除这笔借款账单？"
      >
        删除后，这笔账单将不再参与概览、统计、提醒和自动还款联动，请确认是否继续。
      </DeleteModal>
    </SectionCard>
  );
}
