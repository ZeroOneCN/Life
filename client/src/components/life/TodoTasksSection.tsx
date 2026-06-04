import { useEffect, useMemo, useState } from 'react';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, Checkbox, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { TODO_PRIORITY_TAG_TONES, getTodoPriorityLabel, getTodoStatusLabel, renderTodoMarkdownPreview } from '../../services/todo';
import { todoApi } from '../../services/todoApi';
import type { TodoPriority, TodoTaskDraft, TodoTaskRecord } from '../../types/todo';

interface TodoTasksSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

interface TaskFormState {
  title: string;
  dueDate: string;
  priority: TodoPriority;
  tagsText: string;
  isDaily: boolean;
}

interface TaskEditFormState extends TaskFormState {
  descriptionMarkdown: string;
}

const PAGE_SIZE = 10;

function parseTags(tagsText: string) {
  return tagsText
    .split(/[，,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function createDefaultTaskFormState(): TaskFormState {
  return {
    title: '',
    dueDate: '',
    priority: 'medium',
    tagsText: '',
    isDaily: false,
  };
}

function createDefaultTaskEditFormState(): TaskEditFormState {
  return {
    ...createDefaultTaskFormState(),
    descriptionMarkdown: '',
  };
}

function buildEditFormState(task: TodoTaskRecord): TaskEditFormState {
  return {
    title: task.title,
    dueDate: task.dueDate,
    priority: task.priority,
    tagsText: task.tags.join(', '),
    isDaily: task.isDaily,
    descriptionMarkdown: task.descriptionMarkdown,
  };
}

function parseDraft(form: TaskFormState | TaskEditFormState): TodoTaskDraft | null {
  if (!form.title.trim()) {
    return null;
  }

  return {
    title: form.title.trim(),
    dueDate: form.dueDate,
    priority: form.priority,
    tags: parseTags(form.tagsText),
    isDaily: form.isDaily,
    descriptionMarkdown: 'descriptionMarkdown' in form ? form.descriptionMarkdown.trim() : '',
  };
}

function getStatusTone(task: TodoTaskRecord): 'green' | 'orange' | 'red' | 'blue' {
  const label = getTodoStatusLabel(task);

  if (label === '已完成') {
    return 'green';
  }

  if (label === '已逾期') {
    return 'red';
  }

  return task.isDaily ? 'blue' : 'orange';
}

export function TodoTasksSection({
  showToast,
  onChanged,
}: TodoTasksSectionProps) {
  const [form, setForm] = useState<TaskFormState>(createDefaultTaskFormState);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue' | 'daily'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TodoPriority>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [dueStartDate, setDueStartDate] = useState('');
  const [dueEndDate, setDueEndDate] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<TodoTaskRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [editingTask, setEditingTask] = useState<TodoTaskRecord | null>(null);
  const [editingForm, setEditingForm] = useState<TaskEditFormState>(createDefaultTaskEditFormState);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TodoTaskRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((task) => {
      task.tags.forEach((tag) => tagSet.add(tag));
    });
    return [...tagSet].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  }, [items]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const result = await todoApi.list({
        page,
        page_size: PAGE_SIZE,
        keyword,
        status: statusFilter,
        priority: priorityFilter,
        tag: tagFilter === 'all' ? '' : tagFilter,
        dueStartDate,
        dueEndDate,
        trashed: false,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '任务列表加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [page, keyword, statusFilter, priorityFilter, tagFilter, dueStartDate, dueEndDate]);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter, priorityFilter, tagFilter, dueStartDate, dueEndDate]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allPageSelected = items.length > 0 && items.every((task) => selectedTaskIds.includes(task.id));
  const hasSelection = selectedTaskIds.length > 0;
  const hasActiveFilters = Boolean(
    keyword
    || statusFilter !== 'all'
    || priorityFilter !== 'all'
    || tagFilter !== 'all'
    || dueStartDate
    || dueEndDate,
  );

  const handleCreate = async () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请先填写任务标题。', 'error');
      return;
    }

    try {
      await todoApi.create(draft);
      setForm(createDefaultTaskFormState());
      showToast('待办任务已保存。');
      onChanged();
      await loadTasks();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '创建任务失败。'), 'error');
    }
  };

  const handleToggleSelection = (taskId: string, checked: boolean) => {
    setSelectedTaskIds((current) => (
      checked
        ? [...current, taskId]
        : current.filter((item) => item !== taskId)
    ));
  };

  const handleTogglePageSelection = (checked: boolean) => {
    setSelectedTaskIds((current) => {
      if (checked) {
        const next = new Set(current);
        items.forEach((task) => next.add(task.id));
        return [...next];
      }

      return current.filter((taskId) => !items.some((task) => task.id === taskId));
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('编辑任务时标题不能为空。', 'error');
      return;
    }

    try {
      await todoApi.update(editingTask.id, draft);
      setEditingTask(null);
      showToast('任务已更新。');
      onChanged();
      await loadTasks();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '更新任务失败。'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteTask) {
      return;
    }

    try {
      await todoApi.trash(pendingDeleteTask.id);
      setPendingDeleteTask(null);
      setSelectedTaskIds((current) => current.filter((taskId) => taskId !== pendingDeleteTask.id));
      showToast('任务已移入回收站。');
      onChanged();
      await loadTasks();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '删除任务失败。'), 'error');
    }
  };

  const resetFilters = () => {
    setKeyword('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setTagFilter('all');
    setDueStartDate('');
    setDueEndDate('');
  };

  return (
    <SectionCard
      title="任务列表"
      description="新增、筛选、完成、批量操作和编辑都直接命中后端，页面不再维护本地任务主状态。"
    >
      <div className="page-stack">
        <div className="todo-surface">
          <div className="todo-surface-head">
            <div>
              <strong>快速录入</strong>
              <span>常用字段保持紧凑输入，描述内容放到编辑弹窗里细化。</span>
            </div>
            <Tag tone="blue">后端直写</Tag>
          </div>

          <form className="todo-entry-grid" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
            <Field
              label="任务标题"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：确认周会材料"
            />
            <DatePickerField
              label="截止日期"
              value={form.dueDate}
              onChange={(value) => setForm((current) => ({ ...current, dueDate: value }))}
              clearable
              popoverStrategy="floating"
            />
            <label className="todo-checkbox-field">
              <span className="field-label">重复规则</span>
              <Checkbox
                checked={form.isDaily}
                onChange={(checked) => setForm((current) => ({ ...current, isDaily: checked }))}
              >
                每日任务
              </Checkbox>
            </label>
            <SelectField
              label="优先级"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TodoPriority }))}
            >
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </SelectField>
            <Field
              label="标签"
              value={form.tagsText}
              onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
              placeholder="用逗号分隔多个标签"
            />
            <div className="todo-entry-action">
              <Btn tone="primary" type="submit">保存任务</Btn>
            </div>
          </form>
        </div>

        <div className="todo-surface">
          <div className="todo-surface-head">
            <div>
              <strong>筛选工具</strong>
              <span>优先使用后端 query 参数过滤，避免全量拉回再本地拼装。</span>
            </div>
            <div className="todo-surface-actions">
              <Tag>{loading ? '加载中' : `当前 ${total} 项`}</Tag>
              {selectedTaskIds.length ? <Tag tone="blue">已选 {selectedTaskIds.length} 项</Tag> : null}
              <Btn tone="ghost" disabled={!hasActiveFilters} onClick={resetFilters}>重置筛选</Btn>
            </div>
          </div>

          <div className="todo-filter-grid">
            <Field
              label="关键词"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题、描述或标签"
            />
            <SelectField label="状态" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">全部状态</option>
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
              <option value="overdue">已逾期</option>
              <option value="daily">每日任务</option>
            </SelectField>
            <SelectField label="优先级" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
              <option value="all">全部优先级</option>
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </SelectField>
            <SelectField label="标签筛选" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">全部标签</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </SelectField>
            <DatePickerField
              label="到期开始"
              value={dueStartDate}
              onChange={setDueStartDate}
              clearable
              popoverStrategy="floating"
            />
            <DatePickerField
              label="到期结束"
              value={dueEndDate}
              onChange={setDueEndDate}
              clearable
              popoverStrategy="floating"
            />
          </div>
        </div>

        {hasSelection ? (
          <div className="todo-batch-toolbar">
            <span>已选择 {selectedTaskIds.length} 项任务</span>
            <div className="inline-row">
              <Btn
                tone="secondary"
                onClick={async () => {
                  try {
                    await todoApi.batchComplete(selectedTaskIds);
                    setSelectedTaskIds([]);
                    showToast('已批量标记完成。');
                    onChanged();
                    await loadTasks();
                  } catch (error) {
                    showToast(buildApiErrorMessage(error, '批量完成失败。'), 'error');
                  }
                }}
              >
                批量完成
              </Btn>
              <Btn
                tone="danger"
                onClick={async () => {
                  try {
                    await todoApi.batchTrash(selectedTaskIds);
                    setSelectedTaskIds([]);
                    showToast('已批量移入回收站。');
                    onChanged();
                    await loadTasks();
                  } catch (error) {
                    showToast(buildApiErrorMessage(error, '批量删除失败。'), 'error');
                  }
                }}
              >
                批量移入回收站
              </Btn>
              <Btn tone="ghost" onClick={() => setSelectedTaskIds([])}>取消选择</Btn>
            </div>
          </div>
        ) : null}

        <div className="todo-list-summary">
          <div>
            <strong>任务结果</strong>
            <span>当前页 {items.length} 项，共 {total} 项匹配结果。</span>
          </div>
        </div>

        {items.length ? (
          <>
            <DataTable
              data={items}
              rowKey="id"
              columns={[
                {
                  key: 'selection',
                  title: (
                    <Checkbox checked={allPageSelected} onChange={handleTogglePageSelection}>
                      全选
                    </Checkbox>
                  ),
                  width: 52,
                  render: (_, row) => (
                    <Checkbox
                      checked={selectedTaskIds.includes(row.id)}
                      onChange={(checked) => handleToggleSelection(row.id, checked)}
                    />
                  ),
                },
                {
                  key: 'title',
                  title: '任务',
                  render: (_, row) => (
                    <div className="todo-task-title-cell">
                      <strong className={row.completed ? 'completed-text' : ''}>{row.title}</strong>
                    </div>
                  ),
                },
                {
                  key: 'priority',
                  title: '优先级',
                  align: 'center' as const,
                  render: (_, row) => <Tag tone={TODO_PRIORITY_TAG_TONES[row.priority]}>{getTodoPriorityLabel(row.priority)}</Tag>,
                },
                {
                  key: 'tags',
                  title: '标签',
                  render: (_, row) => (
                    <div className="todo-tag-list">
                      {row.tags.length ? row.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : <span className="subtle-text">-</span>}
                    </div>
                  ),
                },
                {
                  key: 'dueDate',
                  title: '截止日期',
                  align: 'center' as const,
                  render: (_, row) => row.dueDate || '-',
                },
                {
                  key: 'status',
                  title: '状态',
                  align: 'center' as const,
                  render: (_, row) => <Tag tone={getStatusTone(row)}>{getTodoStatusLabel(row)}</Tag>,
                },
                {
                  key: 'actions',
                  title: '操作',
                  width: 200,
                  render: (_, row) => (
                    <div className="todo-table-actions">
                      <Btn
                        tone="secondary"
                        onClick={() => {
                          setEditingTask(row);
                          setEditingForm(buildEditFormState(row));
                        }}
                      >
                        编辑
                      </Btn>
                      <Btn
                        tone="secondary"
                        onClick={async () => {
                          try {
                            await todoApi.toggleCompleted(row.id, !row.completed);
                            showToast(row.completed ? '任务已恢复为未完成。' : '任务已标记完成。');
                            onChanged();
                            await loadTasks();
                          } catch (error) {
                            showToast(buildApiErrorMessage(error, '切换任务状态失败。'), 'error');
                          }
                        }}
                      >
                        {row.completed ? '恢复' : '完成'}
                      </Btn>
                      <Btn tone="danger" onClick={() => setPendingDeleteTask(row)}>删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无符合条件的任务" description="可以先新建待办，或者放宽筛选条件后再查看。" icon="✅" />
        )}
      </div>

      <Modal
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        title={editingTask ? `编辑任务：${editingTask.title}` : '编辑任务'}
        width={980}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingTask(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="todo-modal-grid">
          <Field
            label="任务标题"
            value={editingForm.title}
            onChange={(event) => setEditingForm((current) => ({ ...current, title: event.target.value }))}
          />
          <DatePickerField
            label="截止日期"
            value={editingForm.dueDate}
            onChange={(value) => setEditingForm((current) => ({ ...current, dueDate: value }))}
            clearable
            popoverStrategy="floating"
          />
          <SelectField
            label="优先级"
            value={editingForm.priority}
            onChange={(event) => setEditingForm((current) => ({ ...current, priority: event.target.value as TodoPriority }))}
          >
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </SelectField>
          <label className="todo-checkbox-field">
            <span className="field-label">重复规则</span>
            <Checkbox
              checked={editingForm.isDaily}
              onChange={(checked) => setEditingForm((current) => ({ ...current, isDaily: checked }))}
            >
              每日任务
            </Checkbox>
          </label>
          <Field
            label="标签"
            value={editingForm.tagsText}
            onChange={(event) => setEditingForm((current) => ({ ...current, tagsText: event.target.value }))}
            placeholder="用逗号分隔多个标签"
          />
        </div>

        <div className="todo-markdown-grid">
          <TextArea
            label="Markdown 描述"
            value={editingForm.descriptionMarkdown}
            onChange={(event) => setEditingForm((current) => ({ ...current, descriptionMarkdown: event.target.value }))}
            placeholder="支持标题、列表、引用、代码块和段落。"
          />
          <div className="todo-markdown-preview card">
            <div className="todo-markdown-preview-head">
              <strong>预览</strong>
              <span className="subtle-text">常用 Markdown 子集</span>
            </div>
            <div
              className="todo-markdown-preview-body"
              dangerouslySetInnerHTML={{ __html: renderTodoMarkdownPreview(editingForm.descriptionMarkdown) }}
            />
          </div>
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteTask)}
        onClose={() => setPendingDeleteTask(null)}
        onConfirm={() => void handleDelete()}
        title={pendingDeleteTask ? `移入回收站：${pendingDeleteTask.title}` : '移入回收站'}
      >
        删除后的任务不会立刻丢失，可以在回收站中恢复或永久删除。
      </DeleteModal>
    </SectionCard>
  );
}
