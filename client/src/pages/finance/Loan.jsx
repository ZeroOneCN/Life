import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal, DeleteModal, Toast, Btn, PillTabs, DataTable, Switch } from '../../components/ui';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* ── Inline SVG Icons ── */
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const IconDelete = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconClear = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const STORAGE_KEY = 'lifeos_loan_data';

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rfloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

/* ── Mock data ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let platId = 1, billId = 1, repayId = 1;
  const platforms = [
    { id: platId++, name: '花呗', billing_day: 8, repayment_day: 20, credit_limit: 50000 },
    { id: platId++, name: '借呗', billing_day: 1, repayment_day: 15, credit_limit: 30000 },
    { id: platId++, name: '微粒贷', billing_day: 5, repayment_day: 25, credit_limit: 20000 },
    { id: platId++, name: '京东白条', billing_day: 10, repayment_day: 28, credit_limit: 15000 },
    { id: platId++, name: '美团借钱', billing_day: 15, repayment_day: 10, credit_limit: 10000 },
  ];
  const bills = [];
  const repayments = [];

  for (const p of platforms) {
    const months = rand(3, 6);
    for (let m = 0; m < months; m++) {
      const month = dayjs().subtract(m + rand(0, 3), 'month').format('YYYY-MM');
      const billDay = Math.min(p.repayment_day, dayjs(month + '-01').daysInMonth());
      const amount = rfloat(500, 8000);
      const interest = rfloat(10, amount * 0.08);
      const isPaid = Math.random() > 0.35;
      const bill = {
        id: billId++, platform_id: p.id, platform_name: p.name,
        amount, interest, billing_month: month,
        due_date: dayjs(month + '-01').date(billDay).format('YYYY-MM-DD'),
        is_paid: isPaid, notes: Math.random() > 0.6 ? '日常消费' : '',
      };
      bills.push(bill);
      if (isPaid) {
        const repayDate = dayjs(bill.due_date).subtract(rand(0, 5), 'day').format('YYYY-MM-DD');
        repayments.push({
          id: repayId++, bill_id: bill.id, platform_name: p.name,
          amount: bill.amount, interest: bill.interest,
          repayment_date: repayDate,
          notes: Math.random() > 0.7 ? '自动还款' : '',
        });
      }
    }
  }

  const settings = {
    notificationsEnabled: true, notificationFrequency: 'daily', upcomingDays: 7,
    overdueEnabled: true, wechatEnabled: false, wechatWebhookUrl: '',
    autoRepaymentOnMarkPaid: true,
  };

  return { platforms, bills, repayments, settings };
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
   Dashboard Tab — 数据概览
   ═══════════════════════════════════════ */
