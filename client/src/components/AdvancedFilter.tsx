import { useCallback, useMemo, useState } from 'react';
import { Btn, FilterTag, SelectField, Tag } from './ui';
import { DatePickerField } from './date';

/**
 * 筛选条件定义
 */
export interface FilterCondition {
  /** 条件唯一标识 */
  id: string;
  /** 筛选字段 */
  field: string;
  /** 操作符 */
  operator: 'contains' | 'equals' | 'gt' | 'lt' | 'between' | 'in';
  /** 值（between 时为 [start, end]） */
  value: string | string[];
}

/**
 * 筛选字段元信息
 */
export interface FilterFieldDef {
  /** 字段标识 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: 'text' | 'select' | 'date' | 'date-range' | 'tag';
  /** select 类型的选项 */
  options?: Array<{ value: string; label: string }>;
  /** 占位符 */
  placeholder?: string;
}

/**
 * 高级筛选 Hook
 *
 * 管理多条件组合筛选状态，支持添加/删除/更新/重置条件。
 *
 * @example
 * ```tsx
 * const { conditions, addCondition, removeCondition, updateCondition, resetConditions, activeCount } = useAdvancedFilter();
 *
 * // 在 filterBar 中渲染
 * <FilterBar>
 *   {conditions.map((cond) => (
 *     <FilterConditionRow key={cond.id} ... />
 *   ))}
 *   <Btn onClick={addCondition}>添加条件</Btn>
 * </FilterBar>
 * ```
 */
export function useAdvancedFilter() {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  const addCondition = useCallback((field: string, operator: FilterCondition['operator'] = 'contains', value: string | string[] = '') => {
    const newCondition: FilterCondition = {
      id: `filter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      field,
      operator,
      value,
    };
    setConditions((prev) => [...prev, newCondition]);
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCondition = useCallback((id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const resetConditions = useCallback(() => {
    setConditions([]);
  }, []);

  const activeCount = useMemo(() => conditions.filter((c) => {
    if (Array.isArray(c.value)) {
      return c.value.length > 0 && c.value.some((v) => v.trim() !== '');
    }
    return c.value.trim() !== '';
  }).length, [conditions]);

  return {
    conditions,
    addCondition,
    removeCondition,
    updateCondition,
    resetConditions,
    activeCount,
    setConditions,
  };
}

/**
 * 筛选条件输入行组件
 *
 * 根据字段定义渲染对应的输入控件（文本输入/下拉选择/日期选择等）。
 */
export function FilterConditionRow({
  condition,
  fieldDef,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  fieldDef: FilterFieldDef;
  onChange: (updates: Partial<Omit<FilterCondition, 'id'>>) => void;
  onRemove: () => void;
}) {
  const handleValueChange = (value: string | string[]) => {
    onChange({ value });
  };

  const renderValueInput = () => {
    switch (fieldDef.type) {
      case 'select':
        return (
          <SelectField value={condition.value as string} onChange={(e) => handleValueChange(e.target.value)}>
            <option value="">全部</option>
            {fieldDef.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </SelectField>
        );

      case 'date':
        return (
          <DatePickerField
            value={condition.value as string}
            onChange={(v) => handleValueChange(v)}
            clearable
          />
        );

      case 'date-range': {
        const range = Array.isArray(condition.value) ? condition.value : ['', ''];
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <DatePickerField
              value={range[0]}
              onChange={(v) => handleValueChange([v, range[1]])}
              placeholder="开始日期"
              clearable
            />
            <span style={{ color: 'var(--color-ink-tertiary)' }}>~</span>
            <DatePickerField
              value={range[1]}
              onChange={(v) => handleValueChange([range[0], v])}
              placeholder="结束日期"
              clearable
            />
          </div>
        );
      }

      case 'tag':
        return (
          <input
            type="text"
            className="field"
            value={condition.value as string}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="标签关键词，逗号分隔"
            style={{ minWidth: 160 }}
          />
        );

      default:
        return (
          <input
            type="text"
            className="field"
            value={condition.value as string}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={fieldDef.placeholder ?? '输入关键词...'}
            style={{ minWidth: 160 }}
          />
        );
    }
  };

  return (
    <div className="filter-condition-row">
      <span className="filter-condition-field-label">{fieldDef.label}</span>
      {renderValueInput()}
      <button
        type="button"
        className="filter-condition-remove"
        onClick={onRemove}
        title="移除条件"
        aria-label="移除条件"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="3" x2="11" y2="11" />
          <line x1="11" y1="3" x2="3" y2="11" />
        </svg>
      </button>
    </div>
  );
}

/**
 * 高级筛选栏组件
 *
 * 提供"添加筛选条件"下拉菜单，展开已添加的条件行，显示活跃条件数量。
 */
export function CompoundFilterBar({
  conditions,
  fieldDefs,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onReset,
  rightSlot,
}: {
  conditions: FilterCondition[];
  fieldDefs: FilterFieldDef[];
  onAddCondition: (field: string, operator: FilterCondition['operator']) => void;
  onRemoveCondition: (id: string) => void;
  onUpdateCondition: (id: string, updates: Partial<Omit<FilterCondition, 'id'>>) => void;
  onReset: () => void;
  rightSlot?: React.ReactNode;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const availableFields = useMemo(
    () => fieldDefs.filter((def) => !conditions.some((c) => c.field === def.key)),
    [fieldDefs, conditions],
  );

  const activeCount = useMemo(
    () => conditions.filter((c) => {
      if (Array.isArray(c.value)) {
        return c.value.some((v) => v.trim() !== '');
      }
      return c.value.trim() !== '';
    }).length,
    [conditions],
  );

  const handleAddField = (fieldKey: string) => {
    const def = fieldDefs.find((d) => d.key === fieldKey);
    if (def) {
      const operator = def.type === 'date-range' ? 'between' : def.type === 'date' ? 'equals' : 'contains';
      onAddCondition(fieldKey, operator);
    }
    setShowAddMenu(false);
  };

  return (
    <div className="compound-filter-bar">
      <div className="compound-filter-conditions">
        {conditions.map((condition) => {
          const def = fieldDefs.find((d) => d.key === condition.field);
          if (!def) return null;
          return (
            <FilterConditionRow
              key={condition.id}
              condition={condition}
              fieldDef={def}
              onChange={(updates) => onUpdateCondition(condition.id, updates)}
              onRemove={() => onRemoveCondition(condition.id)}
            />
          );
        })}

        <div className="compound-filter-actions">
          {availableFields.length > 0 && (
            <div className="compound-filter-add-wrapper">
              <Btn
                tone="ghost"
                onClick={() => setShowAddMenu((prev) => !prev)}
              >
                + 添加筛选条件
              </Btn>
              {showAddMenu && (
                <div className="compound-filter-add-menu">
                  {availableFields.map((def) => (
                    <button
                      key={def.key}
                      type="button"
                      className="compound-filter-add-menu-item"
                      onClick={() => handleAddField(def.key)}
                    >
                      {def.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeCount > 0 ? (
            <>
              <Tag tone="blue">{activeCount} 个筛选</Tag>
              <Btn tone="ghost" onClick={onReset}>重置</Btn>
            </>
          ) : null}
        </div>
      </div>
      {rightSlot ? <div className="compound-filter-right">{rightSlot}</div> : null}
    </div>
  );
}