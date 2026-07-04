import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DateTimePickerField } from '../date';
import { SectionCard } from '../page';
import {
  Btn,
  DeleteModal,
  Field,
  Modal,
  PillTabs,
  SelectField,
  Switch,
  Tag,
  TextArea,
} from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { scheduleApi } from '../../services/scheduleApi';
import type {
  ScheduleCalendarView,
  ScheduleEventDraft,
  ScheduleEventRecord,
  ScheduleOccurrence,
  ScheduleRecurrenceConfig,
  ScheduleRecurrenceType,
  ScheduleSettings,
} from '../../types/schedule';

interface ScheduleCalendarSectionProps {
  settings: ScheduleSettings;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

interface EventFormState {
  title: string;
  descriptionMarkdown: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  location: string;
  color: string;
  recurrenceType: ScheduleRecurrenceType;
  recurrenceWeekdays: number[];
  recurrenceDayOfMonth: number;
  recurrenceEndDate: string;
  reminderMinutes: string;
}

const WEEKDAY_LABELS_MON = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
];

const WEEKDAY_LABELS_SUN = [
  { value: 0, label: '日' },
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
];

const RECURRENCE_LABELS: Record<ScheduleRecurrenceType, string> = {
  none: '不重复',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
};

const COLOR_OPTIONS = [
  { value: 'indigo', label: '靛蓝' },
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'orange', label: '橙色' },
  { value: 'red', label: '红色' },
  { value: 'pink', label: '粉色' },
  { value: 'gray', label: '灰色' },
];

const REMINDER_OPTIONS = [
  { value: '0', label: '事件开始时' },
  { value: '5', label: '5 分钟前' },
  { value: '15', label: '15 分钟前' },
  { value: '30', label: '30 分钟前' },
  { value: '60', label: '1 小时前' },
  { value: '120', label: '2 小时前' },
  { value: '1440', label: '1 天前' },
];

/**
 * 将 ISO 时间格式化为短时间字符串（HH:mm），全天事件返回"全天"。
 * @param iso       ISO 时间字符串
 * @param isAllDay   是否全天事件
 * @returns 格式化后的时间标签
 */
function formatOccurrenceTime(iso: string, isAllDay: boolean): string {
  if (isAllDay) {
    return '全天';
  }
  return dayjs(iso).format('HH:mm');
}

/**
 * 生成月历网格的日期数组。
 * @param cursor 当前月份
 * @param weekStartsOn 0=周日，1=周一
 * @returns 42 天网格（6 周）
 */
function buildMonthGrid(cursor: dayjs.Dayjs, weekStartsOn: number): dayjs.Dayjs[] {
  const firstOfMonth = cursor.startOf('month');
  const offset = (firstOfMonth.day() - weekStartsOn + 7) % 7;
  const gridStart = firstOfMonth.subtract(offset, 'day');
  return Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'));
}

/**
 * 生成周视图的日期数组。
 * @param cursor 当前日期
 * @param weekStartsOn 0=周日，1=周一
 * @returns 7 天日期数组
 */
function buildWeekGrid(cursor: dayjs.Dayjs, weekStartsOn: number): dayjs.Dayjs[] {
  const offset = (cursor.day() - weekStartsOn + 7) % 7;
  const start = cursor.subtract(offset, 'day');
  return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
}

/**
 * 判断两个 ISO 时间是否落在同一天。
 * @param a 时间 A
 * @param b 时间 B
 * @returns 是否同一天
 */
function isSameDay(a: string, b: dayjs.Dayjs): boolean {
  return dayjs(a).isSame(b, 'day');
}

/**
 * 从重复配置 + 重复类型构建表单状态。
 * @param config 重复配置
 * @param type   重复类型
 * @returns {weekdays, dayOfMonth}
 */
function extractRecurrenceFields(config: ScheduleRecurrenceConfig | null, type: ScheduleRecurrenceType) {
  return {
    recurrenceWeekdays: config?.weekdays ? [...config.weekdays] : [],
    recurrenceDayOfMonth: config?.dayOfMonth ?? 1,
    recurrenceType: type,
  };
}

/**
 * 根据表单状态构建重复配置。
 * @param form 表单状态
 * @returns 重复配置或 null
 */
