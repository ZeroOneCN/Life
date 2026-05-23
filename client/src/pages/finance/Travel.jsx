import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal, DeleteModal, Toast, Btn, PillTabs, DataTable } from '../../components/ui';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* ── Inline SVG Icons ── */
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const IconDelete = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconClear = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCart = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>;
const IconDollar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
const IconFund = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IconRise = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const STORAGE_KEY = 'lifeos_travel_data';

const CATEGORIES = [
  { value: 'TRANSPORT', label: '交通' },
  { value: 'HOTEL', label: '住宿' },
  { value: 'FOOD', label: '餐饮' },
  { value: 'TICKET', label: '门票' },
  { value: 'SHOPPING', label: '购物' },
  { value: 'OTHER', label: '其他' },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const PAY_CHANNELS = [
  { value: 'ALIPAY', label: '支付宝' },
  { value: 'WECHAT', label: '微信' },
  { value: 'UNIONPAY', label: '银联' },
  { value: 'CASH', label: '现金' },
  { value: 'OTHER', label: '其他' },
];
const PAY_MAP = Object.fromEntries(PAY_CHANNELS.map(c => [c.value, c.label]));

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rfloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

/* ── Mock data ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  const books = [];
  const expenses = [];
  let bookId = 1;
  let expId = 1;

  const bookNames = ['北京之旅', '成都美食行', '杭州周末游', '三亚度假', '西安文化之旅', '上海出差'];
  const places = {
    '北京之旅': { projects: ['故宫门票', '烤鸭晚餐', '地铁', '酒店住宿', '长城一日游', '小吃街'], cats: ['TICKET', 'FOOD', 'TRANSPORT', 'HOTEL', 'TICKET', 'FOOD'] },
    '成都美食行': { projects: ['火锅', '民宿', '打车', '熊猫基地门票', '串串', '采耳'], cats: ['FOOD', 'HOTEL', 'TRANSPORT', 'TICKET', 'FOOD', 'SHOPPING'] },
    '杭州周末游': { projects: ['西湖游船', '酒店', '高铁', '东坡肉', '龙井茶', '公交'], cats: ['TICKET', 'HOTEL', 'TRANSPORT', 'FOOD', 'SHOPPING', 'TRANSPORT'] },
    '三亚度假': { projects: ['机票', '海景酒店', '海鲜大餐', '潜水', '椰子', '出租车'], cats: ['TRANSPORT', 'HOTEL', 'FOOD', 'TICKET', 'FOOD', 'TRANSPORT'] },
    '西安文化之旅': { projects: ['兵马俑门票', '民宿', '高铁', '肉夹馍', '城墙骑行', '打车'], cats: ['TICKET', 'HOTEL', 'TRANSPORT', 'FOOD', 'TICKET', 'TRANSPORT'] },
    '上海出差': { projects: ['机票', '酒店', '地铁', '商务餐', '咖啡', '打车'], cats: ['TRANSPORT', 'HOTEL', 'TRANSPORT', 'FOOD', 'FOOD', 'TRANSPORT'] },
  };

  for (const name of bookNames) {
    const startDate = dayjs().subtract(rand(60, 365), 'day');
    const id = bookId++;
    books.push({
      id, name,
      description: `一次难忘的${name.replace(/之旅|美食行|周末游|度假|文化之旅|出差/g, '')}之行`,
      created_at: startDate.format('YYYY-MM-DD HH:mm'),
      updated_at: startDate.add(rand(1, 7), 'day').format('YYYY-MM-DD HH:mm'),
      summary: '',
    });

    const info = places[name];
    const days = rand(2, 5);
    for (let d = 0; d < days; d++) {
      const date = startDate.add(d, 'day');
      const count = rand(2, 4);
      for (let i = 0; i < count; i++) {
        const idx = rand(0, info.projects.length - 1);
        const originalCost = rfloat(20, 800);
        const discount = Math.random() > 0.6 ? rfloat(5, originalCost * 0.3) : 0;
        expenses.push({
          id: expId++,
          book_id: id,
          date: date.format('YYYY-MM-DD'),
          time_range: `${String(rand(8, 20)).padStart(2, '0')}:00-${String(rand(8, 20)).padStart(2, '0')}:30`,
          duration_minutes: rand(30, 180),
          category: info.cats[idx],
          project: info.projects[idx],
          original_cost: originalCost,
          cost: parseFloat((originalCost - discount).toFixed(2)),
          discount,
          discount_note: discount > 0 ? '优惠券/满减' : '',
          vehicle: info.cats[idx] === 'TRANSPORT' ? ['地铁', '打车', '公交', '高铁', '飞机'][rand(0, 4)] : '',
          platform: PAY_CHANNELS[rand(0, PAY_CHANNELS.length - 1)].value,
          remarks: Math.random() > 0.6 ? '体验不错' : '',
        });
      }
    }
  }

  return { books, expenses };
}

/* ── useIsLight ── */
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

/* ── Shared Pagination ── */
function TablePagination({ c, inputStyle, page, totalPages, onPageChange, pageSize, onPageSizeChange, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
      <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
        style={{ width: 120 }}>
        <option value={10}>10 条/页</option>
        <option value={20}>20 条/页</option>
        <option value={50}>50 条/页</option>
        <option value={100}>100 条/页</option>
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Btn type="ghost" disabled={page <= 1} onClick={() => onPageChange(1)}>首页</Btn>
        <Btn type="ghost" disabled={page <= 1} onClick={() => onPageChange(p => p - 1)}>上一页</Btn>
        <span style={{ color: c.muted, fontSize: 14, whiteSpace: 'nowrap' }}>第 {page} / {totalPages} 页</span>
        <input type="number" min={1} max={totalPages}
          onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) onPageChange(v); } }}
          placeholder="页" />
        <Btn type="ghost" disabled={page >= totalPages} onClick={() => onPageChange(p => p + 1)}>下一页</Btn>
        <Btn type="ghost" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>末页</Btn>
      </div>
      <span style={{ color: c.muted, fontSize: 13 }}>共 {total} 条</span>
    </div>
  );
}

