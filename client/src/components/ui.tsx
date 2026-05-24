import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect, useState } from 'react';

import type { TabOption, TableColumn } from '../types/ui';

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-fill';

interface ToastState {
  message: string;
  type?: 'success' | 'error';
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
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
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

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`toast ${toast.type === 'error' ? 'is-error' : 'is-success'}`}>
      <strong>{toast.type === 'error' ? '操作提示' : '保存成功'}</strong>
      <span>{toast.message}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, width = 560, footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-panel" style={{ width }}>
        {title ? <h3 className="modal-title">{title}</h3> : null}
        <div>{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function DeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children?: ReactNode;
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
          <Btn tone="danger-fill" onClick={onConfirm}>确认删除</Btn>
        </>
      )}
    >
      <p className="subtle-text">{children ?? '该操作不可恢复，请确认是否继续。'}</p>
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

export function Field({ label, hint, ...rest }: FieldProps) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <input {...rest} />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({ label, hint, children, className = '', ...rest }: SelectFieldProps) {
  return (
    <label className="field">
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
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Tag({
  children,
  tone = 'default',
}: PropsWithChildren<{ tone?: 'default' | 'green' | 'orange' | 'blue' | 'red' }>) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  emptyText = '暂无数据',
}: {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  emptyText?: ReactNode;
}) {
  if (!data.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="table-wrap">
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
  ...rest
}: {
  label?: string;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <textarea {...rest} />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function useToastState() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  };

  return { toast, showToast };
}
