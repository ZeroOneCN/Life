import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { SectionCard } from '../page';
import { Btn, DeleteModal, Field, Modal, SelectField, Switch, Tag } from '../ui';
import {
  countRecordsByLedger,
  createShoppingLedger,
  deleteShoppingLedger,
  formatShoppingAmount,
  updateShoppingLedger,
} from '../../services/shopping';
import type { ShoppingCurrencyMode, ShoppingLedger, ShoppingLedgerDraft, ShoppingRecord } from '../../types/shopping';

interface ShoppingLedgersSectionProps {
  activeLedgerId: string;
  records: ShoppingRecord[];
  ledgers: ShoppingLedger[];
  currencyMode: ShoppingCurrencyMode;
  usdtRate: number;
  onActiveLedgerChange: (ledgerId: string) => void;
  onChangeLedgers: (updater: (ledgers: ShoppingLedger[]) => ShoppingLedger[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface LedgerFormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

function createDefaultLedgerForm(): LedgerFormState {
  return {
    name: '',
    description: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: '',
    isActive: false,
  };
}

function buildLedgerForm(ledger: ShoppingLedger): LedgerFormState {
  return {
    name: ledger.name,
    description: ledger.description,
    startDate: ledger.startDate,
    endDate: ledger.endDate,
    isActive: ledger.isActive,
  };
}

function parseLedgerDraft(form: LedgerFormState): ShoppingLedgerDraft | null {
  if (!form.name.trim() || !dayjs(form.startDate).isValid()) {
    return null;
  }

  if (form.endDate && !dayjs(form.endDate).isValid()) {
    return null;
  }

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    isActive: form.isActive,
  };
}

export function ShoppingLedgersSection({
  activeLedgerId,
  records,
  ledgers,
  currencyMode,
  usdtRate,
  onActiveLedgerChange,
  onChangeLedgers,
  showToast,
}: ShoppingLedgersSectionProps) {
  const [form, setForm] = useState<LedgerFormState>(createDefaultLedgerForm);
  const [editingLedger, setEditingLedger] = useState<ShoppingLedger | null>(null);
  const [editingForm, setEditingForm] = useState<LedgerFormState>(createDefaultLedgerForm);
  const [pendingDeleteLedger, setPendingDeleteLedger] = useState<ShoppingLedger | null>(null);

  const ledgerStats = useMemo(
    () =>
      Object.fromEntries(
        ledgers.map((ledger) => {
          const ledgerRecords = records.filter((record) => record.ledgerId === ledger.id);

          return [
            ledger.id,
            {
              count: ledgerRecords.length,
              amount: ledgerRecords.reduce((sum, record) => sum + record.price, 0),
            },
          ];
        }),
      ),
    [ledgers, records],
  );

  const handleCreate = () => {
    const draft = parseLedgerDraft(form);

    if (!draft) {
      showToast('请补全账本名称和开始日期。', 'error');
      return;
    }

    onChangeLedgers((previous) => createShoppingLedger(previous, draft));
    setForm(createDefaultLedgerForm());
    showToast('账本已创建。');
  };

  const handleSaveEdit = () => {
    if (!editingLedger) {
      return;
    }

    const draft = parseLedgerDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的账本信息。', 'error');
      return;
    }

    onChangeLedgers((previous) => updateShoppingLedger(previous, editingLedger.id, draft));
    if (draft.isActive) {
      onActiveLedgerChange(editingLedger.id);
    }
    setEditingLedger(null);
    setEditingForm(createDefaultLedgerForm());
    showToast('账本已更新。');
  };

  return (
    <SectionCard
      title="账本管理"
      description="把不同阶段、主题或项目的购物支出拆进独立账本，方便阶段复盘，也能快速切换默认录入上下文。"
      action={<Tag tone="blue">共 {ledgers.length} 个账本</Tag>}
    >
      <div className="page-stack">
        <div className="shopping-ledger-form">
          <div className="shopping-ledger-form-grid shopping-ledger-form-grid-compact">
            <Field
              label="账本名称"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="例如：618 大促"
            />
            <DatePickerField
              label="开始日期"
              value={form.startDate}
              onChange={(value) => setForm((previous) => ({ ...previous, startDate: value }))}
              clearable={false}
            />
            <DatePickerField
              label="结束日期"
              value={form.endDate}
              onChange={(value) => setForm((previous) => ({ ...previous, endDate: value }))}
              placeholder="可选"
            />
            <SelectField
              label="状态"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.value === 'active' }))}
            >
              <option value="inactive">仅存档</option>
              <option value="active">设为当前活跃</option>
            </SelectField>
            <Field
              label="账本说明"
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="例如：搬家阶段的家具、电器和收纳支出"
            />
            <div className="shopping-inline-action shopping-inline-action-ledger">
              <span className="field-label">保存账本</span>
              <Btn tone="primary" onClick={handleCreate}>
                新建账本
              </Btn>
            </div>
          </div>
        </div>

        <div className="shopping-ledger-grid">
          {ledgers.map((ledger) => {
            const summary = ledgerStats[ledger.id] ?? { count: 0, amount: 0 };

            return (
              <article
                key={ledger.id}
                className={`shopping-ledger-card ${ledger.id === activeLedgerId ? 'is-current' : ''}`}
              >
                <div className="shopping-ledger-card-head">
                  <div>
                    <strong>{ledger.name}</strong>
                    <div className="shopping-ledger-card-meta">
                      <span>{ledger.startDate}{ledger.endDate ? ` - ${ledger.endDate}` : ' - 进行中'}</span>
                      {ledger.isActive ? <Tag tone="green">活跃</Tag> : <Tag tone="default">存档</Tag>}
                    </div>
                  </div>
                  <div className="fitness-row-actions">
                    <Btn
                      tone={ledger.id === activeLedgerId ? 'primary' : 'secondary'}
                      onClick={() => onActiveLedgerChange(ledger.id)}
                    >
                      {ledger.id === activeLedgerId ? '当前账本' : '切换为当前'}
                    </Btn>
                    <Btn
                      tone="secondary"
                      onClick={() => {
                        setEditingLedger(ledger);
                        setEditingForm(buildLedgerForm(ledger));
                      }}
                    >
                      编辑
                    </Btn>
                    <Btn tone="danger" onClick={() => setPendingDeleteLedger(ledger)}>
                      删除
                    </Btn>
                  </div>
                </div>
                <p className="shopping-ledger-card-description">{ledger.description || '暂无账本说明。'}</p>
                <div className="shopping-ledger-card-metrics">
                  <span>{summary.count} 条记录</span>
                  <span>{formatShoppingAmount(summary.amount, currencyMode, usdtRate)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <Modal
        open={Boolean(editingLedger)}
        onClose={() => {
          setEditingLedger(null);
          setEditingForm(createDefaultLedgerForm());
        }}
        title={editingLedger ? `编辑账本：${editingLedger.name}` : '编辑账本'}
        width={820}
        footer={
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingLedger(null);
                setEditingForm(createDefaultLedgerForm());
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>
              保存账本
            </Btn>
          </>
        }
      >
        <div className="shopping-modal-layout">
          <div className="shopping-ledger-form-grid">
            <Field
              label="账本名称"
              value={editingForm.name}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            <DatePickerField
              label="开始日期"
              value={editingForm.startDate}
              onChange={(value) => setEditingForm((previous) => ({ ...previous, startDate: value }))}
              clearable={false}
            />
            <DatePickerField
              label="结束日期"
              value={editingForm.endDate}
              onChange={(value) => setEditingForm((previous) => ({ ...previous, endDate: value }))}
              placeholder="可选"
            />
          </div>
          <Field
            label="账本说明"
            value={editingForm.description}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="说明这个账本的使用边界和阶段背景"
          />
          <Switch
            checked={editingForm.isActive}
            onChange={(checked) => setEditingForm((previous) => ({ ...previous, isActive: checked }))}
            label="设为当前活跃账本"
            description="保存后，这个账本会成为页面顶部默认录入上下文。"
            statusText={editingForm.isActive ? '保存后立即切换' : '仅保留为历史账本'}
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteLedger)}
        onClose={() => setPendingDeleteLedger(null)}
        onConfirm={() => {
          if (!pendingDeleteLedger) {
            return;
          }

          const usedCount = countRecordsByLedger(records, pendingDeleteLedger.id);
          if (usedCount > 0) {
            showToast(`该账本下还有 ${usedCount} 条记录，请先清理或迁移后再删除。`, 'error');
            return;
          }

          const nextLedgers = deleteShoppingLedger(ledgers, pendingDeleteLedger.id);
          onChangeLedgers(() => nextLedgers);
          if (pendingDeleteLedger.id === activeLedgerId) {
            onActiveLedgerChange(nextLedgers[0]?.id ?? '');
          }
          setPendingDeleteLedger(null);
          showToast('账本已删除。');
        }}
        title="确认删除这个账本？"
      >
        账本删除后不会影响其他账本，但已归档到这个账本的记录必须先清理或迁移。
      </DeleteModal>
    </SectionCard>
  );
}
