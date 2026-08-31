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
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import {
  Button,
  Dropdown,
  Input,
  Message,
  Modal as ArcoModal,
  Pagination as ArcoPagination,
  Select,
  Skeleton as ArcoSkeleton,
  Space,
  Switch as ArcoSwitch,
  Checkbox as ArcoCheckbox,
  Table as ArcoTable,
  Tabs,
  Tag as ArcoTag,
  Typography,
} from '@arco-design/web-react';
import { IconEdit, IconDelete, IconEye, IconSearch, IconExport } from '@arco-design/web-react/icon';
import type { TabOption, TableColumn } from '../types/ui';

const { Text } = Typography;

export { useUndo } from '../hooks/useUndo';

export function useFormKeyboardSubmit(onSubmit: () => void, enabled = true) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.isDefaultPrevented()) {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'textarea') return;
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit, enabled],
  );

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

export function Toast({ toast }: { toast: ToastState | null }) {
  // 已迁移至 Arco Message，保留空组件以兼容业务代码
  return null;
}

/** Arco Skeleton 骨架屏 */
export function Skeleton({ lines = 3, width }: { lines?: number; width?: string | number }) {
  return (
    <div style={{ width: typeof width === 'number' ? `${width}px` : (width ?? '100%') }}>
      <ArcoSkeleton text={{ rows: lines }} />
    </div>
  );
}

/** 统计指标骨架屏 */
export function StatGridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          style={{ flex: 1, padding: 16, background: 'var(--color-fill-2)', borderRadius: 8 }}
        >
          <ArcoSkeleton text={{ rows: 2 }} />
        </div>
      ))}
    </div>
  );
}

/** 表格骨架屏 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <ArcoSkeleton text={{ rows: rows + 1 }} />
    </div>
  );
}

/** 卡片骨架屏 */
export function CardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div style={{ height, padding: 20, background: 'var(--color-fill-2)', borderRadius: 8 }}>
      <ArcoSkeleton text={{ rows: 4 }} />
    </div>
  );
}

/**
 * 页面加载状态 — 使用 Arco Spin。
 * 统一放置于页面加载时展示。
 */
export function PageLoading({ tip = '加载中...' }: { tip?: string }) {
  return (
    <div className="page-loading" role="status" aria-label={tip}>
      <div className="page-loading-spinner" aria-hidden="true" />
      <span className="page-loading-tip">{tip}</span>
    </div>
  );
}

/**
 * 搜索输入框 — 使用 Arco Input.Search。
 */
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
  return (
    <Input.Search
      value={value}
      onChange={(val) => onChange(val)}
      onClear={() => {
        if (onClear) onClear();
        else onChange('');
      }}
      placeholder={placeholder}
      disabled={disabled}
      allowClear
      style={{ width: '100%' }}
    />
  );
}

/**
 * 筛选栏 — 使用 Arco Space。
 * 横向排列筛选控件，右侧可选操作按钮。
 */
export function FilterBar({
  children,
  rightSlot,
}: {
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div
      className="filter-bar"
      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}
    >
      <Space size="small" wrap style={{ flex: 1 }}>
        {children}
      </Space>
      {rightSlot ? <div>{rightSlot}</div> : null}
    </div>
  );
}

/**
 * 筛选标签 — 使用 Arco Tag。
 * 可点击的筛选标签，支持激活态和计数。
 */
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
    <ArcoTag
      color={active ? 'arcoblue' : undefined}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      {label}
      {count !== undefined ? <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span> : null}
    </ArcoTag>
  );
}

