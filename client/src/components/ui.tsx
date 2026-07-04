import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { TabOption, TableColumn } from '../types/ui';

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-fill';

interface ToastState {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  detail?: string;
  duration?: number;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
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
  const [showDetail, setShowDetail] = useState(false);

  if (!toast) {
    return null;
  }

  const type = toast.type ?? 'success';
  const typeClass = `is-${type}`;
  const label = TOAST_LABELS[type];
  const icon = TOAST_ICONS[type];

  return (
    <div className={`toast ${typeClass}`}>
      <div className="toast-icon" aria-hidden="true">{icon}</div>
      <div className="toast-content">
        <strong className="toast-title">{label}</strong>
        <span className="toast-message">{toast.message}</span>
        {toast.detail ? (
          <>
            <button
              type="button"
              className="toast-detail-toggle"
              onClick={() => setShowDetail((v) => !v)}
            >
              {showDetail ? '收起详情' : '查看详情'}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                style={{ transform: showDetail ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {showDetail ? <span className="toast-detail">{toast.detail}</span> : null}
          </>
        ) : null}
      </div>
    </div>
  );
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

export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state-enhanced">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description ? <p className="empty-state-desc">{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="btn-primary empty-state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
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
        className="btn-secondary export-button"
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    overlayRef.current?.focus();

    // 计算当前滚动条宽度，用于补偿 overflow:hidden 导致的布局偏移
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlPaddingRight = document.documentElement.style.paddingRight;

    // 锁定滚动 + 补偿滚动条宽度防止闪屏
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.paddingRight = previousHtmlPaddingRight;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      tabIndex={-1}
    >
      <div className="modal-panel" style={{ width }}>
        {(title || true) && (
          <div className="modal-header">
            {title ? <h3 id={titleId} className="modal-title">{title}</h3> : <span />}
            <button
              type="button"
              className="modal-close"
              aria-label="关闭弹窗"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={460}
      footer={(
        <>
          <Btn tone="secondary" onClick={onClose}>取消</Btn>
          <Btn tone={confirmTone} onClick={onConfirm}>{confirmLabel}</Btn>
        </>
      )}
    >
      <p className="subtle-text">{children ?? '这个操作不可恢复，请确认是否继续。'}</p>
    </Modal>
  );
}

export function Btn({
  tone = 'secondary',
  className = '',
  children,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  return (
    <button className={`btn btn-${tone} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

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
    <div className="tab-bar">
      {options.map((option) => (
        <button
          key={option.value}
          className={`tab ${option.value === value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children, className = '', ...rest }: FieldProps) {
  const fieldClass = `field ${error ? 'is-error' : ''} ${className}`.trim();

  return (
    <label className={fieldClass}>
      {label ? <span className="field-label">{label}</span> : null}
      {children ?? <input {...rest} />}
      {error ? <span className="field-error">{error}</span> : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({ label, hint, error, children, className = '', ...rest }: SelectFieldProps) {
  const fieldClass = `field ${error ? 'is-error' : ''}`.trim();

  return (
    <label className={fieldClass}>
      {label ? <span className="field-label">{label}</span> : null}
      <div className="field-control field-control-select">
        <select className={`select-themed ${className}`.trim()} {...rest}>
          {children}
        </select>
        <span className="field-control-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Tag({
  children,
  tone = 'default',
  size = 'md',
}: PropsWithChildren<{ tone?: 'default' | 'pink' | 'green' | 'orange' | 'blue' | 'red'; size?: 'sm' | 'md' }>) {
  return <span className={`tag tag-${tone}${size === 'sm' ? ' tag-sm' : ''}`}>{children}</span>;
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  emptyText = '暂无数据',
  className,
}: {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  emptyText?: ReactNode;
  className?: string;
}) {
  if (!data.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className={`table-wrap${className ? ` ${className}` : ''}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width,
                  textAlign: column.align,
                }}
              >
                {column.title}
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
                    style={{ textAlign: column.align as CSSProperties['textAlign'] }}
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
    <div className="pagination">
      <Btn tone="secondary" disabled={page === 1} onClick={() => onPageChange(1)}>首页</Btn>
      <Btn tone="secondary" disabled={page === 1} onClick={() => onPageChange(page - 1)}>上一页</Btn>
      <span className="subtle-text">第 {page} / {totalPages} 页</span>
      <Btn tone="secondary" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>下一页</Btn>
      <Btn tone="secondary" disabled={page === totalPages} onClick={() => onPageChange(totalPages)}>末页</Btn>
    </div>
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
    <label className={`switch ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" />
      <span className="switch-knob" />
    </label>
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
    <label className="checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
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

  return (
    <label className={fieldClass}>
      {label ? <span className="field-label">{label}</span> : null}
      <textarea {...rest} />
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const showToast = useCallback((
    message: string,
    type: ToastState['type'] = 'success',
    options?: { detail?: string; duration?: number },
  ) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    const duration = options?.duration ?? (type === 'error' ? 4000 : 2800);
    setToast({ message, type, detail: options?.detail, duration });
    timerRef.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}
