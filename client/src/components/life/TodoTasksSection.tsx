import { useEffect, useMemo, useState } from 'react';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, Checkbox, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  TODO_PAGE_SIZE,
  TODO_PRIORITY_TAG_TONES,
  batchCompleteTodoTasks,
  batchTrashTodoTasks,
  createTodoTask,
  filterTodoTasks,
  getTodoPriorityLabel,
  getTodoStatusLabel,
  getTodoTaskStatus,
  renderTodoMarkdownPreview,
  setTodoTaskCompleted,
  trashTodoTask,
  updateTodoTask,
} from '../../services/todo';
import type { TodoPriority, TodoTaskDraft, TodoTaskRecord } from '../../types/todo';

interface TodoTasksSectionProps {
  tasks: TodoTaskRecord[];
  onChangeTasks: (updater: (tasks: TodoTaskRecord[]) => TodoTaskRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
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
  const status = getTodoTaskStatus(task);

  if (status === 'completed') {
    return 'green';
  }

  if (status === 'overdue') {
    return 'red';
  }

  return task.isDaily ? 'blue' : 'orange';
}

export function TodoTasksSection({
  tasks,
  onChangeTasks,
  showToast,
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
  const [editingTask, setEditingTask] = useState<TodoTaskRecord | null>(null);
  const [editingForm, setEditingForm] = useState<TaskEditFormState>(createDefaultTaskEditFormState);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TodoTaskRecord | null>(null);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((task) => {
      if (!task.trashedAt) {
        task.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return [...tagSet].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  }, [tasks]);

  const filteredTasks = useMemo(
    () => filterTodoTasks(tasks, {
      keyword,
      status: statusFilter,
      priority: priorityFilter,
      tag: tagFilter === 'all' ? '' : tagFilter,
      dueStartDate,
      dueEndDate,
    }),
    [tasks, keyword, statusFilter, priorityFilter, tagFilter, dueStartDate, dueEndDate],
  );

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter, priorityFilter, tagFilter, dueStartDate, dueEndDate]);

  useEffect(() => {
    setSelectedTaskIds((current) => current.filter((taskId) => filteredTasks.some((task) => task.id === taskId)));
  }, [filteredTasks]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TODO_PAGE_SIZE));
  const pageTasks = useMemo(() => {
    const startIndex = (page - 1) * TODO_PAGE_SIZE;
    return filteredTasks.slice(startIndex, startIndex + TODO_PAGE_SIZE);
  }, [filteredTasks, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const allPageSelected = pageTasks.length > 0 && pageTasks.every((task) => selectedTaskIds.includes(task.id));
  const hasSelection = selectedTaskIds.length > 0;

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请先填写任务标题。', 'error');
      return;
    }

    onChangeTasks((current) => createTodoTask(current, draft));
    setForm(createDefaultTaskFormState());
    showToast('待办任务已保存。');
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
        pageTasks.forEach((task) => next.add(task.id));
        return [...next];
      }

      return current.filter((taskId) => !pageTasks.some((task) => task.id === taskId));
    });
  };

  const handleSaveEdit = () => {
    if (!editingTask) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('编辑任务时标题不能为空。', 'error');
      return;
    }

    onChangeTasks((current) => updateTodoTask(current, editingTask.id, draft));
    setEditingTask(null);
    showToast('任务已更新。');
  };

  const handleDelete = () => {
    if (!pendingDeleteTask) {
      return;
    }

    onChangeTasks((current) => trashTodoTask(current, pendingDeleteTask.id));
    setPendingDeleteTask(null);
    setSelectedTaskIds((current) => current.filter((taskId) => taskId !== pendingDeleteTask.id));
    showToast('任务已移入回收站。');
  };

  return (
    <SectionCard
      title="任务列表"
      description="在当前页完成新增、筛选、编辑、批量完成和软删除，所有提醒都会基于这里的有效任务自动计算。"
    >
      <div className="page-stack">
        <div className="todo-entry-grid">
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
            <Btn tone="primary" onClick={handleCreate}>保存任务</Btn>
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

        {hasSelection ? (
          <div className="todo-batch-toolbar">
            <span>已选择 {selectedTaskIds.length} 项任务</span>
            <div className="inline-row">
              <Btn
                tone="secondary"
                onClick={() => {
                  onChangeTasks((current) => batchCompleteTodoTasks(current, selectedTaskIds));
                  setSelectedTaskIds([]);
                  showToast('已批量标记完成。');
                }}
              >
                批量完成
              </Btn>
              <Btn
                tone="danger"
                onClick={() => {
                  onChangeTasks((current) => batchTrashTodoTasks(current, selectedTaskIds));
                  setSelectedTaskIds([]);
                  showToast('已批量移入回收站。');
                }}
              >
                批量移入回收站
              </Btn>
              <Btn tone="ghost" onClick={() => setSelectedTaskIds([])}>取消选择</Btn>
            </div>
          </div>
        ) : null}

        {filteredTasks.length ? (
          <>
            <DataTable
              data={pageTasks}
              rowKey="id"
              columns={[
                {
                  key: 'selection',
                  title: (
                    <Checkbox checked={allPageSelected} onChange={handleTogglePageSelection}>
                      全选
                    </Checkbox>
                  ),
                  width: 120,
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
                      {row.descriptionMarkdown ? <span>含 Markdown 描述</span> : null}
                    </div>
                  ),
                },
                {
                  key: 'priority',
                  title: '优先级',
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
                  render: (_, row) => row.dueDate || '-',
                },
                {
                  key: 'status',
                  title: '状态',
                  render: (_, row) => <Tag tone={getStatusTone(row)}>{getTodoStatusLabel(row)}</Tag>,
                },
                {
                  key: 'daily',
                  title: '每日任务',
                  render: (_, row) => (row.isDaily ? '是' : '否'),
                },
                {
                  key: 'actions',
                  title: '操作',
                  width: 260,
                  render: (_, row) => (
                    <div className="todo-table-actions">
                      <Btn
                        tone="ghost"
                        onClick={() => {
                          setEditingTask(row);
                          setEditingForm(buildEditFormState(row));
                        }}
                      >
                        编辑
                      </Btn>
                      <Btn
                        tone="ghost"
                        onClick={() => {
                          onChangeTasks((current) => setTodoTaskCompleted(current, row.id, !row.completed));
                          showToast(row.completed ? '任务已恢复为未完成。' : '任务已标记完成。');
                        }}
                      >
                        {row.completed ? '设为待办' : '完成'}
                      </Btn>
                      <Btn tone="ghost" onClick={() => setPendingDeleteTask(row)}>删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无符合条件的任务" description="可以先新增待办，或者放宽筛选条件后再查看。" />
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
        onConfirm={handleDelete}
        title={pendingDeleteTask ? `移入回收站：${pendingDeleteTask.title}` : '移入回收站'}
      >
        删除后的任务不会立刻丢失，可以在回收站中恢复或永久删除。
      </DeleteModal>
    </SectionCard>
  );
}
