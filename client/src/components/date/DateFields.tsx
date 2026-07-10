import { useId, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';

import type {
  DatePickerFieldProps,
  DateTimePickerFieldProps,
  MonthPickerFieldProps,
} from '../../types/ui';
import { useTheme } from '../../hooks/useTheme';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function usePopoverPosition(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement>,
  popoverRef: React.RefObject<HTMLElement>,
) {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    visibility: 'hidden',
    zIndex: 2000,
  });

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current || !popoverRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current || !popoverRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const popRect = popoverRef.current.getBoundingClientRect();

      const gap = 8;
      const margin = 8;

      let top = rect.bottom + gap;
      let left = rect.left;

      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;

      // 优先向下弹出，如果底部空间不足则向上
      if (top + popRect.height > viewportH - margin) {
        const topPos = rect.top - popRect.height - gap;
        if (topPos >= margin) {
          top = topPos;
        }
      }

      // 水平方向边界检测
      if (left + popRect.width > viewportW - margin) {
        left = viewportW - popRect.width - margin;
      }
      if (left < margin) left = margin;

      setStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        visibility: 'visible',
        zIndex: 2000,
      });
    };

    // 双重 RAF 确保布局完成后再定位
    let raf1 = 0;
    let raf2 = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(updatePosition);
    });

    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen, containerRef, popoverRef]);

  return style;
}

/**
 * 日历面板组件 - 纯dayjs实现，无第三方依赖
 * 提供跨浏览器一致的日期选择体验
 */
