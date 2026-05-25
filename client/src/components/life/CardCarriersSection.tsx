import { useMemo, useState } from 'react';

import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Tag, TextArea } from '../ui';
import {
  createLifeCardCarrier,
  deleteLifeCardCarrier,
  updateLifeCardCarrier,
} from '../../services/card';
import type { LifeCardCarrier, LifeCardCarrierDraft, LifeCardRecord, LifeCardBillRecord } from '../../types/card';

interface CardCarriersSectionProps {
  carriers: LifeCardCarrier[];
  cards: LifeCardRecord[];
  bills: LifeCardBillRecord[];
  onChangeCarriers: (updater: (records: LifeCardCarrier[]) => LifeCardCarrier[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface CarrierFormState {
  name: string;
  description: string;
}

function createDefaultForm(): CarrierFormState {
  return {
    name: '',
    description: '',
  };
}

function buildFormState(carrier: LifeCardCarrier): CarrierFormState {
  return {
    name: carrier.name,
    description: carrier.description,
  };
}

function parseDraft(form: CarrierFormState): LifeCardCarrierDraft | null {
  if (!form.name.trim()) {
    return null;
  }

  return {
    name: form.name.trim(),
    description: form.description.trim(),
  };
}

export function CardCarriersSection({
  carriers,
  cards,
  bills,
  onChangeCarriers,
  showToast,
}: CardCarriersSectionProps) {
  const [form, setForm] = useState<CarrierFormState>(createDefaultForm);
  const [editingCarrier, setEditingCarrier] = useState<LifeCardCarrier | null>(null);
  const [editingForm, setEditingForm] = useState<CarrierFormState>(createDefaultForm);
  const [pendingDelete, setPendingDelete] = useState<LifeCardCarrier | null>(null);

  const carrierUsageMap = useMemo(() => new Map(
    carriers.map((carrier) => [
      carrier.id,
      {
        cardCount: cards.filter((card) => card.carrierId === carrier.id || card.carrierName === carrier.name).length,
        billCount: bills.filter((bill) => bill.carrierName === carrier.name).length,
      },
    ]),
  ), [bills, cards, carriers]);

  const handleCreate = () => {
    const draft = parseDraft(form);
    if (!draft) {
      showToast('请先填写运营商名称。', 'error');
      return;
    }

    onChangeCarriers((current) => createLifeCardCarrier(current, draft));
    setForm(createDefaultForm());
    showToast('运营商已添加。');
  };

  const handleSaveEdit = () => {
    if (!editingCarrier) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('请补全运营商名称。', 'error');
      return;
    }

    onChangeCarriers((current) => updateLifeCardCarrier(current, editingCarrier.id, draft));
    setEditingCarrier(null);
    showToast('运营商已更新。');
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    onChangeCarriers((current) => deleteLifeCardCarrier(current, pendingDelete.id));
    setPendingDelete(null);
    showToast('运营商已删除，历史号卡和账单仍会保留名称快照。');
  };

  return (
    <SectionCard
      title="运营商管理"
      description="维护录入和筛选要用到的运营商列表，历史数据继续保留运营商名称快照。"
    >
      <div className="page-stack">
        <div className="card-carrier-entry-grid">
          <Field
            label="运营商名称"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如 中国移动"
          />
          <Field
            label="描述"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="例如 适合日常通话与流量套餐管理"
          />
          <div className="card-entry-action">
            <Btn tone="primary" onClick={handleCreate}>新增运营商</Btn>
          </div>
        </div>

        {carriers.length ? (
          <DataTable
            rowKey="id"
            data={carriers}
            columns={[
              { key: 'name', title: '运营商名称', dataIndex: 'name', width: 160 },
              { key: 'description', title: '描述', render: (_, row) => row.description || '-', width: 320 },
              {
                key: 'usage',
                title: '历史使用',
                width: 180,
                render: (_, row) => {
                  const usage = carrierUsageMap.get(row.id);
                  return (
                    <div className="card-tag-list">
                      <Tag tone="blue">号卡 {usage?.cardCount ?? 0}</Tag>
                      <Tag tone="default">账单 {usage?.billCount ?? 0}</Tag>
                    </div>
                  );
                },
              },
              {
                key: 'actions',
                title: '操作',
                width: 160,
                render: (_, row) => (
                  <div className="table-actions">
                    <Btn tone="ghost" onClick={() => {
                      setEditingCarrier(row);
                      setEditingForm(buildFormState(row));
                    }}
                    >
                      编辑
                    </Btn>
                    <Btn tone="ghost" onClick={() => setPendingDelete(row)}>删除</Btn>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState title="暂无运营商" description="先添加一个运营商，号卡录入和筛选才能更完整地联动。" />
        )}
      </div>

      <Modal
        open={Boolean(editingCarrier)}
        onClose={() => setEditingCarrier(null)}
        title={editingCarrier ? `编辑运营商：${editingCarrier.name}` : '编辑运营商'}
        width={680}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingCarrier(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="card-carrier-modal-grid card-carrier-modal-grid-inline">
          <Field
            label="运营商名称"
            value={editingForm.name}
            onChange={(event) => setEditingForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Field
            label="描述"
            value={editingForm.description}
            onChange={(event) => setEditingForm((current) => ({ ...current, description: event.target.value }))}
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={pendingDelete ? `删除运营商：${pendingDelete.name}` : '删除运营商'}
      >
        删除后只会影响后续录入和筛选选项，不会回写历史号卡和账单记录。
      </DeleteModal>
    </SectionCard>
  );
}
