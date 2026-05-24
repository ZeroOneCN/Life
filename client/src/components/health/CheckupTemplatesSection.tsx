import { useMemo, useState } from 'react';

import { EmptyState, SectionCard } from '../page';
import { Btn, DeleteModal, Field, Modal, TextArea } from '../ui';
import type { CheckupTemplate, CheckupTemplateItem } from '../../types/checkup';

interface TemplateFormState {
  name: string;
  testType: string;
  items: CheckupTemplateItem[];
}

interface CheckupTemplatesSectionProps {
  templates: CheckupTemplate[];
  onCreateTemplate: (draft: { name: string; testType: string; items: CheckupTemplateItem[] }) => void;
  onUpdateTemplate: (id: string, draft: { name: string; testType: string; items: CheckupTemplateItem[] }) => void;
  onDeleteTemplate: (id: string) => void;
  onUseTemplate: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

function createTemplateItem(seed?: Partial<CheckupTemplateItem>): CheckupTemplateItem {
  return {
    id: seed?.id ?? Math.random().toString(36).slice(2, 10),
    testName: seed?.testName ?? '',
    unit: seed?.unit ?? 'mmol/L',
    referenceRange: seed?.referenceRange ?? '',
  };
}

function createDefaultFormState(): TemplateFormState {
  return {
    name: '',
    testType: '生化检查',
    items: [createTemplateItem()],
  };
}

function buildFormState(template: CheckupTemplate): TemplateFormState {
  return {
    name: template.name,
    testType: template.testType,
    items: template.items.map((item) => createTemplateItem(item)),
  };
}

export function CheckupTemplatesSection({
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onUseTemplate,
  showToast,
}: CheckupTemplatesSectionProps) {
  const [editingTemplate, setEditingTemplate] = useState<CheckupTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(createDefaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const templateCountSummary = useMemo(
    () => templates.reduce((sum, template) => sum + template.items.length, 0),
    [templates],
  );

  const openCreateModal = () => {
    setEditingTemplate(null);
    setForm(createDefaultFormState());
    setFormOpen(true);
  };

  const openEditModal = (template: CheckupTemplate) => {
    setEditingTemplate(template);
    setForm(buildFormState(template));
    setFormOpen(true);
  };

  const handleSave = () => {
    const items = form.items
      .map((item) => ({
        ...item,
        testName: item.testName.trim(),
        unit: item.unit.trim(),
        referenceRange: item.referenceRange.trim(),
      }))
      .filter((item) => item.testName);

    if (!form.name.trim() || !form.testType.trim() || !items.length) {
      showToast('请填写模板名称、检查类型和至少一个模板项目。', 'error');
      return;
    }

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, {
        name: form.name,
        testType: form.testType,
        items,
      });
      showToast('模板已更新。');
    } else {
      onCreateTemplate({
        name: form.name,
        testType: form.testType,
        items,
      });
      showToast('模板已创建。');
    }

    setFormOpen(false);
    setEditingTemplate(null);
    setForm(createDefaultFormState());
  };

  return (
    <SectionCard
      title="模板中心"
      description="将常用体检项目保存为模板，后续可直接回填到批量录入，减少重复输入。"
      action={<Btn tone="primary" onClick={openCreateModal}>新建模板</Btn>}
    >
      <div className="page-stack">
        <div className="callout callout-neutral">
          当前共有 <strong>{templates.length}</strong> 个模板，累计覆盖 <strong>{templateCountSummary}</strong> 个模板项目。
        </div>

        {templates.length ? (
          <div className="checkup-template-grid">
            {templates.map((template) => (
              <div className="checkup-template-card" key={template.id}>
                <div className="notification-status-top">
                  <div>
                    <h3 className="card-title">{template.name}</h3>
                    <p className="section-description">
                      {template.testType} · {template.items.length} 个项目
                    </p>
                  </div>
                </div>

                <div className="stack-list">
                  {template.items.map((item) => (
                    <div key={item.id} className="list-row">
                      <div>
                        <strong>{item.testName}</strong>
                        <div className="list-row-meta">
                          <span>{item.unit || '无单位'}</span>
                          <span>{item.referenceRange || '无参考范围'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="fitness-row-actions">
                  <Btn tone="primary" onClick={() => onUseTemplate(template.id)}>用于批量录入</Btn>
                  <Btn tone="secondary" onClick={() => openEditModal(template)}>编辑</Btn>
                  <Btn tone="danger" onClick={() => setPendingDeleteId(template.id)}>删除</Btn>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="暂无模板"
            description="先创建一个肝功能、血脂或年度体检模板，后续批量录入会更高效。"
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTemplate(null);
          setForm(createDefaultFormState());
        }}
        title={editingTemplate ? `编辑模板：${editingTemplate.name}` : '新建模板'}
        width={900}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => {
              setFormOpen(false);
              setEditingTemplate(null);
              setForm(createDefaultFormState());
            }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSave}>{editingTemplate ? '保存模板' : '创建模板'}</Btn>
          </>
        )}
      >
        <div className="checkup-filter-grid">
          <Field
            label="模板名称"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="例如：年度体检血脂模板"
          />
          <Field
            label="检查类型"
            value={form.testType}
            onChange={(event) => setForm((previous) => ({ ...previous, testType: event.target.value }))}
            placeholder="例如：生化检查"
          />
        </div>

        <div className="checkup-batch-header">
          <strong>模板项目</strong>
          <Btn
            tone="secondary"
            onClick={() => setForm((previous) => ({
              ...previous,
              items: [...previous.items, createTemplateItem()],
            }))}
          >
            新增项目
          </Btn>
        </div>

        <div className="checkup-batch-list">
          {form.items.map((item) => (
            <div key={item.id} className="checkup-batch-row">
              <span className="checkup-batch-index">项</span>
              <Field
                label="项目"
                value={item.testName}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  items: previous.items.map((current) => (
                    current.id === item.id ? { ...current, testName: event.target.value } : current
                  )),
                }))}
                placeholder="例如：ALT"
              />
              <Field
                label="单位"
                value={item.unit}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  items: previous.items.map((current) => (
                    current.id === item.id ? { ...current, unit: event.target.value } : current
                  )),
                }))}
                placeholder="例如：U/L"
              />
              <Field
                label="参考范围"
                value={item.referenceRange}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  items: previous.items.map((current) => (
                    current.id === item.id ? { ...current, referenceRange: event.target.value } : current
                  )),
                }))}
                placeholder="例如：7-40"
              />
              <Btn
                tone="danger"
                disabled={form.items.length === 1}
                onClick={() => setForm((previous) => ({
                  ...previous,
                  items: previous.items.filter((current) => current.id !== item.id),
                }))}
              >
                删除
              </Btn>
            </div>
          ))}
        </div>

        <TextArea
          label="使用说明"
          value={editingTemplate ? `最近更新：${new Date(editingTemplate.updatedAt).toLocaleString()}` : '模板创建后即可在批量录入页直接应用。'}
          readOnly
        />
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onDeleteTemplate(pendingDeleteId);
          setPendingDeleteId(null);
          showToast('模板已删除。');
        }}
        title="删除这个模板？"
      >
        删除后不会影响已保存的体检记录，但将无法继续在批量录入时直接复用。
      </DeleteModal>
    </SectionCard>
  );
}
