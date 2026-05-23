import { useState, useEffect, useMemo } from 'react';
import {
  Input, Button, Select, Modal, Popconfirm, message, Table, Segmented, DatePicker, Switch, Tag, Checkbox,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, UndoOutlined, DeleteFilled,
  UnorderedListOutlined, SettingOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const STORAGE_KEY = 'lifeos_todo_data';
const PAGE_SIZE = 10;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let taskId = 1, logId = 1;

  const tasks = [
    { title: '完成季度工作总结报告', description: '汇总本季度工作成果，包括项目进展、数据分析和下季度计划。', due_date: dayjs().add(3, 'day').format('YYYY-MM-DD'), priority: 'high', tags: ['工作', '报告'], status: 'active', is_daily: false },
    { title: '购买生日礼物', description: '记得买生日礼物，预算 500 元左右。', due_date: dayjs().add(7, 'day').format('YYYY-MM-DD'), priority: 'medium', tags: ['个人'], status: 'active', is_daily: false },
    { title: '每周健身 3 次', description: '保持锻炼习惯，每周至少去健身房 3 次。', due_date: '', priority: 'low', tags: ['健康', '习惯'], status: 'active', is_daily: false },
    { title: '阅读《系统设计面试》', description: '每天读一章，做好笔记。', due_date: '', priority: 'medium', tags: ['学习'], status: 'active', is_daily: false },
    { title: '缴纳水电费', description: '检查本月水电费账单并完成支付。', due_date: dayjs().add(1, 'day').format('YYYY-MM-DD'), priority: 'high', tags: ['生活'], status: 'active', is_daily: false },
    { title: '整理书架', description: '', due_date: '', priority: 'low', tags: ['生活'], status: 'completed', is_daily: false },
    { title: '每日晨会', description: '团队每日站会，同步工作进度。', due_date: '', priority: 'medium', tags: ['工作'], status: 'active', is_daily: true },
    { title: '复盘当日工作', description: '记录当天完成的工作和遇到的问题。', due_date: '', priority: 'low', tags: ['工作', '习惯'], status: 'completed', is_daily: true },
  ];

  const now = dayjs();
  return {
    tasks: tasks.map((t, i) => ({
      id: taskId++,
      ...t,
      tags: t.tags.join(','),
      created_at: now.subtract(rand(1, 30), 'day').format('YYYY-MM-DD HH:mm'),
      completed_at: t.status === 'completed' ? now.subtract(rand(1, 5), 'day').format('YYYY-MM-DD HH:mm') : null,
      deleted_at: null,
    })),
    settings: {
      notification_enabled: false,
    },
    logs: [
      { id: logId++, time: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm'), type: '企业微信', result: '成功', detail: '成功发送 5 条待办通知' },
      { id: logId++, time: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm'), type: '邮件', result: '失败', detail: 'SMTP 连接超时' },
    ],
    taskIdCounter: taskId,
    logIdCounter: logId,
  };
}

function useIsLight() {
  const [isLight, setIsLight] = useState(() => {
    try { return localStorage.getItem('theme') === 'light'; } catch { return false; }
  });
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setIsLight(el.classList.contains('light')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isLight;
}

function modalTitle(text, c) {
  return <span style={{ color: c.text, fontWeight: 600 }}>{text}</span>;
}
function modalStyles(c) {
  return {
    content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
    header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
    mask: { backdropFilter: 'blur(4px)' },
  };
}
const okBtn = { style: { background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 } };
function cancelBtn(c) {
  return { style: { background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 } };
}

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };

function TablePagination({ c, inputStyle, page, totalPages, onPageChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
      <Button disabled={page <= 1} onClick={() => onPageChange(1)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>首页</Button>
      <Button disabled={page <= 1} onClick={() => onPageChange(p => p - 1)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>上一页</Button>
      <span style={{ color: c.muted, fontSize: 13 }}>第 {page} / {totalPages} 页</span>
      <Button disabled={page >= totalPages} onClick={() => onPageChange(p => p + 1)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>下一页</Button>
      <Button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>末页</Button>
    </div>
  );
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */

export default function Todo() {
  const isLight = useIsLight();
  const defaultTab = '任务列表';
  const [tab, setTab] = useState(() => window.location.hash?.slice(1) || defaultTab);
  const handleTabChange = (v) => { setTab(v); window.location.hash = v; };
  useEffect(() => {
    const onHashChange = () => { const h = window.location.hash?.slice(1); if (h) setTab(h); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const [data, setData] = useState(seedMock);
  const [dirty, setDirty] = useState(0);
  const increment = () => setDirty(v => v + 1);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data, dirty]);

  const c = useMemo(() => ({
    text: isLight ? '#1f1f1f' : '#e8e8e8',
    textSecondary: isLight ? '#666' : '#a0a0a0',
    muted: isLight ? '#999' : '#666',
    muted2: isLight ? '#bbb' : '#444',
    border: isLight ? '#e0e0e0' : '#23252a',
    surface: isLight ? '#fff' : '#1a1b1e',
    surfaceTint: isLight ? '#f5f5f5' : '#25262b',
    surfaceTint2: isLight ? '#fafafa' : '#202125',
    dropdownBg: isLight ? '#fff' : '#2a2b30',
    cardBg: isLight ? '#fff' : '#18191c',
  }), [isLight]);

  const fs = useMemo(() => ({
    sectionTitle: { fontSize: 16, fontWeight: 600 },
    cardValue: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' },
    cardLabel: { fontSize: 13, fontWeight: 500 },
    tableCell: { fontSize: 14 },
    tableCellSm: { fontSize: 13 },
  }), []);

  const inputStyle = { background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 40, lineHeight: '40px' };
  const labelStyle = { display: 'block', marginBottom: 6, color: c.textSecondary, fontSize: 13, fontWeight: 500 };

  const tabItems = [
    { value: '任务列表', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UnorderedListOutlined />任务列表</span> },
    { value: '设置通知', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SettingOutlined />设置通知</span> },
    { value: '通知日志', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileTextOutlined />通知日志</span> },
    { value: '回收站', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DeleteOutlined />回收站</span> },
  ];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>待办事项</h1>
      <Segmented value={tab} onChange={handleTabChange} options={tabItems}
        style={{ marginBottom: 20, background: c.surfaceTint, borderRadius: 10, padding: 3 }} />

      {tab === '任务列表' && <TasksTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {tab === '设置通知' && <SettingsTab c={c} data={data} setData={setData} />}
      {tab === '通知日志' && <LogsTab c={c} data={data} inputStyle={inputStyle} />}
      {tab === '回收站' && <TrashTab c={c} data={data} setData={setData} inputStyle={inputStyle} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   Tasks Tab — 任务列表
   ═══════════════════════════════════════ */
function TasksTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [isDaily, setIsDaily] = useState(false);
  const [priority, setPriority] = useState('medium');
  const [tags, setTags] = useState('');
  const [filterStatus, setFilterStatus] = useState();
  const [filterPriority, setFilterPriority] = useState();
  const [filterTag, setFilterTag] = useState();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'medium', due_date: null, tags: '' });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const activeTasks = useMemo(() => data.tasks.filter(t => !t.deleted_at), [data.tasks]);

  const filtered = useMemo(() => {
    let list = [...activeTasks];
    if (filterStatus) list = list.filter(t => t.status === filterStatus);
    if (filterPriority) list = list.filter(t => t.priority === filterPriority);
    if (filterTag) list = list.filter(t => t.tags.includes(filterTag));
    return list.sort((a, b) => {
      if (a.priority !== b.priority) return { high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority];
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.id - a.id;
    });
  }, [activeTasks, filterStatus, filterPriority, filterTag]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filterStatus, filterPriority, filterTag]);

  useEffect(() => { setSelected([]); }, [filtered.length]);

  const total = activeTasks.length;
  const activeCount = activeTasks.filter(t => t.status === 'active').length;
  const completedCount = activeTasks.filter(t => t.status === 'completed').length;
  const dailyCount = activeTasks.filter(t => t.is_daily).length;

  const allTags = useMemo(() => {
    const set = new Set();
    activeTasks.forEach(t => (t.tags || '').split(',').filter(Boolean).forEach(tag => set.add(tag)));
    return Array.from(set);
  }, [activeTasks]);

  const handleAdd = (e) => {
    e?.preventDefault();
    if (!title.trim()) { message.error('请输入任务标题'); return; }
    setData(prev => ({
      ...prev,
      tasks: [{
        id: prev.taskIdCounter,
        title: title.trim(),
        description: '',
        due_date: dueDate ? dayjs(dueDate).format('YYYY-MM-DD') : '',
        priority,
        tags,
        status: 'active',
        is_daily: isDaily,
        created_at: dayjs().format('YYYY-MM-DD HH:mm'),
        completed_at: null,
        deleted_at: null,
      }, ...prev.tasks],
      taskIdCounter: prev.taskIdCounter + 1,
    }));
    setTitle(''); setDueDate(null); setTags(''); setPriority('medium'); setIsDaily(false);
    message.success('已添加');
  };

  const toggleComplete = (item) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === item.id
          ? { ...t, status: t.status === 'active' ? 'completed' : 'active', completed_at: t.status === 'active' ? dayjs().format('YYYY-MM-DD HH:mm') : null }
          : t
      ),
    }));
  };

  const deleteTask = (item) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === item.id ? { ...t, deleted_at: dayjs().format('YYYY-MM-DD HH:mm') } : t),
    }));
    message.success('已移入回收站');
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      description: item.description || '',
      priority: item.priority,
      due_date: item.due_date ? dayjs(item.due_date) : null,
      tags: item.tags || '',
    });
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editForm.title.trim()) { message.error('请输入标题'); return; }
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === editItem.id
          ? { ...t, title: editForm.title.trim(), description: editForm.description, priority: editForm.priority, due_date: editForm.due_date ? dayjs(editForm.due_date).format('YYYY-MM-DD') : '', tags: editForm.tags }
          : t
      ),
    }));
    setEditOpen(false);
    message.success('已更新');
  };

  const handleBatchComplete = () => {
    if (!selected.length) { message.error('请选择任务'); return; }
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => selected.includes(t.id) ? { ...t, status: 'completed', completed_at: dayjs().format('YYYY-MM-DD HH:mm') } : t),
    }));
    setSelected([]);
    message.success('批量完成成功');
  };

  const handleBatchDelete = () => {
    if (!selected.length) { message.error('请选择任务'); return; }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => selected.includes(t.id) ? { ...t, deleted_at: now } : t),
    }));
    setSelected([]);
    message.success('已移入回收站');
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const tagOptions = useMemo(() => allTags.map(t => ({ value: t, label: t })), [allTags]);

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: '总任务', value: total, color: c.text },
          { label: '进行中', value: activeCount, color: '#3b82f6' },
          { label: '已完成', value: completedCount, color: '#10b981' },
          { label: '重复任务', value: dailyCount, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label}
            style={{ flex: 1, background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ color: c.muted, fontSize: 12 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 20, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add task form */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="输入新任务... (Enter 添加)" style={{ ...inputStyle, flex: 1, height: 40 }} />
            <DatePicker value={dueDate} onChange={v => setDueDate(v)}
              style={{ ...inputStyle, width: 160, height: 40 }} placeholder="截止日期" />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Checkbox checked={isDaily} onChange={e => setIsDaily(e.target.checked)}
              style={{ color: c.textSecondary, fontSize: 13 }}>
              <span style={{ color: c.textSecondary }}>每日都要</span>
            </Checkbox>
            <Select value={priority} onChange={v => setPriority(v)}
              style={{ width: 140 }} dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
              options={[
                { value: 'high', label: '高优先级' },
                { value: 'medium', label: '中优先级' },
                { value: 'low', label: '低优先级' },
              ]} />
            <Input value={tags} onChange={e => setTags(e.target.value)}
              placeholder="标签（逗号分隔）" style={{ ...inputStyle, width: 180, height: 40 }} />
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}
              style={{ height: 40, fontSize: 14, fontWeight: 500, borderRadius: 8 }}>添加任务</Button>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select value={filterStatus} onChange={v => setFilterStatus(v)} placeholder="全部状态" allowClear
          style={{ width: 130 }} dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
          options={[
            { value: 'active', label: '进行中' },
            { value: 'completed', label: '已完成' },
          ]} />
        <Select value={filterPriority} onChange={v => setFilterPriority(v)} placeholder="全部优先级" allowClear
          style={{ width: 140 }} dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
          options={[
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
          ]} />
        <Select value={filterTag} onChange={v => setFilterTag(v)} placeholder="全部标签" allowClear
          style={{ width: 140 }} dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
          options={tagOptions} />
        <Button onClick={() => { setFilterStatus(); setFilterPriority(); setFilterTag(); }}
          style={{ height: 36, fontSize: 13, color: c.text, background: c.surfaceTint, border: '1px solid ' + c.border }}>清除筛选</Button>
      </div>

      {/* Batch toolbar */}
      {selected.length > 0 && (
        <div style={{ background: c.surfaceTint2, border: '1px solid ' + c.border, borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: c.textSecondary, fontSize: 13, fontWeight: 500 }}>已选择 {selected.length} 个任务</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={handleBatchComplete}
              style={{ fontSize: 12, color: '#059669', background: c.surfaceTint, border: '1px solid ' + c.border }}>批量完成</Button>
            <Button size="small" onClick={handleBatchDelete}
              style={{ fontSize: 12, color: '#dc2626', background: c.surfaceTint, border: '1px solid ' + c.border }}>批量删除</Button>
            <Button size="small" onClick={() => setSelected(new Set())}
              style={{ fontSize: 12, color: c.textSecondary, background: c.surfaceTint, border: '1px solid ' + c.border }}>取消选择</Button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, overflow: 'hidden' }}>
        {paged.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: c.muted2, fontSize: 14 }}>暂无任务</div>
        ) : (
          <div style={{ borderTop: 'none' }}>
            {paged.map(item => (
              <div key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                  borderBottom: '1px solid ' + c.border,
                  borderLeft: '4px solid ' + PRIORITY_COLORS[item.priority],
                  opacity: item.status === 'completed' ? 0.6 : 1,
                  background: selected.includes(item.id) ? c.surfaceTint2 : 'transparent',
                }}>
                <Checkbox checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                <Button type="text" size="small" onClick={() => toggleComplete(item)}
                  icon={<CheckCircleOutlined style={{ color: item.status === 'completed' ? '#10b981' : c.muted, fontSize: 18 }} />}
                  style={{ padding: 0, height: 'auto', minWidth: 'auto' }} />
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { setDetailItem(item); setDetailOpen(true); }}>
                  <div style={{
                    color: item.status === 'completed' ? c.muted : c.text,
                    fontSize: 14, fontWeight: 500, textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    {(item.tags || '').split(',').filter(Boolean).map(tag => (
                      <span key={tag} style={{ fontSize: 11, color: c.muted, background: c.surfaceTint, padding: '1px 6px', borderRadius: 4 }}>{tag}</span>
                    ))}
                    {item.due_date && (
                      <span style={{ fontSize: 11, color: dayjs(item.due_date).isBefore(dayjs(), 'day') && item.status === 'active' ? '#ef4444' : c.muted }}>
                        <span style={{ fontSize: 13 }}>{item.due_date}</span>
                      </span>
                    )}
                    {item.is_daily && <span style={{ fontSize: 11, color: '#8b5cf6' }}>每日</span>}
                    {item.description && <span style={{ fontSize: 11, color: c.muted2 }}>有描述</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)}
                    style={{ color: c.muted }} />
                  <Popconfirm title="移入回收站？" onConfirm={() => deleteTask(item)} okText="确定" cancelText="取消">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > PAGE_SIZE && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid ' + c.border }}>
            <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal title={modalTitle(detailItem?.title || '', c)} open={detailOpen} onCancel={() => setDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}
            style={{ borderRadius: 8, background: c.surfaceTint, borderColor: c.border, color: c.text }}>关闭</Button>,
          <Button key="toggle" onClick={() => { toggleComplete(detailItem); setDetailOpen(false); }}
            type="primary" style={{ borderRadius: 8, background: detailItem?.status === 'completed' ? '#6b7280' : '#10b981', borderColor: detailItem?.status === 'completed' ? '#6b7280' : '#10b981' }}>
            {detailItem?.status === 'completed' ? '取消完成' : '标记完成'}
          </Button>,
        ]}
        styles={modalStyles(c)} width={500}>
        <div style={{ marginTop: 16, display: 'grid', gap: 14 }}>
          {detailItem?.description && (
            <div style={{ background: c.surfaceTint, borderRadius: 10, padding: 14, color: c.text, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {detailItem.description}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>优先级</div>
              <span style={{ display: 'inline-block', background: PRIORITY_COLORS[detailItem?.priority] + '22', color: PRIORITY_COLORS[detailItem?.priority], padding: '2px 10px', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                {PRIORITY_LABELS[detailItem?.priority]}
              </span>
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>状态</div>
              <span style={{ color: detailItem?.status === 'completed' ? '#10b981' : '#3b82f6', fontSize: 13, fontWeight: 500 }}>
                {detailItem?.status === 'completed' ? '已完成' : '进行中'}
              </span>
            </div>
            {detailItem?.due_date && (
              <div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>截止日期</div>
                <span style={{ color: dayjs(detailItem.due_date).isBefore(dayjs(), 'day') && detailItem.status === 'active' ? '#ef4444' : c.text, fontSize: 13 }}>{detailItem.due_date}</span>
              </div>
            )}
            {detailItem?.is_daily && (
              <div>
                <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>重复</div>
                <span style={{ color: '#8b5cf6', fontSize: 13 }}>每日任务</span>
              </div>
            )}
          </div>
          {(detailItem?.tags || '').split(',').filter(Boolean).length > 0 && (
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>标签</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(detailItem?.tags || '').split(',').filter(Boolean).map(tag => (
                  <span key={tag} style={{ background: c.surfaceTint, color: c.textSecondary, padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{tag}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ color: c.muted2, fontSize: 11 }}>
            创建于 {detailItem?.created_at}
            {detailItem?.completed_at && ` · 完成于 ${detailItem.completed_at}`}
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal title={modalTitle('编辑任务', c)} open={editOpen} onCancel={() => setEditOpen(false)}
        onOk={handleEditSave} okText="保存" cancelText="取消"
        okButtonProps={okBtn} cancelButtonProps={cancelBtn(c)}
        styles={modalStyles(c)} width={520}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>标题 <span style={{ color: '#ef4444' }}>*</span></label>
            <Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>描述（支持 Markdown）</label>
            <Input.TextArea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              rows={4} placeholder="任务描述，支持 Markdown 格式"
              style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>优先级</label>
              <Select value={editForm.priority} onChange={v => setEditForm(p => ({ ...p, priority: v }))}
                style={{ width: '100%' }} dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                options={[
                  { value: 'high', label: '高' },
                  { value: 'medium', label: '中' },
                  { value: 'low', label: '低' },
                ]} />
            </div>
            <div>
              <label style={labelStyle}>截止日期</label>
              <DatePicker value={editForm.due_date} onChange={v => setEditForm(p => ({ ...p, due_date: v }))}
                style={{ width: '100%', ...inputStyle }} placeholder="选择日期" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>标签</label>
            <Input value={editForm.tags} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="逗号分隔多个标签" style={inputStyle} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════
   Settings Tab — 设置通知
   ═══════════════════════════════════════ */
function SettingsTab({ c, data, setData }) {
  const [enabled, setEnabled] = useState(data.settings?.notification_enabled ?? false);

  useEffect(() => { setEnabled(data.settings?.notification_enabled ?? false); }, [data.settings]);

  useEffect(() => {
    setData(prev => ({ ...prev, settings: { notification_enabled: enabled } }));
  }, [enabled]);

  return (
    <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>通知开关</div>
          <div style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>开启后将发送待办提醒（等待接入统一通知中心）</div>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Logs Tab — 通知日志
   ═══════════════════════════════════════ */
function LogsTab({ c, data, inputStyle }) {
  const [page, setPage] = useState(1);
  const logs = useMemo(() => [...data.logs].sort((a, b) => b.id - a.id), [data.logs]);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paged = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    {
      title: <span style={{ fontSize: 13, fontWeight: 600 }}>时间</span>, dataIndex: 'time', width: 160,
      render: v => <span style={{ color: c.text, fontSize: 13 }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: 13, fontWeight: 600 }}>类型</span>, dataIndex: 'type', width: 100,
      render: v => <Tag color={v === '邮件' ? 'blue' : 'green'} style={{ fontSize: 12 }}>{v}</Tag>,
    },
    {
      title: <span style={{ fontSize: 13, fontWeight: 600 }}>结果</span>, dataIndex: 'result', width: 80,
      render: v => <span style={{ color: v === '成功' ? '#10b981' : '#ef4444', fontWeight: 500, fontSize: 13 }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: 13, fontWeight: 600 }}>详情</span>, dataIndex: 'detail',
      render: v => <span style={{ color: c.muted, fontSize: 13 }}>{v}</span>,
    },
  ];

  return (
    <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: c.text, fontWeight: 600, fontSize: 16 }}>通知日志</span>
        <span style={{ color: c.muted, fontSize: 13 }}>共 {logs.length} 条记录</span>
      </div>
      <Table dataSource={paged} columns={columns} rowKey="id" pagination={false} size="middle"
        style={{ background: 'transparent' }}
        locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无日志</span> }} />
      {logs.length > PAGE_SIZE && (
        <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Trash Tab — 回收站
   ═══════════════════════════════════════ */
function TrashTab({ c, data, setData, inputStyle }) {
  const trashItems = useMemo(() => data.tasks.filter(t => t.deleted_at), [data.tasks]);

  const restoreTask = (item) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === item.id ? { ...t, deleted_at: null } : t),
    }));
    message.success('已恢复');
  };

  const deletePermanently = (item) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== item.id),
    }));
    message.success('已永久删除');
  };

  const emptyTrash = () => {
    if (trashItems.length === 0) { message.info('回收站已清空'); return; }
    Modal.confirm({
      title: '清空回收站',
      content: '确定要永久删除回收站中的所有任务吗？此操作不可恢复。',
      okText: '确定清空', cancelText: '取消',
      okButtonProps: { danger: true, style: { borderRadius: 8 } },
      cancelButtonProps: cancelBtn(c),
      styles: modalStyles(c),
      onOk: () => {
        setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => !t.deleted_at) }));
        message.success('回收站已清空');
      },
    });
  };

  return (
    <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: c.text, fontWeight: 600, fontSize: 16 }}>回收站</span>
        <Button onClick={emptyTrash} disabled={trashItems.length === 0}
          icon={<DeleteFilled />}
          style={{ height: 36, fontSize: 13, color: '#ef4444', background: c.surfaceTint, border: '1px solid ' + c.border }}>
          清空回收站
        </Button>
      </div>
      {trashItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: c.muted2, fontSize: 14 }}>回收站为空</div>
      ) : (
        <div>
          {trashItems.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: '1px solid ' + c.border, borderLeft: '4px solid ' + PRIORITY_COLORS[item.priority],
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: c.text, fontSize: 14, fontWeight: 500 }}>{item.title}</div>
                <div style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                  删除于 {item.deleted_at} {item.status === 'completed' ? '（已完成）' : ''}
                </div>
              </div>
              <Button type="text" size="small" icon={<UndoOutlined />} onClick={() => restoreTask(item)}
                style={{ color: '#3b82f6' }}>恢复</Button>
              <Popconfirm title="永久删除？此操作不可恢复。" onConfirm={() => deletePermanently(item)} okText="确定" cancelText="取消">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