/* ═══════════════════════════════════════
   Books Tab — 账本管理
   ═══════════════════════════════════════ */
function BooksTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [toast, setToast] = useState(null);
  const [delBook, setDelBook] = useState(null);

  const books = data.books;
  const sorted = [...books].sort((a, b) => b.id - a.id);
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => { setEditBook(null); setForm({ name: '', description: '' }); setModalOpen(true); };
  const openEdit = (b) => { setEditBook(b); setForm({ name: b.name, description: b.description || '' }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { setToast({type:'error', message:'请输入账本名称'}); return; }
    if (editBook) {
      setData(prev => ({
        ...prev,
        books: prev.books.map(b => b.id === editBook.id ? { ...b, name: form.name, description: form.description, updated_at: dayjs().format('YYYY-MM-DD HH:mm') } : b),
      }));
      setToast({type:'success', message:'已更新'});
    } else {
      const maxId = books.reduce((m, b) => Math.max(m, b.id), 0);
      setData(prev => ({
        ...prev,
        books: [...prev.books, { id: maxId + 1, name: form.name, description: form.description, created_at: dayjs().format('YYYY-MM-DD HH:mm'), updated_at: dayjs().format('YYYY-MM-DD HH:mm'), summary: '' }],
      }));
      setToast({type:'success', message:'已创建'});
    }
    setModalOpen(false);
  };

  const handleDelete = (book) => {
    const expenseCount = data.expenses.filter(e => e.book_id === book.id).length;
    if (expenseCount > 0) {
      setDelBook(book);
    } else {
      setData(prev => ({ ...prev, books: prev.books.filter(b => b.id !== book.id) }));
      setToast({type:'success', message:'已删除'});
    }
  };

  const confirmDeleteBook = () => {
    if (!delBook) return;
    setData(prev => ({
      books: prev.books.filter(b => b.id !== delBook.id),
      expenses: prev.expenses.filter(e => e.book_id !== delBook.id),
    }));
    setToast({type:'success', message:'已删除'});
    setDelBook(null);
  };

  const delExpenseCount = delBook ? data.expenses.filter(e => e.book_id === delBook.id).length : 0;

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>账本名称</span>, dataIndex: 'name', width: 160, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>描述</span>, dataIndex: 'description', width: 240, render: v => <span style={{ color: c.muted2, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>创建时间</span>, dataIndex: 'created_at', width: 150, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>更新时间</span>, dataIndex: 'updated_at', width: 150, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn type="ghost" onClick={() => openEdit(rec)}><IconEdit /> 编辑</Btn>
          <Btn type="danger" onClick={() => handleDelete(rec)}><IconDelete /> 删除</Btn>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Btn type="primary" onClick={openCreate}><IconPlus /> 新建账本</Btn>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={paged} columns={columns} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>暂无账本</span>}
          minWidth={700} />
        {sorted.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
            onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={sorted.length} />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editBook ? '编辑账本' : '新建账本'} width={460}
        footer={<><Btn type="ghost" onClick={() => setModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleSave}>确定</Btn></>}>
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>账本名称 <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：北京之旅" className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>描述</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="可选" rows={3} className="w-full" />
          </div>
        </div>
      </Modal>

      <DeleteModal open={!!delBook} onClose={() => setDelBook(null)} onConfirm={confirmDeleteBook}
        title={`确认删除"${delBook?.name}"？`}>
        {delBook && <p>账本"{delBook.name}"下有 {delExpenseCount} 条花销记录，删除将一并清空且不可恢复</p>}
      </DeleteModal>

      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Expense Tab — 花销记录
   ═══════════════════════════════════════ */
function ExpenseTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [selBookId, setSelBookId] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [catFilter, setCatFilter] = useState(null);
  const [payFilter, setPayFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [form, setForm] = useState({
    date: dayjs(), category: 'FOOD', project: '',
    original_cost: null, discount: 0, discount_note: '', vehicle: '', platform: 'ALIPAY', remarks: '',
  });
  const [toast, setToast] = useState(null);
  const [delExpenseId, setDelExpenseId] = useState(null);

  const books = data.books;
  const selectedBook = books.find(b => b.id === selBookId);

  const allExpenses = useMemo(() => {
    if (!selBookId) return [];
    return data.expenses.filter(e => e.book_id === selBookId);
  }, [data.expenses, selBookId]);

  const filtered = useMemo(() => {
    let list = [...allExpenses];
    if (keyword) {
      const q = keyword.toLowerCase();
      list = list.filter(e => e.project.toLowerCase().includes(q) || e.remarks.toLowerCase().includes(q) || e.vehicle.toLowerCase().includes(q));
    }
    if (catFilter) list = list.filter(e => e.category === catFilter);
    if (payFilter) list = list.filter(e => e.platform === payFilter);
    if (dateRange && dateRange[0] && dateRange[1]) {
      const s = dateRange[0].format('YYYY-MM-DD');
      const e = dateRange[1].format('YYYY-MM-DD');
      list = list.filter(r => r.date >= s && r.date <= e);
    }
    return list.sort((a, b) => b.id - a.id);
  }, [allExpenses, keyword, catFilter, payFilter, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const totalOriginal = allExpenses.reduce((s, e) => s + e.original_cost, 0);
    const totalDiscount = allExpenses.reduce((s, e) => s + e.discount, 0);
    return { count: allExpenses.length, original: totalOriginal, paid: totalOriginal - totalDiscount, saved: totalDiscount };
  }, [allExpenses]);

  const openCreate = () => {
    if (!selBookId) { setToast({type:'success', message:'请先选择账本'}); return; }
    setEditExp(null);
    setForm({ date: dayjs(), category: 'FOOD', project: '', original_cost: null, discount: 0, discount_note: '', vehicle: '', platform: 'ALIPAY', remarks: '' });
    setModalOpen(true);
  };

  const openEdit = (exp) => {
    setEditExp(exp);
    setForm({
      date: dayjs(exp.date), category: exp.category, project: exp.project,
      original_cost: exp.original_cost, discount: exp.discount, discount_note: exp.discount_note || '',
      vehicle: exp.vehicle || '', platform: exp.platform, remarks: exp.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.project || form.original_cost == null) { setToast({type:'error', message:'请填写事项和费用'}); return; }
    const discountAmt = form.discount || 0;
    const payload = {
      ...form,
      date: form.date.format('YYYY-MM-DD'),
      original_cost: parseFloat(form.original_cost),
      discount: parseFloat(discountAmt),
      cost: parseFloat((parseFloat(form.original_cost) - parseFloat(discountAmt)).toFixed(2)),
    };
    if (editExp) {
      setData(prev => ({
        ...prev,
        expenses: prev.expenses.map(e => e.id === editExp.id ? { ...e, ...payload, id: e.id, book_id: selBookId } : e),
      }));
      setToast({type:'success', message:'已更新'});
    } else {
      const maxId = data.expenses.reduce((m, e) => Math.max(m, e.id), 0);
      setData(prev => ({
        ...prev,
        expenses: [...prev.expenses, { ...payload, id: maxId + 1, book_id: selBookId }],
      }));
      setToast({type:'success', message:'已添加'});
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
    setToast({type:'success', message:'已删除'});
  };

  const [summaryDraft, setSummaryDraft] = useState('');
  useEffect(() => { setSummaryDraft(selectedBook?.summary || ''); }, [selBookId]);

  const saveSummary = () => {
    setData(prev => ({
      ...prev,
      books: prev.books.map(b => b.id === selBookId ? { ...b, summary: summaryDraft } : b),
    }));
    setToast({type:'success', message:'总结已保存'});
  };

  const clearFilters = () => { setKeyword(''); setCatFilter(null); setPayFilter(null); setDateRange(null); setPage(1); };
  const hasFilters = keyword || catFilter || payFilter || dateRange;

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>日期</span>, dataIndex: 'date', width: 115, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{dayjs(v).format('YYYY年M月D日')}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>事项</span>, dataIndex: 'project', width: 140, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>分类</span>, dataIndex: 'category', width: 68, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>{CATEGORY_MAP[v] || v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>原价</span>, dataIndex: 'original_cost', width: 85, align: 'right', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>实付</span>, dataIndex: 'cost', width: 85, align: 'right', render: v => <span style={{ fontWeight: 600, color: '#ef4444', fontSize: fs.tableCell.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>节省</span>, dataIndex: 'discount', width: 75, align: 'right', render: v => v > 0 ? <span style={{ color: '#10B981', fontSize: fs.tableCellSm.fontSize }}>-¥{v.toFixed(2)}</span> : <span style={{ color: c.muted2, fontSize: fs.tableCellSm.fontSize }}>-</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>支付方式</span>, dataIndex: 'platform', width: 95, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{PAY_MAP[v] || v}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 120,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn type="ghost" onClick={() => openEdit(rec)}><IconEdit /> 编辑</Btn>
          <Btn type="danger" onClick={() => setDelExpenseId(rec.id)}><IconDelete /> 删除</Btn>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selBookId ?? ''} onChange={e => { setSelBookId(e.target.value ? Number(e.target.value) : null); setPage(1); setKeyword(''); setCatFilter(null); setPayFilter(null); setDateRange(null); }}
          style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 38, fontSize: 14, width: 240, cursor: 'pointer', padding: '0 12px' }}>
          <option value="">请选择账本</option>
          {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {selBookId && (
          <Btn type="primary" onClick={openCreate}><IconPlus /> 添加花销</Btn>
        )}
      </div>

      {!selBookId ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: c.muted, fontSize: 15 }}>请先选择一个账本</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: '记录数', value: stats.count, icon: IconCart, color: '#5e6ad2' },
              { label: '实付总花销', value: `¥${stats.paid.toFixed(2)}`, icon: IconDollar, color: '#ef4444' },
              { label: '总原价', value: `¥${stats.original.toFixed(2)}`, icon: IconFund, color: '#F59E0B' },
              { label: '总节省', value: `¥${stats.saved.toFixed(2)}`, icon: IconRise, color: '#10B981' },
            ].map(s => (
              <div key={s.label} style={{
                background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.surfaceTint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>
                  <s.icon />
                </div>
                <div>
                  <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ color: c.text, ...fs.cardValue }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {selectedBook && (
            <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ color: c.text, ...fs.sectionTitle, marginBottom: 8 }}>出行总结</div>
              <textarea value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)}
                placeholder="记录这次出行的复盘：哪些地方做得好/哪些地方可以优化…"
                rows={3} className="w-full" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Btn type="ghost" onClick={saveSummary}>保存总结</Btn>
              </div>
            </div>
          )}

          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, width: 200, height: 36, gap: 6 }}>
              <IconSearch />
              <input value={keyword}
                onChange={e => { setKeyword(e.target.value); setPage(1); }}
                placeholder="搜索事项/备注/交通" style={{ background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: 14, flex: 1 }} />
            </div>
            <select value={catFilter ?? ''} onChange={e => { setCatFilter(e.target.value || null); setPage(1); }}
              style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 36, fontSize: 14, width: 110, cursor: 'pointer', padding: '0 8px' }}>
              <option value="">全部分类</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={payFilter ?? ''} onChange={e => { setPayFilter(e.target.value || null); setPage(1); }}
              style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 36, fontSize: 14, width: 120, cursor: 'pointer', padding: '0 8px' }}>
              <option value="">全部方式</option>
              {PAY_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="date" value={dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : ''} onChange={e => { setDateRange([e.target.value ? dayjs(e.target.value) : null, dateRange?.[1] || null]); setPage(1); }}
              style={{ width: 150 }} />
            <input type="date" value={dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : ''} onChange={e => { setDateRange([dateRange?.[0] || null, e.target.value ? dayjs(e.target.value) : null]); setPage(1); }}
              style={{ width: 150 }} />
            {hasFilters && (
              <Btn type="ghost" onClick={clearFilters}><IconClear /> 清除</Btn>
            )}
          </div>

          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
            <DataTable data={paged} columns={columns} rowKey="id"
              emptyText={<span style={{ color: c.muted2 }}>{allExpenses.length === 0 ? '暂无花销记录' : '没有匹配的记录'}</span>}
              minWidth={750} />
            {filtered.length > 0 && (
              <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
                onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
                pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
            )}
          </div>

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editExp ? '编辑花销' : '添加花销'} width={520}
            footer={<><Btn type="ghost" onClick={() => setModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleSave}>确定</Btn></>}>
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>日期 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={form.date ? form.date.format('YYYY-MM-DD') : ''}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value ? dayjs(e.target.value) : dayjs() }))}
                    className="w-full" />
                </div>
                <div>
                  <label style={labelStyle}>分类 <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>事项/项目 <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} placeholder="如：午餐/景区门票/酒店住宿" className="w-full" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>原价 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" value={form.original_cost ?? ''} onChange={e => setForm(p => ({ ...p, original_cost: e.target.value === '' ? null : Number(e.target.value) }))}
                    min={0} step={0.01} placeholder="0.00" className="w-full" />
                </div>
                <div>
                  <label style={labelStyle}>优惠/节省</label>
                  <input type="number" value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    min={0} step={0.01} placeholder="0.00" className="w-full" />
                </div>
                <div>
                  <label style={labelStyle}>支付方式 <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                    className="w-full">
                    {PAY_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              {form.category === 'TRANSPORT' && (
                <div>
                  <label style={labelStyle}>交通信息</label>
                  <input type="text" value={form.vehicle} onChange={e => setForm(p => ({ ...p, vehicle: e.target.value }))} placeholder="如：地铁2号线/网约车/航班MU1234" className="w-full" />
                </div>
              )}
              <div>
                <label style={labelStyle}>优惠说明</label>
                <input type="text" value={form.discount_note} onChange={e => setForm(p => ({ ...p, discount_note: e.target.value }))} placeholder="如：积分兑换/满减/支付立减" className="w-full" />
              </div>
              <div>
                <label style={labelStyle}>备注</label>
                <input type="text" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="可选" className="w-full" />
              </div>
            </div>
          </Modal>

          <DeleteModal open={delExpenseId !== null} onClose={() => setDelExpenseId(null)}
            title="确定删除？"
            onConfirm={() => { handleDelete(delExpenseId); setDelExpenseId(null); }} />
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Stats Tab — 统计分析
   ═══════════════════════════════════════ */
function StatsTab({ c, fs, isLight, data }) {
  const [selBookId, setSelBookId] = useState(null);
  const books = data.books;

  const expenses = useMemo(() => {
    if (!selBookId) return [];
    return data.expenses.filter(e => e.book_id === selBookId);
  }, [data.expenses, selBookId]);

  const summary = useMemo(() => {
    const byCategory = {};
    const byPayChannel = {};
    let totalAmount = 0, totalSaved = 0;
    for (const e of expenses) {
      totalAmount += e.original_cost;
      totalSaved += e.discount;
      byCategory[e.category] = byCategory[e.category] || { count: 0, totalAmount: 0, savedAmount: 0 };
      byCategory[e.category].count++;
      byCategory[e.category].totalAmount += e.original_cost;
      byCategory[e.category].savedAmount += e.discount;
      byPayChannel[e.platform] = byPayChannel[e.platform] || { count: 0, totalAmount: 0, savedAmount: 0 };
      byPayChannel[e.platform].count++;
      byPayChannel[e.platform].totalAmount += e.original_cost;
      byPayChannel[e.platform].savedAmount += e.discount;
    }
    return {
      totalCount: expenses.length, totalAmount, totalSaved, paidAmount: totalAmount - totalSaved,
      byCategory: Object.entries(byCategory).map(([name, v]) => ({ name, ...v })),
      byPayChannel: Object.entries(byPayChannel).map(([name, v]) => ({ name, ...v })),
    };
  }, [expenses]);

  const topCategory = summary.byCategory.length ? CATEGORY_MAP[summary.byCategory[0].name] || summary.byCategory[0].name : '暂无';
  const topChannel = summary.byPayChannel.length ? PAY_MAP[summary.byPayChannel[0].name] || summary.byPayChannel[0].name : '暂无';

  const tableCols = (nameKey, labelMap) => [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>{nameKey}</span>, dataIndex: 'name', render: v => <span style={{ color: c.text, fontSize: fs.tableCell.fontSize }}>{labelMap[v] || v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>记录数</span>, dataIndex: 'count', width: 80, align: 'right', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>金额</span>, dataIndex: 'totalAmount', width: 170, align: 'right',
      render: (_, rec) => (
        <div>
          <div style={{ fontWeight: 600, color: c.text, fontSize: fs.tableCell.fontSize }}>¥{(rec.totalAmount - rec.savedAmount).toFixed(2)}</div>
          <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.muted2 }}>原价 ¥{rec.totalAmount.toFixed(2)} · 节省 ¥{rec.savedAmount.toFixed(2)}</div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select value={selBookId ?? ''} onChange={e => setSelBookId(e.target.value ? Number(e.target.value) : null)}
          style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 38, fontSize: 14, width: 240, cursor: 'pointer', padding: '0 12px' }}>
          <option value="">请选择账本</option>
          {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {!selBookId ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: c.muted, fontSize: 15 }}>请先选择一个账本</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: '实付总花销', value: `¥${summary.paidAmount.toFixed(2)}`, color: '#ef4444' },
              { label: '总节省', value: `¥${summary.totalSaved.toFixed(2)}`, color: '#10B981' },
              { label: '记录数', value: summary.totalCount, color: '#5e6ad2' },
              { label: '最大分类', value: topCategory, color: '#F59E0B' },
              { label: '最大渠道', value: topChannel, color: '#3B82F6' },
            ].map(s => (
              <div key={s.label} style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color, ...fs.cardValue }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
              <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>按分类统计</div>
              <DataTable data={summary.byCategory} rowKey="name" columns={tableCols('分类', CATEGORY_MAP)} />
            </div>
            <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
              <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>按支付渠道统计</div>
              <DataTable data={summary.byPayChannel} rowKey="name" columns={tableCols('渠道', PAY_MAP)} />
            </div>
          </div>

          <TrendChart c={c} fs={fs} isLight={isLight} expenses={expenses} />
        </>
      )}
    </div>
  );
}

