import { useId, useRef, useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import dayjs from 'dayjs';
import 'react-day-picker/dist/style.css';

import type {
  DatePickerFieldProps,
  DateTimePickerFieldProps,
  MonthPickerFieldProps,
} from '../../types/ui';
import { useTheme } from '../../hooks/useTheme';

/**
 * 统一日期选择器字段
 * 使用 react-day-picker 提供跨浏览器一致的日期选择体验
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
  const fieldId = useId();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? dayjs(value).toDate() : undefined;
  const minDate = minValue ? dayjs(minValue).toDate() : undefined;
  const maxDate = maxValue ? dayjs(maxValue).toDate() : undefined;

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

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(dayjs(date).format('YYYY-MM-DD'));
    } else {
      onChange('');
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const displayValue = value ? dayjs(value).format('YYYY-MM-DD') : '';

  return (
    <div className={`field date-picker-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`} ref={containerRef}>
      {label ? <label className="field-label" htmlFor={fieldId}>{label}</label> : null}
      <div
        className={`date-picker-input ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="date-picker-calendar-icon" aria-hidden="true">📅</span>
        <input
          id={fieldId}
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          className="date-picker-input-field"
        />
        {clearable && value && !disabled ? (
          <button
            type="button"
            className="date-picker-clear-btn"
            onClick={handleClear}
            aria-label="清除日期"
          >
            ×
          </button>
        ) : null}
      </div>
      {isOpen && !disabled ? (
        <div className={`date-picker-popover ${isDark ? 'rdp-dark' : ''}`}>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={disabled ? true : undefined}
            fromDate={minDate}
            toDate={maxDate}
            weekStartsOn={1}
          />
        </div>
      ) : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

/**
 * 统一月份选择器字段
 * 使用自定义月份选择面板提供跨浏览器一致的体验
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
  const fieldId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value ? dayjs(value).year() : dayjs().year());
  const containerRef = useRef<HTMLDivElement>(null);

  const minYear = minValue ? dayjs(minValue).year() : undefined;
  const maxYear = maxValue ? dayjs(maxValue).year() : undefined;
  const minMonth = minValue ? dayjs(minValue).month() : undefined;
  const maxMonth = maxValue ? dayjs(maxValue).month() : undefined;

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

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const isMonthDisabled = (year: number, monthIndex: number) => {
    if (minYear !== undefined && minMonth !== undefined) {
      if (year < minYear) return true;
      if (year === minYear && monthIndex < minMonth) return true;
    }
    if (maxYear !== undefined && maxMonth !== undefined) {
      if (year > maxYear) return true;
      if (year === maxYear && monthIndex > maxMonth) return true;
    }
    return false;
  };

  const handleMonthClick = (monthIndex: number) => {
    if (isMonthDisabled(viewYear, monthIndex)) return;
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const displayValue = value ? dayjs(value).format('YYYY-MM') : '';

  return (
    <div className={`field date-picker-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`} ref={containerRef}>
      {label ? <label className="field-label" htmlFor={fieldId}>{label}</label> : null}
      <div
        className={`date-picker-input ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="date-picker-calendar-icon" aria-hidden="true">📅</span>
        <input
          id={fieldId}
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          className="date-picker-input-field"
        />
        {clearable && value && !disabled ? (
          <button
            type="button"
            className="date-picker-clear-btn"
            onClick={handleClear}
            aria-label="清除月份"
          >
            ×
          </button>
        ) : null}
      </div>
      {isOpen && !disabled ? (
        <div className="date-picker-popover month-picker-popover">
          <div className="month-picker-header">
            <button
              type="button"
              className="month-picker-nav-btn"
              onClick={() => setViewYear((y) => y - 1)}
              disabled={minYear !== undefined && viewYear <= minYear}
            >
              ‹
            </button>
            <span className="month-picker-year">{viewYear}年</span>
            <button
              type="button"
              className="month-picker-nav-btn"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={maxYear !== undefined && viewYear >= maxYear}
            >
              ›
            </button>
          </div>
          <div className="month-picker-grid">
            {months.map((month, index) => {
              const isSelected = value && dayjs(value).year() === viewYear && dayjs(value).month() === index;
              const isDisabled = isMonthDisabled(viewYear, index);
              return (
                <button
                  key={month}
                  type="button"
                  className={`month-picker-item ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                  onClick={() => handleMonthClick(index)}
                  disabled={isDisabled}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

/**
 * 统一日期时间选择器字段
 * 日期使用自定义选择器，时间使用原生time输入
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
  const fieldId = useId();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const datePart = value ? value.split('T')[0] : '';
  const timePart = value ? value.split('T')[1] || '' : '';

  const selectedDate = datePart ? dayjs(datePart).toDate() : undefined;
  const minDate = minValue ? dayjs(minValue.split('T')[0]).toDate() : undefined;
  const maxDate = maxValue ? dayjs(maxValue.split('T')[0]).toDate() : undefined;

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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const newDate = dayjs(date).format('YYYY-MM-DD');
      const finalTime = timePart || '00:00';
      onChange(`${newDate}T${finalTime}`);
    }
    setIsOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    const finalDate = datePart || dayjs().format('YYYY-MM-DD');
    onChange(`${finalDate}T${newTime}`);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const displayValue = value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '';

  return (
    <div className={`field date-picker-field datetime-picker-field ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`} ref={containerRef}>
      {label ? <label className="field-label" htmlFor={fieldId}>{label}</label> : null}
      <div className="datetime-picker-row">
        <div
          className={`date-picker-input ${isOpen ? 'is-open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className="date-picker-calendar-icon" aria-hidden="true">📅</span>
          <input
            id={fieldId}
            type="text"
            readOnly
            value={datePart}
            placeholder="选择日期"
            disabled={disabled}
            className="date-picker-input-field"
          />
        </div>
        <div className="time-picker-input">
          <span className="date-picker-calendar-icon" aria-hidden="true">⏰</span>
          <input
            type="time"
            value={timePart}
            onChange={handleTimeChange}
            disabled={disabled}
            className="date-picker-input-field"
          />
        </div>
        {clearable && value && !disabled ? (
          <button
            type="button"
            className="date-picker-clear-btn datetime-clear-btn"
            onClick={handleClear}
            aria-label="清除日期时间"
          >
            ×
          </button>
        ) : null}
      </div>
      {isOpen && !disabled ? (
        <div className={`date-picker-popover ${isDark ? 'rdp-dark' : ''}`}>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={disabled ? true : undefined}
            fromDate={minDate}
            toDate={maxDate}
            weekStartsOn={1}
          />
        </div>
      ) : null}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

/**
 * 日期范围选择器组件
 * 用于筛选场景，提供快捷日期选项
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
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fromDate = startDate ? dayjs(startDate).toDate() : undefined;
  const toDate = endDate ? dayjs(endDate).toDate() : undefined;

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

  const handleQuickSelect = (days: number) => {
    const end = dayjs().format('YYYY-MM-DD');
    const start = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');
    onChange(start, end);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
  };

  const displayValue = startDate && endDate
    ? `${dayjs(startDate).format('MM/DD')} - ${dayjs(endDate).format('MM/DD')}`
    : '';

  return (
    <div className={`date-range-picker ${disabled ? 'is-disabled' : ''}`} ref={containerRef}>
      <div
        className={`date-picker-input ${isOpen ? 'is-open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="date-picker-calendar-icon" aria-hidden="true">📅</span>
        <input
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          className="date-picker-input-field"
        />
        {(startDate || endDate) && !disabled ? (
          <button
            type="button"
            className="date-picker-clear-btn"
            onClick={handleClear}
            aria-label="清除日期范围"
          >
            ×
          </button>
        ) : null}
      </div>
      {isOpen && !disabled ? (
        <div className={`date-picker-popover date-range-popover ${isDark ? 'rdp-dark' : ''}`}>
          <div className="date-range-shortcuts">
            <button type="button" onClick={() => handleQuickSelect(7)}>近7天</button>
            <button type="button" onClick={() => handleQuickSelect(30)}>近30天</button>
            <button type="button" onClick={() => handleQuickSelect(90)}>近90天</button>
            <button type="button" onClick={() => {
              const start = dayjs().startOf('month').format('YYYY-MM-DD');
              const end = dayjs().endOf('month').format('YYYY-MM-DD');
              onChange(start, end);
              setIsOpen(false);
            }}>本月</button>
          </div>
          <DayPicker
            selected={fromDate}
            onDayClick={(date) => {
              if (!startDate || endDate) {
                onChange(dayjs(date).format('YYYY-MM-DD'), '');
              } else {
                const start = dayjs(startDate).isBefore(date) ? startDate : dayjs(date).format('YYYY-MM-DD');
                const end = dayjs(startDate).isBefore(date) ? dayjs(date).format('YYYY-MM-DD') : startDate;
                onChange(start, end);
                setIsOpen(false);
              }
            }}
            weekStartsOn={1}
            numberOfMonths={2}
          />
        </div>
      ) : null}
    </div>
  );
}
