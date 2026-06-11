import { useMemo, useState } from 'react';

import { EmptyState, SectionCard } from '../page';
import { Btn, DeleteModal, Field, Modal } from '../ui';
import { formatLoanAmount } from '../../services/loan';
import type { LoanBill, LoanPlatform, LoanPlatformDraft, LoanRepayment } from '../../types/loan';

interface LoanPlatformsSectionProps {
  bills: LoanBill[];
  platforms: LoanPlatform[];
  repayments: LoanRepayment[];
  onCreate: (draft: LoanPlatformDraft) => Promise<void>;
  onUpdate: (platformId: string, draft: LoanPlatformDraft) => Promise<void>;
  onDelete: (platformId: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface PlatformFormState {
  name: string;
  billingDay: string;
  repaymentDay: string;
  creditLimit: string;
}

function createDefaultFormState(): PlatformFormState {
  return {
    name: '',
    billingDay: '',
    repaymentDay: '',
    creditLimit: '',
  };
}

function buildFormState(platform: LoanPlatform): PlatformFormState {
  return {
    name: platform.name,
    billingDay: String(platform.billingDay),
    repaymentDay: String(platform.repaymentDay),
    creditLimit: String(platform.creditLimit || ''),
  };
}

function parseDraft(form: PlatformFormState): LoanPlatformDraft | null {
  const billingDay = Number(form.billingDay);
  const repaymentDay = Number(form.repaymentDay);
  const creditLimit = form.creditLimit ? Number(form.creditLimit) : 0;

  if (!form.name.trim()) {
    return null;
  }

  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
    return null;
  }

  if (!Number.isInteger(repaymentDay) || repaymentDay < 1 || repaymentDay > 31) {
    return null;
  }

  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return null;
  }

  return {
    name: form.name.trim(),
    billingDay,
    repaymentDay,
    creditLimit,
  };
}

