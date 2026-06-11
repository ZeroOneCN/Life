import { useMemo, useState } from 'react';

import { SectionCard } from '../page';
import { Btn, DeleteModal, Field, Modal, Tag } from '../ui';
import {
  createShoppingPlatform,
  deleteShoppingPlatform,
  formatShoppingAmount,
  updateShoppingPlatform,
} from '../../services/shopping';
import type { ShoppingCurrencyMode, ShoppingPlatform, ShoppingRecord } from '../../types/shopping';

interface ShoppingPlatformsSectionProps {
  records: ShoppingRecord[];
  platforms: ShoppingPlatform[];
  currencyMode: ShoppingCurrencyMode;
  usdtRate: number;
  onChangePlatforms: (updater: (platforms: ShoppingPlatform[]) => ShoppingPlatform[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface PlatformFormState {
  name: string;
}

function createDefaultPlatformForm(): PlatformFormState {
  return {
    name: '',
  };
}

function buildPlatformForm(platform: ShoppingPlatform): PlatformFormState {
  return {
    name: platform.name,
  };
}

export function ShoppingPlatformsSection({
  records,
  platforms,
  currencyMode,
  usdtRate,
  onChangePlatforms,
  showToast,
}: ShoppingPlatformsSectionProps) {
  const [form, setForm] = useState<PlatformFormState>(createDefaultPlatformForm);
  const [editingPlatform, setEditingPlatform] = useState<ShoppingPlatform | null>(null);
  const [editingForm, setEditingForm] = useState<PlatformFormState>(createDefaultPlatformForm);
  const [pendingDeletePlatform, setPendingDeletePlatform] = useState<ShoppingPlatform | null>(null);

  const platformStats = useMemo(
    () =>
      Object.fromEntries(
        platforms.map((platform) => {
          const related = records.filter((record) => record.platform === platform.name);

          return [
            platform.id,
            {
              count: related.length,
              amount: related.reduce((sum, record) => sum + record.price, 0),
            },
          ];
        }),
      ),
    [platforms, records],
  );

  const handleCreate = () => {
    if (!form.name.trim()) {
      showToast('请先填写平台名称。', 'error');
      return;
    }

    const duplicate = platforms.some(
      (platform) => platform.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
    );

    if (duplicate) {
      showToast('平台名称已存在。', 'error');
      return;
    }

    onChangePlatforms((previous) =>
      createShoppingPlatform(previous, {
        name: form.name,
        isBuiltIn: false,
      }),
    );
    setForm(createDefaultPlatformForm());
    showToast('平台已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingPlatform || !editingForm.name.trim()) {
      showToast('请补全平台名称。', 'error');
      return;
    }

    const duplicate = platforms.some(
      (platform) =>
        platform.id !== editingPlatform.id &&
        platform.name.trim().toLowerCase() === editingForm.name.trim().toLowerCase(),
    );

    if (duplicate) {
      showToast('平台名称已存在。', 'error');
      return;
    }

    onChangePlatforms((previous) =>
      updateShoppingPlatform(previous, editingPlatform.id, {
        name: editingForm.name,
        colorToken: editingPlatform.colorToken,
        isBuiltIn: editingPlatform.isBuiltIn,
      }),
    );
    setEditingPlatform(null);
    setEditingForm(createDefaultPlatformForm());
    showToast('平台已更新。');
  };

  return (
    <SectionCard
      title="平台管理"
      description="统一维护购物平台名称，录入表单、筛选器和统计看板都会复用这里的平台定义。"
      action={<Tag tone="orange">历史记录会保留平台快照</Tag>}
    >
      <div className="page-stack">
        <div className="shopping-platform-form">
          <div className="shopping-platform-form-grid shopping-platform-form-grid-compact">
            <Field
              label="平台名称"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="例如：京东"
            />
            <div className="shopping-inline-action shopping-inline-action-platform">
              <span className="field-label">保存平台</span>
              <Btn tone="primary" onClick={handleCreate}>
                新增平台
              </Btn>
            </div>
          </div>
        </div>

        <div className="shopping-platform-grid">
          {platforms.map((platform) => {
            const summary = platformStats[platform.id] ?? { count: 0, amount: 0 };

            return (
              <article key={platform.id} className="shopping-platform-card">
                <div className="shopping-platform-card-head">
                  <strong>{platform.name}</strong>
                  <div className="fitness-row-actions">
                    <Btn
                      tone="secondary"
                      onClick={() => {
                        setEditingPlatform(platform);
                        setEditingForm(buildPlatformForm(platform));
                      }}
                    >
                      编辑
                    </Btn>
                    <Btn tone="danger" onClick={() => setPendingDeletePlatform(platform)}>
                      删除
                    </Btn>
                  </div>
                </div>
                <div className="shopping-platform-card-meta">
                  {platform.isBuiltIn ? <Tag tone="blue">系统预置</Tag> : <Tag tone="pink">自定义平台</Tag>}
                  <span className="subtle-text">{summary.count} 条记录</span>
                </div>
                <strong className="shopping-platform-card-amount">
                  {formatShoppingAmount(summary.amount, currencyMode, usdtRate)}
                </strong>
              </article>
            );
          })}
        </div>
      </div>

      <Modal
        open={Boolean(editingPlatform)}
        onClose={() => {
          setEditingPlatform(null);
          setEditingForm(createDefaultPlatformForm());
        }}
        title={editingPlatform ? `编辑平台：${editingPlatform.name}` : '编辑平台'}
        width={520}
        footer={
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingPlatform(null);
                setEditingForm(createDefaultPlatformForm());
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>
              保存平台
            </Btn>
          </>
        }
      >
        <div className="shopping-modal-layout">
          <Field
            label="平台名称"
            value={editingForm.name}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="请输入平台名称"
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeletePlatform)}
        onClose={() => setPendingDeletePlatform(null)}
        onConfirm={() => {
          if (!pendingDeletePlatform) {
            return;
          }

          onChangePlatforms((previous) => deleteShoppingPlatform(previous, pendingDeletePlatform.id));
          setPendingDeletePlatform(null);
          showToast('平台已删除，历史记录中的平台名称会继续保留。');
        }}
        title="确认删除这个平台？"
      >
        删除平台只会影响后续录入和筛选选项，不会改写历史购物记录中的平台名称。
      </DeleteModal>
    </SectionCard>
  );
}
