import { useState, useEffect, useMemo } from 'react';
import { Modal, DeleteModal, Toast, Btn, Tag, PillTabs, Field, DataTable, Pagination, Switch, Checkbox } from '../../components/ui';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* SVG Icons */
const AddIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const DeleteIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const SearchIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;
const ReloadIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>;
const WalletIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14c1.1 0 2 .9 2 2v1h-9a3 3 0 00-3 3v8a3 3 0 003 3h9zm-9-2h10V8H12a2 2 0 100 4 2 2 0 010 4zm4-2.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>;
const DownloadIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>;
const UploadIcon = () => <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>;
const PhoneIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>;
const BarChartIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>;
const SettingsIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>;

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const STORAGE_KEY = 'lifeos_card_data';

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rfloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

/* ── Mock data ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let cardId = 1, carrierId = 1, billId = 1;

  const carriers = [
    { id: carrierId++, name: '中国移动' },
    { id: carrierId++, name: '中国电信' },
    { id: carrierId++, name: '中国联通' },
    { id: carrierId++, name: '中国广电' },
  ];

  const carrierNames = ['中国移动', '中国电信', '中国联通', '中国广电'];
  const baseCards = [
    { phone: '18316426417', carrierIdx: 0, balance: 85.30, fee: 8, billDay: 8, location: '上海', data: '5GB/月', call: '100分钟/月', sms: '', activation: '2023-06-15' },
    { phone: '13377632105', carrierIdx: 1, balance: 12.50, fee: 5, billDay: 1, location: '北京', data: '3GB/月', call: '50分钟/月', sms: '50条/月', activation: '2024-01-10' },
    { phone: '13800138000', carrierIdx: 0, balance: 200.00, fee: 59, billDay: 15, location: '广州', data: '30GB/月', call: '500分钟/月', sms: '100条/月', activation: '2015-07-25' },
    { phone: '15912345678', carrierIdx: 2, balance: 3.20, fee: 19, billDay: 5, location: '深圳', data: '10GB/月', call: '200分钟/月', sms: '', activation: '2022-03-20' },
    { phone: '17788889999', carrierIdx: 1, balance: 45.00, fee: 29, billDay: 20, location: '杭州', data: '20GB/月', call: '300分钟/月', sms: '50条/月', activation: '2023-11-01' },
    { phone: '16611112222', carrierIdx: 3, balance: 0.80, fee: 10, billDay: 12, location: '成都', data: '8GB/月', call: '100分钟/月', sms: '30条/月', activation: '2024-06-05' },
  ];

  const simCards = baseCards.map(c => ({
    id: cardId++,
    phone_number: c.phone,
    carrier: carrierNames[c.carrierIdx],
    balance: c.balance,
    monthly_fee: c.fee,
    billing_day: c.billDay,
    location: c.location,
    data_plan: c.data,
    call_minutes: c.call,
    sms_count: c.sms,
    activation_date: c.activation,
  }));

  const bills = [];
  for (const card of simCards) {
    for (let m = 0; m < 6; m++) {
      const month = dayjs().subtract(m, 'month').format('YYYY-MM');
      const extra = Math.random() > 0.6 ? rfloat(0, 5) : 0;
      bills.push({
        id: billId++,
        sim_id: card.id,
        phone_number: card.phone_number,
        billing_month: month,
        monthly_fee: card.monthly_fee,
        actual_fee: card.monthly_fee + extra,
        extra_charges: extra,
        total_fee: card.monthly_fee + extra,
        note: extra > 0 ? '含增值服务' : '',
        created_at: month + '-01',
      });
    }
  }

  const settings = {
    notification_type: 'email',
    email_enabled: true,
    email_subject: '号卡余额提醒',
    email_template: '您的号码{{phone}}当前余额为{{balance}}元，请及时充值。',
    wechat_enabled: false,
    balance_threshold: 10,
    notification_days_before: 3,
  };

  return { simCards, carriers, bills, settings };
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
  const [jumpInput, setJumpInput] = useState('');
  const doJump = () => { const v = parseInt(jumpInput); if (v >= 1 && v <= totalPages) { onPageChange(v); setJumpInput(''); } };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
      <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
        style={{ ...inputStyle, width: 120 }}>
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

/* ── Modal shared style helpers ── */
function modalTitle(text, c) {
  return <span style={{ color: c.text, fontWeight: 600 }}>{text}</span>;
}

/* ── Helpers ── */
function calcNetworkAge(dateStr) {
  if (!dateStr) return '-';
  const d = dayjs(dateStr);
  const months = dayjs().diff(d, 'month');
  const years = Math.floor(months / 12);
  const rem = months % 12;
  let r = '';
  if (years > 0) r += years + '年';
  if (rem > 0 || years === 0) r += rem + '个月';
  return r;
}

const CARRIER_COLORS = { '中国移动': '#3B82F6', '中国电信': '#0EA5E9', '中国联通': '#ef4444', '中国广电': '#10B981' };

/* ═══════════════════════════════════════
   SimCardList Tab — 号卡管理
   ═══════════════════════════════════════ */
function SimCardListTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [keyword, setKeyword] = useState('');
  const [advOpen, setAdvOpen] = useState(false);
  const [filters, setFilters] = useState({ carrier: '', location: '', balanceMin: '', balanceMax: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [form, setForm] = useState({
    phone_number: '', carrier: '', balance: 0, monthly_fee: 0, billing_day: 1,
    location: '', data_plan: '', call_minutes: '', sms_count: '', activation_date: '',
  });
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeCard, setRechargeCard] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState(0);
  const [deleteCardConfirm, setDeleteCardConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };

  const filtered = useMemo(() => {
    let list = [...data.simCards];
    if (keyword) list = list.filter(c => c.phone_number.includes(keyword));
    if (filters.carrier) list = list.filter(c => c.carrier === filters.carrier);
    if (filters.location) list = list.filter(c => (c.location || '').includes(filters.location));
    if (filters.balanceMin) list = list.filter(c => c.balance >= parseFloat(filters.balanceMin));
    if (filters.balanceMax) list = list.filter(c => c.balance <= parseFloat(filters.balanceMax));
    return list.sort((a, b) => a.id - b.id);
  }, [data.simCards, keyword, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [keyword, filters]);

  const openCreate = () => {
    setEditCard(null);
    setForm({ phone_number: '', carrier: '', balance: 0, monthly_fee: 0, billing_day: 1, location: '', data_plan: '', call_minutes: '', sms_count: '', activation_date: '' });
    setModalOpen(true);
  };
  const openEdit = (c) => {
    setEditCard(c);
    setForm({
      phone_number: c.phone_number, carrier: c.carrier, balance: c.balance, monthly_fee: c.monthly_fee,
      billing_day: c.billing_day, location: c.location || '', data_plan: c.data_plan || '',
      call_minutes: c.call_minutes || '', sms_count: c.sms_count || '',
      activation_date: c.activation_date || '',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.phone_number.trim()) { showToast('请输入电话号码', 'error'); return; }
    if (!form.carrier) { showToast('请选择运营商', 'error'); return; }
    if (editCard) {
      setData(prev => ({ ...prev, simCards: prev.simCards.map(c => c.id === editCard.id ? { ...c, ...form, activation_date: form.activation_date || '' } : c) }));
      showToast('已更新');
    } else {
      const maxId = data.simCards.reduce((m, c) => Math.max(m, c.id), 0);
      setData(prev => ({ ...prev, simCards: [...prev.simCards, { id: maxId + 1, ...form, activation_date: form.activation_date || '' }] }));
      showToast('已添加');
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, simCards: prev.simCards.filter(c => c.id !== id), bills: prev.bills.filter(b => b.sim_id !== id) }));
    showToast('已删除');
  };

  const doRecharge = () => {
    if (!rechargeAmount || rechargeAmount <= 0) { showToast('请输入有效金额', 'error'); return; }
    setData(prev => ({
      ...prev,
      simCards: prev.simCards.map(c => c.id === rechargeCard.id ? { ...c, balance: parseFloat((c.balance + rechargeAmount).toFixed(2)) } : c),
    }));
    showToast('充值成功，余额已更新');
    setRechargeOpen(false);
    setRechargeAmount(0);
  };

  const carrierOptions = data.carriers.map(c => ({ value: c.name, label: c.name }));

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>号码</span>, dataIndex: 'phone_number', width: 140, render: v => <span style={{ color: c.text, fontWeight: 500, fontSize: fs.tableCell.fontSize, fontFamily: 'monospace' }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>余额</span>, dataIndex: 'balance', width: 100, align: 'right', render: v => <span style={{ color: v < 10 ? '#ef4444' : '#10B981', fontWeight: 600, fontSize: fs.tableCell.fontSize }}>¥{v.toFixed(2)}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>运营商</span>, dataIndex: 'carrier', width: 100,
      render: v => <span style={{ color: CARRIER_COLORS[v] || c.textSecondary, fontWeight: 500, fontSize: fs.tableCellSm.fontSize }}>{v}</span>,
    },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>归属地</span>, dataIndex: 'location', width: 80, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>月租</span>, dataIndex: 'monthly_fee', width: 80, align: 'right', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>月结日</span>, dataIndex: 'billing_day', width: 70, align: 'center', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v}日</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>流量</span>, dataIndex: 'data_plan', width: 110, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>通话</span>, dataIndex: 'call_minutes', width: 110, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>入网</span>, dataIndex: 'activation_date', width: 150, render: v => v ? <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>{dayjs(v).format('YYYY-M-D')} <span style={{ color: c.muted2 }}>({calcNetworkAge(v)})</span></span> : <span style={{ color: c.muted2 }}>-</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 140, fixed: 'right',
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => openEdit(rec)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: fs.tableCell.fontSize, padding: '4px 6px' }}>
            <EditIcon /> 编辑
          </button>
          <button onClick={() => { setRechargeCard(rec); setRechargeAmount(0); setRechargeOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: fs.tableCell.fontSize, padding: '4px 6px' }}>
            <WalletIcon /> 充值
          </button>
          <button onClick={() => setDeleteCardConfirm(rec)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: fs.tableCell.fontSize, padding: '4px 6px' }}>
            <DeleteIcon /> 删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.muted, lineHeight: 0, pointerEvents: 'none' }}>
            <SearchIcon />
          </span>
          <input placeholder="搜索号码..." value={keyword}
            onChange={e => { setKeyword(e.target.value); }}
            style={{ ...inputStyle, width: 200, height: 36, paddingLeft: 32 }} />
        </span>
        <Btn onClick={() => setAdvOpen(!advOpen)}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, color: c.text, background: c.surfaceTint, border: '1px solid ' + c.border }}>{advOpen ? '收起筛选' : '高级筛选'}</Btn>
        <Btn onClick={() => { setKeyword(''); setFilters({ carrier: '', location: '', balanceMin: '', balanceMax: '' }); }}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, color: c.muted, background: c.surfaceTint, border: '1px solid ' + c.border }}>
          <ReloadIcon />
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn type="primary" onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>
          <AddIcon /> 添加号卡
        </Btn>
      </div>

      {/* Advanced filters */}
      {advOpen && (
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>运营商</div>
              <select value={filters.carrier} onChange={e => setFilters(p => ({ ...p, carrier: e.target.value }))}
                style={{ ...inputStyle, width: '100%', height: 36 }}>
                <option value="">全部</option>
                {data.carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>归属地</div>
              <input value={filters.location} onChange={e => setFilters(p => ({ ...p, location: e.target.value }))}
                placeholder="归属地" style={{ ...inputStyle, height: 36 }} className="w-full" />
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>最小余额</div>
              <input type="number" value={filters.balanceMin} onChange={e => setFilters(p => ({ ...p, balanceMin: e.target.value }))}
                placeholder="最小值" style={{ ...inputStyle, height: 36 }} className="w-full" />
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>最大余额</div>
              <input type="number" value={filters.balanceMax} onChange={e => setFilters(p => ({ ...p, balanceMax: e.target.value }))}
                placeholder="最大值" style={{ ...inputStyle, height: 36 }} className="w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={paged} columns={columns} rowKey="id" emptyText={<span style={{ color: c.muted2 }}>暂无号卡</span>} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle}
            page={page} totalPages={totalPages} onPageChange={setPage}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle(editCard ? '编辑号卡' : '添加号卡', c)} width={640}
        footer={<div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => setModalOpen(false)}>取消</Btn>
          <Btn type="primary" onClick={handleSave}>确定</Btn>
        </div>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>电话号码 <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} placeholder="请输入号码" style={inputStyle} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>运营商 <span style={{ color: '#ef4444' }}>*</span></label>
            <select value={form.carrier} onChange={e => setForm(p => ({ ...p, carrier: e.target.value }))}
              style={{ width: '100%', ...inputStyle }}>
              <option value="">选择运营商</option>
              {data.carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>余额（元）</label>
            <input type="number" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: parseFloat(e.target.value) || 0 }))}
              min={0} step="0.01" style={{ width: '100%', ...inputStyle }} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>月租（元）</label>
            <input type="number" value={form.monthly_fee} onChange={e => setForm(p => ({ ...p, monthly_fee: parseFloat(e.target.value) || 0 }))}
              min={0} step="0.01" style={{ width: '100%', ...inputStyle }} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>月结日</label>
            <input type="number" value={form.billing_day} onChange={e => setForm(p => ({ ...p, billing_day: parseInt(e.target.value) || 1 }))}
              min={1} max={31} style={{ width: '100%', ...inputStyle }} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>归属地</label>
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="如：上海" style={inputStyle} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>流量套餐</label>
            <input value={form.data_plan} onChange={e => setForm(p => ({ ...p, data_plan: e.target.value }))} placeholder="如：5GB/月" style={inputStyle} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>通话分钟</label>
            <input value={form.call_minutes} onChange={e => setForm(p => ({ ...p, call_minutes: e.target.value }))} placeholder="如：100分钟/月" style={inputStyle} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>短信条数</label>
            <input value={form.sms_count} onChange={e => setForm(p => ({ ...p, sms_count: e.target.value }))} placeholder="如：50条/月" style={inputStyle} className="w-full" />
          </div>
          <div>
            <label style={labelStyle}>开卡时间</label>
            <input type="date" value={form.activation_date} onChange={e => setForm(p => ({ ...p, activation_date: e.target.value }))}
              style={{ width: '100%', ...inputStyle }} className="w-full" />
          </div>
        </div>
      </Modal>

      {/* Recharge Modal */}
      <Modal open={rechargeOpen} onClose={() => setRechargeOpen(false)} title={modalTitle('充值 - ' + (rechargeCard?.phone_number || ''), c)} width={420}
        footer={<div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={() => setRechargeOpen(false)}>取消</Btn>
          <Btn type="primary" onClick={doRecharge} style={{ background: '#10B981', borderColor: '#10B981' }}>确认充值</Btn>
        </div>}>
        <div style={{ marginTop: 16 }}>
          <div style={{ background: c.surfaceTint2, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: c.muted, fontSize: 13 }}>当前余额</span>
              <span style={{ color: c.text, fontWeight: 600, fontSize: 15 }}>¥{(rechargeCard?.balance || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: c.muted, fontSize: 13 }}>运营商</span>
              <span style={{ color: c.text, fontWeight: 500, fontSize: 14 }}>{rechargeCard?.carrier}</span>
            </div>
          </div>
          <label style={labelStyle}>充值金额 <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="number" value={rechargeAmount} onChange={e => setRechargeAmount(parseFloat(e.target.value) || 0)}
            min={0} step="10" placeholder="输入充值金额"
            style={{ width: '100%', ...inputStyle }} className="w-full" />
        </div>
      </Modal>

      {/* Delete card confirmation */}
      <DeleteModal open={!!deleteCardConfirm} onClose={() => setDeleteCardConfirm(null)}
        onConfirm={() => { handleDelete(deleteCardConfirm.id); setDeleteCardConfirm(null); }}
        title={`确定删除 ${deleteCardConfirm?.phone_number}？`} />

      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   BillManagement Tab — 账单管理
   ═══════════════════════════════════════ */
function BillManagementTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteBillConfirm, setDeleteBillConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };

  const bills = useMemo(() => [...data.bills].sort((a, b) => b.id - a.id), [data.bills]);
  const totalPages = Math.max(1, Math.ceil(bills.length / pageSize));
  const paged = bills.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
    showToast('已删除');
  };

  // Export CSV
  const handleExport = () => {
    if (!bills.length) { showToast('暂无账单数据可导出', 'error'); return; }
    const headers = ['月份', '电话号码', '月租', '实际扣费', '额外费用', '总费用', '备注'];
    const rows = bills.map(b => [b.billing_month, b.phone_number, b.monthly_fee, b.actual_fee, b.extra_charges, b.total_fee, b.note || '']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '账单导出_' + dayjs().format('YYYY-MM-DD') + '.csv';
    a.click();
    showToast('导出成功');
  };

  // Download template
  const handleTemplate = () => {
    const headers = ['月份 (YYYY-MM)', '电话号码', '月租', '实际扣费', '额外费用', '总费用', '备注'];
    const rows = data.simCards.slice(0, 3).map(c => [dayjs().format('YYYY-MM'), c.phone_number, c.monthly_fee, c.monthly_fee, 0, c.monthly_fee, '正常月租']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '账单导入模板.csv';
    a.click();
  };

  const totalPaid = bills.reduce((s, b) => s + b.total_fee, 0);

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>月份</span>, dataIndex: 'billing_month', width: 100, render: v => <span style={{ color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>号码</span>, dataIndex: 'phone_number', width: 140, render: v => <span style={{ color: c.text, fontWeight: 500, fontSize: fs.tableCell.fontSize, fontFamily: 'monospace' }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>可用</span>, dataIndex: 'billing_month', width: 100, render: (_, r) => {
      const card = data.simCards.find(c => c.phone_number === r.phone_number);
      return <span style={{ color: (card?.balance || 0) < 10 ? '#ef4444' : '#10B981', fontWeight: 600, fontSize: fs.tableCellSm.fontSize }}>¥{(card?.balance || 0).toFixed(2)}</span>;
    } },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>月租</span>, dataIndex: 'monthly_fee', width: 80, align: 'right', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>实际</span>, dataIndex: 'actual_fee', width: 80, align: 'right', render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>额外</span>, dataIndex: 'extra_charges', width: 70, align: 'right', render: v => <span style={{ color: v > 0 ? '#F59E0B' : c.muted2, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>总计</span>, dataIndex: 'total_fee', width: 90, align: 'right', render: v => <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: fs.tableCell.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>备注</span>, dataIndex: 'note', width: 120, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 70,
      render: (_, rec) => (
        <button onClick={() => setDeleteBillConfirm(rec)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, lineHeight: 0 }}>
          <DeleteIcon />
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      {/* Left: Bill table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ ...fs.sectionTitle, color: c.text }}>账单记录</div>
          <Btn onClick={handleExport}
            style={{ height: 32, fontSize: 13, border: '1px solid ' + c.border, color: c.text, background: c.surfaceTint }}>
            <DownloadIcon /> 导出
          </Btn>
        </div>
        <DataTable data={paged} columns={columns} rowKey="id" emptyText={<span style={{ color: c.muted2 }}>暂无账单</span>} />
        {bills.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle}
            page={page} totalPages={totalPages} onPageChange={setPage}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={bills.length} />
        )}
      </div>

      {/* Right: Import + Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Import area */}
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>导入账单</div>
          <div style={{ color: c.muted, fontSize: 13, marginBottom: 16 }}>支持 CSV 格式，下载模板后填写实际扣费数据</div>
          <div style={{
            border: '2px dashed ' + c.border, borderRadius: 12, padding: 32, textAlign: 'center',
            background: c.surfaceTint,
          }}>
            <div style={{ lineHeight: 0, marginBottom: 12 }}><UploadIcon /></div>
            <div style={{ color: c.muted, fontSize: 14 }}>拖拽文件到此处，或点击选择文件</div>
            <div style={{ color: c.muted2, fontSize: 12, marginTop: 4 }}>仅支持 CSV 格式文件</div>
            <Btn onClick={handleTemplate} style={{ marginTop: 16, border: '1px solid ' + c.border, color: c.text, background: c.surfaceTint, height: 36, fontSize: 13 }}>
              <DownloadIcon /> 下载模板
            </Btn>
          </div>
        </div>

        {/* Stats */}
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 16 }}>统计</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + c.border }}>
            <span style={{ color: c.muted, fontSize: 14 }}>记录数</span>
            <span style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>{bills.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ color: c.muted, fontSize: 14 }}>累计扣费</span>
            <span style={{ color: '#5e6ad2', fontWeight: 700, fontSize: 16 }}>¥{totalPaid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Delete bill confirmation */}
      <DeleteModal open={!!deleteBillConfirm} onClose={() => setDeleteBillConfirm(null)}
        onConfirm={() => { handleDelete(deleteBillConfirm.id); setDeleteBillConfirm(null); }}
        title="确定删除此账单？" />

      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Statistics Tab — 数据统计
   ═══════════════════════════════════════ */
function StatisticsTab({ c, fs, isLight, data }) {
  const { simCards, bills } = data;

  const [carrierFilter, setCarrierFilter] = useState('all');

  const filteredCards = useMemo(() =>
    carrierFilter === 'all' ? simCards : simCards.filter(c => c.carrier === carrierFilter),
    [simCards, carrierFilter]);

  // Stats overview
  const stats = useMemo(() => {
    const totalCards = simCards.length;
    const totalMonthlyFee = simCards.reduce((s, c) => s + c.monthly_fee, 0);
    const totalBalance = simCards.reduce((s, c) => s + c.balance, 0);
    const lowBalanceCount = simCards.filter(c => c.balance < 10).length;
    const totalBills = bills.length;
    const totalPaid = bills.reduce((s, b) => s + b.total_fee, 0);
    return { totalCards, totalMonthlyFee, totalBalance, lowBalanceCount, totalBills, totalPaid };
  }, [simCards, bills]);

  // Monthly data by billing day
  const monthlyData = useMemo(() => {
    const map = {};
    filteredCards.forEach(c => {
      const k = '第' + c.billing_day + '日';
      if (!map[k]) map[k] = { total: 0, count: 0 };
      map[k].total += c.monthly_fee;
      map[k].count += 1;
    });
    return Object.entries(map).map(([month, d]) => ({
      month,
      total: parseFloat(d.total.toFixed(2)),
      count: d.count,
    })).sort((a, b) => parseInt(a.month) - parseInt(b.month));
  }, [filteredCards]);

  // Carrier distribution
  const carrierDist = useMemo(() => {
    const map = {};
    simCards.forEach(c => { map[c.carrier] = (map[c.carrier] || 0) + c.monthly_fee; });
    return Object.entries(map).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  }, [simCards]);

  // Balance distribution
  const balanceRanges = useMemo(() => {
    const ranges = [
      { range: '0-10 元', min: 0, max: 10, count: 0, total: 0 },
      { range: '10-30 元', min: 10, max: 30, count: 0, total: 0 },
      { range: '30-50 元', min: 30, max: 50, count: 0, total: 0 },
      { range: '50-100 元', min: 50, max: 100, count: 0, total: 0 },
      { range: '100 元以上', min: 100, max: Infinity, count: 0, total: 0 },
    ];
    filteredCards.forEach(c => {
      const r = ranges.find(r => c.balance >= r.min && c.balance < r.max);
      if (r) { r.count += 1; r.total += c.balance; }
    });
    return ranges.map(r => ({ range: r.range, count: r.count, avgBalance: r.count > 0 ? parseFloat((r.total / r.count).toFixed(2)) : 0 }));
  }, [filteredCards]);

  // Cumulative charges by sim card
  const cumulativeData = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      if (!map[b.sim_id]) {
        const card = simCards.find(c => c.id === b.sim_id);
        map[b.sim_id] = { sim_id: b.sim_id, phone_number: card?.phone_number || '未知', bill_count: 0, total_paid: 0, avg_monthly_fee: 0, first_month: b.billing_month, last_month: b.billing_month };
      }
      map[b.sim_id].bill_count += 1;
      map[b.sim_id].total_paid += b.total_fee;
      if (b.billing_month < map[b.sim_id].first_month) map[b.sim_id].first_month = b.billing_month;
      if (b.billing_month > map[b.sim_id].last_month) map[b.sim_id].last_month = b.billing_month;
    });
    return Object.values(map).map(d => ({ ...d, total_paid: parseFloat(d.total_paid.toFixed(2)), avg_monthly_fee: d.bill_count > 0 ? parseFloat((d.total_paid / d.bill_count).toFixed(2)) : 0 }));
  }, [bills, simCards]);

  const carrierOptions = useMemo(() => {
    const set = new Set(simCards.map(c => c.carrier));
    return [{ value: 'all', label: '全部' }, ...Array.from(set).map(v => ({ value: v, label: v }))];
  }, [simCards]);

  // ECharts: monthly fee bar chart
  const barChartId = useMemo(() => 'card-bar-' + Math.random().toString(36).slice(2, 8), []);
  useEffect(() => {
    if (!monthlyData.length) return;
    const dom = document.getElementById(barChartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      legend: { textStyle: { color: c.muted, fontSize: 12 }, bottom: 0 },
      grid: { top: 10, bottom: 40, left: 50, right: 50 },
      xAxis: { type: 'category', data: monthlyData.map(d => d.month), axisLabel: { color: c.muted, fontSize: 11 }, axisLine: { lineStyle: { color: c.border } } },
      yAxis: [
        { type: 'value', name: '月租(元)', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.surfaceTint2 } } },
        { type: 'value', name: '卡数', nameTextStyle: { color: c.muted, fontSize: 11 }, axisLabel: { color: c.muted, fontSize: 11 }, splitLine: { show: false } },
      ],
      color: ['#5e6ad2', '#82CA9D'],
      series: [
        { name: '月租总额(元)', type: 'bar', yAxisIndex: 0, data: monthlyData.map(d => d.total), itemStyle: { borderRadius: [4, 4, 0, 0] } },
        { name: '卡数量', type: 'line', yAxisIndex: 1, data: monthlyData.map(d => d.count), smooth: true, lineStyle: { width: 2 }, symbol: 'circle', symbolSize: 6 },
      ],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [monthlyData, isLight]);

  // ECharts: carrier pie
  const pieChartId = useMemo(() => 'card-pie-' + Math.random().toString(36).slice(2, 8), []);
  useEffect(() => {
    if (!carrierDist.length) return;
    const dom = document.getElementById(pieChartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'item', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      legend: { bottom: 0, left: 'center', textStyle: { color: c.muted, fontSize: 12 }, icon: 'circle', itemWidth: 10, itemHeight: 10 },
      color: ['#3B82F6', '#0EA5E9', '#ef4444', '#10B981'],
      series: [{
        type: 'pie', radius: ['38%', '65%'], center: ['50%', '44%'],
        itemStyle: { borderRadius: 8, borderColor: c.surface, borderWidth: 3 },
        label: { show: true, fontSize: 12, color: c.text, formatter: (p) => `${p.name}\n¥${p.value.toFixed(2)}` },
        data: carrierDist,
      }],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [carrierDist, isLight]);

  // ECharts: balance distribution bar
  const balChartId = useMemo(() => 'card-bal-' + Math.random().toString(36).slice(2, 8), []);
  useEffect(() => {
    if (!balanceRanges.length) return;
    const dom = document.getElementById(balChartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      grid: { top: 10, bottom: 30, left: 50, right: 50 },
      xAxis: { type: 'category', data: balanceRanges.map(d => d.range), axisLabel: { color: c.muted, fontSize: 10, rotate: 20 }, axisLine: { lineStyle: { color: c.border } } },
      yAxis: { type: 'value', axisLabel: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.surfaceTint2 } } },
      color: ['#82CA9D'],
      series: [{ type: 'bar', data: balanceRanges.map(d => d.count), itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: c.muted, fontSize: 11 } }],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [balanceRanges, isLight]);

  // ECharts: top 10 cumulative horizontal bar
  const topChartId = useMemo(() => 'card-top-' + Math.random().toString(36).slice(2, 8), []);
  useEffect(() => {
    if (!cumulativeData.length) return;
    const top10 = [...cumulativeData].sort((a, b) => b.total_paid - a.total_paid).slice(0, 10);
    const dom = document.getElementById(topChartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      grid: { top: 10, bottom: 10, left: 100, right: 60 },
      xAxis: { type: 'value', axisLabel: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: c.surfaceTint2 } } },
      yAxis: { type: 'category', data: top10.map(d => d.phone_number), axisLabel: { color: c.text, fontSize: 11, fontFamily: 'monospace' }, axisLine: { lineStyle: { color: c.border } } },
      color: ['#5e6ad2'],
      series: [{ type: 'bar', data: top10.map(d => d.total_paid), itemStyle: { borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: c.muted, fontSize: 11, formatter: (p) => '¥' + p.value.toFixed(2) } }],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [cumulativeData, isLight]);

  return (
    <div>
      {/* Filter */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: c.muted, fontSize: 14 }}>运营商：</span>
        <select value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}
          style={{ background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, height: 40, width: 150 }}>
          {carrierOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: '总卡数', value: stats.totalCards, color: c.text },
          { label: '月租总计', value: '¥' + stats.totalMonthlyFee.toFixed(2), color: '#5e6ad2' },
          { label: '余额总计', value: '¥' + stats.totalBalance.toFixed(2), color: '#10B981' },
          { label: '低余额告警', value: stats.lowBalanceCount, color: '#ef4444' },
          { label: '账单记录数', value: stats.totalBills, color: c.text },
          { label: '累计扣费', value: '¥' + stats.totalPaid.toFixed(2), color: '#5e6ad2' },
        ].map(s => (
          <div key={s.label} style={{
            background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 12px',
            textAlign: 'center',
          }}>
            <div style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>{s.label}</div>
            <div style={{ color: s.color, fontWeight: 700, fontSize: 22 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>按结日月租统计</div>
          <div id={barChartId} style={{ width: '100%', height: 280 }} />
        </div>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>运营商月租分布</div>
          <div id={pieChartId} style={{ width: '100%', height: 280 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>余额区间分布</div>
          <div id={balChartId} style={{ width: '100%', height: 280 }} />
        </div>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>号码累计扣费 TOP10</div>
          <div id={topChartId} style={{ width: '100%', height: 280 }} />
        </div>
      </div>

      {/* Cumulative detail table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 16 }}>号码累计扣费明细</div>
        {cumulativeData.length > 0 ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 130px 100px', gap: 8, padding: '10px 14px', borderBottom: '1px solid ' + c.border, color: c.muted, fontSize: 13, fontWeight: 600 }}>
              <span>号码</span><span style={{ textAlign: 'center' }}>账单月数</span><span style={{ textAlign: 'center' }}>平均月费</span><span style={{ textAlign: 'center' }}>数据期间</span><span style={{ textAlign: 'right' }}>累计扣费</span>
            </div>
            {cumulativeData.sort((a, b) => b.total_paid - a.total_paid).map(d => (
              <div key={d.sim_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 130px 100px', gap: 8, padding: '10px 14px', borderBottom: '1px solid ' + c.surfaceTint2, alignItems: 'center' }}>
                <span style={{ color: c.text, fontWeight: 500, fontSize: 14, fontFamily: 'monospace' }}>{d.phone_number}</span>
                <span style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center' }}>{d.bill_count} 个月</span>
                <span style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center' }}>¥{d.avg_monthly_fee.toFixed(2)}</span>
                <span style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{d.first_month} ~ {d.last_month}</span>
                <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: 14, textAlign: 'right' }}>¥{d.total_paid.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: c.muted, fontSize: 14 }}>暂无账单数据</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Settings Tab — 系统设置
   ═══════════════════════════════════════ */
function SettingsTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [settings, setSettings] = useState(data.settings || {
    notification_type: 'email', email_enabled: true, email_subject: '', email_template: '',
    wechat_enabled: false,
    balance_threshold: 10, notification_days_before: 3,
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [carrierName, setCarrierName] = useState('');

  const [carrierTab, setCarrierTab] = useState('notification');
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };
  const [carrierDeleteFirst, setCarrierDeleteFirst] = useState(null);
  const [carrierDeleteSecond, setCarrierDeleteSecond] = useState(null);

  useEffect(() => { setSettings(data.settings); }, [data.settings]);

  const handleSaveSettings = () => {
    setData(prev => ({ ...prev, settings }));
    showToast('设置已保存');
  };

  // Carrier CRUD
  const handleAddCarrier = () => {
    if (!carrierName.trim()) { showToast('请输入运营商名称', 'error'); return; }
    if (data.carriers.some(c => c.name === carrierName.trim())) { showToast('运营商已存在', 'error'); return; }
    const maxId = data.carriers.reduce((m, c) => Math.max(m, c.id), 0);
    setData(prev => ({ ...prev, carriers: [...prev.carriers, { id: maxId + 1, name: carrierName.trim() }] }));
    setCarrierName('');
    showToast('已添加');
  };

  const handleEditCarrier = (c) => { setEditingCarrier(c); setCarrierName(c.name); setEditModalOpen(true); };

  const handleSaveCarrier = () => {
    if (!carrierName.trim()) { showToast('运营商名称不能为空', 'error'); return; }
    setData(prev => ({
      ...prev,
      carriers: prev.carriers.map(c => c.id === editingCarrier.id ? { ...c, name: carrierName.trim() } : c),
    }));
    setEditModalOpen(false);
    showToast('已更新');
  };

  const handleDeleteCarrier = (c) => {
    const count = data.simCards.filter(s => s.carrier === c.name).length;
    if (count > 0) {
      setCarrierDeleteSecond({ carrier: c, count });
    } else {
      setData(prev => ({ ...prev, carriers: prev.carriers.filter(x => x.id !== c.id) }));
      showToast('已删除');
    }
  };

  const carrierColumns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>运营商名称</span>, dataIndex: 'name', render: v => <span style={{ color: c.text, fontWeight: 500, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handleEditCarrier(rec)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: fs.tableCell.fontSize, padding: '4px 6px' }}>
            <EditIcon /> 编辑
          </button>
          <button onClick={() => setCarrierDeleteFirst(rec)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: fs.tableCell.fontSize, padding: '4px 6px' }}>
            <DeleteIcon /> 删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Btn type={carrierTab === 'notification' ? 'primary' : 'secondary'}
          onClick={() => setCarrierTab('notification')}
          style={{ height: 36, fontSize: 14 }}>通知设置</Btn>
        <Btn type={carrierTab === 'carrier' ? 'primary' : 'secondary'}
          onClick={() => setCarrierTab('carrier')}
          style={{ height: 36, fontSize: 14 }}>运营商管理</Btn>
      </div>

      {carrierTab === 'notification' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Notification settings */}
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
            <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 20 }}>提醒设置</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Notification type */}
              <div>
                <label style={labelStyle}>通知方式</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {[
                    { value: 'email', label: '邮件通知' },
                    { value: 'wechat', label: '企业微信' },
                    { value: 'both', label: '两者都启用' },
                  ].map(opt => (
                    <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: c.text, fontSize: 14 }}>
                      <input type="radio" name="notification_type" value={opt.value}
                        checked={settings.notification_type === opt.value}
                        onChange={e => setSettings(p => ({ ...p, notification_type: e.target.value }))}
                        style={{ accentColor: '#5e6ad2' }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Email settings */}
              <div style={{ borderTop: '1px solid ' + c.border, paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>邮件通知设置</span>
                  <Switch checked={settings.email_enabled} onChange={v => setSettings(p => ({ ...p, email_enabled: v }))} />
                </div>
              </div>

              {/* WeChat settings */}
              <div style={{ borderTop: '1px solid ' + c.border, paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>企业微信通知设置</span>
                  <Switch checked={settings.wechat_enabled} onChange={v => setSettings(p => ({ ...p, wechat_enabled: v }))} />
                </div>
              </div>

              {/* General settings */}
              <div style={{ borderTop: '1px solid ' + c.border, paddingTop: 20 }}>
                <span style={{ color: c.text, fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 16 }}>通用设置</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>余额阈值（元）</label>
                    <input type="number" value={settings.balance_threshold} onChange={e => setSettings(p => ({ ...p, balance_threshold: parseFloat(e.target.value) || 0 }))}
                      min={0} style={{ width: '100%', ...inputStyle }} className="w-full" />
                  </div>
                  <div>
                    <label style={labelStyle}>提前通知天数</label>
                    <input type="number" value={settings.notification_days_before} onChange={e => setSettings(p => ({ ...p, notification_days_before: parseInt(e.target.value) || 0 }))}
                      min={0} style={{ width: '100%', ...inputStyle }} className="w-full" />
                  </div>
                </div>
              </div>

              <Btn type="primary" onClick={handleSaveSettings} style={{ height: 40, fontSize: 14, alignSelf: 'flex-start' }}>保存设置</Btn>
            </div>
          </div>
        </div>
      ) : (
        /* Carrier management */
        <div>
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <input value={carrierName} onChange={e => setCarrierName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCarrier(); }} placeholder="输入运营商名称"
              style={{ ...inputStyle, width: 300, height: 36 }} className="w-full" />
            <Btn type="primary" onClick={handleAddCarrier}
              style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>
              <AddIcon /> 添加运营商
            </Btn>
          </div>
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
            <DataTable data={data.carriers} columns={carrierColumns} rowKey="id" emptyText={<span style={{ color: c.muted2 }}>暂无运营商</span>} />
          </div>

          <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={modalTitle('编辑运营商', c)} width={420}
            footer={<div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setEditModalOpen(false)}>取消</Btn>
              <Btn type="primary" onClick={handleSaveCarrier}>确定</Btn>
            </div>}>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>运营商名称</label>
              <input value={carrierName} onChange={e => setCarrierName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveCarrier(); }} placeholder="请输入运营商名称"
                style={inputStyle} className="w-full" />
            </div>
          </Modal>

          {/* First carrier delete confirm */}
          <DeleteModal open={!!carrierDeleteFirst} onClose={() => setCarrierDeleteFirst(null)}
            onConfirm={() => { const c = carrierDeleteFirst; setCarrierDeleteFirst(null); handleDeleteCarrier(c); }}
            title={`确定删除"${carrierDeleteFirst?.name}"？`} />

          {/* Second carrier delete confirm when carrier has associated cards */}
          <DeleteModal open={!!carrierDeleteSecond} onClose={() => setCarrierDeleteSecond(null)}
            onConfirm={() => {
              const { carrier: c } = carrierDeleteSecond;
              setData(prev => ({
                ...prev,
                carriers: prev.carriers.filter(x => x.id !== c.id),
                simCards: prev.simCards.map(s => s.carrier === c.name ? { ...s, carrier: '未知' } : s),
              }));
              showToast('已删除');
              setCarrierDeleteSecond(null);
            }}
            title={`运营商"${carrierDeleteSecond?.carrier?.name}"下有 ${carrierDeleteSecond?.count} 张号卡，删除将清空关联运营商信息`} />
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Main CardMgmt Component
   ═══════════════════════════════════════ */
export default function CardMgmt() {
  const isLight = useIsLight();

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

  const inputStyle = useMemo(() => ({
    background: c.surfaceTint, border: '1px solid ' + c.border,
    borderRadius: 8, color: c.text, height: 42, lineHeight: '42px',
  }), [c]);

  const labelStyle = useMemo(() => ({
    display: 'block', marginBottom: 6, color: c.textSecondary, fontSize: 13, fontWeight: 500,
  }), [c]);

  const [data, setData] = useState(() => {
    const mock = seedMock();
    return JSON.parse(JSON.stringify(mock));
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const defaultTab = 'cards';
  const [tab, setTab] = useState(() => window.location.hash?.slice(1) || defaultTab);
  const handleTabChange = (v) => { setTab(v); window.location.hash = v; };
  useEffect(() => {
    const onHashChange = () => { const h = window.location.hash?.slice(1); if (h) setTab(h); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabItems = [
    { value: 'cards', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PhoneIcon />号卡管理</span> },
    { value: 'bills', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><WalletIcon />账单管理</span> },
    { value: 'stats', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChartIcon />数据统计</span> },
    { value: 'settings', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SettingsIcon />系统设置</span> },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'cards': return <SimCardListTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />;
      case 'bills': return <BillManagementTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />;
      case 'stats': return <StatisticsTab c={c} fs={fs} isLight={isLight} data={data} />;
      case 'settings': return <SettingsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />;
      default: return null;
    }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>号卡管理</h1>
      <PillTabs value={tab} onChange={handleTabChange} options={tabItems}
        style={{ marginBottom: 20, background: c.surfaceTint, borderRadius: 10, padding: 3 }} />
      {renderTab()}
    </div>
  );
}
