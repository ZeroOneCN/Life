import { useState } from 'react';
import { Btn, Field, Modal, SelectField } from './ui';
import { DatePickerField } from './date';

/**
 * 批量编辑字段定义
 */
export interface BatchEditField {
  /** 字段标识 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: 'text' | 'select' | 'date' | 'tag';
  /** select 选项 */
  options?: Array<{ value: string; label: string }>;
  /** 占位符 */
  placeholder?: string;
}

/**
 * 批量编辑 Modal 组件
 *
 * 支持对多个选中记录批量编辑指定字段，每个字段可独立设置是否启用。
 * 启用一个字段后，该字段的值会应用到所有选中记录。
 *
 * @example
 * ```tsx
 * const [batchEditOpen, setBatchEditOpen] = useState(false);
 *
 * <BatchEditModal
 *   open={batchEditOpen}
 *   onClose={() => setBatchEditOpen(false)}
 *   fields={[
 *     { key: 'priority', label: '优先级', type: 'select', options: [...] },
 *     { key: 'dueDate', label: '截止日期', type: 'date' },
 *   ]}
 *   onApply={async (values) => {
 *     for (const id of selectedIds) {
 *       await api.update(id, values);
 *     }
 *   }}
 *   selectedCount={selectedIds.length}
 * />
 * ```
 */
export function BatchEditModal({
  open,
  onClose,
  fields,
  onApply,
  selectedCount,
  title = '批量编辑',
}: {
  open: boolean;
  onClose: () => void;
  fields: BatchEditField[];
  onApply: (values: Record<string, string>) => Promise<void>;
  selectedCount: number;
  title?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    const activeValues: Record<string, string> = {};
    for (const field of fields) {
      if (enabled[field.key] && values[field.key] !== undefined && values[field.key] !== '') {
        activeValues[field.key] = values[field.key];
      }
    }
    if (Object.keys(activeValues).length === 0) return;

    setApplying(true);
    try {
      await onApply(activeValues);
      setValues({});
      setEnabled({});
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    if (!applying) {
      setValues({});
      setEnabled({});
      onClose();
    }
  };

  const toggleField = (key: string) => {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!enabled[key]) {
      setValues((prev) => ({ ...prev, [key]: '' }));
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`${title}（已选 ${selectedCount} 项）`}
      width={520}
      footer={(
        <>
          <Btn tone="secondary" onClick={handleClose} disabled={applying}>取消</Btn>
          <Btn tone="primary" onClick={() => void handleApply()} loading={applying}>应用修改</Btn>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map((field) => (
          <div
            key={field.key}
            className="batch-edit-field"
            style={{
              opacity: enabled[field.key] ? 1 : 0.5,
              transition: 'opacity 0.15s ease',
            }}
          >
            <div className="batch-edit-field-header">
              <label className="batch-edit-toggle">
                <input
                  type="checkbox"
                  checked={enabled[field.key] ?? false}
                  onChange={() => toggleField(field.key)}
                  style={{ marginRight: 6 }}
                />
                {field.label}
              </label>
              {enabled[field.key] && field.type === 'select' ? (
                <SelectField
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">请选择...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </SelectField>
              ) : null}
              {enabled[field.key] && field.type === 'date' ? (
                <DatePickerField
                  value={values[field.key] ?? ''}
                  onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                  clearable
                />
              ) : null}
              {enabled[field.key] && field.type === 'text' ? (
                <input
                  type="text"
                  className="field"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{ minWidth: 200 }}
                />
              ) : null}
              {enabled[field.key] && field.type === 'tag' ? (
                <input
                  type="text"
                  className="field"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder="逗号分隔多个标签"
                  style={{ minWidth: 200 }}
                />
              ) : null}
            </div>
          </div>
        ))}
        {fields.length === 0 ? (
          <div className="batch-edit-empty">
            <span className="subtle-text">当前无可批量编辑的字段</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}