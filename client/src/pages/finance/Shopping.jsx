import { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, DeleteModal, Toast, Btn, DataTable } from '../../components/ui';
import dayjs from 'dayjs';

/* ── Inline SVG Icons ── */
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const IconDelete = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconClear = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCart = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>;
const IconDollar = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
const IconShop = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>;
const IconCalendar = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconSettings = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const STORAGE_KEY = 'lifeos_shopping_data';
const PLATFORMS_KEY = 'lifeos_shopping_platforms';
const SETTINGS_KEY = 'lifeos_shopping_settings';

const DEFAULT_PLATFORMS = ['拼多多', '淘宝', '京东', '抖音', '唯品会', '美团', '苏宁', '其他'];

const PLATFORM_COLORS = {
  '拼多多': '#dc2626',
  '淘宝': '#ea580c',
  '京东': '#2563eb',
  '抖音': '#db2777',
  '唯品会': '#7c3aed',
  '美团': '#ca8a04',
  '苏宁': '#16a34a',
  '其他': '#6b7280',
};

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ── mock seed ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let id = 1;
  const today = dayjs();
  const records = [];
  const names = ['iPhone 15', '机械键盘', '蓝牙耳机', '充电宝', '笔记本电脑包',
    '手机壳', '数据线', '显示器支架', '台灯', '保温杯',
    '运动鞋', '背包', '鼠标', '鼠标垫', '移动硬盘',
    'U盘', '摄像头', '麦克风', '音箱', '路由器'];
  const specs = ['标准版', 'Pro', '基础款', '升级版', '黑色', '白色', '蓝色', '红色', '大号', '小号', null, null, null];

  for (let i = 0; i < 60; i++) {
    const d = today.subtract(rand(0, 90), 'day');
    const price = parseFloat((rand(10, 5000) + Math.random()).toFixed(2));
    records.push({
      id: id++,
      name: names[rand(0, names.length - 1)],
      spec: specs[rand(0, specs.length - 1)],
      price,
      unit_price: Math.random() > 0.5 ? parseFloat((price / rand(1, 5)).toFixed(2)) : null,
      platform: DEFAULT_PLATFORMS[rand(0, DEFAULT_PLATFORMS.length - 1)],
      date: d.format('YYYY-MM-DD'),
      order_no: Math.random() > 0.3 ? `${d.format('YYMMDD')}-${String(rand(100000, 999999))}` : null,
      note: Math.random() > 0.7 ? '家庭日常使用' : null,
    });
  }
  return records;
}

