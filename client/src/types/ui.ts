import type { CSSProperties, ReactNode } from 'react';
import type { Matcher } from 'react-day-picker';

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

export type CalendarTone = 'default';

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
  clearable?: boolean;
  tone?: CalendarTone;
  popoverStrategy?: 'floating' | 'inline';
}

export interface DatePickerFieldProps extends DateFieldBaseProps {
  minValue?: string;
  maxValue?: string;
  disabledDates?: Matcher | Matcher[];
}

export interface MonthPickerFieldProps extends DateFieldBaseProps {
  minValue?: string;
  maxValue?: string;
  isMonthDisabled?: (value: string) => boolean;
}

export interface DateTimePickerFieldProps extends DateFieldBaseProps {
  minuteStep?: 15 | 30;
  minValue?: string;
  maxValue?: string;
  disabledDates?: Matcher | Matcher[];
  shortcutOptions?: DateShortcutOption[];
}