function buildRecurrenceConfig(form: EventFormState): ScheduleRecurrenceConfig | null {
  if (form.recurrenceType === 'weekly') {
    return form.recurrenceWeekdays.length
      ? { weekdays: [...form.recurrenceWeekdays].sort((left, right) => left - right) }
      : null;
  }
  if (form.recurrenceType === 'monthly') {
    return { dayOfMonth: Math.max(1, Math.min(31, Math.round(form.recurrenceDayOfMonth || 1))) };
  }
  return null;
}

/**
 * 将事件记录转换为表单状态。
 * @param event 事件记录
 * @returns 表单状态
 */
function buildEditForm(event: ScheduleEventRecord): EventFormState {
  return {
    title: event.title,
    descriptionMarkdown: event.descriptionMarkdown,
    startAt: event.startAt,
    endAt: event.endAt ?? '',
    isAllDay: event.isAllDay,
    location: event.location,
    color: event.color,
    ...extractRecurrenceFields(event.recurrenceConfig, event.recurrenceType),
    recurrenceEndDate: event.recurrenceEndDate ?? '',
    reminderMinutes: event.reminderMinutes === null ? '' : String(event.reminderMinutes),
  };
}

/**
 * 将表单状态转换为事件草稿。
 * @param form 表单状态
 * @returns 事件草稿或 null（标题为空时）
 */
function parseDraft(form: EventFormState): ScheduleEventDraft | null {
  if (!form.title.trim()) {
    return null;
  }
  const reminderRaw = form.reminderMinutes.trim();
  const reminderMinutes = reminderRaw === '' ? null : Math.max(0, Math.round(Number(reminderRaw)));
  return {
    title: form.title.trim(),
    descriptionMarkdown: form.descriptionMarkdown.trim(),
    startAt: form.startAt,
    endAt: form.endAt || null,
    isAllDay: form.isAllDay,
    location: form.location.trim() || null,
    color: form.color,
    recurrenceType: form.recurrenceType,
    recurrenceConfig: buildRecurrenceConfig(form),
    recurrenceEndDate: form.recurrenceEndDate || null,
    reminderMinutes: Number.isFinite(reminderMinutes as number) ? (reminderMinutes as number) : null,
  };
}

function createEmptyForm(defaultReminderMinutes: number): EventFormState {
  const now = dayjs();
  return {
    title: '',
    descriptionMarkdown: '',
    startAt: now.format('YYYY-MM-DDTHH:mm'),
    endAt: now.add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
    isAllDay: false,
    location: '',
    color: 'indigo',
    recurrenceType: 'none',
    recurrenceWeekdays: [],
    recurrenceDayOfMonth: now.date(),
    recurrenceEndDate: '',
    reminderMinutes: String(defaultReminderMinutes),
  };
}

/**
 * 日历视图主组件：支持月/周/日三种视图，事件以色块呈现，支持点击事件查看/编辑。
 */
