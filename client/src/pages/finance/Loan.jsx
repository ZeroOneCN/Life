import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Input, Button, Select, Modal, Popconfirm, message, Table, Segmented, DatePicker, InputNumber, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  FundOutlined, RiseOutlined,
  SearchOutlined, ClearOutlined,
  ShoppingCartOutlined, DollarOutlined, SettingOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

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
    const observer = new MutationObserver(() => setIsLight(el.classList.contains('light')));
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

/* ── Modal shared style helpers ── */
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

/* ═══════════════════════════════════════
   Dashboard Tab — 数据概览
   ═══════════════════════════════════════ */
function DashboardTab({ c, fs, isLight, data }) {
  const { platforms, bills, repayments } = data;

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
    Modal.confirm({
      title: '标记还款',
      content: `确定标记"${bill.platform_name} · ¥${bill.amount.toFixed(2)}"为已还款吗？`,
      okText: '确定', cancelText: '取消',
      onOk: () => {
        data.bills = data.bills.map(b => b.id === bill.id ? { ...b, is_paid: true } : b);
        if (data.settings?.autoRepaymentOnMarkPaid !== false) {
          const maxId = data.repayments.reduce((m, r) => Math.max(m, r.id), 0);
          data.repayments.push({
            id: maxId + 1, bill_id: bill.id, platform_name: bill.platform_name,
            amount: bill.amount, interest: bill.interest || 0,
            repayment_date: dayjs().format('YYYY-MM-DD'), notes: '自动记录',
          });
        }
        message.success('已标记为已还款');
      },
    });
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
                  <Button size="small" style={{ background: '#10B981', borderColor: '#10B981', color: '#fff', borderRadius: 6, fontSize: fs.tableCellSm.fontSize }}
                    onClick={() => markAsPaid(b)}>标记还款</Button>
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

  const ddStyle = { background: c.dropdownBg, border: '1px solid ' + c.border };

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
    if (!form.name.trim()) { message.error('请输入平台名称'); return; }
    if (!form.billing_day || form.billing_day < 1 || form.billing_day > 31) { message.error('账单出账日需在 1-31 之间'); return; }
    if (!form.repayment_day || form.repayment_day < 1 || form.repayment_day > 31) { message.error('还款日需在 1-31 之间'); return; }
    if (editPlat) {
      setData(prev => ({ ...prev, platforms: prev.platforms.map(p => p.id === editPlat.id ? { ...p, ...form } : p) }));
      message.success('已更新');
    } else {
      const maxId = data.platforms.reduce((m, p) => Math.max(m, p.id), 0);
      setData(prev => ({ ...prev, platforms: [...prev.platforms, { id: maxId + 1, ...form }] }));
      message.success('已创建');
    }
    setModalOpen(false);
  };

  const handleDelete = (plat) => {
    const billCount = data.bills.filter(b => b.platform_id === plat.id).length;
    if (billCount > 0) {
      Modal.confirm({
        title: '确认删除',
        content: `平台"${plat.name}"下有 ${billCount} 条账单记录，删除将一并清空`,
        okText: '确定', cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => {
          setData(prev => ({
            platforms: prev.platforms.filter(p => p.id !== plat.id),
            bills: prev.bills.filter(b => b.platform_id !== plat.id),
          }));
          message.success('已删除');
        },
      });
    } else {
      setData(prev => ({ ...prev, platforms: prev.platforms.filter(p => p.id !== plat.id) }));
      message.success('已删除');
    }
  };

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>ID</span>, dataIndex: 'id', width: 60, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>#{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>平台名称</span>, dataIndex: 'name', width: 160, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>账单出账日</span>, dataIndex: 'billing_day', width: 110, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v} 日</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款日</span>, dataIndex: 'repayment_day', width: 100, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v} 日</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>额度</span>, dataIndex: 'credit_limit', width: 120, align: 'right', render: v => <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 140, fixed: 'right',
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}>编辑</Button>
          <Popconfirm title={`确定删除"${rec.name}"？`} onConfirm={() => handleDelete(rec)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: fs.tableCell.fontSize }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input prefix={<SearchOutlined style={{ color: c.muted }} />}
          placeholder="搜索平台名称" value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={{ ...inputStyle, width: 240, height: 36 }} />
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>添加平台</Button>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <Table dataSource={filtered} columns={columns} rowKey="id" pagination={false} size="middle"
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无平台</span> }}
          scroll={{ x: 700 }} />
      </div>

      <Modal title={modalTitle(editPlat ? '编辑平台' : '添加平台', c)} open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText="确定" cancelText="取消"
        okButtonProps={okBtn} cancelButtonProps={cancelBtn(c)}
        styles={modalStyles(c)} width={480}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>平台名称 <span style={{ color: '#ef4444' }}>*</span></label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="如：花呗" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>账单出账日 <span style={{ color: '#ef4444' }}>*</span></label>
              <InputNumber value={form.billing_day} onChange={v => setForm(p => ({ ...p, billing_day: v }))}
                min={1} max={31} placeholder="1-31"
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
            </div>
            <div>
              <label style={labelStyle}>还款日 <span style={{ color: '#ef4444' }}>*</span></label>
              <InputNumber value={form.repayment_day} onChange={v => setForm(p => ({ ...p, repayment_day: v }))}
                min={1} max={31} placeholder="1-31"
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>额度</label>
            <InputNumber value={form.credit_limit} onChange={v => setForm(p => ({ ...p, credit_limit: v }))}
              min={0} step={100} precision={2} placeholder="0.00"
              style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
          </div>
        </div>
      </Modal>
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
  const [monthFilter, setMonthFilter] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBill, setEditBill] = useState(null);
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
  const statusOptions = [
    { value: null, label: '全部状态' },
    { value: false, label: '未还款' },
    { value: true, label: '已还款' },
  ];

  const openCreate = () => {
    setEditBill(null);
    setForm({ platform_id: null, amount: null, interest: null, billing_month: selectedMonth, due_date: null, notes: '' });
    setModalOpen(true);
  };
  const openEdit = (b) => {
    setEditBill(b);
    setForm({ platform_id: b.platform_id, amount: b.amount, interest: b.interest || null, billing_month: b.billing_month, due_date: b.due_date ? dayjs(b.due_date) : null, notes: b.notes || '' });
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
    if (!form.platform_id) { message.error('请选择平台'); return; }
    if (!form.amount || form.amount <= 0) { message.error('请输入有效金额'); return; }
    const plat = data.platforms.find(p => p.id === form.platform_id);
    const payload = {
      ...form,
      due_date: form.due_date ? form.due_date.format('YYYY-MM-DD') : autoSetDueDate(form.platform_id, form.billing_month),
      platform_name: plat?.name || '',
      amount: parseFloat(form.amount),
      interest: parseFloat(form.interest || 0),
    };
    if (editBill) {
      setData(prev => ({
        ...prev,
        bills: prev.bills.map(b => b.id === editBill.id ? { ...b, ...payload, id: b.id } : b),
      }));
      message.success('已更新');
    } else {
      const maxId = data.bills.reduce((m, b) => Math.max(m, b.id), 0);
      setData(prev => ({ ...prev, bills: [...prev.bills, { ...payload, id: maxId + 1, is_paid: false }] }));
      message.success('已添加');
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
    message.success('已标记为已还款');
  };

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
    message.success('已删除');
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
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 180, fixed: 'right',
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {!rec.is_paid && (
            <Button type="text" size="small" onClick={() => markAsPaid(rec)}
              style={{ color: '#10B981', fontSize: fs.tableCell.fontSize }}>标记还款</Button>
          )}
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: fs.tableCell.fontSize }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select value={platformFilter} onChange={v => setPlatformFilter(v)} placeholder="全部平台" allowClear
          style={{ width: 140, height: 36 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
          options={[{ value: null, label: '全部平台' }, ...platformOptions]} />
        <Select value={statusFilter} onChange={v => setStatusFilter(v)} placeholder="全部状态" allowClear
          style={{ width: 120, height: 36 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
          options={statusOptions} />
        <div style={{ flex: 1 }} />
        <Button disabled={uniqueMonths.indexOf(selectedMonth) >= uniqueMonths.length - 1} onClick={prevMonth}
          style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize }}>上个月</Button>
        <span style={{ color: c.text, fontWeight: 600, fontSize: fs.tableCell.fontSize }}>{selectedMonth}</span>
        <Button disabled={uniqueMonths.indexOf(selectedMonth) <= 0} onClick={nextMonth}
          style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize }}>下个月</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>添加账单</Button>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <Table dataSource={filtered} columns={columns} rowKey="id" pagination={false} size="middle"
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无账单</span> }}
          scroll={{ x: 750 }} />
      </div>

      <Modal title={modalTitle(editBill ? '编辑账单' : '添加账单', c)} open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText="确定" cancelText="取消"
        okButtonProps={okBtn} cancelButtonProps={cancelBtn(c)}
        styles={modalStyles(c)} width={520}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>选择平台 <span style={{ color: '#ef4444' }}>*</span></label>
            <Select value={form.platform_id} onChange={v => setForm(p => ({ ...p, platform_id: v }))}
              style={{ width: '100%', height: 42 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
              placeholder="请选择借款平台" options={platformOptions} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>账单金额 <span style={{ color: '#ef4444' }}>*</span></label>
              <InputNumber value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))}
                min={0} precision={2} placeholder="0.00"
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
            </div>
            <div>
              <label style={labelStyle}>利息</label>
              <InputNumber value={form.interest} onChange={v => setForm(p => ({ ...p, interest: v }))}
                min={0} precision={2} placeholder="0.00"
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>账单月份 <span style={{ color: '#ef4444' }}>*</span></label>
              <DatePicker picker="month" value={form.billing_month ? dayjs(form.billing_month) : null}
                onChange={d => setForm(p => ({ ...p, billing_month: d ? d.format('YYYY-MM') : '' }))}
                style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }}
                popupStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }} />
            </div>
            <div>
              <label style={labelStyle}>还款截止日</label>
              <DatePicker value={form.due_date} onChange={d => setForm(p => ({ ...p, due_date: d }))}
                style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }}
                popupStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <Input.TextArea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} placeholder="可选" style={inputStyle} />
          </div>
        </div>
      </Modal>
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
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ bill_id: null, amount: null, interest: null, repayment_date: dayjs(), notes: '' });

  const filtered = useMemo(() => {
    let list = [...data.repayments];
    if (platformFilter) list = list.filter(r => {
      const bill = data.bills.find(b => b.id === r.bill_id);
      return bill?.platform_id === platformFilter;
    });
    if (startDate && endDate) {
      const s = startDate.format('YYYY-MM-DD');
      const e = endDate.format('YYYY-MM-DD');
      list = list.filter(r => r.repayment_date >= s && r.repayment_date <= e);
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
    setForm({ bill_id: null, amount: null, interest: null, repayment_date: dayjs(), notes: '' });
    setModalOpen(true);
  };

  const handleBillChange = (billId) => {
    const bill = data.bills.find(b => b.id === billId);
    setForm(p => ({ ...p, bill_id: billId, interest: bill?.interest || null }));
  };

  const handleSave = () => {
    if (!form.bill_id) { message.error('请选择账单'); return; }
    if (!form.amount || form.amount <= 0) { message.error('请输入有效还款金额'); return; }
    const bill = data.bills.find(b => b.id === form.bill_id);
    const maxId = data.repayments.reduce((m, r) => Math.max(m, r.id), 0);
    setData(prev => ({
      ...prev,
      repayments: [...prev.repayments, {
        id: maxId + 1, bill_id: form.bill_id,
        platform_name: bill?.platform_name || '',
        amount: parseFloat(form.amount),
        interest: parseFloat(form.interest || 0),
        repayment_date: form.repayment_date.format('YYYY-MM-DD'),
        notes: form.notes,
      }],
    }));
    message.success('已添加');
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, repayments: prev.repayments.filter(r => r.id !== id) }));
    message.success('已删除');
  };

  const clearFilters = () => { setPlatformFilter(null); setStartDate(null); setEndDate(null); setPage(1); };
  const hasFilters = platformFilter || startDate || endDate;

  const columns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>ID</span>, dataIndex: 'id', width: 52, render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>#{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>平台</span>, dataIndex: 'platform_name', width: 110, render: v => <span style={{ fontWeight: 500, color: c.text, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款金额</span>, dataIndex: 'amount', width: 100, align: 'right', render: v => <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: fs.tableCell.fontSize }}>¥{v.toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款利息</span>, dataIndex: 'interest', width: 90, align: 'right', render: v => <span style={{ color: c.muted, fontSize: fs.tableCellSm.fontSize }}>¥{(v || 0).toFixed(2)}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>还款日期</span>, dataIndex: 'repayment_date', width: 105, render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{dayjs(v).format('YYYY年M月D日')}</span> },
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>备注</span>, dataIndex: 'notes', width: 120, render: v => <span style={{ color: c.muted2, fontSize: fs.tableCellSm.fontSize }}>{v || '-'}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 80, fixed: 'right',
      render: (_, rec) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(rec.id)} okText="确定" cancelText="取消">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: fs.tableCell.fontSize }}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select value={platformFilter} onChange={v => setPlatformFilter(v)} placeholder="全部平台" allowClear
          style={{ width: 140, height: 36 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
          options={[{ value: null, label: '全部平台' }, ...platformOptions]} />
        <DatePicker value={startDate} onChange={d => { setStartDate(d); setPage(1); }} placeholder="开始日期"
          style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }} />
        <DatePicker value={endDate} onChange={d => { setEndDate(d); setPage(1); }} placeholder="结束日期"
          style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }} />
        {hasFilters && (
          <Button icon={<ClearOutlined />} onClick={clearFilters}
            style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize, color: c.muted }}>清除</Button>
        )}
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>添加还款记录</Button>
      </div>
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <Table dataSource={paged} columns={columns} rowKey="id" pagination={false} size="middle"
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无还款记录</span> }}
          scroll={{ x: 700 }} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
            onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      <Modal title={modalTitle('添加还款记录', c)} open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText="确定" cancelText="取消"
        okButtonProps={okBtn} cancelButtonProps={cancelBtn(c)}
        styles={modalStyles(c)} width={480}>
        <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>选择账单 <span style={{ color: '#ef4444' }}>*</span></label>
            <Select value={form.bill_id} onChange={handleBillChange}
              style={{ width: '100%', height: 42 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
              placeholder="请选择未还款账单" options={billOptions} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>还款金额 <span style={{ color: '#ef4444' }}>*</span></label>
              <InputNumber value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))}
                min={0} precision={2} placeholder="0.00"
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
            </div>
            <div>
              <label style={labelStyle}>还款利息</label>
              <InputNumber value={form.interest} onChange={v => setForm(p => ({ ...p, interest: v }))}
                min={0} precision={2} placeholder="0.00"
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>还款日期 <span style={{ color: '#ef4444' }}>*</span></label>
            <DatePicker value={form.repayment_date} onChange={d => setForm(p => ({ ...p, repayment_date: d }))}
              style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }}
              popupStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }} />
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <Input.TextArea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3} placeholder="可选" style={inputStyle} />
          </div>
        </div>
      </Modal>
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
        <DatePicker picker="month" value={dayjs(monthFilter)} onChange={d => setMonthFilter(d ? d.format('YYYY-MM') : dayjs().format('YYYY-MM'))}
          style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }}
          popupStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }} />
        <Select value={platformFilter} onChange={setPlatformFilter} placeholder="全部平台" allowClear
          style={{ width: 140, height: 36 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
          options={[{ value: null, label: '全部平台' }, ...platformOptions]} />
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
              <Button size="small" type={rangeMode === 'last30' ? 'primary' : 'default'}
                onClick={() => setRangeMode('last30')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>最近30天</Button>
              <Button size="small" type={rangeMode === 'custom' ? 'primary' : 'default'}
                onClick={() => setRangeMode('custom')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>自定义</Button>
              <Button size="small" type={chartType === 'line' ? 'primary' : 'default'}
                onClick={() => setChartType('line')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>折线</Button>
              <Button size="small" type={chartType === 'bar' ? 'primary' : 'default'}
                onClick={() => setChartType('bar')}
                style={{ fontSize: fs.tableCellSm.fontSize, borderRadius: 6, height: 30 }}>柱状</Button>
            </div>
          </div>
          {rangeMode === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <DatePicker value={customStart} onChange={setCustomStart}
                style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }} />
              <DatePicker value={customEnd} onChange={setCustomEnd}
                style={{ height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8 }} />
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

  const updatePref = (key, value) => {
    setPrefs(p => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    setData(prev => ({ ...prev, settings: prefs }));
    message.success('设置已保存');
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
          <Button onClick={reset} style={{ ...inputStyle, height: 36, fontSize: fs.tableCell.fontSize, color: c.muted }}>恢复默认</Button>
          <Button type="primary" onClick={save} style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>保存设置</Button>
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
              <Select value={prefs.notificationFrequency} onChange={v => updatePref('notificationFrequency', v)}
                disabled={!prefs.notificationsEnabled}
                style={{ width: '100%', height: 42 }} popupStyle={ddStyle} dropdownStyle={ddStyle}
                options={[{ value: 'daily', label: '每日首次' }, { value: 'always', label: '每次进入' }]} />
            </div>
            <div>
              <label style={labelStyle}>提前提醒天数</label>
              <InputNumber value={prefs.upcomingDays} onChange={v => updatePref('upcomingDays', v)}
                min={0} max={30} disabled={!prefs.notificationsEnabled}
                style={{ width: '100%', ...inputStyle }} inputStyle={{ textAlign: 'center' }} />
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
        <Segmented value={activeTab} onChange={(v) => { setActiveTab(v); window.location.hash = v; }}
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

      {activeTab === 'dashboard' && <DashboardTab c={c} fs={fs} isLight={isLight} data={data} />}
      {activeTab === 'platforms' && <PlatformsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'bills' && <BillsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'repayments' && <RepaymentsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'statistics' && <StatisticsTab c={c} fs={fs} isLight={isLight} data={data} />}
      {activeTab === 'settings' && <SettingsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
    </div>
  );
}
