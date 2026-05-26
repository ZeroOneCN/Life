import { useEffect, useState } from 'react';

import { DeleteModal, Btn, DataTable, Field, Pagination, SelectField, Tag } from '../ui';
import { EmptyState, SectionCard } from '../page';
import { buildApiErrorMessage } from '../../lib/api';
import { getTodoPriorityLabel } from '../../services/todo';
import { todoApi } from '../../services/todoApi';
import type { TodoPriority, TodoTaskRecord } from '../../types/todo';

interface TodoTrashSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

const PAGE_SIZE = 10;

export function TodoTrashSection({
  showToast,
  onChanged,
}: TodoTrashSectionProps) {
  const [keyword, setKeyword] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TodoPriority>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TodoTaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TodoTaskRecord | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const loadTrash = async () => {
    try {
      const result = await todoApi.list({
        page,
        page_size: PAGE_SIZE,
        keyword,
        priority: priorityFilter,
        trashed: true,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '回收站加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadTrash();
  }, [page, keyword, priorityFilter]);

  useEffect(() => {
    setPage(1);
  }, [keyword, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SectionCard
      title="回收站"
      description="已删除的任务会先进入回收站，恢复、永久删除和清空都走后端。"
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

        {items.length ? (
          <>
            <DataTable
              data={items}
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
                        onClick={async () => {
                          try {
                            await todoApi.restore(row.id);
                            showToast('任务已恢复。');
                            onChanged();
                            await loadTrash();
                          } catch (error) {
                            showToast(buildApiErrorMessage(error, '恢复任务失败。'), 'error');
                          }
                        }}
                      >
                        恢复
                      </Btn>
                      <Btn tone="ghost" onClick={() => setPendingDeleteTask(row)}>永久删除</Btn>
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
        onClose={() => setPendingDeleteTask(null)}
        onConfirm={() => {
          void (async () => {
            if (!pendingDeleteTask) {
              return;
            }

            try {
              await todoApi.deletePermanently(pendingDeleteTask.id);
              setPendingDeleteTask(null);
              showToast('任务已永久删除。');
              onChanged();
              await loadTrash();
            } catch (error) {
              showToast(buildApiErrorMessage(error, '永久删除失败。'), 'error');
            }
          })();
        }}
        title={pendingDeleteTask ? `永久删除：${pendingDeleteTask.title}` : '永久删除任务'}
      >
        永久删除后无法恢复，请确认是否继续。
      </DeleteModal>

      <DeleteModal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          void (async () => {
            try {
              await todoApi.clearTrash();
              setClearConfirmOpen(false);
              showToast('回收站已清空。');
              onChanged();
              await loadTrash();
            } catch (error) {
              showToast(buildApiErrorMessage(error, '清空回收站失败。'), 'error');
            }
          })();
        }}
        title="清空回收站"
      >
        这会永久删除所有已进入回收站的任务，操作不可恢复。
      </DeleteModal>
    </SectionCard>
  );
}
