import type { CSSProperties, ReactNode } from 'react';

export interface TabOption {
  value: string;
  label: ReactNode;
}

export interface TableColumn<T> {
  key: string;
  title: ReactNode;
  dataIndex?: keyof T;
  width?: number | string;
  align?: CSSProperties['textAlign'];
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

export interface DateShortcutOption {
  label: string;
  value: string;
}

interface DateFieldBaseProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 兼容性属性，原生输入框忽略 */
  clearable?: boolean;
  /** 兼容性属性，原生输入框忽略 */
  popoverStrategy?: 'floating' | 'inline';
}

export interface DatePickerFieldProps extends DateFieldBaseProps {
  minValue?: string;
  maxValue?: string;
  /** 兼容性属性，原生输入框忽略 */
  disabledDates?: unknown;
}

export interface MonthPickerFieldProps extends DateFieldBaseProps {
  minValue?: string;
  maxValue?: string;
  /** 兼容性属性，原生输入框忽略 */
  isMonthDisabled?: (value: string) => boolean;
}

export interface DateTimePickerFieldProps extends DateFieldBaseProps {
  /** 兼容性属性，原生输入框忽略 */
  minuteStep?: 15 | 30;
  minValue?: string;
  maxValue?: string;
  /** 兼容性属性，原生输入框忽略 */
  disabledDates?: unknown;
  /** 兼容性属性，原生输入框忽略 */
  shortcutOptions?: DateShortcutOption[];
}