function DashboardTab({ c, fs, isLight, data, setData }) {
  const { platforms, bills, repayments } = data;
  const [toast, setToast] = useState(null);
  const [markBill, setMarkBill] = useState(null);

  const stats = useMemo(() => {
    let totalDebt = 0, totalPaid = 0, totalUnpaid = 0, totalInterest = 0;
    for (const b of bills) {
      totalDebt += b.amount;
      totalInterest += b.interest || 0;
      if (b.is_paid) totalPaid += b.amount;
      else totalUnpaid += b.amount;
    }
    return { totalDebt, totalPaid, totalUnpaid, totalInterest };
  }, [bills]);

  const upcomingBills = useMemo(() => {
    return bills
      .filter(b => !b.is_paid && dayjs(b.due_date).diff(dayjs(), 'day') <= 7)
      .sort((a, b) => dayjs(a.due_date).diff(dayjs(b.due_date)));
  }, [bills]);

  const chartId = useMemo(() => 'loan-pie-' + Math.random().toString(36).slice(2, 8), []);
  const chartRendered = useRef(false);

  const markAsPaid = (bill) => {
    setMarkBill(bill);
  };

  const confirmMarkPaid = () => {
    if (!markBill) return;
    setData(prev => {
      const newBills = prev.bills.map(b => b.id === markBill.id ? { ...b, is_paid: true } : b);
      let newRepayments = [...prev.repayments];
      if (prev.settings?.autoRepaymentOnMarkPaid !== false) {
        const maxId = prev.repayments.reduce((m, r) => Math.max(m, r.id), 0);
        newRepayments.push({
          id: maxId + 1, bill_id: markBill.id, platform_name: markBill.platform_name,
          amount: markBill.amount, interest: markBill.interest || 0,
          repayment_date: dayjs().format('YYYY-MM-DD'), notes: '自动记录',
        });
      }
      return { ...prev, bills: newBills, repayments: newRepayments };
    });
    setToast({type:'success', message:'已标记为已还款'});
    setMarkBill(null);
  };

  useEffect(() => {
    if (chartRendered.current) { chartRendered.current = false; }
    const dom = document.getElementById(chartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    const unpaidMap = {};
    for (const b of bills) {
      const pName = b.platform_name;
      unpaidMap[pName] = (unpaidMap[pName] || 0) + (b.is_paid ? 0 : b.amount);
    }
    const pieData = Object.entries(unpaidMap).filter(([, v]) => v > 0);
    if (!pieData.length) {
      for (const b of bills) {
        unpaidMap[b.platform_name] = (unpaidMap[b.platform_name] || 0) + b.amount;
      }
    }
    const data2 = Object.entries(unpaidMap).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
    chart.setOption({
      tooltip: { trigger: 'item', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      legend: { type: 'scroll', bottom: 0, left: 'center', textStyle: { color: c.muted, fontSize: 12 }, icon: 'circle', itemWidth: 10, itemHeight: 10 },
      color: ['#5e6ad2', '#ef4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'],
      series: [{
        type: 'pie', radius: ['34%', '62%'], center: ['50%', '44%'],
        itemStyle: { borderRadius: 10, borderColor: c.surface, borderWidth: 3 },
        label: { show: true, fontSize: 12, color: c.text, formatter: (p) => `${p.name}\n¥${p.value.toFixed(2)}` },
        data: data2,
      }],
      backgroundColor: 'transparent',
    });
    chartRendered.current = true;
    return () => { chart.dispose(); chartRendered.current = false; };
  }, [bills, isLight]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '总借款', value: `¥${stats.totalDebt.toFixed(2)}`, color: '#0f766e', accent: '#5e6ad2' },
          { label: '已还款', value: `¥${stats.totalPaid.toFixed(2)}`, color: '#2f7a16', accent: '#10B981' },
          { label: '待还款', value: `¥${stats.totalUnpaid.toFixed(2)}`, color: '#b45309', accent: '#F59E0B' },
          { label: '总利息', value: `¥${stats.totalInterest.toFixed(2)}`, color: '#c2410c', accent: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{
            background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 18px',
            borderLeft: '3px solid ' + s.accent,
          }}>
            <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 4 }}>{s.label}</div>
            <div style={{ color: s.color, ...fs.cardValue }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>即将到期账单</div>
          {upcomingBills.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {upcomingBills.map(b => (
                <div key={b.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: 10, border: '1px solid ' + c.border,
                  background: c.surfaceTint2,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: c.text, fontSize: fs.tableCell.fontSize }}>{b.platform_name}</div>
                    <div style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize, marginTop: 4 }}>
                      到期 {dayjs(b.due_date).format('M月D日')} · <strong style={{ color: '#ef4444' }}>¥{b.amount.toFixed(2)}</strong>
                    </div>
                  </div>
                  <Btn style={{ background: '#10B981', borderColor: '#10B981', color: '#fff', borderRadius: 6, fontSize: fs.tableCellSm.fontSize }}
                    onClick={() => markAsPaid(b)}>标记还款</Btn>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: c.muted, fontSize: 14 }}>未来 7 天暂无到期账单</div>
          )}
        </div>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>平台借款分布</div>
          <div id={chartId} style={{ width: '100%', height: 280 }} />
        </div>
      </div>

      <DeleteModal open={!!markBill} onClose={() => setMarkBill(null)} onConfirm={confirmMarkPaid}
        title="标记还款">
        <p>{markBill ? `确定标记"${markBill.platform_name} · ¥${markBill.amount.toFixed(2)}"为已还款吗？` : ''}</p>
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Platforms Tab — 借款平台
   ═══════════════════════════════════════ */
function PlatformsTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editPlat, setEditPlat] = useState(null);
  const [form, setForm] = useState({ name: '', billing_day: null, repayment_day: null, credit_limit: null });
  const [toast, setToast] = useState(null);
  const [delPlat, setDelPlat] = useState(null);

  const filtered = useMemo(() => {
    let list = [...data.platforms];
    if (keyword) {
      const q = keyword.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.id - b.id);
  }, [data.platforms, keyword]);

  const openCreate = () => { setEditPlat(null); setForm({ name: '', billing_day: null, repayment_day: null, credit_limit: null }); setModalOpen(true); };
  const openEdit = (p) => { setEditPlat(p); setForm({ name: p.name, billing_day: p.billing_day, repayment_day: p.repayment_day, credit_limit: p.credit_limit }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { setToast({type:'error', message:'请输入平台名称'}); return; }
    if (!form.billing_day || form.billing_day < 1 || form.billing_day > 31) { setToast({type:'error', message:'账单出账日需在 1-31 之间'}); return; }
    if (!form.repayment_day || form.repayment_day < 1 || form.repayment_day > 31) { setToast({type:'error', message:'还款日需在 1-31 之间'}); return; }
    if (editPlat) {
      setData(prev => ({ ...prev, platforms: prev.platforms.map(p => p.id === editPlat.id ? { ...p, ...form } : p) }));
      setToast({type:'success', message:'已更新'});
    } else {
      const maxId = data.platforms.reduce((m, p) => Math.max(m, p.id), 0);
      setData(prev => ({ ...prev, platforms: [...prev.platforms, { id: maxId + 1, ...form }] }));
      setToast({type:'success', message:'已创建'});
    }
    setModalOpen(false);
  };

  const handleDelete = (plat) => {
    const billCount = data.bills.filter(b => b.platform_id === plat.id).length;
    if (billCount > 0) {
      setDelPlat(plat);
    } else {
      setData(prev => ({ ...prev, platforms: prev.platforms.filter(p => p.id !== plat.id) }));
      setToast({type:'success', message:'已删除'});
    }
  };

  const confirmDeletePlat = () => {
    if (!delPlat) return;
    setData(prev => ({
      platforms: prev.platforms.filter(p => p.id !== delPlat.id),
      bills: prev.bills.filter(b => b.platform_id !== delPlat.id),
    }));
    setToast({type:'success', message:'已删除'});
    setDelPlat(null);
  };

  const delBillCount = delPlat ? data.bills.filter(b => b.platform_id === delPlat.id).length : 0;

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>ID</span>, dataIndex: 'id', width: 60, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>#{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>平台名称</span>, dataIndex: 'name', width: 160, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>账单出账日</span>, dataIndex: 'billing_day', width: 110, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v} 日</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款日</span>, dataIndex: 'repayment_day', width: 100, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v} 日</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>额度</span>, dataIndex: 'credit_limit', width: 120, align: 'right', render: v => <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 140,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn type="ghost" onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}><IconEdit /> 编辑</Btn>
          <Btn type="danger" onClick={() => handleDelete(rec)} style={{ fontSize: fs.tableCell.fontSize }}><IconDelete /> 删除</Btn>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, width: 240, height: 36, gap: 6 }}>
          <IconSearch />
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索平台名称" style={{ background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: 14, flex: 1 }} />
        </div>
        <div style={{ flex: 1 }} />
        <Btn type="primary" onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}><IconPlus /> 添加平台</Btn>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={filtered} columns={columns} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>暂无平台</span>}
          minWidth={700} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editPlat ? '编辑平台' : '添加平台'} width={480}
        footer={<><Btn onClick={() => setModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleSave}>确定</Btn></>}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>平台名称 <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：花呗" style={inputStyle} className="w-full" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>账单出账日 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" value={form.billing_day ?? ''} onChange={e => setForm(p => ({ ...p, billing_day: e.target.value === '' ? null : Number(e.target.value) }))}
                min={1} max={31} placeholder="1-31" style={{ width: '100%', ...inputStyle }} />
            </div>
            <div>
              <label style={labelStyle}>还款日 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" value={form.repayment_day ?? ''} onChange={e => setForm(p => ({ ...p, repayment_day: e.target.value === '' ? null : Number(e.target.value) }))}
                min={1} max={31} placeholder="1-31" style={{ width: '100%', ...inputStyle }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>额度</label>
            <input type="number" value={form.credit_limit ?? ''} onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value === '' ? null : Number(e.target.value) }))}
              min={0} step={100} placeholder="0.00" style={{ width: '100%', ...inputStyle }} />
          </div>
        </div>
      </Modal>

      <DeleteModal open={!!delPlat} onClose={() => setDelPlat(null)} onConfirm={confirmDeletePlat}
        title={`确认删除"${delPlat?.name}"？`}>
        {delPlat && <p>平台"{delPlat.name}"下有 {delBillCount} 条账单记录，删除将一并清空</p>}
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Bills Tab — 账单管理
   ═══════════════════════════════════════ */
function BillsTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const ddStyle = { background: c.dropdownBg, border: '1px solid ' + c.border };
  const [platformFilter, setPlatformFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [toast, setToast] = useState(null);
  const [delBillId, setDelBillId] = useState(null);
  const [form, setForm] = useState({
    platform_id: null, amount: null, interest: null,
    billing_month: dayjs().format('YYYY-MM'), due_date: null, notes: '',
  });

  const uniqueMonths = useMemo(() => {
    const s = new Set(data.bills.map(b => b.billing_month).filter(Boolean));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [data.bills]);

  const [selectedMonth, setSelectedMonth] = useState(uniqueMonths[0] || dayjs().format('YYYY-MM'));
  useEffect(() => { if (uniqueMonths.length && !uniqueMonths.includes(selectedMonth)) setSelectedMonth(uniqueMonths[0]); }, [uniqueMonths]);

  const filtered = useMemo(() => {
    let list = data.bills.filter(b => b.billing_month === selectedMonth);
    if (platformFilter) list = list.filter(b => b.platform_id === platformFilter);
    if (statusFilter !== null) list = list.filter(b => b.is_paid === statusFilter);
    return list.sort((a, b) => b.id - a.id);
  }, [data.bills, selectedMonth, platformFilter, statusFilter]);

  const platformOptions = data.platforms.map(p => ({ value: p.id, label: p.name }));

  const openCreate = () => {
    setEditBill(null);
    setForm({ platform_id: null, amount: null, interest: null, billing_month: selectedMonth, due_date: null, notes: '' });
    setModalOpen(true);
  };
  const openEdit = (b) => {
    setEditBill(b);
    setForm({ platform_id: b.platform_id, amount: b.amount, interest: b.interest || null, billing_month: b.billing_month, due_date: b.due_date || null, notes: b.notes || '' });
    setModalOpen(true);
  };

  const autoSetDueDate = (platId, month) => {
    if (!platId || !month) return;
    const plat = data.platforms.find(p => p.id === platId);
    if (!plat?.repayment_day) return;
    const base = dayjs(month + '-01');
    const day = Math.min(plat.repayment_day, base.daysInMonth());
    return base.date(day).format('YYYY-MM-DD');
  };

  const handleSave = () => {
    if (!form.platform_id) { setToast({type:'error', message:'请选择平台'}); return; }
    if (!form.amount || form.amount <= 0) { setToast({type:'error', message:'请输入有效金额'}); return; }
    const plat = data.platforms.find(p => p.id === form.platform_id);
    const payload = {
      ...form,
      due_date: form.due_date || autoSetDueDate(form.platform_id, form.billing_month),
      platform_name: plat?.name || '',
      amount: parseFloat(form.amount),
      interest: parseFloat(form.interest || 0),
    };
    if (editBill) {
      setData(prev => ({
        ...prev,
        bills: prev.bills.map(b => b.id === editBill.id ? { ...b, ...payload, id: b.id } : b),
      }));
      setToast({type:'success', message:'已更新'});
    } else {
      const maxId = data.bills.reduce((m, b) => Math.max(m, b.id), 0);
      setData(prev => ({ ...prev, bills: [...prev.bills, { ...payload, id: maxId + 1, is_paid: false }] }));
      setToast({type:'success', message:'已添加'});
    }
    setModalOpen(false);
  };

  const markAsPaid = (bill) => {
    setData(prev => ({
      ...prev,
      bills: prev.bills.map(b => b.id === bill.id ? { ...b, is_paid: true } : b),
    }));
    if (data.settings?.autoRepaymentOnMarkPaid !== false) {
      const maxId = data.repayments.reduce((m, r) => Math.max(m, r.id), 0);
      setData(prev => ({
        ...prev,
        repayments: [...prev.repayments, {
          id: maxId + 1, bill_id: bill.id, platform_name: bill.platform_name,
          amount: bill.amount, interest: bill.interest || 0,
          repayment_date: dayjs().format('YYYY-MM-DD'), notes: '自动记录',
        }],
      }));
    }
    setToast({type:'success', message:'已标记为已还款'});
  };

  const handleDelete = (id) => {
    setDelBillId(id);
  };

  const confirmDeleteBill = () => {
    if (!delBillId) return;
    setData(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== delBillId) }));
    setToast({type:'success', message:'已删除'});
    setDelBillId(null);
  };

  const prevMonth = () => { const idx = uniqueMonths.indexOf(selectedMonth); if (idx < uniqueMonths.length - 1) setSelectedMonth(uniqueMonths[idx + 1]); };
  const nextMonth = () => { const idx = uniqueMonths.indexOf(selectedMonth); if (idx > 0) setSelectedMonth(uniqueMonths[idx - 1]); };

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>ID</span>, dataIndex: 'id', width: 52, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>#{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>平台</span>, dataIndex: 'platform_name', width: 110, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>金额</span>, dataIndex: 'amount', width: 100, align: 'right', render: v => <span style={{ color: c.text, fontWeight: 600, fontSize: fs.tableCell.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>利息</span>, dataIndex: 'interest', width: 80, align: 'right', render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>¥{(v || 0).toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款截止日</span>, dataIndex: 'due_date', width: 110, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{dayjs(v).format('M月D日')}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>状态</span>, width: 80,
      render: (_, rec) => (
        <span style={{
          display: 'inline-block', padding: '2px 10px', borderRadius: 4, fontSize: fs.tableCellSm.fontSize,
          background: rec.is_paid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: rec.is_paid ? '#10B981' : '#ef4444',
        }}>{rec.is_paid ? '已还款' : '未还款'}</span>
      ),
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 180,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {!rec.is_paid && (
            <Btn type="ghost" onClick={() => markAsPaid(rec)}
              style={{ color: '#10B981', fontSize: fs.tableCell.fontSize }}>标记还款</Btn>
          )}
          <Btn type="ghost" onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}><IconEdit /> 编辑</Btn>
          <Btn type="danger" onClick={() => handleDelete(rec.id)} style={{ fontSize: fs.tableCell.fontSize }}><IconDelete /> 删除</Btn>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={platformFilter ?? ''} onChange={e => setPlatformFilter(e.target.value ? Number(e.target.value) : null)}
          style={{ width: 140, height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
          <option value="">全部平台</option>
          {platformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={statusFilter === null ? '' : statusFilter ? 'paid' : 'unpaid'} onChange={e => {
          const v = e.target.value;
          if (v === 'paid') setStatusFilter(true);
          else if (v === 'unpaid') setStatusFilter(false);
          else setStatusFilter(null);
        }}
          style={{ width: 120, height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
          <option value="">全部状态</option>
          <option value="unpaid">未还款</option>
          <option value="paid">已还款</option>
        </select>
        <div style={{ flex: 1 }} />
        <Btn disabled={uniqueMonths.indexOf(selectedMonth) >= uniqueMonths.length - 1} onClick={prevMonth}
          style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize }}>上个月</Btn>
        <span style={{ color: c.text, fontWeight: 600, fontSize: fs.tableCell.fontSize }}>{selectedMonth}</span>
        <Btn disabled={uniqueMonths.indexOf(selectedMonth) <= 0} onClick={nextMonth}
          style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize }}>下个月</Btn>
        <Btn type="primary" onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}><IconPlus /> 添加账单</Btn>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={filtered} columns={columns} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>暂无账单</span>}
          minWidth={750} />
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editBill ? '编辑账单' : '添加账单'} width={520}
        footer={<><Btn onClick={() => setModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleSave}>确定</Btn></>}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>选择平台 <span style={{ color: '#ef4444' }}>*</span></label>
            <select value={form.platform_id ?? ''} onChange={e => setForm(p => ({ ...p, platform_id: e.target.value ? Number(e.target.value) : null }))}
              style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
              <option value="">请选择借款平台</option>
              {platformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>账单金额 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" value={form.amount ?? ''} onChange={e => setForm(p => ({ ...p, amount: e.target.value === '' ? null : Number(e.target.value) }))}
                min={0} step="any" placeholder="0.00" style={{ width: '100%', ...inputStyle }} />
            </div>
            <div>
              <label style={labelStyle}>利息</label>
              <input type="number" value={form.interest ?? ''} onChange={e => setForm(p => ({ ...p, interest: e.target.value === '' ? null : Number(e.target.value) }))}
                min={0} step="any" placeholder="0.00" style={{ width: '100%', ...inputStyle }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>账单月份 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="month" value={form.billing_month} onChange={e => setForm(p => ({ ...p, billing_month: e.target.value }))}
                style={{ width: '100%', ...inputStyle }} />
            </div>
            <div>
              <label style={labelStyle}>还款截止日</label>
              <input type="date" value={form.due_date ?? ''} onChange={e => setForm(p => ({ ...p, due_date: e.target.value || null }))}
                style={{ width: '100%', ...inputStyle }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} placeholder="可选" style={{ width: '100%', ...inputStyle, lineHeight: 1.5, padding: '10px 12px' }} />
          </div>
        </div>
      </Modal>

      <DeleteModal open={!!delBillId} onClose={() => setDelBillId(null)} onConfirm={confirmDeleteBill}
        title="确认删除账单？">
        <p>确定要删除此账单吗？</p>
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Repayments Tab — 还款记录
   ═══════════════════════════════════════ */
function RepaymentsTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const ddStyle = { background: c.dropdownBg, border: '1px solid ' + c.border };
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [delRepayId, setDelRepayId] = useState(null);
  const [form, setForm] = useState({ bill_id: null, amount: null, interest: null, repayment_date: dayjs().format('YYYY-MM-DD'), notes: '' });

  const filtered = useMemo(() => {
    let list = [...data.repayments];
    if (platformFilter) list = list.filter(r => {
      const bill = data.bills.find(b => b.id === r.bill_id);
      return bill?.platform_id === platformFilter;
    });
    if (startDate && endDate) {
      list = list.filter(r => r.repayment_date >= startDate && r.repayment_date <= endDate);
    }
    return list.sort((a, b) => b.id - a.id);
  }, [data.repayments, data.bills, platformFilter, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const platformOptions = data.platforms.map(p => ({ value: p.id, label: p.name }));
  const unpaidBills = data.bills.filter(b => !b.is_paid);
  const billOptions = unpaidBills.map(b => ({
    value: b.id,
    label: `${b.platform_name} · ¥${b.amount.toFixed(2)} · ${b.billing_month}`,
  }));

  const openCreate = () => {
    setForm({ bill_id: null, amount: null, interest: null, repayment_date: dayjs().format('YYYY-MM-DD'), notes: '' });
    setModalOpen(true);
  };

  const handleBillChange = (billId) => {
    const bill = data.bills.find(b => b.id === billId);
    setForm(p => ({ ...p, bill_id: billId, interest: bill?.interest || null }));
  };

  const handleSave = () => {
    if (!form.bill_id) { setToast({type:'error', message:'请选择账单'}); return; }
    if (!form.amount || form.amount <= 0) { setToast({type:'error', message:'请输入有效还款金额'}); return; }
    const bill = data.bills.find(b => b.id === form.bill_id);
    const maxId = data.repayments.reduce((m, r) => Math.max(m, r.id), 0);
    setData(prev => ({
      ...prev,
      repayments: [...prev.repayments, {
        id: maxId + 1, bill_id: form.bill_id,
        platform_name: bill?.platform_name || '',
        amount: parseFloat(form.amount),
        interest: parseFloat(form.interest || 0),
        repayment_date: form.repayment_date,
        notes: form.notes,
      }],
    }));
    setToast({type:'success', message:'已添加'});
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    setDelRepayId(id);
  };

  const confirmDeleteRepayment = () => {
    if (!delRepayId) return;
    setData(prev => ({ ...prev, repayments: prev.repayments.filter(r => r.id !== delRepayId) }));
    setToast({type:'success', message:'已删除'});
    setDelRepayId(null);
  };

  const clearFilters = () => { setPlatformFilter(null); setStartDate(''); setEndDate(''); setPage(1); };
  const hasFilters = platformFilter || startDate || endDate;

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>ID</span>, dataIndex: 'id', width: 52, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>#{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>平台</span>, dataIndex: 'platform_name', width: 110, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款金额</span>, dataIndex: 'amount', width: 100, align: 'right', render: v => <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: fs.tableCell.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款利息</span>, dataIndex: 'interest', width: 90, align: 'right', render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>¥{(v || 0).toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款日期</span>, dataIndex: 'repayment_date', width: 105, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{dayjs(v).format('YYYY年M月D日')}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>备注</span>, dataIndex: 'notes', width: 120, render: v => <span style={{ color: c.muted2, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 80,
      render: (_, rec) => (
        <Btn type="danger" onClick={() => handleDelete(rec.id)} style={{ fontSize: fs.tableCell.fontSize }}><IconDelete /> 删除</Btn>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={platformFilter ?? ''} onChange={e => setPlatformFilter(e.target.value ? Number(e.target.value) : null)}
          style={{ width: 140, height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
          <option value="">全部平台</option>
          {platformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
          placeholder="开始日期" style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '0 8px' }} />
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
          placeholder="结束日期" style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '0 8px' }} />
        {hasFilters && (
          <Btn onClick={clearFilters}
            style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize, color: c.muted }}><IconClear /> 清除</Btn>
        )}
        <div style={{ flex: 1 }} />
        <Btn type="primary" onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}><IconPlus /> 添加还款记录</Btn>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={paged} columns={columns} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>暂无还款记录</span>}
          minWidth={700} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
            onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title="添加还款记录" width={480}
        footer={<><Btn onClick={() => setModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleSave}>确定</Btn></>}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>选择账单 <span style={{ color: '#ef4444' }}>*</span></label>
            <select value={form.bill_id ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; handleBillChange(v); }}
              style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
              <option value="">请选择未还款账单</option>
              {billOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>还款金额 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" value={form.amount ?? ''} onChange={e => setForm(p => ({ ...p, amount: e.target.value === '' ? null : Number(e.target.value) }))}
                min={0} step="any" placeholder="0.00" style={{ width: '100%', ...inputStyle }} />
            </div>
            <div>
              <label style={labelStyle}>还款利息</label>
              <input type="number" value={form.interest ?? ''} onChange={e => setForm(p => ({ ...p, interest: e.target.value === '' ? null : Number(e.target.value) }))}
                min={0} step="any" placeholder="0.00" style={{ width: '100%', ...inputStyle }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>还款日期 <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="date" value={form.repayment_date} onChange={e => setForm(p => ({ ...p, repayment_date: e.target.value }))}
              style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '0 8px' }} />
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} placeholder="可选" style={{ width: '100%', ...inputStyle, lineHeight: 1.5, padding: '10px 12px' }} />
          </div>
        </div>
      </Modal>

      <DeleteModal open={!!delRepayId} onClose={() => setDelRepayId(null)} onConfirm={confirmDeleteRepayment}
        title="确认删除还款记录？">
        <p>确定要删除此还款记录吗？</p>
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Statistics Tab — 数据统计
   ═══════════════════════════════════════ */
