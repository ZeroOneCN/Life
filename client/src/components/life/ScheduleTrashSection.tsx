import { Btn, Tag } from '../ui';
import { TrashSection, type TrashFilter } from '../shared/TrashSection';
import { scheduleApi } from '../../services/scheduleApi';
import type {
  ScheduleEventRecord,
  ScheduleListParams,
  ScheduleRecurrenceType,
} from '../../types/schedule';

interface ScheduleTrashSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

/** 重复类型展示文案 */
const RECURRENCE_LABELS: Record<ScheduleRecurrenceType, string> = {
  none: '不重复',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
};

/** 重复类型过滤选项 */
const RECURRENCE_FILTERS: TrashFilter[] = [
  {
    field: 'recurrenceType',
    label: '重复类型',
    defaultValue: 'all',
    options: [
      { value: 'all', label: '全部' },
      { value: 'none', label: '不重复' },
      { value: 'daily', label: '每日' },
      { value: 'weekly', label: '每周' },
      { value: 'monthly', label: '每月' },
    ],
  },
];

/**
 * 日程回收站区块：基于通用 TrashSection，提供日程专属的列与过滤配置。
 * @param props 组件属性（showToast、onChanged）
 * @returns 渲染日程回收站的 React 元素
 */
export function ScheduleTrashSection({
  showToast,
  onChanged,
}: ScheduleTrashSectionProps) {
  return (
    <TrashSection<ScheduleEventRecord>
      title="回收站"
      description="已删除的日程会先进入回收站，恢复、永久删除和清空都走后端。"
      entityName="日程"
      searchPlaceholder="搜索标题、地点"
      filterGridClassName="schedule-trash-filter-grid"
      filters={RECURRENCE_FILTERS}
      columns={(helpers) => [
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
          key: 'recurrence',
          title: '重复',
          render: (_, row) => (
            row.recurrenceType === 'none'
              ? <span className="subtle-text">-</span>
              : <Tag tone="blue">{RECURRENCE_LABELS[row.recurrenceType]}</Tag>
          ),
        },
        {
          key: 'trashedAt',
          title: '删除时间',
          render: (_, row) => row.trashedAt || '-',
        },
        {
          key: 'actions',
          title: '操作',
          align: 'right',
          render: (_, row) => (
            <div className="table-actions">
              <Btn tone="secondary" onClick={() => helpers.onRestore(row)}>恢复</Btn>
              <Btn tone="danger" onClick={() => helpers.onRequestDelete(row)}>永久删除</Btn>
            </div>
          ),
        },
      ]}
      api={{
        list: (params) => scheduleApi.list(params as ScheduleListParams),
        restore: (id) => scheduleApi.restore(id),
        deletePermanently: (id) => scheduleApi.deletePermanently(id),
        clearTrash: () => scheduleApi.clearTrash(),
      }}
      showToast={showToast}
      onChanged={onChanged}
    />
  );
}
