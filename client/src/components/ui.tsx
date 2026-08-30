import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { Button, Input, Message, Modal as ArcoModal, Pagination as ArcoPagination, Select, Switch as ArcoSwitch, Checkbox as ArcoCheckbox, Tabs, Tag as ArcoTag } from '@arco-design/web-react';
import type { TabOption, TableColumn } from '../types/ui';

export function useUndo<T>(initialValue: T, maxHistory = 50) {
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const current = history[historyIndex];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const setValue = useCallback((nextValue: T | ((prev: T) => T)) => {
    setHistory((prev) => {
      const currentValue = prev[historyIndex];
      const computed = typeof nextValue === 'function'
        ? (nextValue as (prev: T) => T)(currentValue)
        : nextValue;
      if (computed === currentValue) return prev;
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(computed);
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, maxHistory - 1));
  }, [historyIndex, maxHistory]);

  const undo = useCallback(() => {
    setHistoryIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setHistoryIndex((prev) => Math.min(history.length - 1, prev + 1));
  }, [history.length]);

  const reset = useCallback((value: T) => {
    setHistory([value]);
    setHistoryIndex(0);
  }, []);

  return { current, setValue, undo, redo, canUndo, canRedo, reset };
}

export function useFormKeyboardSubmit(onSubmit: () => void, enabled = true) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.isDefaultPrevented()) {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'textarea') return;
      e.preventDefault();
      onSubmit();
    }
  }, [onSubmit, enabled]);

  return { handleKeyDown };
}

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-fill';

