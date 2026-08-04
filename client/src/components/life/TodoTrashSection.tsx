import { Btn, Tag } from '../ui';
import { TrashSection, type TrashFilter } from '../shared/TrashSection';
import { getTodoPriorityLabel } from '../../services/todo';
import { todoApi, type TodoListParams } from '../../services/todoApi';
import type { TodoTaskRecord } from '../../types/todo';

interface TodoTrashSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

/** 优先级过滤选项 */
const PRIORITY_FILTERS: TrashFilter[] = [
  {
    field: 'priority',
    label: '优先级',
    defaultValue: 'all',
    options: [
      { value: 'all', label: '全部优先级' },
      { value: 'high', label: '高优先级' },
      { value: 'medium', label: '中优先级' },
      { value: 'low', label: '低优先级' },
    ],
  },
];

/**
 * 待办回收站区块：基于通用 TrashSection，提供任务专属的列与过滤配置。
 * @param props 组件属性（showToast、onChanged）
 * @returns 渲染待办回收站的 React 元素
 */
export function TodoTrashSection({
  showToast,
  onChanged,
}: TodoTrashSectionProps) {
  return (
    <TrashSection<TodoTaskRecord>
      title="回收站"
      description="已删除的任务会先进入回收站，恢复、永久删除和清空都走后端。"
      entityName="任务"
      searchPlaceholder="搜索标题或标签"
      filterGridClassName="todo-trash-filter-grid"
      filters={PRIORITY_FILTERS}
      columns={(helpers) => [
        { key: 'title', title: '任务标题', dataIndex: 'title' },
        {
          key: 'priority',
          title: '优先级',
          render: (_, row) => <Tag tone="orange">{getTodoPriorityLabel(row.priority)}</Tag>,
        },
        {
          key: 'tags',
          title: '标签',
          render: (_, row) => row.tags.length ? row.tags.join(' / ') : '-',
        },
        {
          key: 'trashedAt',
          title: '删除时间',
          render: (_, row) => row.trashedAt || '-',
        },
        {
          key: 'actions',
          title: '操作',
          render: (_, row) => (
            <div className="todo-table-actions">
              <Btn tone="secondary" onClick={() => helpers.onRestore(row)}>恢复</Btn>
              <Btn tone="danger" onClick={() => helpers.onRequestDelete(row)}>永久删除</Btn>
            </div>
          ),
        },
      ]}
      api={{
        list: (params) => todoApi.list(params as TodoListParams),
        restore: (id) => todoApi.restore(id),
        deletePermanently: (id) => todoApi.deletePermanently(id),
        clearTrash: () => todoApi.clearTrash(),
      }}
      showToast={showToast}
      onChanged={onChanged}
    />
  );
}