/**
 * 导出按钮 — 使用 Arco Dropdown + Button。
 */
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
  const defaultOptions = options ?? [
    { value: 'csv', label: '导出 CSV' },
    { value: 'excel', label: '导出 Excel' },
    { value: 'json', label: '导出 JSON' },
  ];

  const dropList = (
    <div
      style={{
        background: 'var(--color-bg-1)',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      {defaultOptions.map((option) => (
        <div
          key={option.value}
          onClick={() => onExport(option.value)}
          style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-fill-2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {option.label}
        </div>
      ))}
    </div>
  );

  return (
    <Dropdown droplist={dropList} disabled={disabled} position="br">
      <Button type="secondary" disabled={disabled}>
        <IconExport style={{ marginRight: 4 }} />
        {label}
      </Button>
    </Dropdown>
  );
}

type TrendDirection = 'up' | 'down' | 'flat';

/** 趋势箭头 — 使用 Arco Tag。 */
export function TrendArrow({ direction, value }: { direction: TrendDirection; value?: string }) {
  const colorMap: Record<TrendDirection, 'red' | 'green' | 'default'> = {
    up: 'red',
    down: 'green',
    flat: 'default',
  };
  const symbolMap: Record<TrendDirection, string> = {
    up: '↑',
    down: '↓',
    flat: '→',
  };
  return (
    <ArcoTag color={colorMap[direction]} size="small">
      {symbolMap[direction]}
      {value ? <span style={{ marginLeft: 2 }}>{value}</span> : null}
    </ArcoTag>
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
      footer={
        <>
          <Btn tone="secondary" onClick={onClose}>
            取消
          </Btn>
          <Btn ref={confirmRef} tone={confirmTone} onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <p className="subtle-text">{children ?? '这个操作不可恢复，请确认是否继续。'}</p>
    </Modal>
  );
}

export const Btn = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonProps>>(function Btn(
  { tone = 'secondary', className = '', children, loading, disabled, type: htmlType, ...rest },
  ref,
) {
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
      htmlType={htmlType}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </Button>
  );
});

/** 编辑图标 — 使用 Arco IconEdit */
export const EditIcon = ({ size = 16 }: { size?: number }) => (
  <IconEdit style={{ fontSize: size }} />
);

/** 删除图标 — 使用 Arco IconDelete */
export const DeleteIcon = ({ size = 16 }: { size?: number }) => (
  <IconDelete style={{ fontSize: size }} />
);

/** 查看图标 — 使用 Arco IconEye */
export const EyeIcon = ({ size = 16 }: { size?: number }) => <IconEye style={{ fontSize: size }} />;

/**
 * 图标按钮 — 使用 Arco Button。
 * 统一用于列表行操作（编辑/删除/查看），支持 tooltip 提示。
 */
export function IconBtn({
  tone = 'secondary',
  className = '',
  icon,
  title,
  size = 16,
  ...rest
}: ButtonProps & { icon: React.ReactNode; title: string; size?: number }) {
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
      type={typeMap[tone] ?? 'secondary'}
      status={statusMap[tone]}
      className={className}
      icon={icon}
      title={title}
      aria-label={title}
      size="small"
      {...(rest as Record<string, unknown>)}
    />
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
    <Tabs activeTab={value} onChange={onChange} type="capsule" size="small">
      {options.map((option) => (
        <Tabs.TabPane key={option.value} title={option.label} />
      ))}
    </Tabs>
  );
}

/**
 * 表单字段 — 使用 Arco Form.Item 风格的布局。
 * 保持现有 API 兼容，内部使用 Arco 样式 token。
 */
