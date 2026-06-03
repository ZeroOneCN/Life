import { useMemo, useState } from 'react';

import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Tag, TextArea } from '../ui';
import {
  createSubscriptionCategory,
  deleteSubscriptionCategory,
  updateSubscriptionCategory,
} from '../../services/subscription';
import type { SubscriptionCategory, SubscriptionCategoryDraft, SubscriptionRecord } from '../../types/subscription';

interface SubscriptionCategoriesSectionProps {
  categories: SubscriptionCategory[];
  records: SubscriptionRecord[];
  onChangeCategories: (updater: (categories: SubscriptionCategory[]) => SubscriptionCategory[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface CategoryFormState {
  name: string;
  description: string;
}

function createDefaultFormState(): CategoryFormState {
  return {
    name: '',
    description: '',
  };
}

function buildFormState(category: SubscriptionCategory): CategoryFormState {
  return {
    name: category.name,
    description: category.description,
  };
}

function parseDraft(form: CategoryFormState): SubscriptionCategoryDraft | null {
  if (!form.name.trim()) {
    return null;
  }

  return {
    name: form.name.trim(),
    description: form.description.trim(),
  };
}

export function SubscriptionCategoriesSection({
  categories,
  records,
  onChangeCategories,
  showToast,
}: SubscriptionCategoriesSectionProps) {
  const [form, setForm] = useState<CategoryFormState>(createDefaultFormState);
  const [editingCategory, setEditingCategory] = useState<SubscriptionCategory | null>(null);
  const [editingForm, setEditingForm] = useState<CategoryFormState>(createDefaultFormState);
  const [pendingDelete, setPendingDelete] = useState<SubscriptionCategory | null>(null);

  const categoryUsage = useMemo(() => categories.map((category) => ({
    categoryId: category.id,
    count: records.filter((record) => record.categoryId === category.id || record.categoryName === category.name).length,
  })), [categories, records]);

  const handleCreate = () => {
    const draft = parseDraft(form);
    if (!draft) {
      showToast('分类名称不能为空。', 'error');
      return;
    }

    onChangeCategories((current) => createSubscriptionCategory(current, draft));
    setForm(createDefaultFormState());
    showToast('分类已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingCategory) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('分类名称不能为空。', 'error');
      return;
    }

    onChangeCategories((current) => updateSubscriptionCategory(current, editingCategory.id, draft));
    setEditingCategory(null);
    showToast('分类已更新。');
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    onChangeCategories((current) => deleteSubscriptionCategory(current, pendingDelete.id));
    setPendingDelete(null);
    showToast('分类已删除，历史记录会继续保留分类快照。');
  };

  return (
    <SectionCard
      title="分类管理"
      description="分类是订阅记录和统计看板的共同数据源，删除分类不会回写历史记录。"
      action={<Tag tone="blue">共 {categories.length} 个分类</Tag>}
    >
      <div className="page-stack">
        <div className="subscription-category-entry">
          <Field
            label="分类名称"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如 AI 工具"
          />
          <Field
            label="分类说明"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="写明这个分类的使用边界"
          />
          <div className="subscription-entry-action">
            <Btn tone="primary" onClick={handleCreate}>新增分类</Btn>
          </div>
        </div>

        {categories.length ? (
          <DataTable
            data={categories}
            rowKey="id"
            columns={[
              { key: 'name', title: '分类名称', dataIndex: 'name' },
              { key: 'description', title: '说明', render: (_, row) => row.description || '-' },
              {
                key: 'usage',
                title: '关联记录',
                render: (_, row) => {
                  const usage = categoryUsage.find((item) => item.categoryId === row.id)?.count ?? 0;
                  return <Tag tone="green">{usage} 条</Tag>;
                },
              },
              {
                key: 'updatedAt',
                title: '最近更新',
                dataIndex: 'updatedAt',
              },
              {
                key: 'actions',
                title: '操作',
                render: (_, row) => (
                  <div className="table-actions">
                    <Btn
                      tone="ghost"
                      onClick={() => {
                        setEditingCategory(row);
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
          <EmptyState title="暂无分类" description="先新增一个分类，订阅记录录入时才能更好地聚合和筛选。" />
        )}
      </div>

      <Modal
        open={Boolean(editingCategory)}
        onClose={() => setEditingCategory(null)}
        title={editingCategory ? `编辑分类：${editingCategory.name}` : '编辑分类'}
        width={640}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingCategory(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存分类</Btn>
          </>
        )}
      >
        <div className="subscription-modal-grid subscription-modal-grid-small">
          <Field
            label="分类名称"
            value={editingForm.name}
            onChange={(event) => setEditingForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>
        <TextArea
          label="分类说明"
          value={editingForm.description}
          onChange={(event) => setEditingForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="说明这个分类覆盖哪些订阅场景"
        />
      </Modal>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={pendingDelete ? `删除分类：${pendingDelete.name}` : '删除分类'}
      >
        删除后历史记录仍会保留原分类名称快照，但新建或编辑时将不再可选。
      </DeleteModal>
    </SectionCard>
  );
}
