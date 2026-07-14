import { useState } from 'react';
import { SectionCard, EmptyState } from '../page';
import {
  Btn,
  DataTable,
  DeleteIcon,
  DeleteModal,
  EditIcon,
  Field,
  IconBtn,
  Modal,
  Tag,
  TextArea,
  useToastState,
} from '../ui';
import {
  type StockPlatform,
  type StockPlatformDraft,
} from '../../types/investment';

interface StockPlatformsSectionProps {
  platforms: StockPlatform[];
  onAdd: (draft: StockPlatformDraft) => void;
  onUpdate: (id: string, draft: Partial<StockPlatformDraft>) => void;
  onDelete: (id: string) => void;
}

export function StockPlatformsSection({ platforms, onAdd, onUpdate, onDelete }: StockPlatformsSectionProps) {
  const { showToast } = useToastState();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<StockPlatform | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    name: '',
    brokerType: '',
    accountId: '',
    remark: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    brokerType: '',
    accountId: '',
    remark: '',
  });

  const handleAddSubmit = () => {
    if (!addForm.name.trim()) {
      showToast('请输入平台名称', 'error');
      return;
    }
    onAdd({
      name: addForm.name.trim(),
      brokerType: addForm.brokerType,
      accountId: addForm.accountId.trim(),
      remark: addForm.remark.trim(),
    });
    showToast('平台已添加');
    setAddForm({ name: '', brokerType: '', accountId: '', remark: '' });
    setShowAddModal(false);
  };

  const handleEditSubmit = () => {
    if (!editingPlatform || !editForm.name.trim()) {
      showToast('请输入平台名称', 'error');
      return;
    }
    onUpdate(editingPlatform.id, {
      name: editForm.name.trim(),
      brokerType: editForm.brokerType,
      accountId: editForm.accountId.trim(),
      remark: editForm.remark.trim(),
    });
    showToast('平台已更新');
    setEditingPlatform(null);
  };

  const handleDeleteConfirm = () => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      showToast('平台已删除');
      setPendingDeleteId(null);
    }
  };

  const columns = [
    {
      key: 'name',
      title: '平台名称',
      render: (_: unknown, row: StockPlatform) => (
        <div>
          <strong>{row.name}</strong>
          <Tag tone="blue" size="sm">{row.brokerType || '-'}</Tag>
        </div>
      ),
    },
    {
      key: 'accountId',
      title: '账户标识',
      render: (_: unknown, row: StockPlatform) => row.accountId || '-',
    },
    {
      key: 'remark',
      title: '备注',
      render: (_: unknown, row: StockPlatform) => row.remark || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_: unknown, row: StockPlatform) => (
        <div className="fitness-row-actions">
          <IconBtn
            tone="secondary"
            icon={<EditIcon />}
            title="编辑"
            onClick={() => {
              setEditingPlatform(row);
              setEditForm({
                name: row.name,
                brokerType: row.brokerType,
                accountId: row.accountId,
                remark: row.remark,
              });
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
  ];

  return (
    <SectionCard
      title="交易平台"
      description={`管理你的交易账户，共 ${platforms.length} 个平台`}
      action={<Btn tone="primary" onClick={() => setShowAddModal(true)}>添加平台</Btn>}
    >
      {platforms.length === 0 ? (
        <EmptyState
          title="暂无交易平台"
          description="先添加一个交易平台，如富途牛牛、老虎证券等"
          icon="📱"
        />
      ) : (
        <DataTable columns={columns} data={platforms} rowKey="id" />
      )}

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="添加交易平台"
        footer={
          <>
            <Btn tone="secondary" onClick={() => setShowAddModal(false)}>取消</Btn>
            <Btn tone="primary" onClick={handleAddSubmit}>保存</Btn>
          </>
        }
      >
        <Field
          label="平台名称 *"
          value={addForm.name}
          onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="例如：富途牛牛主账户"
        />
        <Field
          label="券商类型"
          value={addForm.brokerType}
          onChange={(e) => setAddForm((prev) => ({ ...prev, brokerType: e.target.value }))}
          placeholder="例如：富途牛牛、老虎证券、币安等"
        />
        <Field
          label="账户标识"
          value={addForm.accountId}
          onChange={(e) => setAddForm((prev) => ({ ...prev, accountId: e.target.value }))}
          placeholder="例如：FT001"
        />
        <TextArea
          label="备注"
          value={addForm.remark}
          onChange={(e) => setAddForm((prev) => ({ ...prev, remark: e.target.value }))}
          rows={2}
          placeholder="备注信息"
        />
      </Modal>

      <Modal
        open={!!editingPlatform}
        onClose={() => setEditingPlatform(null)}
        title="编辑交易平台"
        footer={
          <>
            <Btn tone="secondary" onClick={() => setEditingPlatform(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleEditSubmit}>保存</Btn>
          </>
        }
      >
        <Field
          label="平台名称 *"
          value={editForm.name}
          onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <Field
          label="券商类型"
          value={editForm.brokerType}
          onChange={(e) => setEditForm((prev) => ({ ...prev, brokerType: e.target.value }))}
          placeholder="例如：富途牛牛、老虎证券、币安等"
        />
        <Field
          label="账户标识"
          value={editForm.accountId}
          onChange={(e) => setEditForm((prev) => ({ ...prev, accountId: e.target.value }))}
        />
        <TextArea
          label="备注"
          value={editForm.remark}
          onChange={(e) => setEditForm((prev) => ({ ...prev, remark: e.target.value }))}
          rows={2}
        />
      </Modal>

      <DeleteModal
        open={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        title="删除交易平台"
        onConfirm={handleDeleteConfirm}
      >
        删除后，关联该平台的交易记录仍会保留，但平台名称将显示为"未知平台"。
      </DeleteModal>
    </SectionCard>
  );
}