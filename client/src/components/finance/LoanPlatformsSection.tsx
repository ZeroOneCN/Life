import { useMemo, useState } from 'react';

import { EmptyState, SectionCard } from '../page';
import { Btn, DeleteModal, Field, Modal } from '../ui';
import {
  countBillsByPlatform,
  countRepaymentsByPlatform,
  createLoanPlatform,
  deleteLoanPlatform,
  formatLoanAmount,
  updateLoanPlatform,
} from '../../services/loan';
import type { LoanBill, LoanPlatform, LoanPlatformDraft, LoanRepayment } from '../../types/loan';

interface LoanPlatformsSectionProps {
  activeUserId: string;
  bills: LoanBill[];
  platforms: LoanPlatform[];
  repayments: LoanRepayment[];
  onChangePlatforms: (updater: (platforms: LoanPlatform[]) => LoanPlatform[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface PlatformFormState {
  userId: string;
  name: string;
  billingDay: string;
  repaymentDay: string;
  creditLimit: string;
}

function createDefaultFormState(activeUserId: string): PlatformFormState {
  return {
    userId: activeUserId,
    name: '',
    billingDay: '',
    repaymentDay: '',
    creditLimit: '',
  };
}

function buildFormState(platform: LoanPlatform): PlatformFormState {
  return {
    userId: platform.userId,
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

  if (!form.userId.trim() || !form.name.trim()) {
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
    userId: form.userId.trim(),
    name: form.name.trim(),
    billingDay,
    repaymentDay,
    creditLimit,
  };
}

export function LoanPlatformsSection({
  activeUserId,
  bills,
  platforms,
  repayments,
  onChangePlatforms,
  showToast,
}: LoanPlatformsSectionProps) {
  const [form, setForm] = useState<PlatformFormState>(() => createDefaultFormState(activeUserId));
  const [editingPlatform, setEditingPlatform] = useState<LoanPlatform | null>(null);
  const [editingForm, setEditingForm] = useState<PlatformFormState>(() => createDefaultFormState(activeUserId));
  const [pendingDeletePlatform, setPendingDeletePlatform] = useState<LoanPlatform | null>(null);

  const scopedPlatforms = useMemo(
    () => platforms.filter((platform) => platform.userId === activeUserId),
    [activeUserId, platforms],
  );

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全平台名称、账单日、还款日和额度。', 'error');
      return;
    }

    const duplicate = scopedPlatforms.some((platform) => platform.name.toLowerCase() === draft.name.toLowerCase());
    if (duplicate) {
      showToast('当前用户下已存在同名平台。', 'error');
      return;
    }

    onChangePlatforms((previous) => createLoanPlatform(previous, draft));
    setForm(createDefaultFormState(activeUserId));
    showToast('贷款平台已创建。');
  };

  const handleSaveEdit = () => {
    if (!editingPlatform) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('请补全要保存的平台信息。', 'error');
      return;
    }

    const duplicate = platforms.some((platform) => (
      platform.id !== editingPlatform.id
      && platform.userId === draft.userId
      && platform.name.toLowerCase() === draft.name.toLowerCase()
    ));
    if (duplicate) {
      showToast('该用户下已存在同名平台。', 'error');
      return;
    }

    onChangePlatforms((previous) => updateLoanPlatform(previous, editingPlatform.id, draft));
    setEditingPlatform(null);
    setEditingForm(createDefaultFormState(activeUserId));
    showToast('贷款平台已更新。');
  };

  return (
    <SectionCard
      title="平台"
      description="维护每个贷款平台的账单日、还款日和额度，后续账单默认到期日会依赖这里的规则自动推导。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前新建平台默认归属 <strong>{activeUserId || '未设置用户'}</strong>。若后续账单或还款仍引用某个平台，将不能直接删除它。
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
            placeholder="例如：12000"
          />
          <div className="loan-inline-action">
            <span className="field-label">保存平台</span>
            <Btn tone="primary" onClick={handleCreate}>新建平台</Btn>
          </div>
        </div>

        {scopedPlatforms.length ? (
          <div className="loan-platform-grid">
            {scopedPlatforms.map((platform) => {
              const linkedBills = bills.filter((bill) => bill.platformId === platform.id);
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
                    <span>账单 {countBillsByPlatform(bills, platform.id)} 笔</span>
                  </div>
                  <div className="loan-summary-card-metrics">
                    <span>还款 {countRepaymentsByPlatform(repayments, platform.id)} 笔</span>
                    <span>累计账单 {formatLoanAmount(totalExposure)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="暂无贷款平台"
            description="先为当前用户创建一个贷款平台，后续账单和还款记录才能完整挂接。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingPlatform)}
        onClose={() => {
          setEditingPlatform(null);
          setEditingForm(createDefaultFormState(activeUserId));
        }}
        title={editingPlatform ? `编辑平台：${editingPlatform.name}` : '编辑平台'}
        width={760}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingPlatform(null);
                setEditingForm(createDefaultFormState(activeUserId));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存平台</Btn>
          </>
        )}
      >
        <div className="loan-modal-layout">
          <div className="loan-modal-grid loan-modal-grid-platform">
            <Field
              label="用户 ID"
              value={editingForm.userId}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, userId: event.target.value }))}
            />
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

          const linkedBills = countBillsByPlatform(bills, pendingDeletePlatform.id);
          const linkedRepayments = countRepaymentsByPlatform(repayments, pendingDeletePlatform.id);

          if (linkedBills > 0 || linkedRepayments > 0) {
            showToast(`该平台仍关联 ${linkedBills} 笔账单和 ${linkedRepayments} 笔还款，无法直接删除。`, 'error');
            return;
          }

          onChangePlatforms((previous) => deleteLoanPlatform(previous, pendingDeletePlatform.id));
          setPendingDeletePlatform(null);
          showToast('贷款平台已删除。');
        }}
        title="确认删除这个贷款平台？"
      >
        删除平台后，后续将不能再把新账单挂到它下面，因此已有账单或还款记录未清理前不允许误删。
      </DeleteModal>
    </SectionCard>
  );
}
