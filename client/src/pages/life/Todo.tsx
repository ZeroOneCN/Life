import { useMemo, useState } from 'react';

import { NotificationStatusCard } from '../../components/NotificationStatusCard';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { SettingSwitchCard } from '../../components/SettingSwitchCard';
import { Btn, Checkbox, Field, PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { TodoPageState } from '../../types/pages';

const STORAGE_KEY = 'lifeos_todo_page';

const initialState: TodoPageState = {
  tasks: [
    { id: 'todo-1', title: '准备本周项目复盘', category: '工作', dueDate: '今天', completed: false },
    { id: 'todo-2', title: '整理出差报销单据', category: '财务', dueDate: '明天', completed: false },
    { id: 'todo-3', title: '预约年度体检', category: '健康', dueDate: '本周', completed: true },
  ],
  settings: {
    reminderEnabled: true,
  },
};

const tabOptions = [
  { value: 'tasks', label: '任务列表' },
  { value: 'settings', label: '提醒设置' },
] as const;

export default function TodoPage() {
  const [data, setData] = useLocalStorageState<TodoPageState>(STORAGE_KEY, initialState);
  const [tab, setTab] = usePageTab('tasks', tabOptions.map((item) => item.value));
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('生活');
  const { toast, showToast } = useToastState();

  const pendingCount = useMemo(
    () => data.tasks.filter((task) => !task.completed).length,
    [data.tasks],
  );

  const completedCount = data.tasks.length - pendingCount;

  const addTask = () => {
    if (!taskTitle.trim()) {
      showToast('请输入待办标题。', 'error');
      return;
    }

    setData((previous) => ({
      ...previous,
      tasks: [
        {
          id: Math.random().toString(36).slice(2, 10),
          title: taskTitle.trim(),
          category: taskCategory,
          dueDate: '待安排',
          completed: false,
        },
        ...previous.tasks,
      ],
    }));
    setTaskTitle('');
    showToast('待办事项已创建。');
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="待办事项"
        subtitle="通知设置和发送记录已统一迁移到通知中心，这里只保留业务开关和任务触发。"
        actions={(
          <Btn
            tone="primary"
            onClick={() => {
              const result = enqueueSceneNotification('todo.reminder', {
                message: `今天有 ${pendingCount} 条待办仍未完成，请优先处理。`,
              });
              showToast(result.some((item) => item.status === 'success') ? '待办提醒已写入通知中心。' : '待办提醒未发送，通知中心可能未启用对应渠道。', result.some((item) => item.status === 'success') ? 'success' : 'error');
            }}
          >
            发送今日提醒
          </Btn>
        )}
      />

      <PillTabs
        options={tabOptions.map((item) => ({ value: item.value, label: item.label }))}
        value={tab}
        onChange={(value) => setTab(value as (typeof tabOptions)[number]['value'])}
      />

      {tab === 'tasks' ? (
        <>
          <StatGrid
            items={[
              { label: '待办总数', value: `${data.tasks.length}` },
              { label: '待完成', value: `${pendingCount}`, helper: '将进入提醒摘要' },
              { label: '已完成', value: `${completedCount}` },
            ]}
          />
          <SectionCard title="新增任务" description="轻量记录今天要处理的事项。">
            <div className="form-grid">
              <Field
                label="任务标题"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="例如：确认周会材料"
              />
              <label className="field">
                <span className="field-label">分类</span>
                <select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value)}>
                  <option value="生活">生活</option>
                  <option value="工作">工作</option>
                  <option value="健康">健康</option>
                  <option value="财务">财务</option>
                </select>
              </label>
            </div>
            <Btn tone="primary" onClick={addTask}>添加待办</Btn>
          </SectionCard>
          <SectionCard title="任务列表" description="可以在这里快速勾选完成，提醒汇总会自动读取未完成任务。">
            <div className="stack-list">
              {data.tasks.map((task) => (
                <div className="list-row" key={task.id}>
                  <Checkbox
                    checked={task.completed}
                    onChange={(checked) => {
                      setData((previous) => ({
                        ...previous,
                        tasks: previous.tasks.map((item) => (
                          item.id === task.id
                            ? { ...item, completed: checked }
                            : item
                        )),
                      }));
                    }}
                  >
                    <span className={task.completed ? 'completed-text' : ''}>{task.title}</span>
                  </Checkbox>
                  <div className="list-row-meta">
                    <span>{task.category}</span>
                    <span>{task.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}

      {tab === 'settings' ? (
        <div className="page-stack">
          <SettingSwitchCard
            title="待办提醒开关"
            description="控制待办事项是否向通知中心发起提醒请求。"
            checked={data.settings.reminderEnabled}
            onChange={(checked) => {
              setData((previous) => ({
                ...previous,
                settings: {
                  ...previous.settings,
                  reminderEnabled: checked,
                },
              }));
              updateSceneConfig('todo.reminder', { enabled: checked });
              showToast(`待办提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={data.settings.reminderEnabled ? '已启用' : '已停用'}
            impact="开启后，页面中的“发送今日提醒”动作会通过通知中心统一发送。"
          />
          <NotificationStatusCard
            sceneId="todo.reminder"
            title="通知中心场景状态"
            summary="查看当前绑定渠道、启用状态和统一发送入口。"
          />
        </div>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
