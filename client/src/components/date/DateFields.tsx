import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  DayFlag,
  DayPicker,
  SelectionState,
  UI,
  type ClassNames,
  type Matcher,
} from 'react-day-picker';

import type {
  DatePickerFieldProps,
  DateTimePickerFieldProps,
  MonthPickerFieldProps,
} from '../../types/ui';
import { Btn } from '../ui';

const DATE_FORMAT = 'YYYY-MM-DD';
const MONTH_FORMAT = 'YYYY-MM';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const DISPLAY_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

const DAY_PICKER_CLASS_NAMES: Partial<ClassNames> = {
  [UI.Root]: 'calendar-root',
  [UI.Months]: 'calendar-months',
  [UI.Month]: 'calendar-month',
  [UI.MonthCaption]: 'calendar-caption',
  [UI.CaptionLabel]: 'calendar-caption-label',
  [UI.Nav]: 'calendar-nav',
  [UI.PreviousMonthButton]: 'calendar-nav-button',
  [UI.NextMonthButton]: 'calendar-nav-button',
  [UI.MonthGrid]: 'calendar-grid',
  [UI.Weekdays]: 'calendar-weekdays',
  [UI.Weekday]: 'calendar-weekday',
  [UI.Week]: 'calendar-week',
  [UI.Day]: 'calendar-day',
  [UI.DayButton]: 'calendar-day-button',
  [SelectionState.selected]: 'is-selected',
  [DayFlag.today]: 'is-today',
  [DayFlag.outside]: 'is-outside',
  [DayFlag.disabled]: 'is-disabled',
  [DayFlag.focused]: 'is-focused',
};

function parseFormattedValue(value: string, format: string) {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format(format) === value ? parsed : null;
}

function roundToMinuteStep(baseTime: Dayjs, minuteStep: 15 | 30) {
  const remainder = baseTime.minute() % minuteStep;
  const alignedMinute = remainder === 0 ? baseTime.minute() : baseTime.minute() + (minuteStep - remainder);
  const nextTime = alignedMinute >= 60
    ? baseTime.add(1, 'hour').minute(0)
    : baseTime.minute(alignedMinute);

  return nextTime.second(0).millisecond(0);
}

function buildDateMatchers(
  minValue?: string,
  maxValue?: string,
  disabledDates?: Matcher | Matcher[],
  format = DATE_FORMAT,
) {
  const matchers: Matcher[] = [];
  const minDate = parseFormattedValue(minValue ?? '', format);
  const maxDate = parseFormattedValue(maxValue ?? '', format);

  if (minDate) {
    matchers.push({ before: minDate.toDate() });
  }

  if (maxDate) {
    matchers.push({ after: maxDate.toDate() });
  }

  if (Array.isArray(disabledDates)) {
    matchers.push(...disabledDates);
  } else if (disabledDates) {
    matchers.push(disabledDates);
  }

  return matchers.length ? matchers : undefined;
}