export function Field({ label, hint, error, children, className = '', ...rest }: FieldProps) {
  const fieldClass = `field ${error ? 'is-error' : ''} ${className}`.trim();

  if (children) {
    return (
      <div className={fieldClass} style={{ marginBottom: 16 }}>
        {label ? (
          <Text
            style={{
              display: 'block',
              marginBottom: 4,
              fontSize: 13,
              color: 'var(--color-text-2)',
            }}
          >
            {label}
          </Text>
        ) : null}
        {children}
        {error ? (
          <Text type="error" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            {error}
          </Text>
        ) : null}
        {hint && !error ? (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            {hint}
          </Text>
        ) : null}
      </div>
    );
  }

  // Arco Input 的 onChange 签名为 (value: string, e) => void，需适配原生 (e) => void
  const { onChange: nativeOnChange, value, ...inputProps } = rest as any;
  const handleArcoChange = nativeOnChange
    ? (val: string) =>
        nativeOnChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>)
    : undefined;

  return (
    <div className={fieldClass} style={{ marginBottom: 16 }}>
      {label ? (
        <Text
          style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--color-text-2)' }}
        >
          {label}
        </Text>
      ) : null}
      <Input value={value} onChange={handleArcoChange} {...inputProps} style={{ width: '100%' }} />
      {error ? (
        <Text type="error" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {error}
        </Text>
      ) : null}
      {hint && !error ? (
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  className = '',
  value,
  onChange,
  disabled,
  name,
  required,
  ...rest
}: SelectFieldProps) {
  // 将 native <option> 子元素转换为 Arco Select.Option
  const options = useMemo(() => {
    const opts: ReactNode[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === 'option') {
        const {
          value: optionValue,
          children: optionChildren,
          disabled: optionDisabled,
        } = child.props;
        opts.push(
          <Select.Option key={String(optionValue)} value={optionValue} disabled={optionDisabled}>
            {optionChildren}
          </Select.Option>,
        );
      }
    });
    return opts;
  }, [children]);

  return (
    <div className={className} style={{ marginBottom: 16 }}>
      {label ? (
        <Text
          style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--color-text-2)' }}
        >
          {label}
        </Text>
      ) : null}
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
        style={{ width: '100%' }}
      >
        {options}
      </Select>
      {error ? (
        <Text type="error" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {error}
        </Text>
      ) : null}
      {hint && !error ? (
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

// 重新导出 Arco Select 的 Option 子组件
export { Select } from '@arco-design/web-react';

export function Tag({
  children,
  tone = 'default',
  size = 'md',
}: PropsWithChildren<{
  tone?: 'default' | 'pink' | 'green' | 'orange' | 'blue' | 'red';
  size?: 'sm' | 'md';
}>) {
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

/** 兼容性：将 CSSProperties['textAlign'] 映射为 Arco Table 支持的 "center" | "left" | "right" */
function mapAlign(
  align: CSSProperties['textAlign'] | undefined,
): 'center' | 'left' | 'right' | undefined {
  if (align === 'center' || align === 'left' || align === 'right') return align;
  return undefined;
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
  const arcoColumns = useMemo(
    () =>
      columns.map((col) => ({
        title: col.title,
        dataIndex: col.dataIndex as string,
        key: col.key,
        width: col.width,
        align: mapAlign(col.align),
        render: col.render
          ? (value: unknown, row: T, index: number) => col.render!(value, row, index)
          : undefined,
      })),
    [columns],
  );

  return (
    <div className={className}>
      <ArcoTable
        columns={arcoColumns}
        data={data}
        rowKey={rowKey as string}
        noDataElement={emptyText}
        pagination={false}
        border={false}
        stripe={false}
        size="small"
        tableLayoutFixed
      />
    </div>
  );
}

export const Pagination = memo(function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
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
});

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  statusText,
}: SwitchProps) {
  const control = <ArcoSwitch checked={checked} onChange={onChange} disabled={disabled} />;

  if (!label && !description && !statusText) {
    return control;
  }

  return (
    <div
      className="switch-row"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <div>
        {label ? (
          <div className="switch-label" style={{ fontWeight: 500 }}>
            {label}
          </div>
        ) : null}
        {description ? (
          <div
            className="switch-description"
            style={{ fontSize: 13, color: 'var(--color-text-3)' }}
          >
            {description}
          </div>
        ) : null}
      </div>
      <div className="switch-side" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {statusText ? (
          <span className="subtle-text" style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
            {statusText}
          </span>
        ) : null}
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
  // Arco Input.TextArea 的 onChange 签名为 (value: string, e) => void，需适配原生 (e) => void
  const { onChange: nativeOnChange, value, ...textAreaProps } = rest as any;
  const handleArcoChange = nativeOnChange
    ? (val: string) =>
        nativeOnChange({ target: { value: val } } as React.ChangeEvent<HTMLTextAreaElement>)
    : undefined;

  return (
    <div className={className} style={{ marginBottom: 16 }}>
      {label ? (
        <Text
          style={{ display: 'block', marginBottom: 4, fontSize: 13, color: 'var(--color-text-2)' }}
        >
          {label}
        </Text>
      ) : null}
      <Input.TextArea
        value={value}
        onChange={handleArcoChange}
        {...textAreaProps}
        style={{ width: '100%' }}
      />
      {error ? (
        <Text type="error" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {error}
        </Text>
      ) : null}
      {hint && !error ? (
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

export const validators = {
  required:
    (message = '此项为必填') =>
    (value: any): string | null => {
      if (value === null || value === undefined || value === '') {
        return message;
      }
      if (typeof value === 'string' && value.trim() === '') {
        return message;
      }
      return null;
    },

  minLength:
    (min: number, message?: string) =>
    (value: any): string | null => {
      if (!value && value !== 0) return null;
      const str = String(value);
      if (str.length < min) {
        return message || `最少需要 ${min} 个字符`;
      }
      return null;
    },

  maxLength:
    (max: number, message?: string) =>
    (value: any): string | null => {
      if (!value && value !== 0) return null;
      const str = String(value);
      if (str.length > max) {
        return message || `最多允许 ${max} 个字符`;
      }
      return null;
    },

  min:
    (minValue: number, message?: string) =>
    (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      if (isNaN(num)) return null;
      if (num < minValue) {
        return message || `不能小于 ${minValue}`;
      }
      return null;
    },

  max:
    (maxValue: number, message?: string) =>
    (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      if (isNaN(num)) return null;
      if (num > maxValue) {
        return message || `不能大于 ${maxValue}`;
      }
      return null;
    },

  email:
    (message = '请输入有效的邮箱地址') =>
    (value: any): string | null => {
      if (!value) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return message;
      }
      return null;
    },

  pattern:
    (regex: RegExp, message = '格式不正确') =>
    (value: any): string | null => {
      if (!value) return null;
      if (!regex.test(String(value))) {
        return message;
      }
      return null;
    },

  number:
    (message = '请输入有效的数字') =>
    (value: any): string | null => {
      if (value === null || value === undefined || value === '') return null;
      if (isNaN(Number(value))) {
        return message;
      }
      return null;
    },

  positiveNumber:
    (message = '请输入正数') =>
    (value: any): string | null => {
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
      Object.keys(rules).reduce(
        (acc, key) => {
          acc[key as keyof T] = true;
          return acc;
        },
        {} as Partial<Record<keyof T, boolean>>,
      ),
    );

    return isValid;
  }, [rules, values, validateField]);

  const handleChange = useCallback(
    (name: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setValues((prev) => ({ ...prev, [name]: value }) as T);

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
      setValues((prev) => ({ ...prev, [name]: value }) as T);
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
  const showToast = useCallback(
    (
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
    },
    [],
  );

  const hideToast = useCallback(() => {
    Message.clear();
  }, []);

  return { toast: null, showToast, hideToast };
}