function StatisticsTab({ c, fs, isLight, data }) {
  const ddStyle = { background: c.dropdownBg, border: '1px solid ' + c.border };
  const [monthFilter, setMonthFilter] = useState(dayjs().format('YYYY-MM'));
  const [platformFilter, setPlatformFilter] = useState(null);
  const [rangeMode, setRangeMode] = useState('last30');
  const [chartType, setChartType] = useState('line');
  const [customStart, setCustomStart] = useState(dayjs().subtract(29, 'day'));
  const [customEnd, setCustomEnd] = useState(dayjs());

  const platformOptions = data.platforms.map(p => ({ value: p.id, label: p.name }));

  const monthlyStats = useMemo(() => {
    const monthBills = data.bills.filter(b => b.billing_month === monthFilter);
    let totalAmount = 0, paidAmount = 0, unpaidAmount = 0, totalInterest = 0;
    for (const b of monthBills) {
      totalAmount += b.amount;
      totalInterest += b.interest || 0;
      if (b.is_paid) paidAmount += b.amount;
      else unpaidAmount += b.amount;
    }
    return { totalBills: monthBills.length, totalAmount, paidAmount, unpaidAmount, totalInterest };
  }, [data.bills, monthFilter]);

  const trendChartId = useMemo(() => 'loan-trend-' + Math.random().toString(36).slice(2, 8), []);
  const pieChartId = useMemo(() => 'loan-stat-pie-' + Math.random().toString(36).slice(2, 8), []);

  const trendData = useMemo(() => {
    const start = rangeMode === 'custom' ? customStart : dayjs().subtract(29, 'day');
    const end = rangeMode === 'custom' ? customEnd : dayjs();
    const dates = [];
    let cur = start;
    while (cur.isBefore(end) || cur.isSame(end, 'day')) { dates.push(cur.format('YYYY-MM-DD')); cur = cur.add(1, 'day'); }
    const dayMap = {};
    for (const r of data.repayments) {
      if (platformFilter) {
        const bill = data.bills.find(b => b.id === r.bill_id);
        if (bill?.platform_id !== platformFilter) continue;
      }
      dayMap[r.repayment_date] = (dayMap[r.repayment_date] || 0) + r.amount;
    }
    const amounts = dates.map(d => dayMap[d] || 0);
    const total = amounts.reduce((s, v) => s + v, 0);
    const max = amounts.length ? Math.max(...amounts) : 0;
    const min = amounts.length ? Math.min(...amounts) : 0;
    const avg = amounts.length ? total / amounts.length : 0;
    return { dates, series: [{ name: '还款金额', type: chartType, smooth: chartType === 'line', data: amounts, areaStyle: chartType === 'line' ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(94,106,210,0.25)' }, { offset: 1, color: 'rgba(94,106,210,0)' }]) } : undefined, lineStyle: { color: '#5e6ad2', width: 2 }, itemStyle: { color: '#5e6ad2' }, barMaxWidth: 32 }], summary: { total, avg, max, min } };
  }, [data.repayments, data.bills, platformFilter, rangeMode, customStart, customEnd, chartType]);

  useEffect(() => {
    const dom = document.getElementById(trendChartId);
    if (!dom || !trendData.dates.length) return;
    const chart = echarts.init(dom);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      grid: { left: 54, right: 18, top: 20, bottom: 48 },
      xAxis: { type: 'category', data: trendData.dates.map(d => dayjs(d).format('M/D')), axisLabel: { rotate: 45, fontSize: 11, color: c.muted }, axisLine: { lineStyle: { color: c.border } } },
      yAxis: { type: 'value', axisLabel: { color: c.muted, fontSize: 11, formatter: '¥{value}' }, splitLine: { lineStyle: { color: c.surfaceTint, type: 'dashed' } } },
      series: trendData.series,
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [trendData, isLight]);

  useEffect(() => {
    const dom = document.getElementById(pieChartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    const totalMap = {};
    for (const p of data.platforms) {
      const total = data.bills.filter(b => b.platform_id === p.id).reduce((s, b) => s + b.amount, 0);
      if (total > 0) totalMap[p.name] = total;
    }
    const pieData = Object.entries(totalMap).map(([name, value]) => ({ name, value }));
    chart.setOption({
      tooltip: { trigger: 'item', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      legend: { type: 'scroll', bottom: 0, left: 'center', textStyle: { color: c.muted, fontSize: 12 }, icon: 'circle', itemWidth: 10, itemHeight: 10 },
      color: ['#5e6ad2', '#ef4444', '#10B981', '#F59E0B', '#3B82F6'],
      series: [{ type: 'pie', radius: ['35%', '64%'], center: ['50%', '43%'], itemStyle: { borderRadius: 10, borderColor: c.surface, borderWidth: 3 }, label: { show: true, fontSize: 12, color: c.text, formatter: (p) => `${p.name}\n¥${p.value.toFixed(2)}` }, data: pieData }],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [data.platforms, data.bills, isLight]);

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value || dayjs().format('YYYY-MM'))}
          style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '0 8px' }} />
        <select value={platformFilter ?? ''} onChange={e => setPlatformFilter(e.target.value ? Number(e.target.value) : null)}
          style={{ width: 140, height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
          <option value="">全部平台</option>
          {platformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '总账单数', value: monthlyStats.totalBills, color: '#5e6ad2' },
          { label: '总金额', value: `¥${monthlyStats.totalAmount.toFixed(2)}`, color: c.text },
          { label: '已还款', value: `¥${monthlyStats.paidAmount.toFixed(2)}`, color: '#10B981' },
          { label: '未还款', value: `¥${monthlyStats.unpaidAmount.toFixed(2)}`, color: '#F59E0B' },
          { label: '总利息', value: `¥${monthlyStats.totalInterest.toFixed(2)}`, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ color: c.muted, ...fs.cardLabel, marginBottom: 4 }}>{s.label}</div>
            <div style={{ color: s.color, ...fs.cardValue }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...fs.sectionTitle, color: c.text }}>还款趋势</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn type={rangeMode === 'last30' ? 'primary' : 'secondary'}
                onClick={() => setRangeMode('last30')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>最近30天</Btn>
              <Btn type={rangeMode === 'custom' ? 'primary' : 'secondary'}
                onClick={() => setRangeMode('custom')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>自定义</Btn>
              <Btn type={chartType === 'line' ? 'primary' : 'secondary'}
                onClick={() => setChartType('line')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>折线</Btn>
              <Btn type={chartType === 'bar' ? 'primary' : 'secondary'}
                onClick={() => setChartType('bar')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>柱状</Btn>
            </div>
          </div>
          {rangeMode === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input type="date" value={customStart.format('YYYY-MM-DD')} onChange={e => setCustomStart(dayjs(e.target.value))}
                style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '0 8px' }} />
              <input type="date" value={customEnd.format('YYYY-MM-DD')} onChange={e => setCustomEnd(dayjs(e.target.value))}
                style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '0 8px' }} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            {[
              { label: '总额', value: trendData.summary.total },
              { label: '日均', value: trendData.summary.avg },
              { label: '最大值', value: trendData.summary.max },
              { label: '最小值', value: trendData.summary.min },
            ].map(t => (
              <div key={t.label} style={{ background: c.surfaceTint2, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>{t.label}</div>
                <div style={{ color: c.text, fontWeight: 600, fontSize: fs.tableCell.fontSize }}>¥{t.value.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div id={trendChartId} style={{ width: '100%', height: 260 }} />
        </div>
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>平台借款分布</div>
          <div id={pieChartId} style={{ width: '100%', height: 400 }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Settings Tab — 平台设置
   ═══════════════════════════════════════ */
function SettingsTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const ddStyle = { background: c.dropdownBg, border: '1px solid ' + c.border };
  const [prefs, setPrefs] = useState(data.settings || {});
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState(null);

  const updatePref = (key, value) => {
    setPrefs(p => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    setData(prev => ({ ...prev, settings: prefs }));
    setToast({type:'success', message:'设置已保存'});
    setSaved(true);
  };

  const reset = () => {
    const defaults = {
      notificationsEnabled: true, notificationFrequency: 'daily', upcomingDays: 7,
      overdueEnabled: true, wechatEnabled: false, wechatWebhookUrl: '',
      autoRepaymentOnMarkPaid: true,
    };
    setPrefs(defaults);
    setSaved(false);
  };

  const SL = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderRadius: 10, background: c.surfaceTint2, border: '1px solid ' + c.border };

  return (
    <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, paddingBottom: 20, borderBottom: '1px solid ' + c.border, marginBottom: 20 }}>
        <div>
          <div style={{ ...fs.sectionTitle, color: c.text }}>提醒与联动配置</div>
          <div style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize, marginTop: 4 }}>保存后会立即刷新本地偏好</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={reset} style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize, color: c.muted }}>恢复默认</Btn>
          <Btn type="primary" onClick={save} style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>保存设置</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ background: c.surfaceTint2, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 600, color: c.text, fontSize: fs.tableCell.fontSize }}>提醒中心</div>
              <div style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize, marginTop: 2 }}>控制全局提醒是否启用、提醒频率</div>
            </div>
            <div style={SL}>
              <span style={{ fontSize: fs.tableCellSm.fontSize, color: c.text }}>启用提醒中心</span>
              <Switch checked={prefs.notificationsEnabled} onChange={v => updatePref('notificationsEnabled', v)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>提醒频次</label>
              <select value={prefs.notificationFrequency} onChange={e => updatePref('notificationFrequency', e.target.value)}
                disabled={!prefs.notificationsEnabled}
                style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px', opacity: prefs.notificationsEnabled ? 1 : 0.5 }}>
                <option value="daily">每日首次</option>
                <option value="always">每次进入</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>提前提醒天数</label>
              <input type="number" value={prefs.upcomingDays} onChange={e => updatePref('upcomingDays', Number(e.target.value))}
                min={0} max={30} disabled={!prefs.notificationsEnabled}
                style={{ width: '100%', ...inputStyle, opacity: prefs.notificationsEnabled ? 1 : 0.5 }} />
            </div>
          </div>
          <div style={{ ...SL, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.text, fontWeight: 500 }}>启用逾期提醒</div>
              <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.muted2 }}>已过还款截止日的账单发送告警</div>
            </div>
            <Switch checked={prefs.overdueEnabled} onChange={v => updatePref('overdueEnabled', v)}
              disabled={!prefs.notificationsEnabled} />
          </div>
        </div>

        <div style={{ background: c.surfaceTint2, border: '1px solid ' + c.border, borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 600, color: c.text, fontSize: fs.tableCell.fontSize, marginBottom: 16 }}>账单还款自动流水</div>
          <div style={SL}>
            <div>
              <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.text, fontWeight: 500 }}>自动生成还款记录</div>
              <div style={{ fontSize: fs.tableCellSm.fontSize, color: c.muted2 }}>标记已还时自动写入还款流水</div>
            </div>
            <Switch checked={prefs.autoRepaymentOnMarkPaid !== false} onChange={v => updatePref('autoRepaymentOnMarkPaid', v)} />
          </div>
        </div>

        {saved && <div style={{ textAlign: 'center', color: '#10B981', fontSize: fs.tableCellSm.fontSize }}>设置已保存</div>}
      </div>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function Loan() {
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
  const [activeTab, setActiveTab] = useState(() => window.location.hash?.slice(1) || 'dashboard');

  useEffect(() => {
    const onHashChange = () => { const h = window.location.hash?.slice(1); if (h) setActiveTab(h); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const fs = {
    sectionTitle: { fontSize: 16, fontWeight: 600 },
    cardValue: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' },
    cardLabel: { fontSize: 13, fontWeight: 500 },
    tableCell: { fontSize: 14 },
    tableCellSm: { fontSize: 13 },
  };

  const inputStyle = {
    background: c.surfaceTint, border: '1px solid ' + c.border,
    borderRadius: 8, color: c.text, height: 42, lineHeight: '42px',
  };
  const labelStyle = { color: c.textSecondary, fontWeight: 500, fontSize: 14, marginBottom: 6, display: 'block' };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>借款还款</h1>

      <div style={{ marginBottom: 24 }}>
        <PillTabs value={activeTab} onChange={(v) => { setActiveTab(v); window.location.hash = v; }}
          options={[
            { value: 'dashboard', label: '数据概览' },
            { value: 'platforms', label: '借款平台' },
            { value: 'bills', label: '账单管理' },
            { value: 'repayments', label: '还款记录' },
            { value: 'statistics', label: '数据统计' },
            { value: 'settings', label: '平台设置' },
          ]}
          style={{ background: c.surfaceTint, borderRadius: 8, padding: '3px 4px', fontSize: 14 }}
        />
      </div>

      {activeTab === 'dashboard' && <DashboardTab c={c} fs={fs} isLight={isLight} data={data} setData={setData} />}
      {activeTab === 'platforms' && <PlatformsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'bills' && <BillsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'repayments' && <RepaymentsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'statistics' && <StatisticsTab c={c} fs={fs} isLight={isLight} data={data} />}
      {activeTab === 'settings' && <SettingsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
    </div>
  );
}
