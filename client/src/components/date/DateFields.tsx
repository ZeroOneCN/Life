import { useCallback } from 'react';
import { DatePicker } from '@arco-design/web-react';
import dayjs from 'dayjs';

import type {
  DatePickerFieldProps,
  DateTimePickerFieldProps,
  MonthPickerFieldProps,
} from '../../types/ui';

/**
 * 统一日期选择器字段
 * 使用 Arco Design DatePicker 提供跨浏览器一致的日期选择体验
 */
export function DatePickerField({
  value,
  onChange,
  label,
  hint,
  placeholder = '请选择日期',
  disabled = false,
  minValue,
  maxValue,
  clearable = true,
  error,
}: DatePickerFieldProps & { error?: string }) {
  const disabledDate = useCallback((current: dayjs.Dayjs) => {
    if (minValue && current.isBefore(dayjs(minValue), 'day')) return true;
    if (maxValue && current.isAfter(dayjs(maxValue), 'day')) return true;
    return false;
  }, [minValue, maxValue]);

  const handleChange = useCallback((dateString: string) => {
    onChange(dateString || '');
  }, [onChange]);

  return (
    <div className={`field date-picker-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`}>
      {label ? <label className="field-label">{label}</label> : null}
      <DatePicker
        value={value || undefined}
        onChange={handleChange}
        format="YYYY-MM-DD"
        placeholder={placeholder}
        disabled={disabled}
        disabledDate={disabledDate}
        allowClear={clearable}
        style={{ width: '100%' }}
      />
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

/**
 * 统一月份选择器字段
 * 使用 Arco Design MonthPicker 提供跨浏览器一致的体验
 */
export function MonthPickerField({
  value,
  onChange,
  label,
  hint,
  placeholder = '请选择月份',
  disabled = false,
  minValue,
  maxValue,
  clearable = true,
  error,
}: MonthPickerFieldProps & { error?: string }) {
  const disabledDate = useCallback((current: dayjs.Dayjs) => {
    if (minValue && current.isBefore(dayjs(minValue), 'month')) return true;
    if (maxValue && current.isAfter(dayjs(maxValue), 'month')) return true;
    return false;
  }, [minValue, maxValue]);

  const handleChange = useCallback((dateString: string) => {
    onChange(dateString || '');
  }, [onChange]);

  return (
    <div className={`field date-picker-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`}>
      {label ? <label className="field-label">{label}</label> : null}
      <DatePicker.MonthPicker
        value={value || undefined}
        onChange={handleChange}
        format="YYYY-MM"
        placeholder={placeholder}
        disabled={disabled}
        disabledDate={disabledDate}
        allowClear={clearable}
        style={{ width: '100%' }}
      />
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

/**
 * 统一日期时间选择器字段
 * 使用 Arco Design DatePicker + showTime 提供日期时间选择
 */
export function DateTimePickerField({
  value,
  onChange,
  label,
  hint,
  placeholder = '请选择日期和时间',
  disabled = false,
  minValue,
  maxValue,
  clearable = true,
  error,
}: DateTimePickerFieldProps & { error?: string }) {
  const disabledDate = useCallback((current: dayjs.Dayjs) => {
    if (minValue && current.isBefore(dayjs(minValue), 'day')) return true;
    if (maxValue && current.isAfter(dayjs(maxValue), 'day')) return true;
    return false;
  }, [minValue, maxValue]);

  const handleChange = useCallback((dateString: string) => {
    // Arco 返回格式为 "YYYY-MM-DD HH:mm"，转换为业务使用的 "YYYY-MM-DDTHH:mm"
    const converted = dateString ? dateString.replace(' ', 'T') : '';
    onChange(converted);
  }, [onChange]);

  return (
    <div className={`field date-picker-field datetime-picker-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`}>
      {label ? <label className="field-label">{label}</label> : null}
      <DatePicker
        value={value ? value.replace('T', ' ') : undefined}
        onChange={handleChange}
        format="YYYY-MM-DD HH:mm"
        placeholder={placeholder}
        disabled={disabled}
        disabledDate={disabledDate}
        allowClear={clearable}
        showTime={{ defaultValue: dayjs('00:00', 'HH:mm') }}
        style={{ width: '100%' }}
      />
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

/**
 * 日期范围选择器组件
 * 使用 Arco Design RangePicker，提供快捷日期选项
 */
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = '选择日期范围',
  disabled = false,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const handleChange = useCallback((dateString: string[]) => {
    onChange(dateString?.[0] || '', dateString?.[1] || '');
  }, [onChange]);

  const rangeValue = startDate || endDate
    ? ([startDate || undefined, endDate || undefined]).filter(Boolean) as [string, string] | undefined
    : undefined;

  return (
    <div className="date-range-picker">
      <DatePicker.RangePicker
        value={rangeValue}
        onChange={handleChange}
        format="YYYY-MM-DD"
        placeholder={[placeholder, placeholder]}
        disabled={disabled}
        allowClear
        style={{ width: '100%' }}
      />
    </div>
  );
}