/* ── Trend Chart ── */
function TrendChart({ c, fs, isLight, expenses }) {
  const chartId = useMemo(() => 'trend-' + Math.random().toString(36).slice(2, 8), []);

  const dailyData = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      const paid = e.original_cost - e.discount;
      map[e.date] = (map[e.date] || 0) + paid;
    }
    return Object.entries(map)
      .map(([date, amount]) => ({ date, amount: parseFloat(amount.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [expenses]);

  useEffect(() => {
    if (!dailyData.length) return;
    const dom = document.getElementById(chartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      grid: { left: 55, right: 16, top: 20, bottom: 28 },
      xAxis: { type: 'category', data: dailyData.map(d => dayjs(d.date).format('M月D日')), axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.muted, fontSize: 11 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: c.surfaceTint } }, axisLabel: { color: c.muted, fontSize: 11, formatter: '¥{value}' } },
      series: [{
        type: 'line', data: dailyData.map(d => d.amount), smooth: true,
        lineStyle: { color: '#5e6ad2', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(94,106,210,0.25)' }, { offset: 1, color: 'rgba(94,106,210,0)' }]) },
        symbol: 'circle', symbolSize: 5, itemStyle: { color: '#5e6ad2' },
      }],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [dailyData, isLight]);

  if (!dailyData.length) return null;

  return (
    <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
      <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>每日花销趋势</div>
      <div id={chartId} style={{ width: '100%', height: 280 }} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Leaderboard Tab — 花销排行
   ═══════════════════════════════════════ */
function LeaderboardTab({ c, fs, data, inputStyle, labelStyle }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const stats = useMemo(() => {
    const bookStats = data.books.map(book => {
      const exps = data.expenses.filter(e => e.book_id === book.id);
      const totalAmount = exps.reduce((s, e) => s + e.original_cost, 0);
      const totalSaved = exps.reduce((s, e) => s + e.discount, 0);
      return { bookId: book.id, bookName: book.name, totalAmount, totalSaved, totalCount: exps.length };
    });
    const totals = bookStats.reduce((acc, b) => {
      acc.totalCount += b.totalCount;
      acc.totalAmount += b.totalAmount;
      acc.totalSaved += b.totalSaved;
      return acc;
    }, { totalCount: 0, totalAmount: 0, totalSaved: 0 });
    return { bookStats, totals };
  }, [data]);

  const ranked = [...stats.bookStats].sort((a, b) => (b.totalAmount - b.totalSaved) - (a.totalAmount - a.totalSaved));
  const totalPages = Math.ceil(ranked.length / pageSize) || 1;
  const paged = ranked.slice((page - 1) * pageSize, page * pageSize);
  const totalPaid = stats.totals.totalAmount - stats.totals.totalSaved;
  const maxPaid = Math.max(1, ...ranked.map(r => r.totalAmount - r.totalSaved));

  const columns = [
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>#</span>, width: 56, align: 'center',
      render: (_, __, idx) => {
        const rank = (page - 1) * pageSize + idx + 1;
        const rankColor = rank === 1 ? '#F59E0B' : rank === 2 ? '#9CA3AF' : rank === 3 ? '#D97706' : c.muted;
        return <span style={{ fontWeight: 700, fontSize: fs.tableCell.fontSize, color: rankColor }}>{rank}</span>;
      },
    },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>账本</span>, dataIndex: 'bookName', width: 180, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>实付</span>, dataIndex: 'totalAmount', width: 200, align: 'right',
      render: (_, rec) => {
        const paid = rec.totalAmount - rec.totalSaved;
        return (
          <div>
            <div style={{ fontWeight: 600, color: c.text, fontSize: fs.tableCell.fontSize }}>¥{paid.toFixed(2)}</div>
            <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.muted2 }}>原价 ¥{rec.totalAmount.toFixed(2)} · 节省 ¥{rec.totalSaved.toFixed(2)}</div>
            <div style={{ marginTop: 4, height: 4, background: c.surfaceTint, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(paid / maxPaid) * 100}%`, background: '#5e6ad2', borderRadius: 2 }} />
            </div>
          </div>
        );
      },
    },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>记录数</span>, dataIndex: 'totalCount', width: 80, align: 'right', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px', borderColor: '#5e6ad280' }}>
          <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 4 }}>全部账本实付总花销</div>
          <div style={{ ...fs.cardValueLg, color: '#5e6ad2' }}>¥{totalPaid.toFixed(2)}</div>
          <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.muted2, marginTop: 4 }}>原价 ¥{stats.totals.totalAmount.toFixed(2)} · 节省 ¥{stats.totals.totalSaved.toFixed(2)}</div>
        </div>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 4 }}>全部记录数</div>
          <div style={{ ...fs.cardValue, color: c.text }}>{stats.totals.totalCount}</div>
        </div>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 4 }}>账本数量</div>
          <div style={{ ...fs.cardValue, color: c.text }}>{data.books.length}</div>
        </div>
      </div>

      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>账本花销排行</div>
        <DataTable data={paged} columns={columns} rowKey="bookId"
          emptyText={<span style={{ color: c.muted2 }}>暂无数据</span>}
          minWidth={500} />
        {ranked.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
            onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={ranked.length} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function Travel() {
  const isLight = useIsLight();
  const c = useMemo(() => ({
    text: isLight ? '#1d1d1f' : '#f7f8f8',
    textSecondary: isLight ? '#62666d' : '#d0d6e0',
    muted: '#8a8f98',
    muted2: isLight ? '#9ca3af' : '#62666d',
    border: isLight ? '#e5e7eb' : '#23252a',
    surface: isLight ? '#ffffff' : '#0f1011',
    surfaceTint: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    surfaceTint2: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
    dropdownBg: isLight ? '#f0f1f2' : '#18191a',
    cardBg: isLight ? '#ffffff' : '#0f1011',
  }), [isLight]);

  const [data, setData] = useState(seedMock);
  const [activeTab, setActiveTab] = useState(() => window.location.hash?.slice(1) || 'books');

  useEffect(() => {
    const onHashChange = () => { const h = window.location.hash?.slice(1); if (h) setActiveTab(h); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const inputStyle = {
    background: c.surfaceTint, border: '1px solid ' + c.border,
    borderRadius: 8, color: c.text, height: 42, lineHeight: '42px',
  };
  const labelStyle = { display: 'block', fontSize: 13, marginBottom: 6, color: 'var(--color-ink-subtle)', fontWeight: 500 };

  const fs = {
    pageTitle: { fontSize: 22, fontWeight: 700 },
    sectionTitle: { fontSize: 16, fontWeight: 600 },
    cardValue: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' },
    cardValueLg: { fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' },
    cardLabel: { fontSize: 13, fontWeight: 500 },
    tableCell: { fontSize: 14 },
    tableCellSm: { fontSize: 13 },
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>旅行游玩</h1>

      <div style={{ marginBottom: 24 }}>
        <PillTabs value={activeTab} onChange={(v) => { setActiveTab(v); window.location.hash = v; }}
          options={[
            { value: 'books', label: '账本管理' },
            { value: 'expense', label: '花销记录' },
            { value: 'stats', label: '统计分析' },
            { value: 'leaderboard', label: '花销排行' },
          ]}
        />
      </div>

      {activeTab === 'books' && <BooksTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'expense' && <ExpenseTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'stats' && <StatsTab c={c} fs={fs} isLight={isLight} data={data} />}
      {activeTab === 'leaderboard' && <LeaderboardTab c={c} fs={fs} data={data} inputStyle={inputStyle} labelStyle={labelStyle} />}
    </div>
  );
}
