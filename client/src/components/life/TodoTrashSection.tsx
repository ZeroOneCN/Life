import { useEffect, useMemo, useState } from 'react';

import { DeleteModal, Btn, DataTable, Field, Pagination, SelectField, Tag } from '../ui';
import { EmptyState, SectionCard } from '../page';
import {
  TODO_PAGE_SIZE,
  clearTrashedTodoTasks,
  deleteTodoTaskPermanently,
  filterTodoTasks,
  getTodoPriorityLabel,
  restoreTodoTask,
} from '../../services/todo';
import type { TodoPriority, TodoTaskRecord } from '../../types/todo';

interface TodoTrashSectionProps {
  tasks: TodoTaskRecord[];
  onChangeTasks: (updater: (tasks: TodoTaskRecord[]) => TodoTaskRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function TodoTrashSection({
  tasks,
  onChangeTasks,
  showToast,
}: TodoTrashSectionProps) {
  const [keyword, setKeyword] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TodoPriority>('all');
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const trashedTasks = useMemo(
    () => filterTodoTasks(tasks, {
      keyword,
      priority: priorityFilter,
      includeTrashed: true,
    }),
    [tasks, keyword, priorityFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [keyword, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(trashedTasks.length / TODO_PAGE_SIZE));
  const pageTasks = useMemo(() => {
    const startIndex = (page - 1) * TODO_PAGE_SIZE;
    return trashedTasks.slice(startIndex, startIndex + TODO_PAGE_SIZE);
  }, [trashedTasks, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pendingDeleteTask = pendingDeleteId ? tasks.find((task) => task.id === pendingDeleteId) ?? null : null;

  return (
    <SectionCard
      title="回收站"
      description="已删除的任务会先进入回收站，你可以恢复、永久删除，或一次性清空全部已删除任务。"
      action={<Btn tone="danger" onClick={() => setClearConfirmOpen(true)}>清空回收站</Btn>}
    >
      <div className="page-stack">
        <div className="todo-trash-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题或标签"
          />
          <SelectField
            label="优先级"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
          >
            <option value="all">全部优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </SelectField>
        </div>

        {trashedTasks.length ? (
          <>
            <DataTable
              data={pageTasks}
              rowKey="id"
              columns={[
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
                      <Btn
                        tone="ghost"
                        onClick={() => {
                          onChangeTasks((current) => restoreTodoTask(current, row.id));
                          showToast('任务已恢复。');
                        }}
                      >
                        恢复
                      </Btn>
                      <Btn tone="ghost" onClick={() => setPendingDeleteId(row.id)}>永久删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="回收站为空" description="目前没有已删除任务，删除后的待办会先留在这里。" />
        )}
      </div>

      <DeleteModal
        open={Boolean(pendingDeleteTask)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteTask) {
            return;
          }

          onChangeTasks((current) => deleteTodoTaskPermanently(current, pendingDeleteTask.id));
          setPendingDeleteId(null);
          showToast('任务已永久删除。');
        }}
        title={pendingDeleteTask ? `永久删除：${pendingDeleteTask.title}` : '永久删除任务'}
      >
        永久删除后无法恢复，请确认是否继续。
      </DeleteModal>

      <DeleteModal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          onChangeTasks((current) => clearTrashedTodoTasks(current));
          setClearConfirmOpen(false);
          showToast('回收站已清空。');
        }}
        title="清空回收站"
      >
        这会永久删除所有已进入回收站的任务，操作不可恢复。
      </DeleteModal>
    </SectionCard>
  );
}
