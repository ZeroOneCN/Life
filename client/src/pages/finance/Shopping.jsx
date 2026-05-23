import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Input, Button, Select, Modal, Popconfirm, message, InputNumber, DatePicker, Table,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  ShoppingCartOutlined, DollarOutlined, ShopOutlined,
  CalendarOutlined, SearchOutlined, SettingOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

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
      <Select value={pageSize} onChange={v => { onPageSizeChange(v); onPageChange(1); }}
        style={{ width: 120 }}
        popupStyle={{ background: c.dropdownBg }}
        dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
        options={[
          { value: 10, label: '10 条/页' },
          { value: 20, label: '20 条/页' },
          { value: 50, label: '50 条/页' },
          { value: 100, label: '100 条/页' },
        ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button disabled={page <= 1} onClick={() => onPageChange(1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>首页</Button>
        <Button disabled={page <= 1} onClick={() => onPageChange(p => p - 1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>上一页</Button>
        <span style={{ color: c.muted, fontSize: 14, whiteSpace: 'nowrap' }}>第 {page} / {totalPages} 页</span>
        <Input type="number" min={1} max={totalPages}
          onPressEnter={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) onPageChange(v); }}
          style={{ ...inputStyle, width: 56, height: 36, textAlign: 'center' }} placeholder="页" />
        <Button disabled={page >= totalPages} onClick={() => onPageChange(p => p + 1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>下一页</Button>
        <Button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>末页</Button>
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
    setRecords(prev => prev.filter(r => r.id !== id));
    message.success('已删除');
  };

  const handleSave = () => {
    if (!form.name || form.price == null) {
      message.error('请填写名称和价格');
      return;
    }
    if (editRec) {
      setRecords(prev => prev.map(r => r.id === editRec.id
        ? { ...form, price: parseFloat(form.price), unit_price: form.unit_price ? parseFloat(form.unit_price) : null, id: r.id }
        : r));
      message.success('已更新');
    } else {
      const maxId = records.reduce((m, r) => Math.max(m, r.id), 0);
      setRecords(prev => [...prev, {
        ...form, price: parseFloat(form.price), unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        id: maxId + 1,
      }]);
      message.success('已添加');
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
    if (!newPlatform.trim()) { message.error('请输入平台名称'); return; }
    if (platforms.includes(newPlatform.trim())) { message.error('平台已存在'); return; }
    setPlatforms(prev => [...prev, newPlatform.trim()]);
    setNewPlatform('');
  };

  const handleRemovePlatform = (name) => {
    if (DEFAULT_PLATFORMS.includes(name)) { message.warning('默认平台不能删除'); return; }
    setPlatforms(prev => prev.filter(p => p !== name));
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
    message.success('设置已保存');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">网上购物</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button icon={<SettingOutlined />} onClick={openSettings}
            style={{ ...inputStyle, height: 36, fontSize: 13, color: c.muted, borderColor: c.border }}>
            设置
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={openAdd}
            style={{ height: 36, fontSize: 13, fontWeight: 500 }}>
            新增记录
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <StatCard c={c} icon={ShoppingCartOutlined} iconColor="#5e6ad2" label="总记录数" value={stats.total} />
        <StatCard c={c} icon={DollarOutlined} iconColor="#10B981" label="总消费金额" value={fmtCurrency(stats.amount)}
          subtext={
            <span onClick={() => setCurrencyMode(p => p === 'CNY' ? 'USDT' : 'CNY')}
              style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: c.muted2 }}>
              切换到 {currencyMode === 'CNY' ? 'USDT' : '人民币'} (1 USDT ≈ ¥{usdtRate.toFixed(2)})
            </span>
          } />
        <StatCard c={c} icon={ShopOutlined} iconColor="#F59E0B" label="平台数量" value={stats.platformCount} />
        <StatCard c={c} icon={CalendarOutlined} iconColor="#3B82F6" label="最近日期" value={stats.recentDate ? fmtDate(stats.recentDate) : '-'} />
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px',
        marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Input prefix={<SearchOutlined style={{ color: c.muted }} />}
          placeholder="搜索商品名称、订单号..." value={searchText}
          onChange={e => { setSearchText(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 240, height: 38 }} />
        <Select value={platformFilter} onChange={v => { setPlatformFilter(v); setPage(1); }}
          style={{ width: 130, height: 38 }}
          popupStyle={dropdownStyle}
          dropdownStyle={dropdownStyle}
          options={[
            { value: 'all', label: '全部平台' },
            ...platforms.map(p => ({ value: p, label: p })),
          ]} />
        <DatePicker picker="month" value={monthFilter ? dayjs(monthFilter) : null}
          onChange={(d) => { setMonthFilter(d ? d.format('YYYY-MM') : ''); setPage(1); }}
          placeholder="选择月份" allowClear
          style={{ ...inputStyle, width: 160, height: 38, background: c.surfaceTint }}
          />
        <Button icon={<ShopOutlined />} onClick={() => setPlatModalOpen(true)}
          style={{ ...inputStyle, height: 38, fontSize: 13, color: c.muted }}>
          平台管理
        </Button>
        {hasFilters && (
          <Button icon={<ClearOutlined />} onClick={clearFilters}
            style={{ ...inputStyle, height: 38, fontSize: 13, color: c.muted }}>
            清除筛选
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{
        background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20,
      }}>
        <Table dataSource={paged} columns={[
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
            title: '操作', width: 140, fixed: 'right',
            render: (_, rec) => (
              <div style={{ display: 'flex', gap: 4 }}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
                <Popconfirm title="确定删除这条记录？" onConfirm={() => handleDelete(rec.id)} okText="确定" cancelText="取消">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
                </Popconfirm>
              </div>
            ),
          },
        ]} rowKey="id" pagination={false} size="middle"
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>{records.length === 0 ? '暂无数据，点击上方「新增记录」开始添加' : '没有匹配的记录'}</span> }}
          scroll={{ x: 900 }} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
            onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>{editRec ? '编辑记录' : '新增记录'}</span>}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="保存" cancelText="取消"
        okButtonProps={{ style: { background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 } }}
        cancelButtonProps={{ style: { background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 } }}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={560}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>商品名称 <span style={{ color: '#ef4444' }}>*</span></label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="请输入商品名称" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>规格</label>
              <Input value={form.spec} onChange={e => setForm(p => ({ ...p, spec: e.target.value }))}
                placeholder="如：XL、红色、500ml" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>订单号</label>
              <Input value={form.order_no} onChange={e => setForm(p => ({ ...p, order_no: e.target.value }))}
                placeholder="可选" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>价格 (元) <span style={{ color: '#ef4444' }}>*</span></label>
              <InputNumber value={form.price} onChange={v => setForm(p => ({ ...p, price: v }))}
                min={0} step={0.01} precision={2} placeholder="0.00"
                style={{ width: '100%', ...inputStyle }}
                inputStyle={{ textAlign: 'center' }} />
            </div>
            <div>
              <label style={labelStyle}>单价</label>
              <InputNumber value={form.unit_price} onChange={v => setForm(p => ({ ...p, unit_price: v }))}
                min={0} step={0.01} precision={2} placeholder="可选"
                style={{ width: '100%', ...inputStyle }}
                inputStyle={{ textAlign: 'center' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>购买平台 <span style={{ color: '#ef4444' }}>*</span></label>
              <Select value={form.platform} onChange={v => setForm(p => ({ ...p, platform: v }))}
                style={{ width: '100%', height: 42 }}
                popupStyle={dropdownStyle}
                dropdownStyle={dropdownStyle}
                options={platforms.map(p => ({ value: p, label: p }))} />
            </div>
            <div>
              <label style={labelStyle}>日期 <span style={{ color: '#ef4444' }}>*</span></label>
              <Input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <Input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="可选" style={inputStyle} />
          </div>
        </div>
      </Modal>

      {/* ═══ Platform Management Modal ═══ */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>平台管理</span>}
        open={platModalOpen} onCancel={() => setPlatModalOpen(false)}
        footer={
          <Button onClick={() => setPlatModalOpen(false)}
            style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 36, fontSize: 13 }}>完成</Button>
        }
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={420}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input value={newPlatform} onChange={e => setNewPlatform(e.target.value)}
            placeholder="输入新平台名称" style={inputStyle}
            onPressEnter={handleAddPlatform} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPlatform}
            style={{ height: 42 }}>添加</Button>
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
                <Popconfirm title={`确定删除平台"${p}"？`}
                  onConfirm={() => handleRemovePlatform(p)}
                  okText="确定" cancelText="取消">
                  <Button type="text" icon={<DeleteOutlined />}
                    style={{ color: '#ef4444', height: 32, width: 32 }} />
                </Popconfirm>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* ═══ Settings Modal ═══ */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>设置</span>}
        open={settingsOpen} onCancel={() => setSettingsOpen(false)}
        onOk={saveSettings}
        okText="保存设置" cancelText="取消"
        okButtonProps={{ style: { background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 } }}
        cancelButtonProps={{ style: { background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 } }}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={420}>
        <div style={{ display: 'grid', gap: 4 }}>
          <label style={labelStyle}>USDT/CNY 汇率</label>
          <InputNumber value={usdtRate} onChange={v => setUsdtRate(v || 7.0)}
            min={0.01} step={0.01} precision={2}
            style={{ width: '100%', ...inputStyle }}
            inputStyle={{ textAlign: 'center' }} />
          <div style={{ color: c.muted2, fontSize: 12, marginTop: 4 }}>用于将人民币金额转换为 USDT 显示</div>
        </div>
      </Modal>
    </div>
  );
}