export function ScheduleCalendarSection({
  settings,
  showToast,
  onChanged,
}: ScheduleCalendarSectionProps) {
  const [view, setView] = useState<ScheduleCalendarView>(settings.defaultView);
  const [cursor, setCursor] = useState<dayjs.Dayjs>(() => dayjs());
  const [occurrences, setOccurrences] = useState<ScheduleOccurrence[]>([]);
  const [eventMap, setEventMap] = useState<Map<string, ScheduleEventRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<ScheduleOccurrence | null>(null);
  const [editingEvent, setEditingEvent] = useState<ScheduleEventRecord | null>(null);
  const [editingForm, setEditingForm] = useState<EventFormState>(() => createEmptyForm(settings.defaultReminderMinutes));
  const [pendingDelete, setPendingDelete] = useState<ScheduleEventRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EventFormState>(() => createEmptyForm(settings.defaultReminderMinutes));

  const weekStartsOn = settings.weekStartsOn;
  const weekdayLabels = weekStartsOn === 0 ? WEEKDAY_LABELS_SUN : WEEKDAY_LABELS_MON;

  /**
   * 计算当前视图对应的查询时间范围。
   * @returns {rangeStart, rangeEnd}
   */
  const computeRange = useCallback(() => {
    if (view === 'month') {
      const start = cursor.startOf('month').subtract(7, 'day');
      const end = cursor.endOf('month').add(7, 'day');
      return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
    }
    if (view === 'week') {
      const grid = buildWeekGrid(cursor, weekStartsOn);
      return {
        rangeStart: grid[0].startOf('day').toISOString(),
        rangeEnd: grid[6].endOf('day').toISOString(),
      };
    }
    return {
      rangeStart: cursor.startOf('day').toISOString(),
      rangeEnd: cursor.endOf('day').toISOString(),
    };
  }, [cursor, view, weekStartsOn]);

  /**
   * 加载日历视图数据：拉取区间内所有展开后的事件实例。
   */
  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const { rangeStart, rangeEnd } = computeRange();
      const result = await scheduleApi.getCalendar({ rangeStart, rangeEnd });
      setOccurrences(result.items);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '日历加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  }, [computeRange, showToast]);

  /**
   * 加载事件主记录映射（用于编辑/删除）。
   */
  const loadEventMap = useCallback(async () => {
    const sourceIds = new Set(occurrences.map((item) => item.sourceId).filter(Boolean));
    if (!sourceIds.size) {
      setEventMap(new Map());
      return;
    }
    try {
      const result = await scheduleApi.list({
        page: 1,
        page_size: 200,
        status: 'all',
        trashed: false,
      });
      const next = new Map<string, ScheduleEventRecord>();
      result.items.forEach((item) => {
        if (sourceIds.has(item.id)) {
          next.set(item.id, item);
        }
      });
      setEventMap(next);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '事件详情加载失败。'), 'error');
    }
  }, [occurrences, showToast]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    void loadEventMap();
  }, [loadEventMap]);

  /**
   * 按日期分组事件实例，便于在月/周/日视图中按天渲染。
   */
  const occurrencesByDay = useMemo(() => {
    const map = new Map<string, ScheduleOccurrence[]>();
    occurrences.forEach((item) => {
      const dayKey = dayjs(item.startAt).format('YYYY-MM-DD');
      const list = map.get(dayKey) ?? [];
      list.push(item);
      map.set(dayKey, list);
    });
    map.forEach((list) => list.sort((left, right) => {
      if (left.isAllDay !== right.isAllDay) {
        return left.isAllDay ? -1 : 1;
      }
      return dayjs(left.startAt).valueOf() - dayjs(right.startAt).valueOf();
    }));
    return map;
  }, [occurrences]);

  const monthGrid = useMemo(() => buildMonthGrid(cursor, weekStartsOn), [cursor, weekStartsOn]);
  const weekGrid = useMemo(() => buildWeekGrid(cursor, weekStartsOn), [cursor, weekStartsOn]);

  const goPrev = () => {
    if (view === 'month') {
      setCursor((current) => current.subtract(1, 'month'));
    } else if (view === 'week') {
      setCursor((current) => current.subtract(7, 'day'));
    } else {
      setCursor((current) => current.subtract(1, 'day'));
    }
  };

  const goNext = () => {
    if (view === 'month') {
      setCursor((current) => current.add(1, 'month'));
    } else if (view === 'week') {
      setCursor((current) => current.add(7, 'day'));
    } else {
      setCursor((current) => current.add(1, 'day'));
    }
  };

  const goToday = () => setCursor(dayjs());

  const periodLabel = useMemo(() => {
    if (view === 'month') {
      return cursor.format('YYYY 年 M 月');
    }
    if (view === 'week') {
      const start = weekGrid[0];
      const end = weekGrid[6];
      return `${start.format('M月D日')} - ${end.format('M月D日')}`;
    }
    return cursor.format('YYYY 年 M 月 D 日');
  }, [cursor, view, weekGrid]);

  /**
   * 打开事件详情：先尝试用 sourceId 找主记录，找到则进入编辑弹窗。
   * @param occurrence 事件实例
   */
  const handleOpenOccurrence = (occurrence: ScheduleOccurrence) => {
    const record = occurrence.sourceId ? eventMap.get(occurrence.sourceId) : undefined;
    if (record) {
      setEditingEvent(record);
      setEditingForm(buildEditForm(record));
    } else {
      setSelectedOccurrence(occurrence);
    }
  };

  /**
   * 保存编辑：调用 update 接口，成功后刷新日历。
   */
  const handleSaveEdit = async () => {
    if (!editingEvent) {
      return;
    }
    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('事件标题不能为空。', 'error');
      return;
    }
    try {
      await scheduleApi.update(editingEvent.id, draft);
      setEditingEvent(null);
      showToast('日程已更新。');
      onChanged();
      await loadCalendar();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '更新日程失败。'), 'error');
    }
  };

  /**
   * 切换事件完成状态。
   * @param event 事件记录
   */
  const handleToggleCompleted = async (event: ScheduleEventRecord) => {
    try {
      await scheduleApi.toggleCompleted(event.id, !event.completed);
      showToast(`日程已标记为${event.completed ? '未完成' : '已完成'}。`);
      onChanged();
      await loadCalendar();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '更新完成状态失败。'), 'error');
    }
  };

  /**
   * 删除事件（移入回收站）。
   */
  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    try {
      await scheduleApi.trash(pendingDelete.id);
      setPendingDelete(null);
      setEditingEvent(null);
      showToast('日程已移入回收站。');
      onChanged();
      await loadCalendar();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '删除日程失败。'), 'error');
    }
  };

  /**
   * 创建新事件。
   */
  const handleCreate = async () => {
    const draft = parseDraft(createForm);
    if (!draft) {
      showToast('事件标题不能为空。', 'error');
      return;
    }
    try {
      await scheduleApi.create(draft);
      setCreateOpen(false);
      setCreateForm(createEmptyForm(settings.defaultReminderMinutes));
      showToast('日程已创建。');
      onChanged();
      await loadCalendar();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '创建日程失败。'), 'error');
    }
  };

  /**
   * 点击月历单元格：将光标移到该天，若为日视图则刷新。
   * @param day 日期
   */
  const handleDayClick = (day: dayjs.Dayjs) => {
    if (view === 'month') {
      setCursor(day);
      setView('day');
    }
  };

  /**
   * 在指定日期快速新建事件。
   * @param day 目标日期
   */
  const handleQuickCreate = (day: dayjs.Dayjs) => {
    const next = createEmptyForm(settings.defaultReminderMinutes);
    next.startAt = day.hour(9).minute(0).format('YYYY-MM-DDTHH:mm');
    next.endAt = day.hour(10).minute(0).format('YYYY-MM-DDTHH:mm');
    setCreateForm(next);
    setCreateOpen(true);
  };

  /**
   * 渲染重复规则编辑器（周日/周一两种排列）。
   */
  const renderRecurrenceEditor = (
    value: ScheduleRecurrenceType,
    weekdays: number[],
    dayOfMonth: number,
    onChange: (next: { recurrenceType: ScheduleRecurrenceType; weekdays: number[]; dayOfMonth: number }) => void,
  ) => (
    <div className="schedule-recurrence-editor">
      <SelectField
        label="重复规则"
        value={value}
        onChange={(event) => onChange({ recurrenceType: event.target.value as ScheduleRecurrenceType, weekdays, dayOfMonth })}
      >
        {Object.entries(RECURRENCE_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </SelectField>
      {value === 'weekly' ? (
        <div className="schedule-recurrence-weekdays">
          <span className="field-label">重复星期</span>
          <div className="schedule-recurrence-weekday-row">
            {weekdayLabels.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`schedule-recurrence-weekday-pill ${weekdays.includes(item.value) ? 'is-active' : ''}`}
                onClick={() => {
                  if (weekdays.includes(item.value)) {
                    onChange({ recurrenceType: value, weekdays: weekdays.filter((w) => w !== item.value), dayOfMonth });
                  } else {
                    onChange({
                      recurrenceType: value,
                      weekdays: [...weekdays, item.value].sort((left, right) => left - right),
                      dayOfMonth,
                    });
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {value === 'monthly' ? (
        <Field
          label="每月几号"
          type="number"
          min={1}
          max={31}
          value={String(dayOfMonth)}
          onChange={(event) => onChange({
            recurrenceType: value,
            weekdays,
            dayOfMonth: Math.max(1, Math.min(31, Number(event.target.value) || 1)),
          })}
        />
      ) : null}
    </div>
  );

  /**
   * 渲染事件编辑表单（创建/编辑共用）。
   */
  const renderEventForm = (
    form: EventFormState,
    setForm: (updater: (current: EventFormState) => EventFormState) => void,
  ) => (
    <div className="schedule-event-form">
      <Field
        label="标题"
        value={form.title}
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        placeholder="例如：项目周会"
      />
      <div className="schedule-event-form-row">
        <Switch
          checked={form.isAllDay}
          onChange={(checked) => setForm((current) => ({ ...current, isAllDay: checked }))}
          label="全天事件"
        />
      </div>
      <div className="schedule-event-form-row">
        <DateTimePickerField
          label="开始时间"
          value={form.startAt}
          onChange={(value) => setForm((current) => ({ ...current, startAt: value }))}
        />
        <DateTimePickerField
          label="结束时间"
          value={form.endAt}
          onChange={(value) => setForm((current) => ({ ...current, endAt: value }))}
          clearable
        />
      </div>
      <div className="schedule-event-form-row">
        <SelectField
          label="颜色"
          value={form.color}
          onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
        >
          {COLOR_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </SelectField>
        <SelectField
          label="提醒"
          value={form.reminderMinutes}
          onChange={(event) => setForm((current) => ({ ...current, reminderMinutes: event.target.value }))}
        >
          <option value="">不提醒</option>
          {REMINDER_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </SelectField>
      </div>
      <Field
        label="地点"
        value={form.location}
        onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
        placeholder="可选"
      />
      {renderRecurrenceEditor(form.recurrenceType, form.recurrenceWeekdays, form.recurrenceDayOfMonth, ({ recurrenceType, weekdays, dayOfMonth }) => setForm((current) => ({
        ...current,
        recurrenceType,
        recurrenceWeekdays: weekdays,
        recurrenceDayOfMonth: dayOfMonth,
      })))}
      {form.recurrenceType !== 'none' ? (
        <Field
          label="重复截止日期"
          type="date"
          value={form.recurrenceEndDate ? dayjs(form.recurrenceEndDate).format('YYYY-MM-DD') : ''}
          onChange={(event) => setForm((current) => ({
            ...current,
            recurrenceEndDate: event.target.value ? dayjs(event.target.value).toISOString() : '',
          }))}
          hint="留空则长期重复"
        />
      ) : null}
      <TextArea
        label="描述"
        rows={3}
        value={form.descriptionMarkdown}
        onChange={(event) => setForm((current) => ({ ...current, descriptionMarkdown: event.target.value }))}
        placeholder="支持 Markdown"
      />
    </div>
  );

  return (
    <SectionCard
      title="日历视图"
      description="按月/周/日浏览日程，支持事件展开、完成切换、编辑和快速新建。"
      action={<Btn tone="primary" onClick={() => {
        setCreateForm(createEmptyForm(settings.defaultReminderMinutes));
        setCreateOpen(true);
      }}>新建日程</Btn>}
    >
      <div className={`page-stack schedule-calendar ${loading ? 'is-loading' : ''}`}>
        <div className="schedule-toolbar">
          <div className="schedule-toolbar-nav">
            <Btn tone="secondary" onClick={goPrev}>上一页</Btn>
            <Btn tone="secondary" onClick={goToday}>今天</Btn>
            <Btn tone="secondary" onClick={goNext}>下一页</Btn>
          </div>
          <strong className="schedule-period-label">{periodLabel}</strong>
          <PillTabs
            options={[
              { value: 'month', label: '月视图' },
              { value: 'week', label: '周视图' },
              { value: 'day', label: '日视图' },
            ]}
            value={view}
            onChange={(value) => setView(value as ScheduleCalendarView)}
          />
        </div>

        {view === 'month' ? (
          <div className="schedule-month-grid">
            <div className="schedule-month-header">
              {weekdayLabels.map((item) => (
                <div key={item.value} className="schedule-month-header-cell">{item.label}</div>
              ))}
            </div>
            <div className="schedule-month-body">
              {monthGrid.map((day) => {
                const dayKey = day.format('YYYY-MM-DD');
                const dayEvents = occurrencesByDay.get(dayKey) ?? [];
                const isCurrentMonth = day.month() === cursor.month();
                const isToday = day.isSame(dayjs(), 'day');
                return (
                  <div
                    key={dayKey}
                    className={`schedule-month-cell ${isCurrentMonth ? '' : 'is-outside'} ${isToday ? 'is-today' : ''}`}
                    onClick={() => handleDayClick(day)}
                  >
                    <div className="schedule-month-cell-head">
                      <span className="schedule-month-day-num">{day.date()}</span>
                      <div className="schedule-month-cell-actions">
                        <button
                          type="button"
                          className="schedule-month-add-btn"
                          title="在该日新建"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleQuickCreate(day);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="schedule-month-events">
                      {dayEvents.slice(0, 3).map((occurrence) => (
                        <button
                          key={occurrence.occurrenceKey}
                          type="button"
                          className={`schedule-event-chip color-${occurrence.color || 'indigo'} ${occurrence.completed ? 'is-completed' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenOccurrence(occurrence);
                          }}
                          title={occurrence.title}
                        >
                          <span className="schedule-event-chip-time">
                            {formatOccurrenceTime(occurrence.startAt, occurrence.isAllDay)}
                          </span>
                          <span className="schedule-event-chip-title">{occurrence.title}</span>
                          {occurrence.recurring ? <span className="schedule-event-chip-repeat">↻</span> : null}
                        </button>
                      ))}
                      {dayEvents.length > 3 ? (
                        <span className="schedule-month-more">还有 {dayEvents.length - 3} 项</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === 'week' ? (
          <div className="schedule-week-grid">
            {weekGrid.map((day) => {
              const dayKey = day.format('YYYY-MM-DD');
              const dayEvents = occurrencesByDay.get(dayKey) ?? [];
              const isToday = day.isSame(dayjs(), 'day');
              return (
                <div key={dayKey} className={`schedule-week-col ${isToday ? 'is-today' : ''}`}>
                  <div className="schedule-week-col-head">
                    <span className="schedule-week-day-label">
                      {weekdayLabels.find((item) => item.value === day.day())?.label ?? ''}
                    </span>
                    <span className="schedule-week-day-num">{day.date()}</span>
                    <button
                      type="button"
                      className="schedule-week-add-btn"
                      title="在该日新建"
                      onClick={() => handleQuickCreate(day)}
                    >
                      +
                    </button>
                  </div>
                  <div className="schedule-week-events">
                    {dayEvents.length ? dayEvents.map((occurrence) => (
                      <button
                        key={occurrence.occurrenceKey}
                        type="button"
                        className={`schedule-event-block color-${occurrence.color || 'indigo'} ${occurrence.completed ? 'is-completed' : ''}`}
                        onClick={() => handleOpenOccurrence(occurrence)}
                      >
                        <div className="schedule-event-block-time">
                          {formatOccurrenceTime(occurrence.startAt, occurrence.isAllDay)}
                          {occurrence.endAt ? ` - ${formatOccurrenceTime(occurrence.endAt, occurrence.isAllDay)}` : ''}
                        </div>
                        <div className="schedule-event-block-title">{occurrence.title}</div>
                        {occurrence.location ? (
                          <div className="schedule-event-block-location">@{occurrence.location}</div>
                        ) : null}
                        {occurrence.recurring ? <span className="schedule-event-block-repeat">↻ 重复</span> : null}
                      </button>
                    )) : <span className="schedule-week-empty">暂无日程</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {view === 'day' ? (
          <div className="schedule-day-view">
            <div className="schedule-day-head">
              <strong>{cursor.format('YYYY 年 M 月 D 日 dddd')}</strong>
              <Btn tone="secondary" onClick={() => handleQuickCreate(cursor)}>新建日程</Btn>
            </div>
            <div className="schedule-day-events">
              {(occurrencesByDay.get(cursor.format('YYYY-MM-DD')) ?? []).map((occurrence) => (
                <button
                  key={occurrence.occurrenceKey}
                  type="button"
                  className={`schedule-day-event color-${occurrence.color || 'indigo'} ${occurrence.completed ? 'is-completed' : ''}`}
                  onClick={() => handleOpenOccurrence(occurrence)}
                >
                  <div className="schedule-day-event-time">
                    {formatOccurrenceTime(occurrence.startAt, occurrence.isAllDay)}
                    {occurrence.endAt ? ` - ${formatOccurrenceTime(occurrence.endAt, occurrence.isAllDay)}` : ''}
                  </div>
                  <div className="schedule-day-event-body">
                    <strong>{occurrence.title}</strong>
                    {occurrence.location ? <span>@{occurrence.location}</span> : null}
                    {occurrence.recurring ? <Tag tone="blue">重复</Tag> : null}
                    {occurrence.descriptionMarkdown ? (
                      <p className="schedule-day-event-desc">{occurrence.descriptionMarkdown}</p>
                    ) : null}
                  </div>
                </button>
              ))}
              {(occurrencesByDay.get(cursor.format('YYYY-MM-DD')) ?? []).length === 0 ? (
                <span className="schedule-day-empty">今日暂无日程</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* 事件详情/编辑弹窗 */}
      <Modal
        open={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        title={editingEvent ? `编辑日程：${editingEvent.title}` : '编辑日程'}
        width={620}
        footer={(
          <>
            <Btn tone="danger" onClick={() => setPendingDelete(editingEvent)}>移入回收站</Btn>
            <Btn tone="secondary" onClick={() => setEditingEvent(null)}>取消</Btn>
            <Btn tone="primary" onClick={() => void handleSaveEdit()}>保存</Btn>
          </>
        )}
      >
        {editingEvent ? renderEventForm(editingForm, setEditingForm) : null}
        {editingEvent ? (
          <div className="schedule-event-meta">
            <Tag tone={editingEvent.completed ? 'green' : 'orange'}>
              {editingEvent.completed ? '已完成' : '未完成'}
            </Tag>
            <Tag tone="blue">{RECURRENCE_LABELS[editingEvent.recurrenceType]}</Tag>
            <Btn
              tone="secondary"
              onClick={() => void handleToggleCompleted(editingEvent)}
            >
              {editingEvent.completed ? '标记未完成' : '标记已完成'}
            </Btn>
          </div>
        ) : null}
      </Modal>

      {/* 创建弹窗 */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建日程"
        width={620}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setCreateOpen(false)}>取消</Btn>
            <Btn tone="primary" onClick={() => void handleCreate()}>创建</Btn>
          </>
        )}
      >
        {renderEventForm(createForm, setCreateForm)}
      </Modal>

      {/* 详情弹窗（无主记录时仅展示实例信息） */}
      <Modal
        open={Boolean(selectedOccurrence)}
        onClose={() => setSelectedOccurrence(null)}
        title={selectedOccurrence ? selectedOccurrence.title : '日程详情'}
        width={480}
        footer={<Btn tone="secondary" onClick={() => setSelectedOccurrence(null)}>关闭</Btn>}
      >
        {selectedOccurrence ? (
          <div className="schedule-event-detail">
            <div className="schedule-event-detail-row">
              <span className="field-label">时间</span>
              <span>
                {formatOccurrenceTime(selectedOccurrence.startAt, selectedOccurrence.isAllDay)}
                {selectedOccurrence.endAt ? ` - ${formatOccurrenceTime(selectedOccurrence.endAt, selectedOccurrence.isAllDay)}` : ''}
              </span>
            </div>
            {selectedOccurrence.location ? (
              <div className="schedule-event-detail-row">
                <span className="field-label">地点</span>
                <span>{selectedOccurrence.location}</span>
              </div>
            ) : null}
            {selectedOccurrence.descriptionMarkdown ? (
              <div className="schedule-event-detail-row">
                <span className="field-label">描述</span>
                <span>{selectedOccurrence.descriptionMarkdown}</span>
              </div>
            ) : null}
            {selectedOccurrence.recurring ? (
              <div className="schedule-event-detail-row">
                <span className="field-label">类型</span>
                <Tag tone="blue">重复事件实例</Tag>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
        title={pendingDelete ? `删除日程：${pendingDelete.title}` : '删除日程'}
        confirmLabel="确认归档"
        confirmTone="primary"
      >
        日程将移入回收站，可在回收站中恢复或永久删除。
      </DeleteModal>
    </SectionCard>
  );
}
