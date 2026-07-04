import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DateTimePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import {
  Btn,
  DataTable,
  DeleteModal,
  Field,
  IconBtn,
  Modal,
  Pagination,
  SelectField,
  Switch,
  Tag,
  TextArea,
  DeleteIcon,
  EditIcon,
} from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { scheduleApi } from '../../services/scheduleApi';
import type {
  ScheduleEventDraft,
  ScheduleEventRecord,
  ScheduleRecurrenceConfig,
  ScheduleRecurrenceType,
  ScheduleSettings,
} from '../../types/schedule';

interface ScheduleEventsSectionProps {
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

const PAGE_SIZE = 10;

const WEEKDAY_LABELS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
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

type StatusFilter = 'all' | 'active' | 'completed' | 'recurring';

/**
 * 创建空白事件表单。
 * @param defaultReminderMinutes 默认提前提醒分钟数
 * @returns 表单初始状态
 */
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
 * 根据事件记录构建编辑表单状态。
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
    recurrenceType: event.recurrenceType,
    recurrenceWeekdays: event.recurrenceConfig?.weekdays ? [...event.recurrenceConfig.weekdays] : [],
    recurrenceDayOfMonth: event.recurrenceConfig?.dayOfMonth ?? 1,
    recurrenceEndDate: event.recurrenceEndDate ?? '',
    reminderMinutes: event.reminderMinutes === null ? '' : String(event.reminderMinutes),
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

/**
 * 格式化事件时间显示。
 * @param event 事件记录
 * @returns 时间标签
 */
function formatEventTime(event: ScheduleEventRecord): string {
  if (event.isAllDay) {
    return `${dayjs(event.startAt).format('MM-DD')} 全天`;
  }
  const start = dayjs(event.startAt).format('MM-DD HH:mm');
  if (event.endAt) {
    return `${start} - ${dayjs(event.endAt).format('HH:mm')}`;
  }
  return start;
}

/**
 * 事件列表与 CRUD 主组件：支持快速录入、筛选、分页、编辑、完成切换、删除。
 */
export function ScheduleEventsSection({
  settings,
  showToast,
  onChanged,
}: ScheduleEventsSectionProps) {
  const [form, setForm] = useState<EventFormState>(() => createEmptyForm(settings.defaultReminderMinutes));
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ScheduleEventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEventRecord | null>(null);
  const [editingForm, setEditingForm] = useState<EventFormState>(() => createEmptyForm(settings.defaultReminderMinutes));
  const [pendingDelete, setPendingDelete] = useState<ScheduleEventRecord | null>(null);

  /**
   * 加载事件列表。
   */
  const loadEvents = async () => {
    setLoading(true);
    try {
      const result = await scheduleApi.list({
        page,
        page_size: PAGE_SIZE,
        keyword,
        status: statusFilter,
        trashed: false,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '日程列表加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [page, keyword, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /**
   * 创建事件。
   */
  const handleCreate = async () => {
    const draft = parseDraft(form);
    if (!draft) {
      showToast('请先填写事件标题。', 'error');
      return;
    }
    try {
      await scheduleApi.create(draft);
      setForm(createEmptyForm(settings.defaultReminderMinutes));
      showToast('日程已保存。');
      onChanged();
      await loadEvents();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '创建日程失败。'), 'error');
    }
  };

  /**
   * 保存编辑。
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
      await loadEvents();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '更新日程失败。'), 'error');
    }
  };

  /**
   * 切换完成状态。
   * @param event 事件记录
   */
  const handleToggleCompleted = async (event: ScheduleEventRecord) => {
    try {
      await scheduleApi.toggleCompleted(event.id, !event.completed);
      showToast(`日程已标记为${event.completed ? '未完成' : '已完成'}。`);
      onChanged();
      await loadEvents();
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
      showToast('日程已移入回收站。');
      onChanged();
      await loadEvents();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '删除日程失败。'), 'error');
    }
  };

  /**
   * 渲染重复规则编辑器。
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
            {WEEKDAY_LABELS.map((item) => (
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
   * 渲染事件表单（创建/编辑共用）。
   */
  const renderEventForm = (
    currentForm: EventFormState,
    setForm: (updater: (prev: EventFormState) => EventFormState) => void,
  ) => (
    <div className="schedule-event-form">
      <Field
        label="标题"
        value={currentForm.title}
        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        placeholder="例如：项目周会"
      />
      <div className="schedule-event-form-row">
        <Switch
          checked={currentForm.isAllDay}
          onChange={(checked) => setForm((prev) => ({ ...prev, isAllDay: checked }))}
          label="全天事件"
        />
      </div>
      <div className="schedule-event-form-row">
        <DateTimePickerField
          label="开始时间"
          value={currentForm.startAt}
          onChange={(value) => setForm((prev) => ({ ...prev, startAt: value }))}
        />
        <DateTimePickerField
          label="结束时间"
          value={currentForm.endAt}
          onChange={(value) => setForm((prev) => ({ ...prev, endAt: value }))}
          clearable
        />
      </div>
      <div className="schedule-event-form-row">
        <SelectField
          label="颜色"
          value={currentForm.color}
          onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
        >
          {COLOR_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </SelectField>
        <SelectField
          label="提醒"
          value={currentForm.reminderMinutes}
          onChange={(event) => setForm((prev) => ({ ...prev, reminderMinutes: event.target.value }))}
        >
          <option value="">不提醒</option>
          {REMINDER_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </SelectField>
      </div>
      <Field
        label="地点"
        value={currentForm.location}
        onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
        placeholder="可选"
      />
      {renderRecurrenceEditor(currentForm.recurrenceType, currentForm.recurrenceWeekdays, currentForm.recurrenceDayOfMonth, ({ recurrenceType, weekdays, dayOfMonth }) => setForm((prev) => ({
        ...prev,
        recurrenceType,
        recurrenceWeekdays: weekdays,
        recurrenceDayOfMonth: dayOfMonth,
      })))}
      {currentForm.recurrenceType !== 'none' ? (
        <Field
          label="重复截止日期"
          type="date"
          value={currentForm.recurrenceEndDate ? dayjs(currentForm.recurrenceEndDate).format('YYYY-MM-DD') : ''}
          onChange={(event) => setForm((prev) => ({
            ...prev,
            recurrenceEndDate: event.target.value ? dayjs(event.target.value).toISOString() : '',
          }))}
          hint="留空则长期重复"
        />
      ) : null}
      <TextArea
        label="描述"
        rows={3}
        value={currentForm.descriptionMarkdown}
        onChange={(event) => setForm((prev) => ({ ...prev, descriptionMarkdown: event.target.value }))}
        placeholder="支持 Markdown"
      />
    </div>
  );

  const hasItems = items.length > 0;

  return (
    <SectionCard
      title="事件列表"
      description="快速录入、筛选、完成切换、编辑和删除都直接命中后端。"
    >
      <div className="page-stack">
        <div className="schedule-surface">
          <div className="schedule-surface-head">
            <div>
              <strong>快速录入</strong>
              <span>常用字段保持紧凑，描述与重复规则在编辑弹窗中细化。</span>
            </div>
            <Tag tone="blue">后端直写</Tag>
          </div>
          <form className="schedule-entry-grid" onSubmit={(event) => { event.preventDefault(); void handleCreate(); }}>
            <Field
              label="标题"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：项目周会"
            />
            <DateTimePickerField
              label="开始时间"
              value={form.startAt}
              onChange={(value) => setForm((current) => ({ ...current, startAt: value }))}
            />
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
              label="重复"
              value={form.recurrenceType}
              onChange={(event) => setForm((current) => ({
                ...current,
                recurrenceType: event.target.value as ScheduleRecurrenceType,
              }))}
            >
              {Object.entries(RECURRENCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelectField>
            <div className="schedule-entry-action">
              <Btn type="submit" tone="primary">新增日程</Btn>
            </div>
          </form>
        </div>

        <div className="schedule-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题、地点"
          />
          <SelectField
            label="状态"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">全部</option>
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
            <option value="recurring">重复事件</option>
          </SelectField>
        </div>

        {hasItems ? (
          <>
            <DataTable
              data={items}
              rowKey="id"
              columns={[
                {
                  key: 'title',
                  title: '事件标题',
                  render: (_, row) => (
                    <div className="schedule-table-title">
                      <span className={`schedule-color-dot color-${row.color || 'indigo'}`} />
                      <div>
                        <strong>{row.title}</strong>
                        {row.location ? <span className="schedule-table-sub">{row.location}</span> : null}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'time',
                  title: '时间',
                  render: (_, row) => <span className="schedule-table-time">{formatEventTime(row)}</span>,
                },
                {
                  key: 'recurrence',
                  title: '重复',
                  render: (_, row) => (
                    row.recurrenceType === 'none'
                      ? <span className="subtle-text">-</span>
                      : <Tag tone="blue">{RECURRENCE_LABELS[row.recurrenceType]}</Tag>
                  ),
                },
                {
                  key: 'reminder',
                  title: '提醒',
                  render: (_, row) => (
                    row.reminderMinutes === null
                      ? <span className="subtle-text">-</span>
                      : <span>{row.reminderMinutes === 0 ? '开始时' : `${row.reminderMinutes} 分钟前`}</span>
                  ),
                },
                {
                  key: 'completed',
                  title: '状态',
                  render: (_, row) => (
                    <Tag tone={row.completed ? 'green' : 'orange'}>
                      {row.completed ? '已完成' : '未完成'}
                    </Tag>
                  ),
                },
                {
                  key: 'actions',
                  title: '操作',
                  align: 'right',
                  render: (_, row) => (
                    <div className="table-actions">
                      <IconBtn
                        tone="secondary"
                        icon={<EditIcon />}
                        title="编辑"
                        onClick={() => {
                          setEditingEvent(row);
                          setEditingForm(buildEditForm(row));
                        }}
                      />
                      <IconBtn
                        tone="secondary"
                        icon={<DeleteIcon />}
                        title="移入回收站"
                        onClick={() => setPendingDelete(row)}
                      />
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无日程"
            description="使用上方快速录入或切换到日历视图新建事件。"
          />
        )}
      </div>

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
            <Btn
              tone="secondary"
              onClick={() => void handleToggleCompleted(editingEvent)}
            >
              {editingEvent.completed ? '标记未完成' : '标记已完成'}
            </Btn>
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