interface ToastState {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  detail?: string;
  duration?: number;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  loading?: boolean;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: number;
  footer?: ReactNode;
  children: ReactNode;
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  statusText?: ReactNode;
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const TOAST_ICONS: Record<NonNullable<ToastState['type']>, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

const TOAST_LABELS: Record<NonNullable<ToastState['type']>, string> = {
  success: '操作成功',
  error: '操作失败',
  warning: '温馨提示',
  info: '提示信息',
};

export function Toast({ toast }: { toast: ToastState | null }) {
  // 已迁移至 Arco Message，保留空组件以兼容业务代码
  return null;
}

export function Skeleton({ lines = 3, width }: { lines?: number; width?: string | number }) {
  return (
    <div className="skeleton-block" style={width ? { width: typeof width === 'number' ? `${width}px` : width } : undefined}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

export function StatGridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="stat-card skeleton-card">
          <div className="skeleton-line" style={{ width: '40%', height: 14, marginBottom: 10 }} />
          <div className="skeleton-line" style={{ width: '70%', height: 26, marginBottom: 8 }} />
          <div className="skeleton-line" style={{ width: '50%', height: 12 }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="skeleton-line" style={{ width: '60%', height: 14, margin: '0 auto' }} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci}><div className="skeleton-line" style={{ width: ci === 0 ? '70%' : '50%', height: 14, margin: '0 auto' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="section-card" style={{ height }}>
      <div className="skeleton-line" style={{ width: '30%', height: 16, marginBottom: 16 }} />
      <div className="skeleton-line" style={{ width: '100%', height: 14, marginBottom: 10 }} />
      <div className="skeleton-line" style={{ width: '80%', height: 14, marginBottom: 10 }} />
      <div className="skeleton-line" style={{ width: '60%', height: 14 }} />
    </div>
  );
}

export function PageLoading({ tip = '加载中...' }: { tip?: string }) {
  return (
    <div className="page-loading" role="status" aria-label={tip}>
      <div className="page-loading-spinner" aria-hidden="true" />
      <span className="page-loading-tip">{tip}</span>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = '搜索...',
  onClear,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const inputId = useId();

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
  };

  return (
    <div className={`search-input-wrapper ${disabled ? 'is-disabled' : ''}`}>
      <span className="search-input-icon" aria-hidden="true">🔍</span>
      <input
        id={inputId}
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {value && !disabled ? (
        <button
          type="button"
          className="search-input-clear"
          onClick={handleClear}
          aria-label="清除搜索"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function FilterBar({
  children,
  rightSlot,
}: {
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="filter-bar">
      <div className="filter-bar-left">{children}</div>
      {rightSlot ? <div className="filter-bar-right">{rightSlot}</div> : null}
    </div>
  );
}

export function FilterTag({
  label,
  active = false,
  onClick,
  count,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      className={`filter-tag ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {count !== undefined ? <span className="filter-tag-count">{count}</span> : null}
    </button>
  );
}

export function ExportButton({
  onExport,
  label = '导出',
  disabled = false,
  options,
}: {
  onExport: (format: 'csv' | 'excel' | 'json') => void;
  label?: string;
  disabled?: boolean;
  options?: Array<{ value: 'csv' | 'excel' | 'json'; label: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultOptions = options ?? [
    { value: 'csv', label: '导出 CSV' },
    { value: 'excel', label: '导出 Excel' },
    { value: 'json', label: '导出 JSON' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    onExport(format);
    setIsOpen(false);
  };

  return (
    <div className="export-button-wrapper" ref={containerRef}>
      <button
        type="button"
        className="btn btn-secondary export-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span aria-hidden="true">📤</span>
        {label}
        <span className="export-button-arrow" aria-hidden="true">▾</span>
      </button>
      {isOpen && !disabled ? (
        <div className="export-dropdown">
          {defaultOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="export-dropdown-item"
              onClick={() => handleExport(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type TrendDirection = 'up' | 'down' | 'flat';

export function TrendArrow({ direction, value }: { direction: TrendDirection; value?: string }) {
  const map: Record<TrendDirection, { symbol: string; className: string }> = {
    up: { symbol: '↑', className: 'trend-up' },
    down: { symbol: '↓', className: 'trend-down' },
    flat: { symbol: '→', className: 'trend-flat' },
  };
  const { symbol, className } = map[direction];

  return (
    <span className={`trend-arrow ${className}`}>
      {symbol}
      {value ? <span className="trend-value">{value}</span> : null}
    </span>
  );
}

export function Modal({ open, onClose, title, width = 560, footer, children }: ModalProps) {
  return (
    <ArcoModal
      visible={open}
      onCancel={onClose}
      title={title}
      style={{ width }}
      footer={footer}
      maskClosable={false}
      escToExit={false}
      closable
      autoFocus={false}
      focusLock
    >
      {children}
    </ArcoModal>
  );
}

export function DeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = '确认删除',
  confirmTone = 'danger-fill',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  confirmTone?: 'danger-fill' | 'primary' | 'secondary' | 'danger';
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => confirmRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={460}
      footer={(
        <>
          <Btn tone="secondary" onClick={onClose}>取消</Btn>
          <Btn ref={confirmRef} tone={confirmTone} onClick={onConfirm}>{confirmLabel}</Btn>
        </>
      )}
    >
      <p className="subtle-text">{children ?? '这个操作不可恢复，请确认是否继续。'}</p>
    </Modal>
  );
}

export const Btn = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonProps>>(function Btn({
  tone = 'secondary',
  className = '',
  children,
  loading,
  disabled,
  ...rest
}, ref) {
  // 将项目的 tone 映射到 Arco Button 的 type/status
  const typeMap: Record<string, 'primary' | 'secondary' | 'outline' | 'text' | 'default'> = {
    primary: 'primary',
    secondary: 'secondary',
    ghost: 'outline',
    danger: 'outline',
    'danger-fill': 'primary',
  };
  const statusMap: Record<string, 'danger' | 'warning' | 'success' | undefined> = {
    danger: 'danger',
    'danger-fill': 'danger',
  };

  return (
    <Button
      ref={ref}
      type={typeMap[tone] ?? 'secondary'}
      status={statusMap[tone]}
      loading={loading}
      disabled={disabled}
      className={className}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </Button>
  );
});

const ICON_SIZE = 16;

export const EditIcon = ({ size = ICON_SIZE }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const DeleteIcon = ({ size = ICON_SIZE }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

export const EyeIcon = ({ size = ICON_SIZE }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8 1-12 1-12z" />
    <circle cx="11" cy="12" r="3" />
  </svg>
);

export function IconBtn({
  tone = 'secondary',
  className = '',
  icon,
  title,
  size = ICON_SIZE,
  ...rest
}: ButtonProps & { icon: React.ReactNode; title: string; size?: number }) {
  return (
    <button
      className={`btn-icon btn-icon-${tone} ${className}`.trim()}
      title={title}
      aria-label={title}
      {...rest}
    >
      {typeof icon === 'string' ? null : icon}
    </button>
  );
}

export function PillTabs({
  options,
  value,
  onChange,
}: {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Tabs
      activeTab={value}
      onChange={onChange}
      type="capsule"
      size="small"
    >
      {options.map((option) => (
        <Tabs.TabPane key={option.value} title={option.label} />
      ))}
    </Tabs>
  );
}

export function Field({ label, hint, error, children, className = '', ...rest }: FieldProps) {
  const fieldClass = `field ${error ? 'is-error' : ''} ${className}`.trim();

  if (children) {
    return (
      <label className={fieldClass}>
        {label ? <span className="field-label">{label}</span> : null}
        {children}
        {error ? <span className="field-error">{error}</span> : null}
        {hint && !error ? <span className="field-hint">{hint}</span> : null}
      </label>
    );
  }

  // Arco Input 的 onChange 签名为 (value: string, e) => void，需适配原生 (e) => void
  const { onChange: nativeOnChange, value, ...inputProps } = rest as any;
  const handleArcoChange = nativeOnChange
    ? (val: string) => nativeOnChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>)
    : undefined;

  return (
    <label className={fieldClass}>
      {label ? <span className="field-label">{label}</span> : null}
      <Input value={value} onChange={handleArcoChange} {...inputProps} />
      {error ? <span className="field-error">{error}</span> : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({ label, hint, error, children, className = '', value, onChange, disabled, name, required, ...rest }: SelectFieldProps) {
  const fieldClass = `field ${error ? 'is-error' : ''}`.trim();

  // 将 native <option> 子元素转换为 Arco Select.Option
  const options = useMemo(() => {
    const opts: ReactNode[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === 'option') {
        const { value: optionValue, children: optionChildren, disabled: optionDisabled } = child.props;
        opts.push(
          <Select.Option key={String(optionValue)} value={optionValue} disabled={optionDisabled}>
            {optionChildren}
          </Select.Option>
        );
      }
    });
    return opts;
  }, [children]);

  return (
    <label className={fieldClass}>
      {label ? <span className="field-label">{label}</span> : null}
      <Select
        value={value as string | number | string[] | number[] | undefined}
        disabled={disabled}
        onChange={(val) => {
          // 模拟原生 select 的 onChange 事件接口
          const syntheticEvent = {
            target: { value: val },
            currentTarget: { value: val },
          } as React.ChangeEvent<HTMLSelectElement>;
          if (onChange) onChange(syntheticEvent);
        }}
        className={className}
        style={{ width: '100%' }}
      >
        {options}
      </Select>
      {error ? <span className="field-error">{error}</span> : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

// 重新导出 Arco Select 的 Option 子组件
export { Select } from '@arco-design/web-react';

export function Tag({
  children,
  tone = 'default',
  size = 'md',
}: PropsWithChildren<{ tone?: 'default' | 'pink' | 'green' | 'orange' | 'blue' | 'red'; size?: 'sm' | 'md' }>) {
  const colorMap: Record<string, string> = {
    default: 'gray',
    pink: 'magenta',
    green: 'green',
    orange: 'orange',
    blue: 'arcoblue',
    red: 'red',
  };
  return (
    <ArcoTag color={colorMap[tone]} size={size === 'sm' ? 'small' : 'default'}>
      {children}
    </ArcoTag>
  );
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  emptyText = '暂无数据',
  className,
  resizable = false,
}: {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  emptyText?: ReactNode;
  className?: string;
  resizable?: boolean;
}) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number | string>>(() => {
    const widths: Record<string, number | string> = {};
    columns.forEach((col) => {
      if (col.width !== undefined) {
        widths[col.key] = col.width;
      }
    });
    return widths;
  });

  const resizeStateRef = useRef<{
    columnKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = columnWidths[columnKey];
    const startWidth = typeof currentWidth === 'number' ? currentWidth : 120;
    resizeStateRef.current = {
      columnKey,
      startX: e.clientX,
      startWidth,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStateRef.current) return;
      const diff = moveEvent.clientX - resizeStateRef.current.startX;
      const newWidth = Math.max(60, resizeStateRef.current.startWidth + diff);
      setColumnWidths((prev) => ({
        ...prev,
        [resizeStateRef.current!.columnKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  if (!data.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className={`table-wrap${className ? ` ${className}` : ''}${resizable ? ' is-resizable' : ''}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: columnWidths[column.key] ?? column.width,
                  textAlign: column.align,
                }}
              >
                <span className="th-content">{column.title}</span>
                {resizable ? (
                  <div
                    className="col-resize-handle"
                    onMouseDown={(e) => handleResizeStart(e, column.key)}
                    aria-hidden="true"
                    title="拖拽调整列宽"
                  />
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={String(row[rowKey])}>
              {columns.map((column) => {
                const value = column.dataIndex ? row[column.dataIndex] : undefined;

                return (
                  <td
                    key={column.key}
                    style={{
                      textAlign: column.align as CSSProperties['textAlign'],
                      width: columnWidths[column.key] ?? column.width,
                    }}
                  >
                    {column.render ? column.render(value, row, index) : String(value ?? '-')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <ArcoPagination
      current={page}
      total={totalPages}
      pageSize={1}
      onChange={(current) => onPageChange(current)}
      size="small"
      hideOnSinglePage
    />
  );
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  statusText,
}: SwitchProps) {
  const control = (
    <ArcoSwitch checked={checked} onChange={onChange} disabled={disabled} />
  );

  if (!label && !description && !statusText) {
    return control;
  }

  return (
    <div className="switch-row">
      <div>
        {label ? <div className="switch-label">{label}</div> : null}
        {description ? <div className="switch-description">{description}</div> : null}
      </div>
      <div className="switch-side">
        {statusText ? <span className="subtle-text">{statusText}</span> : null}
        {control}
      </div>
    </div>
  );
}

export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <ArcoCheckbox checked={checked} onChange={onChange}>
      {children}
    </ArcoCheckbox>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className = '',
  ...rest
}: {
  label?: string;
  hint?: string;
  error?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldClass = `field ${error ? 'is-error' : ''} ${className}`.trim();

  // Arco Input.TextArea 的 onChange 签名为 (value: string, e) => void，需适配原生 (e) => void
  const { onChange: nativeOnChange, value, ...textAreaProps } = rest as any;
  const handleArcoChange = nativeOnChange
    ? (val: string) => nativeOnChange({ target: { value: val } } as React.ChangeEvent<HTMLTextAreaElement>)
    : undefined;

  return (
    <label className={fieldClass}>
      {label ? <span className="field-label">{label}</span> : null}
      <Input.TextArea value={value} onChange={handleArcoChange} {...textAreaProps} />
      {error ? <span className="field-error">{error}</span> : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export const validators = {
  required: (message = '此项为必填') => (value: any): string | null => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return message;
    }
    return null;
  },

  minLength: (min: number, message?: string) => (value: any): string | null => {
    if (!value && value !== 0) return null;
    const str = String(value);
    if (str.length < min) {
      return message || `最少需要 ${min} 个字符`;
    }
    return null;
  },

  maxLength: (max: number, message?: string) => (value: any): string | null => {
    if (!value && value !== 0) return null;
    const str = String(value);
    if (str.length > max) {
      return message || `最多允许 ${max} 个字符`;
    }
    return null;
  },

  min: (minValue: number, message?: string) => (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return null;
    if (num < minValue) {
      return message || `不能小于 ${minValue}`;
    }
    return null;
  },

  max: (maxValue: number, message?: string) => (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num)) return null;
    if (num > maxValue) {
      return message || `不能大于 ${maxValue}`;
    }
    return null;
  },

  email: (message = '请输入有效的邮箱地址') => (value: any): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(value))) {
      return message;
    }
    return null;
  },

  pattern: (regex: RegExp, message = '格式不正确') => (value: any): string | null => {
    if (!value) return null;
    if (!regex.test(String(value))) {
      return message;
    }
    return null;
  },

  number: (message = '请输入有效的数字') => (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (isNaN(Number(value))) {
      return message;
    }
    return null;
  },

  positiveNumber: (message = '请输入正数') => (value: any): string | null => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      return message;
    }
    return null;
  },
};

type Validator = (value: any) => string | null;
type ValidationRules<T> = Partial<Record<keyof T, Validator[]>>;
type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules<T>,
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (name: keyof T, value: any): string | null => {
      const fieldRules = rules[name];
      if (!fieldRules) return null;

      for (const rule of fieldRules) {
        const error = rule(value);
        if (error) return error;
      }
      return null;
    },
    [rules],
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: ValidationErrors<T> = {};
    let isValid = true;

    (Object.keys(rules) as Array<keyof T>).forEach((key) => {
      const error = validateField(key, values[key]);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(
      Object.keys(rules).reduce((acc, key) => {
        acc[key as keyof T] = true;
        return acc;
      }, {} as Partial<Record<keyof T, boolean>>),
    );

    return isValid;
  }, [rules, values, validateField]);

  const handleChange = useCallback(
    (name: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [name]: value } as T));

      if (touched[name]) {
        const error = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: error ?? undefined }));
      }
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (name: keyof T) => () => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      const error = validateField(name, values[name]);
      setErrors((prev) => ({ ...prev, [name]: error ?? undefined }));
    },
    [validateField, values],
  );

  const setFieldValue = useCallback(
    (name: keyof T, value: any) => {
      setValues((prev) => ({ ...prev, [name]: value } as T));
      if (touched[name]) {
        const error = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: error ?? undefined }));
      }
    },
    [touched, validateField],
  );

  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setErrors((prev) => ({ ...prev, [name]: error ?? undefined }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const isValid = useMemo(() => {
    return (Object.keys(rules) as Array<keyof T>).every((key) => {
      return validateField(key, values[key]) === null;
    });
  }, [rules, values, validateField]);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setIsSubmitting,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    validateField,
    validateAll,
    resetForm,
    setValues,
  };
}

export function useToastState() {
  const showToast = useCallback((
    message: string,
    type: ToastState['type'] = 'success',
    options?: { detail?: string; duration?: number },
  ) => {
    const duration = options?.duration ?? (type === 'error' ? 4000 : 2800);
    const typeMap: Record<string, 'success' | 'info' | 'warning' | 'error' | 'normal'> = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };
    Message[typeMap[type] ?? 'info']({ content: message, duration });
  }, []);

  const hideToast = useCallback(() => {
    Message.clear();
  }, []);

  return { toast: null, showToast, hideToast };
}
