import { useId } from 'react';

import type {
  DatePickerFieldProps,
  DateTimePickerFieldProps,
  MonthPickerFieldProps,
} from '../../types/ui';

/**
 * 原生日期选择器字段
 * 使用 <input type="date"> 提供浏览器原生日期选择，配合主题样式
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
}: DatePickerFieldProps) {
  const fieldId = useId();

  return (
    <div className={`field date-native-field ${disabled ? 'is-disabled' : ''}`}>
      {label ? <label className="field-label" htmlFor={fieldId}>{label}</label> : null}
      <input
        id={fieldId}
        type="date"
        className="date-native-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={minValue}
        max={maxValue}
        placeholder={placeholder}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/**
 * 原生月份选择器字段
 * 使用 <input type="month"> 提供浏览器原生月份选择，配合主题样式
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
}: MonthPickerFieldProps) {
  const fieldId = useId();

  return (
    <div className={`field date-native-field ${disabled ? 'is-disabled' : ''}`}>
      {label ? <label className="field-label" htmlFor={fieldId}>{label}</label> : null}
      <input
        id={fieldId}
        type="month"
        className="date-native-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={minValue}
        max={maxValue}
        placeholder={placeholder}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/**
 * 原生日期时间选择器字段
 * 使用 <input type="datetime-local"> 提供浏览器原生日期时间选择，配合主题样式
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
}: DateTimePickerFieldProps) {
  const fieldId = useId();

  return (
    <div className={`field date-native-field ${disabled ? 'is-disabled' : ''}`}>
      {label ? <label className="field-label" htmlFor={fieldId}>{label}</label> : null}
      <input
        id={fieldId}
        type="datetime-local"
        className="date-native-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={minValue}
        max={maxValue}
        placeholder={placeholder}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
