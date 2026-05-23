import { useState, useEffect, useMemo } from 'react';
import { Modal, DeleteModal, Toast, Btn, Tag, PillTabs, Field, DataTable, Pagination, Switch, Checkbox } from '../../components/ui';
import dayjs from 'dayjs';

const STORAGE_KEY = 'lifeos_todo_data';
const PAGE_SIZE = 10;

/* SVG Icons */
const AddIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const DeleteIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const CheckIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
const UndoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>;
const ListIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>;
const SettingsIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>;
const FileTextIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>;

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
    const observer = new MutationObserver(() => setIsLight(el.getAttribute('data-theme') === 'light'));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isLight;
}

function modalTitle(text, c) {
  return <span style={{ color: c.text, fontWeight: 600 }}>{text}</span>;
}

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };

function TablePagination({ c, inputStyle, page, totalPages, onPageChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 16 }}>
      <Btn disabled={page <= 1} onClick={() => onPageChange(1)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>首页</Btn>
      <Btn disabled={page <= 1} onClick={() => onPageChange(p => p - 1)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>上一页</Btn>
      <span style={{ color: c.muted, fontSize: 13 }}>第 {page} / {totalPages} 页</span>
      <Btn disabled={page >= totalPages} onClick={() => onPageChange(p => p + 1)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>下一页</Btn>
      <Btn disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
        style={{ ...inputStyle, height: 32, fontSize: 12 }}>末页</Btn>
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
    { value: '任务列表', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ListIcon />任务列表</span> },
    { value: '设置通知', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SettingsIcon />设置通知</span> },
    { value: '通知日志', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileTextIcon />通知日志</span> },
    { value: '回收站', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DeleteIcon />回收站</span> },
  ];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>待办事项</h1>
      <PillTabs value={tab} onChange={handleTabChange} options={tabItems}
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
  const [dueDate, setDueDate] = useState('');
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
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', tags: '' });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };

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
    if (!title.trim()) { showToast('请输入任务标题', 'error'); return; }
    setData(prev => ({
      ...prev,
      tasks: [{
        id: prev.taskIdCounter,
        title: title.trim(),
        description: '',
        due_date: dueDate || '',
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
    setTitle(''); setDueDate(''); setTags(''); setPriority('medium'); setIsDaily(false);
    showToast('已添加');
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
    showToast('已移入回收站');
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditForm({
      title: item.title,
      description: item.description || '',
      priority: item.priority,
      due_date: item.due_date || '',
      tags: item.tags || '',
    });
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editForm.title.trim()) { showToast('请输入标题', 'error'); return; }
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === editItem.id
          ? { ...t, title: editForm.title.trim(), description: editForm.description, priority: editForm.priority, due_date: editForm.due_date || '', tags: editForm.tags }
          : t
      ),
    }));
    setEditOpen(false);
    showToast('已更新');
  };

  const handleBatchComplete = () => {
    if (!selected.length) { showToast('请选择任务', 'error'); return; }
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => selected.includes(t.id) ? { ...t, status: 'completed', completed_at: dayjs().format('YYYY-MM-DD HH:mm') } : t),
    }));
    setSelected([]);
    showToast('批量完成成功');
  };

  const handleBatchDelete = () => {
    if (!selected.length) { showToast('请选择任务', 'error'); return; }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => selected.includes(t.id) ? { ...t, deleted_at: now } : t),
    }));
    setSelected([]);
    showToast('已移入回收站');
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
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="输入新任务... (Enter 添加)" style={{ ...inputStyle, flex: 1, height: 40 }} className="w-full" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{ ...inputStyle, width: 160, height: 40 }} placeholder="截止日期" />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Checkbox checked={isDaily} onChange={setIsDaily}>
              <span style={{ color: c.textSecondary }}>每日都要</span>
            </Checkbox>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              style={{ ...inputStyle, width: 140 }}>
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
            <input value={tags} onChange={e => setTags(e.target.value)}
              placeholder="标签（逗号分隔）" style={{ ...inputStyle, width: 180, height: 40 }} className="w-full" />
            <Btn type="primary" onClick={handleAdd} style={{ height: 40, fontSize: 14, fontWeight: 500 }}>
              <AddIcon /> 添加任务
            </Btn>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterStatus || ''} onChange={e => setFilterStatus(e.target.value || undefined)}
          style={{ ...inputStyle, width: 130 }}>
          <option value="">全部状态</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
        </select>
        <select value={filterPriority || ''} onChange={e => setFilterPriority(e.target.value || undefined)}
          style={{ ...inputStyle, width: 140 }}>
          <option value="">全部优先级</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <select value={filterTag || ''} onChange={e => setFilterTag(e.target.value || undefined)}
          style={{ ...inputStyle, width: 140 }}>
          <option value="">全部标签</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Btn onClick={() => { setFilterStatus(); setFilterPriority(); setFilterTag(); }}
          style={{ height: 36, fontSize: 13, color: c.text, background: c.surfaceTint, border: '1px solid ' + c.border }}>清除筛选</Btn>
      </div>

      {/* Batch toolbar */}
      {selected.length > 0 && (
        <div style={{ background: c.surfaceTint2, border: '1px solid ' + c.border, borderRadius: 10, padding: '10px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: c.textSecondary, fontSize: 13, fontWeight: 500 }}>已选择 {selected.length} 个任务</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleBatchComplete}
              style={{ fontSize: 12, color: '#059669', background: c.surfaceTint, border: '1px solid ' + c.border, padding: '4px 10px' }}>批量完成</Btn>
            <Btn onClick={handleBatchDelete}
              style={{ fontSize: 12, color: '#dc2626', background: c.surfaceTint, border: '1px solid ' + c.border, padding: '4px 10px' }}>批量删除</Btn>
            <Btn onClick={() => setSelected(new Set())}
              style={{ fontSize: 12, color: c.textSecondary, background: c.surfaceTint, border: '1px solid ' + c.border, padding: '4px 10px' }}>取消选择</Btn>
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
                <button onClick={() => toggleComplete(item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                  <span style={{ color: item.status === 'completed' ? '#10b981' : c.muted, fontSize: 18, lineHeight: 0 }}><CheckIcon /></span>
                </button>
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
                  <button onClick={() => openEdit(item)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, padding: 4, lineHeight: 0 }}>
                    <EditIcon />
                  </button>
                  <button onClick={() => setDeleteConfirm(item)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, lineHeight: 0 }}>
                    <DeleteIcon />
                  </button>
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

      {/* Delete confirmation modal */}
      <DeleteModal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => { deleteTask(deleteConfirm); setDeleteConfirm(null); }}
        title="移入回收站？" />

      {/* Detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={modalTitle(detailItem?.title || '', c)} width={500}
        footer={<div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => setDetailOpen(false)}>关闭</Btn>
          <Btn type="primary" onClick={() => { toggleComplete(detailItem); setDetailOpen(false); }}
            style={{ background: detailItem?.status === 'completed' ? '#6b7280' : '#10b981', borderColor: detailItem?.status === 'completed' ? '#6b7280' : '#10b981' }}>
            {detailItem?.status === 'completed' ? '取消完成' : '标记完成'}
          </Btn>
        </div>}>
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
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={modalTitle('编辑任务', c)} width={520}
        footer={<div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => setEditOpen(false)}>取消</Btn>
          <Btn type="primary" onClick={handleEditSave}>保存</Btn>
        </div>}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>标题 <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>描述（支持 Markdown）</label>
            <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
              rows={4} placeholder="任务描述，支持 Markdown 格式"
              style={{ ...inputStyle, width: '100%', height: 'auto', lineHeight: 1.5, padding: 10, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>优先级</label>
              <select value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}
                style={{ width: '100%', ...inputStyle }}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>截止日期</label>
              <input type="date" value={editForm.due_date} onChange={e => setEditForm(p => ({ ...p, due_date: e.target.value }))}
                style={{ width: '100%', ...inputStyle }} className="w-full" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>标签</label>
            <input value={editForm.tags} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="逗号分隔多个标签" style={inputStyle} className="w-full" />
          </div>
        </div>
      </Modal>

      <Toast toast={toast} />
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
      <DataTable data={paged} columns={columns} rowKey="id" emptyText={<span style={{ color: c.muted2 }}>暂无日志</span>} />
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
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);

  const restoreTask = (item) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === item.id ? { ...t, deleted_at: null } : t),
    }));
    showToast('已恢复');
  };

  const deletePermanently = (item) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== item.id),
    }));
    showToast('已永久删除');
  };

  const emptyTrash = () => {
    if (trashItems.length === 0) { showToast('回收站已清空', 'error'); return; }
    setEmptyConfirm(true);
  };

  return (
    <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: c.text, fontWeight: 600, fontSize: 16 }}>回收站</span>
        <Btn onClick={emptyTrash} disabled={trashItems.length === 0}
          style={{ height: 36, fontSize: 13, color: '#ef4444', background: c.surfaceTint, border: '1px solid ' + c.border }}>
          <DeleteIcon /> 清空回收站
        </Btn>
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
              <button onClick={() => restoreTask(item)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <UndoIcon /> 恢复
              </button>
              <button onClick={() => setConfirmDelete(item)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, lineHeight: 0 }}>
                <DeleteIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <DeleteModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => { deletePermanently(confirmDelete); setConfirmDelete(null); }}
        title="永久删除？此操作不可恢复。" />

      {/* Empty trash confirmation */}
      <DeleteModal open={emptyConfirm} onClose={() => setEmptyConfirm(false)}
        onConfirm={() => { setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => !t.deleted_at) })); showToast('回收站已清空'); setEmptyConfirm(false); }}
        title="确定要永久删除回收站中的所有任务吗？此操作不可恢复。" />

      <Toast toast={toast} />
    </div>
  );
}