function usePopoverDismiss(
  open: boolean,
  rootRef: RefObject<HTMLDivElement>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (target && rootRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open, rootRef]);
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 2v3M17 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 7v5l3 3M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 10l5 5l5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DateFieldFrame({
  rootRef,
  id,
  open,
  label,
  hint,
  placeholder,
  displayValue,
  icon,
  disabled = false,
  onToggle,
  children,
}: {
  rootRef: RefObject<HTMLDivElement>;
  id: string;
  open: boolean;
  label?: string;
  hint?: string;
  placeholder: string;
  displayValue: string;
  icon: ReactNode;
  disabled?: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`field date-field ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      {label ? <span className="field-label">{label}</span> : null}
      <button
        id={id}
        type="button"
        className={`date-trigger ${open ? 'is-open' : ''} ${displayValue ? '' : 'is-placeholder'}`.trim()}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="date-trigger-value">{displayValue || placeholder}</span>
        <span className="date-trigger-icons" aria-hidden="true">
          <span className="date-trigger-icon">{icon}</span>
          <span className={`date-trigger-chevron ${open ? 'is-open' : ''}`}>
            <ChevronIcon />
          </span>
        </span>
      </button>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

function DatePopover({
  labelledBy,
  title,
  description,
  children,
  variant = 'default',
  clearable = true,
  confirmDisabled = false,
  onConfirm,
  onClear,
  onToday,
}: {
  labelledBy: string;
  title: string;
  description: string;
  children: ReactNode;
  variant?: 'default' | 'datetime';
  clearable?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClear?: () => void;
  onToday?: () => void;
}) {
  return (
    <div
      className={`date-popover ${variant === 'datetime' ? 'is-datetime' : ''}`.trim()}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          onConfirm();
        }
      }}
    >
      <div className="date-popover-header">
        <div>
          <strong id={labelledBy}>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      <div className="date-popover-body">{children}</div>
      <div className="date-popover-footer">
        <div className="date-popover-footer-start">
          {onToday ? (
            <Btn tone="ghost" type="button" onClick={onToday}>
              今天
            </Btn>
          ) : null}
        </div>
        <div className="date-popover-footer-end">
          {clearable && onClear ? (
            <Btn tone="secondary" type="button" onClick={onClear}>
              清空
            </Btn>
          ) : null}
          <Btn tone="primary" type="button" onClick={onConfirm} disabled={confirmDisabled}>
            确认
          </Btn>
        </div>
      </div>
    </div>
  );
}

function buildDatePickerLabels() {
  return {
    labelGrid: (date: Date) => `${dayjs(date).format('YYYY年M月')}日历`,
    labelNext: () => '下个月',
    labelPrevious: () => '上个月',
    labelDayButton: (date: Date, modifiers: Record<string, boolean>) => {
      const parts = [dayjs(date).format('YYYY年M月D日')];

      if (modifiers.selected) {
        parts.push('已选中');
      }

      if (modifiers.today) {
        parts.push('今天');
      }

      return parts.join('，');
    },
    labelWeekday: (date: Date) => `星期${WEEKDAY_NAMES[date.getDay()]}`,
  };
}

function buildMinuteOptions(minuteStep: 15 | 30, selectedMinute: number) {
  const values = minuteStep === 30 ? [0, 30] : [0, 15, 30, 45];

  if (!values.includes(selectedMinute)) {
    values.push(selectedMinute);
  }

  return values.sort((left, right) => left - right);
}

function formatTimeLabel(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isMonthBlocked(
  monthValue: string,
  minValue?: string,
  maxValue?: string,
  isMonthDisabled?: (value: string) => boolean,
) {
  if (minValue && monthValue < minValue) {
    return true;
  }

  if (maxValue && monthValue > maxValue) {
    return true;
  }

  return isMonthDisabled ? isMonthDisabled(monthValue) : false;
}

export function DatePickerField({
  value,
  onChange,
  label,
  hint,
  placeholder = '请选择日期',
  disabled = false,
  clearable = true,
  minValue,
  maxValue,
  disabledDates,
}: DatePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const selectedDate = useMemo(() => parseFormattedValue(value, DATE_FORMAT), [value]);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(selectedDate?.toDate());
  const [displayMonth, setDisplayMonth] = useState<Date>((selectedDate ?? dayjs()).toDate());

  usePopoverDismiss(open, rootRef, () => setOpen(false));

  const disabledMatchers = useMemo(
    () => buildDateMatchers(minValue, maxValue, disabledDates, DATE_FORMAT),
    [disabledDates, maxValue, minValue],
  );

  const labels = useMemo(() => buildDatePickerLabels(), []);

  const openPopover = () => {
    const seed = selectedDate ?? dayjs();
    setDraftDate(selectedDate?.toDate());
    setDisplayMonth(seed.toDate());
    setOpen(true);
  };

  return (
    <DateFieldFrame
      rootRef={rootRef}
      id={fieldId}
      open={open}
      label={label}
      hint={hint}
      placeholder={placeholder}
      displayValue={selectedDate?.format(DATE_FORMAT) ?? ''}
      icon={<CalendarIcon />}
      disabled={disabled}
      onToggle={() => {
        if (open) {
          setOpen(false);
          return;
        }

        openPopover();
      }}
    >
      {open ? (
        <DatePopover
          labelledBy={titleId}
          title="选择日期"
          description={selectedDate?.format('YYYY年MM月DD日') ?? '按日历选择具体日期'}
          clearable={clearable}
          confirmDisabled={!draftDate}
          onConfirm={() => {
            onChange(draftDate ? dayjs(draftDate).format(DATE_FORMAT) : '');
            setOpen(false);
          }}
          onClear={() => {
            setDraftDate(undefined);
            onChange('');
            setOpen(false);
          }}
          onToday={() => {
            const today = dayjs();
            setDraftDate(today.toDate());
            setDisplayMonth(today.toDate());
          }}
        >
          <DayPicker
            mode="single"
            weekStartsOn={1}
            showOutsideDays
            month={displayMonth}
            selected={draftDate}
            classNames={DAY_PICKER_CLASS_NAMES}
            disabled={disabledMatchers}
            startMonth={parseFormattedValue(minValue ?? '', DATE_FORMAT)?.startOf('month').toDate()}
            endMonth={parseFormattedValue(maxValue ?? '', DATE_FORMAT)?.endOf('month').toDate()}
            formatters={{
              formatCaption: (date) => dayjs(date).format('YYYY年 M月'),
              formatDay: (date) => String(date.getDate()),
              formatWeekdayName: (date) => WEEKDAY_NAMES[date.getDay()],
            }}
            labels={labels}
            onMonthChange={setDisplayMonth}
            onSelect={(nextDate) => {
              setDraftDate(nextDate);
              if (nextDate) {
                setDisplayMonth(nextDate);
              }
            }}
          />
        </DatePopover>
      ) : null}
    </DateFieldFrame>
  );
}

export function MonthPickerField({
  value,
  onChange,
  label,
  hint,
  placeholder = '请选择月份',
  disabled = false,
  clearable = true,
  minValue,
  maxValue,
  isMonthDisabled,
}: MonthPickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const selectedMonth = useMemo(() => parseFormattedValue(value, MONTH_FORMAT), [value]);
  const [open, setOpen] = useState(false);
  const [draftMonth, setDraftMonth] = useState(value);
  const [visibleYear, setVisibleYear] = useState((selectedMonth ?? dayjs()).year());

  usePopoverDismiss(open, rootRef, () => setOpen(false));

  const openPopover = () => {
    const seed = selectedMonth ?? dayjs();
    setDraftMonth(selectedMonth?.format(MONTH_FORMAT) ?? '');
    setVisibleYear(seed.year());
    setOpen(true);
  };

  return (
    <DateFieldFrame
      rootRef={rootRef}
      id={fieldId}
      open={open}
      label={label}
      hint={hint}
      placeholder={placeholder}
      displayValue={selectedMonth?.format('YYYY年MM月') ?? ''}
      icon={<CalendarIcon />}
      disabled={disabled}
      onToggle={() => {
        if (open) {
          setOpen(false);
          return;
        }

        openPopover();
      }}
    >
      {open ? (
        <DatePopover
          labelledBy={titleId}
          title="选择月份"
          description={selectedMonth?.format('YYYY年MM月') ?? '按年份切换后选择月份'}
          clearable={clearable}
          confirmDisabled={!draftMonth}
          onConfirm={() => {
            onChange(draftMonth || '');
            setOpen(false);
          }}
          onClear={() => {
            setDraftMonth('');
            onChange('');
            setOpen(false);
          }}
          onToday={() => {
            const currentMonth = dayjs();
            setVisibleYear(currentMonth.year());
            setDraftMonth(currentMonth.format(MONTH_FORMAT));
          }}
        >
          <div className="month-picker-panel">
            <div className="month-picker-year-bar">
              <button
                type="button"
                className="calendar-nav-button"
                aria-label="上一年"
                onClick={() => setVisibleYear((previous) => previous - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M15 6l-6 6l6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <strong>{visibleYear} 年</strong>
              <button
                type="button"
                className="calendar-nav-button"
                aria-label="下一年"
                onClick={() => setVisibleYear((previous) => previous + 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 6l6 6l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="month-picker-grid">
              {MONTH_NAMES.map((monthName, index) => {
                const monthValue = `${visibleYear}-${String(index + 1).padStart(2, '0')}`;
                const blocked = isMonthBlocked(monthValue, minValue, maxValue, isMonthDisabled);

                return (
                  <button
                    key={monthValue}
                    type="button"
                    className={`month-picker-item ${draftMonth === monthValue ? 'is-active' : ''}`}
                    disabled={blocked}
                    onClick={() => setDraftMonth(monthValue)}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          </div>
        </DatePopover>
      ) : null}
    </DateFieldFrame>
  );
}

export function DateTimePickerField({
  value,
  onChange,
  label,
  hint,
  placeholder = '请选择日期和时间',
  disabled = false,
  clearable = true,
  minuteStep = 15,
  minValue,
  maxValue,
  disabledDates,
  shortcutOptions = [],
}: DateTimePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const selectedDateTime = useMemo(() => parseFormattedValue(value, DATE_TIME_FORMAT), [value]);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(selectedDateTime?.toDate());
  const [displayMonth, setDisplayMonth] = useState<Date>((selectedDateTime ?? dayjs()).toDate());
  const [draftHour, setDraftHour] = useState(selectedDateTime?.hour() ?? 0);
  const [draftMinute, setDraftMinute] = useState(selectedDateTime?.minute() ?? 0);

  usePopoverDismiss(open, rootRef, () => setOpen(false));

  const disabledMatchers = useMemo(
    () => buildDateMatchers(minValue, maxValue, disabledDates, DATE_TIME_FORMAT),
    [disabledDates, maxValue, minValue],
  );

  const labels = useMemo(() => buildDatePickerLabels(), []);
  const minuteOptions = useMemo(
    () => buildMinuteOptions(minuteStep, draftMinute),
    [draftMinute, minuteStep],
  );

  const openPopover = () => {
    const seed = selectedDateTime ?? roundToMinuteStep(dayjs(), minuteStep);
    setDraftDate(seed.toDate());
    setDisplayMonth(seed.toDate());
    setDraftHour(seed.hour());
    setDraftMinute(seed.minute());
    setOpen(true);
  };

  return (
    <DateFieldFrame
      rootRef={rootRef}
      id={fieldId}
      open={open}
      label={label}
      hint={hint}
      placeholder={placeholder}
      displayValue={selectedDateTime?.format(DISPLAY_DATE_TIME_FORMAT) ?? ''}
      icon={<ClockIcon />}
      disabled={disabled}
      onToggle={() => {
        if (open) {
          setOpen(false);
          return;
        }

        openPopover();
      }}
    >
      {open ? (
        <DatePopover
          labelledBy={titleId}
          variant="datetime"
          title="选择日期和时间"
          description={
            selectedDateTime
              ? `${selectedDateTime.format('YYYY年MM月DD日')} · ${formatTimeLabel(selectedDateTime.hour(), selectedDateTime.minute())}`
              : '先选择日期，再选择小时和分钟'
          }
          clearable={clearable}
          confirmDisabled={!draftDate}
          onConfirm={() => {
            if (!draftDate) {
              onChange('');
              setOpen(false);
              return;
            }

            onChange(
              dayjs(draftDate)
                .hour(draftHour)
                .minute(draftMinute)
                .second(0)
                .millisecond(0)
                .format(DATE_TIME_FORMAT),
            );
            setOpen(false);
          }}
          onClear={() => {
            setDraftDate(undefined);
            onChange('');
            setOpen(false);
          }}
        >
          <div className="date-time-layout">
            <div className="date-time-calendar">
              <DayPicker
                mode="single"
                weekStartsOn={1}
                showOutsideDays
                month={displayMonth}
                selected={draftDate}
                classNames={DAY_PICKER_CLASS_NAMES}
                disabled={disabledMatchers}
                startMonth={parseFormattedValue(minValue ?? '', DATE_TIME_FORMAT)?.startOf('month').toDate()}
                endMonth={parseFormattedValue(maxValue ?? '', DATE_TIME_FORMAT)?.endOf('month').toDate()}
                formatters={{
                  formatCaption: (date) => dayjs(date).format('YYYY年 M月'),
                  formatDay: (date) => String(date.getDate()),
                  formatWeekdayName: (date) => WEEKDAY_NAMES[date.getDay()],
                }}
                labels={labels}
                onMonthChange={setDisplayMonth}
                onSelect={(nextDate) => {
                  setDraftDate(nextDate);
                  if (nextDate) {
                    setDisplayMonth(nextDate);
                  }
                }}
              />
            </div>
            <div className="date-time-controls">
              <div className="date-time-summary">
                <strong>{draftDate ? dayjs(draftDate).format('YYYY年MM月DD日') : '未选择日期'}</strong>
                <span>{draftDate ? formatTimeLabel(draftHour, draftMinute) : '请选择一个可用日期'}</span>
              </div>
              {shortcutOptions.length ? (
                <div className="date-shortcuts">
                  {shortcutOptions.map((shortcut) => (
                    <button
                      key={shortcut.label}
                      type="button"
                      className="date-shortcut-button"
                      onClick={() => {
                        const parsed = parseFormattedValue(shortcut.value, DATE_TIME_FORMAT);

                        if (!parsed) {
                          return;
                        }

                        setDraftDate(parsed.toDate());
                        setDisplayMonth(parsed.toDate());
                        setDraftHour(parsed.hour());
                        setDraftMinute(parsed.minute());
                      }}
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="date-time-columns">
                <div className="time-column">
                  <span className="time-column-label">小时</span>
                  <div className="time-option-list">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <button
                        key={hour}
                        type="button"
                        className={`time-option-button ${draftHour === hour ? 'is-active' : ''}`}
                        onClick={() => setDraftHour(hour)}
                      >
                        {String(hour).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="time-column">
                  <span className="time-column-label">分钟</span>
                  <div className="time-option-list">
                    {minuteOptions.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        className={`time-option-button ${draftMinute === minute ? 'is-active' : ''}`}
                        onClick={() => setDraftMinute(minute)}
                      >
                        {String(minute).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DatePopover>
      ) : null}
    </DateFieldFrame>
  );
}