export function LoanPlatformsSection({
  bills,
  platforms,
  repayments,
  onCreate,
  onUpdate,
  onDelete,
  showToast,
}: LoanPlatformsSectionProps) {
  const [form, setForm] = useState<PlatformFormState>(createDefaultFormState);
  const [editingPlatform, setEditingPlatform] = useState<LoanPlatform | null>(null);
  const [editingForm, setEditingForm] = useState<PlatformFormState>(createDefaultFormState);
  const [pendingDeletePlatform, setPendingDeletePlatform] = useState<LoanPlatform | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedPlatforms = useMemo(
    () => [...platforms].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
    [platforms],
  );

  const handleCreate = async () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全平台名称、账单日、还款日和额度。', 'error');
      return;
    }

    const duplicate = sortedPlatforms.some((platform) => platform.name.toLowerCase() === draft.name.toLowerCase());
    if (duplicate) {
      showToast('已存在同名贷款平台。', 'error');
      return;
    }

    setSaving(true);
    try {
      await onCreate(draft);
      setForm(createDefaultFormState());
      showToast('贷款平台已创建。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPlatform) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('请补全要保存的平台信息。', 'error');
      return;
    }

    const duplicate = sortedPlatforms.some((platform) => (
      platform.id !== editingPlatform.id
      && platform.name.toLowerCase() === draft.name.toLowerCase()
    ));
    if (duplicate) {
      showToast('已存在同名贷款平台。', 'error');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(editingPlatform.id, draft);
      setEditingPlatform(null);
      setEditingForm(createDefaultFormState());
      showToast('贷款平台已更新。');
    } catch {
      // The page container already surfaces API errors.
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title="平台"
      description="维护贷款平台的账单日、还款日和额度，后续账单默认到期日会参考这些规则。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          若平台仍被账单或还款记录引用，将不能直接删除。
        </div>

        <div className="loan-platform-form-grid">
          <Field
            label="平台名称"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="例如：花呗"
          />
          <Field
            label="账单日"
            type="number"
            min="1"
            max="31"
            value={form.billingDay}
            onChange={(event) => setForm((previous) => ({ ...previous, billingDay: event.target.value }))}
            placeholder="1 - 31"
          />
          <Field
            label="还款日"
            type="number"
            min="1"
            max="31"
            value={form.repaymentDay}
            onChange={(event) => setForm((previous) => ({ ...previous, repaymentDay: event.target.value }))}
            placeholder="1 - 31"
          />
          <Field
            label="额度"
            type="number"
            min="0"
            step="0.01"
            value={form.creditLimit}
            onChange={(event) => setForm((previous) => ({ ...previous, creditLimit: event.target.value }))}
            placeholder="例如：20000"
          />
          <div className="loan-inline-action">
            <span className="field-label">保存平台</span>
            <Btn tone="primary" onClick={() => void handleCreate()} disabled={saving}>新建平台</Btn>
          </div>
        </div>

        {sortedPlatforms.length ? (
          <div className="loan-platform-grid">
            {sortedPlatforms.map((platform) => {
              const linkedBills = bills.filter((bill) => bill.platformId === platform.id);
              const linkedRepayments = repayments.filter((repayment) => repayment.platformId === platform.id);
              const totalExposure = linkedBills.reduce((sum, bill) => sum + bill.amount, 0);

              return (
                <article key={platform.id} className="loan-platform-card">
                  <div className="loan-platform-card-head">
                    <div>
                      <strong>{platform.name}</strong>
                      <div className="loan-summary-card-meta">
                        <span>账单日 {platform.billingDay} 日</span>
                        <span>还款日 {platform.repaymentDay} 日</span>
                      </div>
                    </div>
                    <div className="fitness-row-actions">
                      <Btn
                        tone="secondary"
                        onClick={() => {
                          setEditingPlatform(platform);
                          setEditingForm(buildFormState(platform));
                        }}
                      >
                        编辑
                      </Btn>
                      <Btn tone="danger" onClick={() => setPendingDeletePlatform(platform)}>删除</Btn>
                    </div>
                  </div>
                  <div className="loan-summary-card-metrics">
                    <span>额度 {formatLoanAmount(platform.creditLimit)}</span>
                    <span>账单 {linkedBills.length} 笔</span>
                  </div>
                  <div className="loan-summary-card-metrics">
                    <span>还款 {linkedRepayments.length} 笔</span>
                    <span>累计账单 {formatLoanAmount(totalExposure)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="暂无贷款平台"
            description="先创建一个贷款平台，后续账单和还款才能完整挂接。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingPlatform)}
        onClose={() => {
          setEditingPlatform(null);
          setEditingForm(createDefaultFormState());
        }}
        title={editingPlatform ? `编辑平台：${editingPlatform.name}` : '编辑平台'}
        width={760}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingPlatform(null);
                setEditingForm(createDefaultFormState());
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={() => void handleSaveEdit()} disabled={saving}>保存平台</Btn>
          </>
        )}
      >
        <div className="loan-modal-layout">
          <div className="loan-modal-grid loan-modal-grid-platform">
            <Field
              label="平台名称"
              value={editingForm.name}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            <Field
              label="账单日"
              type="number"
              min="1"
              max="31"
              value={editingForm.billingDay}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, billingDay: event.target.value }))}
            />
            <Field
              label="还款日"
              type="number"
              min="1"
              max="31"
              value={editingForm.repaymentDay}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, repaymentDay: event.target.value }))}
            />
            <Field
              label="额度"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.creditLimit}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, creditLimit: event.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeletePlatform)}
        onClose={() => setPendingDeletePlatform(null)}
        onConfirm={() => {
          if (!pendingDeletePlatform) {
            return;
          }

          const linkedBills = bills.filter((bill) => bill.platformId === pendingDeletePlatform.id).length;
          const linkedRepayments = repayments.filter((repayment) => repayment.platformId === pendingDeletePlatform.id).length;

          if (linkedBills > 0 || linkedRepayments > 0) {
            showToast(`该平台仍关联 ${linkedBills} 笔账单和 ${linkedRepayments} 笔还款，无法直接删除。`, 'error');
            return;
          }

          setSaving(true);
          void onDelete(pendingDeletePlatform.id)
            .then(() => {
              setPendingDeletePlatform(null);
              showToast('贷款平台已删除。');
            })
            .catch((error) => {
              console.error('删除贷款平台失败:', error);
              showToast('删除贷款平台失败，请重试。', 'error');
            })
            .finally(() => {
              setSaving(false);
            });
        }}
        title="确认删除这个贷款平台？"
      >
        删除后将不能再把新账单挂到该平台下，因此已有账单或还款记录未清理前不允许误删。
      </DeleteModal>
    </SectionCard>
  );
}
