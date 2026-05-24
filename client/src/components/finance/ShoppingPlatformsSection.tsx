import { useMemo, useState, type CSSProperties } from 'react';

import { SectionCard } from '../page';
import { Btn, DeleteModal, Field, Modal, Tag } from '../ui';
import {
  SHOPPING_PLATFORM_COLOR_PRESETS,
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
  colorToken: string;
}

const COLOR_LABELS: Record<string, string> = {
  '#5e6ad2': '主题蓝',
  '#1eaedb': '海湾青',
  '#27a644': '清新绿',
  '#f59e0b': '琥珀橙',
  '#e5484d': '强调红',
  '#10b981': '薄荷绿',
  '#c084fc': '雾紫',
  '#f97316': '暖橘',
};

function createDefaultPlatformForm(): PlatformFormState {
  return {
    name: '',
    colorToken: SHOPPING_PLATFORM_COLOR_PRESETS[0],
  };
}

function buildPlatformForm(platform: ShoppingPlatform): PlatformFormState {
  return {
    name: platform.name,
    colorToken: platform.colorToken || SHOPPING_PLATFORM_COLOR_PRESETS[0],
  };
}

function ColorPalettePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="shopping-color-picker" role="radiogroup" aria-label="平台色板">
      {SHOPPING_PLATFORM_COLOR_PRESETS.map((color) => {
        const selected = value === color;

        return (
          <button
            key={color}
            type="button"
            className={`shopping-color-swatch ${selected ? 'is-active' : ''}`}
            style={{ '--swatch-color': color } as CSSProperties}
            onClick={() => onChange(color)}
            aria-label={COLOR_LABELS[color] ?? '平台颜色'}
            aria-pressed={selected}
          >
            <span className="shopping-color-swatch-dot" />
            <span className="shopping-color-swatch-label">{COLOR_LABELS[color] ?? color}</span>
          </button>
        );
      })}
    </div>
  );
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

  const platformStats = useMemo(() => (
    Object.fromEntries(platforms.map((platform) => {
      const related = records.filter((record) => record.platform === platform.name);
      return [platform.id, {
        count: related.length,
        amount: related.reduce((sum, record) => sum + record.price, 0),
      }];
    }))
  ), [platforms, records]);

  const handleCreate = () => {
    if (!form.name.trim()) {
      showToast('请先填写平台名称。', 'error');
      return;
    }

    const duplicate = platforms.some((platform) => platform.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (duplicate) {
      showToast('平台名称已存在。', 'error');
      return;
    }

    onChangePlatforms((previous) => createShoppingPlatform(previous, {
      name: form.name,
      colorToken: form.colorToken,
      isBuiltIn: false,
    }));
    setForm(createDefaultPlatformForm());
    showToast('平台已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingPlatform || !editingForm.name.trim()) {
      showToast('请补全平台名称。', 'error');
      return;
    }

    const duplicate = platforms.some((platform) => (
      platform.id !== editingPlatform.id
      && platform.name.trim().toLowerCase() === editingForm.name.trim().toLowerCase()
    ));

    if (duplicate) {
      showToast('平台名称已存在。', 'error');
      return;
    }

    onChangePlatforms((previous) => updateShoppingPlatform(previous, editingPlatform.id, {
      name: editingForm.name,
      colorToken: editingForm.colorToken,
      isBuiltIn: editingPlatform.isBuiltIn,
    }));
    setEditingPlatform(null);
    setEditingForm(createDefaultPlatformForm());
    showToast('平台已更新。');
  };

  return (
    <SectionCard
      title="平台管理"
      description="统一维护购物平台的名称和配色，后续录入表单、筛选项和图表都会复用这里的定义。"
      action={<Tag tone="orange">历史记录保留平台快照</Tag>}
    >
      <div className="page-stack">
        <div className="shopping-platform-form">
          <div className="shopping-platform-form-grid">
            <Field
              label="平台名称"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="例如：小红书"
            />
            <div className="field">
              <span className="field-label">平台色板</span>
              <ColorPalettePicker
                value={form.colorToken}
                onChange={(colorToken) => setForm((previous) => ({ ...previous, colorToken }))}
              />
            </div>
            <div className="shopping-inline-action shopping-inline-action-platform">
              <span className="field-label">保存平台</span>
              <Btn tone="primary" onClick={handleCreate}>新增平台</Btn>
            </div>
          </div>
        </div>

        <div className="shopping-platform-grid">
          {platforms.map((platform) => {
            const summary = platformStats[platform.id] ?? { count: 0, amount: 0 };

            return (
              <article key={platform.id} className="shopping-platform-card">
                <div className="shopping-platform-card-head">
                  <div className="shopping-platform-chip">
                    <span className="shopping-platform-color" style={{ background: platform.colorToken }} />
                    <strong>{platform.name}</strong>
                  </div>
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
                    <Btn tone="danger" onClick={() => setPendingDeletePlatform(platform)}>删除</Btn>
                  </div>
                </div>
                <div className="shopping-platform-card-meta">
                  {platform.isBuiltIn ? <Tag tone="blue">系统预置</Tag> : <Tag tone="default">自定义平台</Tag>}
                  <span className="subtle-text">{summary.count} 笔记录</span>
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
        width={640}
        footer={(
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
            <Btn tone="primary" onClick={handleSaveEdit}>保存平台</Btn>
          </>
        )}
      >
        <div className="shopping-modal-layout">
          <Field
            label="平台名称"
            value={editingForm.name}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, name: event.target.value }))}
          />
          <div className="field">
            <span className="field-label">平台色板</span>
            <ColorPalettePicker
              value={editingForm.colorToken}
              onChange={(colorToken) => setEditingForm((previous) => ({ ...previous, colorToken }))}
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

          onChangePlatforms((previous) => deleteShoppingPlatform(previous, pendingDeletePlatform.id));
          setPendingDeletePlatform(null);
          showToast('平台已删除，历史记录中的平台名称会继续保留。');
        }}
        title="确认删除这个平台？"
      >
        删除平台只会影响后续录入与筛选选项，不会回写历史购物记录中的平台名称。
      </DeleteModal>
    </SectionCard>
  );
}