function loadPlatforms() {
  try {
    const stored = localStorage.getItem(PLATFORMS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...DEFAULT_PLATFORMS];
}

function savePlatforms(list) {
  localStorage.setItem(PLATFORMS_KEY, JSON.stringify(list));
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { usdtRate: 7.0 };
}

function getPlatformColor(platform) {
  return PLATFORM_COLORS[platform] || '#6b7280';
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

/* ── Shared Pagination ── */
function TablePagination({ c, inputStyle, page, totalPages, onPageChange, pageSize, onPageSizeChange, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
      <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
        style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 36, fontSize: 13, width: 120, cursor: 'pointer', padding: '0 8px' }}>
        <option value={10}>10 条/页</option>
        <option value={20}>20 条/页</option>
        <option value={50}>50 条/页</option>
        <option value={100}>100 条/页</option>
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Btn disabled={page <= 1} onClick={() => onPageChange(1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>首页</Btn>
        <Btn disabled={page <= 1} onClick={() => onPageChange(p => p - 1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>上一页</Btn>
        <span style={{ color: c.muted, fontSize: 14, whiteSpace: 'nowrap' }}>第 {page} / {totalPages} 页</span>
        <input type="number" min={1} max={totalPages}
          onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) onPageChange(v); } }}
          style={{ ...inputStyle, width: 56, height: 36, textAlign: 'center' }} placeholder="页" />
        <Btn disabled={page >= totalPages} onClick={() => onPageChange(p => p + 1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>下一页</Btn>
        <Btn disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>末页</Btn>
      </div>
      <span style={{ color: c.muted, fontSize: 13 }}>共 {total} 条</span>
    </div>
  );
}

/* ═══════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════ */
function StatCard({ c, icon: Icon, iconColor, value, label, subtext }) {
  return (
    <div style={{
      background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: c.surfaceTint, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor || c.text, fontSize: 20,
      }}>
        <Icon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: c.muted, fontSize: 13, marginBottom: 2 }}>{label}</div>
        <div style={{ color: c.text, fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px' }}>{value}</div>
        {subtext && <div style={{ color: c.muted2, fontSize: 12, marginTop: 2 }}>{subtext}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function Shopping() {
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

  const inputStyle = {
    background: c.surfaceTint, border: '1px solid ' + c.border,
    borderRadius: 8, color: c.text, height: 42, lineHeight: '42px',
  };
  const labelStyle = { color: c.textSecondary, fontWeight: 500, fontSize: 14, marginBottom: 6, display: 'block' };
  const selectStyle = { ...inputStyle, width: '100%' };
  const dropdownStyle = { background: c.dropdownBg, border: '1px solid ' + c.border };

  /* ── data state ── */
  const [records, setRecords] = useState(seedMock);
  const [platforms, setPlatforms] = useState(loadPlatforms);
  const [settings, setSettings] = useState(loadSettings);

  /* ── filter state ── */
  const [searchText, setSearchText] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('');

  /* ── pagination state ── */
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  /* ── modal state ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [form, setForm] = useState({
    name: '', spec: '', price: null, unit_price: null,
    platform: '', date: dayjs().format('YYYY-MM-DD'), order_no: '', note: '',
  });

  /* ── platform modal state ── */
  const [platModalOpen, setPlatModalOpen] = useState(false);

  /* ── settings modal state ── */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usdtRate, setUsdtRate] = useState(settings.usdtRate);

  /* ── toast / delete state ── */
  const [toast, setToast] = useState(null);
  const [delRecId, setDelRecId] = useState(null);
  const [delPlatName, setDelPlatName] = useState(null);

  /* ── currency ── */
  const [currencyMode, setCurrencyMode] = useState('CNY');

  /* ── persist ── */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    savePlatforms(platforms);
  }, [platforms]);

  /* ── compute stats ── */
  const stats = useMemo(() => {
    const total = records.length;
    const amount = records.reduce((s, r) => s + r.price, 0);
    const uniquePlatforms = [...new Set(records.map(r => r.platform))];
    let recentDate = '';
    let maxDateNum = 0;
    for (const r of records) {
      const d = parseInt(r.date.replace(/-/g, ''));
      if (d > maxDateNum) { maxDateNum = d; recentDate = r.date; }
    }
    return { total, amount, platformCount: uniquePlatforms.length, recentDate };
  }, [records]);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    let list = [...records];
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q) || (r.order_no && r.order_no.toLowerCase().includes(q)));
    }
    if (platformFilter !== 'all') {
      list = list.filter(r => r.platform === platformFilter);
    }
    if (monthFilter) {
      list = list.filter(r => r.date.startsWith(monthFilter));
    }
    return list.sort((a, b) => b.id - a.id);
  }, [records, searchText, platformFilter, monthFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ── format helpers ── */
  const fmtCurrency = useCallback((amount) => {
    if (currencyMode === 'CNY') return `¥${amount.toFixed(2)}`;
    const rate = usdtRate || 7.0;
    return `₮${(amount / rate).toFixed(2)}`;
  }, [currencyMode, usdtRate]);

  const fmtDate = (d) => d ? dayjs(d).format('YYYY年M月D日') : '';

  /* ── CRUD ── */
  const openAdd = () => {
    setEditRec(null);
    setForm({
      name: '', spec: '', price: null, unit_price: null,
      platform: platforms[0] || '其他', date: dayjs().format('YYYY-MM-DD'),
      order_no: '', note: '',
    });
    setModalOpen(true);
  };

  const openEdit = (rec) => {
    setEditRec(rec);
    setForm({
      name: rec.name, spec: rec.spec || '', price: rec.price, unit_price: rec.unit_price,
      platform: rec.platform, date: rec.date, order_no: rec.order_no || '', note: rec.note || '',
    });
    setModalOpen(true);
  };

  const handleDelete = (id) => {
    setDelRecId(id);
  };

  const confirmDeleteRecord = () => {
    if (!delRecId) return;
    setRecords(prev => prev.filter(r => r.id !== delRecId));
    setToast({type:'success', message:'已删除'});
    setDelRecId(null);
  };

  const handleSave = () => {
    if (!form.name || form.price == null) {
      setToast({type:'error', message:'请填写名称和价格'});
      return;
    }
    if (editRec) {
      setRecords(prev => prev.map(r => r.id === editRec.id
        ? { ...form, price: parseFloat(form.price), unit_price: form.unit_price ? parseFloat(form.unit_price) : null, id: r.id }
        : r));
      setToast({type:'success', message:'已更新'});
    } else {
      const maxId = records.reduce((m, r) => Math.max(m, r.id), 0);
      setRecords(prev => [...prev, {
        ...form, price: parseFloat(form.price), unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        id: maxId + 1,
      }]);
      setToast({type:'success', message:'已添加'});
    }
    setModalOpen(false);
  };

  /* ── filters ── */
  const clearFilters = () => {
    setSearchText('');
    setPlatformFilter('all');
    setMonthFilter('');
    setPage(1);
  };

  const hasFilters = searchText || platformFilter !== 'all' || monthFilter;

  /* ── platform management ── */
  const [newPlatform, setNewPlatform] = useState('');

  const handleAddPlatform = () => {
    if (!newPlatform.trim()) { setToast({type:'error', message:'请输入平台名称'}); return; }
    if (platforms.includes(newPlatform.trim())) { setToast({type:'error', message:'平台已存在'}); return; }
    setPlatforms(prev => [...prev, newPlatform.trim()]);
    setNewPlatform('');
  };

  const handleRemovePlatform = (name) => {
    if (DEFAULT_PLATFORMS.includes(name)) { setToast({type:'error', message:'默认平台不能删除'}); return; }
    setDelPlatName(name);
  };

  const confirmRemovePlatform = () => {
    if (!delPlatName) return;
    setPlatforms(prev => prev.filter(p => p !== delPlatName));
    setDelPlatName(null);
  };

  /* ── settings ── */
  const openSettings = () => {
    setUsdtRate(settings.usdtRate);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    const newSettings = { usdtRate };
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    setSettingsOpen(false);
    setToast({type:'success', message:'设置已保存'});
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">网上购物</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={openSettings}
            style={{ ...inputStyle, height: 36, fontSize: 13, color: c.muted, borderColor: c.border }}>
            <IconSettings /> 设置
          </Btn>
          <Btn type="primary" onClick={openAdd}
            style={{ height: 36, fontSize: 13, fontWeight: 500 }}>
            <IconPlus /> 新增记录
          </Btn>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard c={c} icon={IconCart} iconColor="#5e6ad2" label="总记录数" value={stats.total} />
        <StatCard c={c} icon={IconDollar} iconColor="#10B981" label="总消费金额" value={fmtCurrency(stats.amount)}
          subtext={
            <span onClick={() => setCurrencyMode(p => p === 'CNY' ? 'USDT' : 'CNY')}
              style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: c.muted2 }}>
              切换到 {currencyMode === 'CNY' ? 'USDT' : '人民币'} (1 USDT ≈ ¥{usdtRate.toFixed(2)})
            </span>
          } />
        <StatCard c={c} icon={IconShop} iconColor="#F59E0B" label="平台数量" value={stats.platformCount} />
        <StatCard c={c} icon={IconCalendar} iconColor="#3B82F6" label="最近日期" value={stats.recentDate ? fmtDate(stats.recentDate) : '-'} />
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px',
        marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, width: 240, height: 38, gap: 6 }}>
          <IconSearch />
          <input value={searchText} onChange={e => { setSearchText(e.target.value); setPage(1); }}
            placeholder="搜索商品名称、订单号..." style={{ background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: 14, flex: 1 }} />
        </div>
        <select value={platformFilter} onChange={e => { setPlatformFilter(e.target.value); setPage(1); }}
          style={{ width: 130, height: 38, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 13, cursor: 'pointer', padding: '0 8px' }}>
          <option value="all">全部平台</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="month" value={monthFilter} onChange={e => { setMonthFilter(e.target.value || ''); setPage(1); }}
          style={{ ...inputStyle, width: 160, height: 38 }} />
        <Btn onClick={() => setPlatModalOpen(true)}
          style={{ ...inputStyle, height: 38, fontSize: 13, color: c.muted }}>
          <IconShop /> 平台管理
        </Btn>
        {hasFilters && (
          <Btn onClick={clearFilters}
            style={{ ...inputStyle, height: 38, fontSize: 13, color: c.muted }}>
            <IconClear /> 清除筛选
          </Btn>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{
        background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20,
      }}>
        <DataTable data={paged} columns={[
          { title: '名称', dataIndex: 'name', width: 180, render: v => <span style={{ fontWeight: 500, color: c.text }}>{v}</span> },
          { title: '规格', dataIndex: 'spec', width: 80, render: v => <span style={{ color: c.muted2 }}>{v || '-'}</span> },
          { title: '价格', dataIndex: 'price', width: 100, align: 'right', render: v => <span style={{ fontWeight: 500, color: c.text }}>{fmtCurrency(v)}</span> },
          { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: v => <span style={{ color: c.muted2 }}>{v ? fmtCurrency(v) : '-'}</span> },
          {
            title: '平台', dataIndex: 'platform', width: 100,
            render: v => (
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: getPlatformColor(v) + '20', color: getPlatformColor(v),
                border: '1px solid ' + getPlatformColor(v) + '40',
              }}>{v}</span>
            ),
          },
          { title: '日期', dataIndex: 'date', width: 110, render: v => <span style={{ color: c.textSecondary }}>{fmtDate(v)}</span> },
          {
            title: '订单号', dataIndex: 'order_no', width: 140,
            render: v => <span style={{ color: c.muted2, fontSize: 13 }} title={v || ''}>{v || '-'}</span>,
          },
          {
            title: '操作', width: 140,
            render: (_, rec) => (
              <div style={{ display: 'flex', gap: 4 }}>
                <Btn type="ghost" onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: 13 }}><IconEdit /> 编辑</Btn>
                <Btn type="danger" onClick={() => handleDelete(rec.id)} style={{ fontSize: 13 }}><IconDelete /> 删除</Btn>
              </div>
            ),
          },
        ]} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>{records.length === 0 ? '暂无数据，点击上方「新增记录」开始添加' : '没有匹配的记录'}</span>}
          minWidth={900} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
            onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editRec ? '编辑记录' : '新增记录'} width={560}
        footer={<><Btn onClick={() => setModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleSave}>保存</Btn></>}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>商品名称 <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="请输入商品名称" style={{ width: '100%', ...inputStyle }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>规格</label>
              <input value={form.spec} onChange={e => setForm(p => ({ ...p, spec: e.target.value }))}
                placeholder="如：XL、红色、500ml" style={{ width: '100%', ...inputStyle }} />
            </div>
            <div>
              <label style={labelStyle}>订单号</label>
              <input value={form.order_no} onChange={e => setForm(p => ({ ...p, order_no: e.target.value }))}
                placeholder="可选" style={{ width: '100%', ...inputStyle }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>价格 (元) <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" value={form.price ?? ''} onChange={e => setForm(p => ({ ...p, price: e.target.value === '' ? null : Number(e.target.value) }))}
                min={0} step="0.01" placeholder="0.00"
                style={{ width: '100%', ...inputStyle, textAlign: 'center' }} />
            </div>
            <div>
              <label style={labelStyle}>单价</label>
              <input type="number" value={form.unit_price ?? ''} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value === '' ? null : Number(e.target.value) }))}
                min={0} step="0.01" placeholder="可选"
                style={{ width: '100%', ...inputStyle, textAlign: 'center' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>购买平台 <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>日期 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                style={{ width: '100%', ...inputStyle }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="可选" style={{ width: '100%', ...inputStyle }} />
          </div>
        </div>
      </Modal>

      {/* ═══ Platform Management Modal ═══ */}
      <Modal open={platModalOpen} onClose={() => setPlatModalOpen(false)}
        title="平台管理" width={420}
        footer={<Btn onClick={() => setPlatModalOpen(false)}>完成</Btn>}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={newPlatform} onChange={e => setNewPlatform(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddPlatform(); }}
            placeholder="输入新平台名称" style={{ width: '100%', ...inputStyle }} />
          <Btn type="primary" onClick={handleAddPlatform}
            style={{ height: 42, whiteSpace: 'nowrap' }}><IconPlus /> 添加</Btn>
        </div>
        <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
          {platforms.map(p => {
            const color = getPlatformColor(p);
            return (
              <div key={p} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: color + '15', border: '1px solid ' + color + '30',
              }}>
                <span style={{ color, fontWeight: 500, fontSize: 14 }}>{p}</span>
                <Btn type="danger" onClick={() => handleRemovePlatform(p)}
                  style={{ height: 32, width: 32, padding: 0, justifyContent: 'center' }}><IconDelete /></Btn>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ═══ Settings Modal ═══ */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)}
        title="设置" width={420}
        footer={<><Btn onClick={() => setSettingsOpen(false)}>取消</Btn><Btn type="primary" onClick={saveSettings}>保存设置</Btn></>}>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={labelStyle}>USDT/CNY 汇率</label>
          <input type="number" value={usdtRate} onChange={e => setUsdtRate(parseFloat(e.target.value) || 7.0)}
            min={0.01} step="0.01"
            style={{ width: '100%', ...inputStyle, textAlign: 'center' }} />
          <div style={{ color: c.muted2, fontSize: 12, marginTop: 4 }}>用于将人民币金额转换为 USDT 显示</div>
        </div>
      </Modal>

      <DeleteModal open={!!delRecId} onClose={() => setDelRecId(null)} onConfirm={confirmDeleteRecord}
        title="确认删除记录？">
        <p>确定要删除此购物记录吗？</p>
      </DeleteModal>
      <DeleteModal open={!!delPlatName} onClose={() => setDelPlatName(null)} onConfirm={confirmRemovePlatform}
        title="确认删除平台？">
        <p>确定要删除此平台吗？</p>
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}