function CalendarPanel({
  selectedDate,
  viewMonth,
  onMonthChange,
  onDateSelect,
  minDate,
  maxDate,
}: {
  selectedDate?: Date;
  viewMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const startOfMonth = dayjs(viewMonth).startOf('month');
  const endOfMonth = dayjs(viewMonth).endOf('month');
  const startDay = startOfMonth.day();
  const startDayAdjusted = startDay === 0 ? 6 : startDay - 1;

  const daysInMonth = endOfMonth.date();
  const prevMonthDays = dayjs(viewMonth).subtract(1, 'month').daysInMonth();

  const cells: Array<{ date: dayjs.Dayjs; isCurrentMonth: boolean }> = [];

  for (let i = startDayAdjusted - 1; i >= 0; i--) {
    cells.push({
      date: dayjs(viewMonth).subtract(1, 'month').date(prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      date: dayjs(viewMonth).date(i),
      isCurrentMonth: true,
    });
  }

  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: dayjs(viewMonth).add(1, 'month').date(i),
      isCurrentMonth: false,
    });
  }

  const isDateDisabled = (date: dayjs.Dayjs) => {
    if (minDate && date.isBefore(dayjs(minDate).startOf('day'))) return true;
    if (maxDate && date.isAfter(dayjs(maxDate).endOf('day'))) return true;
    return false;
  };

  const isSelected = (date: dayjs.Dayjs) => {
    if (!selectedDate) return false;
    return date.isSame(dayjs(selectedDate), 'day');
  };

  const isToday = (date: dayjs.Dayjs) => {
    return date.isSame(dayjs(), 'day');
  };

  return (
    <div className="custom-calendar">
      <div className="custom-calendar-header">
        <button
          type="button"
          className="custom-calendar-nav"
          onClick={() => onMonthChange(dayjs(viewMonth).subtract(1, 'month').toDate())}
          aria-label="上个月"
        >
          ‹
        </button>
        <span className="custom-calendar-title">
          {dayjs(viewMonth).format('YYYY年 M月')}
        </span>
        <button
          type="button"
          className="custom-calendar-nav"
          onClick={() => onMonthChange(dayjs(viewMonth).add(1, 'month').toDate())}
          aria-label="下个月"
        >
          ›
        </button>
      </div>
      <div className="custom-calendar-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="custom-calendar-weekday">{d}</div>
        ))}
      </div>
      <div className="custom-calendar-grid">
        {cells.map(({ date, isCurrentMonth }, idx) => {
          const disabled = isDateDisabled(date);
          const selected = isSelected(date);
          const today = isToday(date);
          return (
            <button
              key={idx}
              type="button"
              className={`custom-calendar-day
                ${!isCurrentMonth ? 'is-outside' : ''}
                ${selected ? 'is-selected' : ''}
                ${today ? 'is-today' : ''}
                ${disabled ? 'is-disabled' : ''}`}
              onClick={() => !disabled && onDateSelect(date.toDate())}
              disabled={disabled}
            >
              {date.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 统一日期选择器字段
 * 使用自定义日历面板提供跨浏览器一致的日期选择体验
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
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    return value ? dayjs(value).toDate() : dayjs().toDate();
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const popoverStyle = usePopoverPosition(isOpen, containerRef, popoverRef);

  const selectedDate = value ? dayjs(value).toDate() : undefined;
  const minDate = minValue ? dayjs(minValue).toDate() : undefined;
  const maxDate = maxValue ? dayjs(maxValue).toDate() : undefined;

  useEffect(() => {
    if (value && isOpen) {
      setViewMonth(dayjs(value).toDate());
    }
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleTouchOutside = (event: TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, [isOpen]);

  const handleSelect = (date: Date) => {
    onChange(dayjs(date).format('YYYY-MM-DD'));
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
      {isOpen && !disabled && typeof document !== 'undefined'
        ? createPortal(
            <div ref={popoverRef} className={`date-picker-popover is-portal ${isDark ? 'is-dark' : ''}`} style={popoverStyle}>
              <CalendarPanel
                selectedDate={selectedDate}
                viewMonth={viewMonth}
                onMonthChange={setViewMonth}
                onDateSelect={handleSelect}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>,
            document.body,
          )
        : null}
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
  const popoverRef = useRef<HTMLDivElement>(null);

  const popoverStyle = usePopoverPosition(isOpen, containerRef, popoverRef);

  const minYear = minValue ? dayjs(minValue).year() : undefined;
  const maxYear = maxValue ? dayjs(maxValue).year() : undefined;
  const minMonth = minValue ? dayjs(minValue).month() : undefined;
  const maxMonth = maxValue ? dayjs(maxValue).month() : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleTouchOutside = (event: TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, [isOpen]);

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
      {isOpen && !disabled && typeof document !== 'undefined'
        ? createPortal(
            <div ref={popoverRef} className="date-picker-popover month-picker-popover is-portal" style={popoverStyle}>
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
                {MONTH_LABELS.map((month, index) => {
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
            </div>,
            document.body,
          )
        : null}
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
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const datePart = value ? value.split('T')[0] : '';
    return datePart ? dayjs(datePart).toDate() : dayjs().toDate();
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const popoverStyle = usePopoverPosition(isOpen, containerRef, popoverRef);

  const datePart = value ? value.split('T')[0] : '';
  const timePart = value ? value.split('T')[1] || '' : '';

  const selectedDate = datePart ? dayjs(datePart).toDate() : undefined;
  const minDate = minValue ? dayjs(minValue.split('T')[0]).toDate() : undefined;
  const maxDate = maxValue ? dayjs(maxValue.split('T')[0]).toDate() : undefined;

  useEffect(() => {
    if (datePart && isOpen) {
      setViewMonth(dayjs(datePart).toDate());
    }
  }, [datePart, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleTouchOutside = (event: TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
  }, [isOpen]);

  const handleDateSelect = (date: Date) => {
    const newDate = dayjs(date).format('YYYY-MM-DD');
    const finalTime = timePart || '00:00';
    onChange(`${newDate}T${finalTime}`);
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
      {isOpen && !disabled && typeof document !== 'undefined'
        ? createPortal(
            <div ref={popoverRef} className={`date-picker-popover is-portal ${isDark ? 'is-dark' : ''}`} style={popoverStyle}>
              <CalendarPanel
                selectedDate={selectedDate}
                viewMonth={viewMonth}
                onMonthChange={setViewMonth}
                onDateSelect={handleDateSelect}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>,
            document.body,
          )
        : null}
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
  const [viewMonth, setViewMonth] = useState<Date>(() => dayjs().toDate());
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const popoverStyle = usePopoverPosition(isOpen, containerRef, popoverRef);

  const fromDate = startDate ? dayjs(startDate).toDate() : undefined;
  const toDate = endDate ? dayjs(endDate).toDate() : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleTouchOutside = (event: TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
    };
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

  const handleDateClick = (date: Date) => {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    if (!startDate || endDate) {
      onChange(dateStr, '');
    } else {
      if (dayjs(dateStr).isBefore(startDate)) {
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
      setIsOpen(false);
    }
  };

  const isInRange = (date: dayjs.Dayjs) => {
    if (!startDate || !endDate) return false;
    return date.isAfter(dayjs(startDate).subtract(1, 'day')) && date.isBefore(dayjs(endDate).add(1, 'day'));
  };

  const isStart = (date: dayjs.Dayjs) => {
    return startDate && date.isSame(dayjs(startDate), 'day');
  };

  const isEnd = (date: dayjs.Dayjs) => {
    return endDate && date.isSame(dayjs(endDate), 'day');
  };

  const displayValue = startDate && endDate
    ? `${dayjs(startDate).format('MM/DD')} - ${dayjs(endDate).format('MM/DD')}`
    : '';

  const startOfMonth = dayjs(viewMonth).startOf('month');
  const endOfMonth = dayjs(viewMonth).endOf('month');
  const startDay = startOfMonth.day();
  const startDayAdjusted = startDay === 0 ? 6 : startDay - 1;
  const daysInMonth = endOfMonth.date();
  const prevMonthDays = dayjs(viewMonth).subtract(1, 'month').daysInMonth();

  const cells: Array<{ date: dayjs.Dayjs; isCurrentMonth: boolean }> = [];

  for (let i = startDayAdjusted - 1; i >= 0; i--) {
    cells.push({
      date: dayjs(viewMonth).subtract(1, 'month').date(prevMonthDays - i),
      isCurrentMonth: false,
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      date: dayjs(viewMonth).date(i),
      isCurrentMonth: true,
    });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      date: dayjs(viewMonth).add(1, 'month').date(i),
      isCurrentMonth: false,
    });
  }

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
      {isOpen && !disabled && typeof document !== 'undefined'
        ? createPortal(
            <div ref={popoverRef} className={`date-picker-popover date-range-popover is-portal ${isDark ? 'is-dark' : ''}`} style={popoverStyle}>
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
              <div className="custom-calendar">
                <div className="custom-calendar-header">
                  <button
                    type="button"
                    className="custom-calendar-nav"
                    onClick={() => setViewMonth(dayjs(viewMonth).subtract(1, 'month').toDate())}
                    aria-label="上个月"
                  >
                    ‹
                  </button>
                  <span className="custom-calendar-title">
                    {dayjs(viewMonth).format('YYYY年 M月')}
                  </span>
                  <button
                    type="button"
                    className="custom-calendar-nav"
                    onClick={() => setViewMonth(dayjs(viewMonth).add(1, 'month').toDate())}
                    aria-label="下个月"
                  >
                    ›
                  </button>
                </div>
                <div className="custom-calendar-weekdays">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="custom-calendar-weekday">{d}</div>
                  ))}
                </div>
                <div className="custom-calendar-grid">
                  {cells.map(({ date, isCurrentMonth }, idx) => {
                    const selected = isStart(date) || isEnd(date);
                    const inRange = isInRange(date);
                    const today = date.isSame(dayjs(), 'day');
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`custom-calendar-day
                          ${!isCurrentMonth ? 'is-outside' : ''}
                          ${selected ? 'is-selected' : ''}
                          ${inRange ? 'is-in-range' : ''}
                          ${isStart(date) ? 'is-range-start' : ''}
                          ${isEnd(date) ? 'is-range-end' : ''}
                          ${today ? 'is-today' : ''}`}
                        onClick={() => handleDateClick(date.toDate())}
                      >
                        {date.date()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
