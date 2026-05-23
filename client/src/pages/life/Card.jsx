import { useState, useEffect, useMemo } from 'react';
import {
  Input, Button, Select, Modal, Popconfirm, message, Table, Segmented, DatePicker, InputNumber, Switch, Radio,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SearchOutlined, ReloadOutlined,
  WalletOutlined, DownloadOutlined, UploadOutlined, SettingOutlined, BarChartOutlined,
  PhoneOutlined, TeamOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

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
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
      <Select value={pageSize} onChange={v => { onPageSizeChange(v); onPageChange(1); }}
        style={{ width: 120 }}
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
    location: '', data_plan: '', call_minutes: '', sms_count: '', activation_date: null,
  });
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeCard, setRechargeCard] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState(0);

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
    setForm({ phone_number: '', carrier: '', balance: 0, monthly_fee: 0, billing_day: 1, location: '', data_plan: '', call_minutes: '', sms_count: '', activation_date: null });
    setModalOpen(true);
  };
  const openEdit = (c) => {
    setEditCard(c);
    setForm({
      phone_number: c.phone_number, carrier: c.carrier, balance: c.balance, monthly_fee: c.monthly_fee,
      billing_day: c.billing_day, location: c.location || '', data_plan: c.data_plan || '',
      call_minutes: c.call_minutes || '', sms_count: c.sms_count || '',
      activation_date: c.activation_date ? dayjs(c.activation_date) : null,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.phone_number.trim()) { message.error('请输入电话号码'); return; }
    if (!form.carrier) { message.error('请选择运营商'); return; }
    if (editCard) {
      setData(prev => ({ ...prev, simCards: prev.simCards.map(c => c.id === editCard.id ? { ...c, ...form, activation_date: form.activation_date ? form.activation_date.format('YYYY-MM-DD') : '' } : c) }));
      message.success('已更新');
    } else {
      const maxId = data.simCards.reduce((m, c) => Math.max(m, c.id), 0);
      setData(prev => ({ ...prev, simCards: [...prev.simCards, { id: maxId + 1, ...form, activation_date: form.activation_date ? form.activation_date.format('YYYY-MM-DD') : '' }] }));
      message.success('已添加');
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, simCards: prev.simCards.filter(c => c.id !== id), bills: prev.bills.filter(b => b.sim_id !== id) }));
    message.success('已删除');
  };

  const doRecharge = () => {
    if (!rechargeAmount || rechargeAmount <= 0) { message.error('请输入有效金额'); return; }
    setData(prev => ({
      ...prev,
      simCards: prev.simCards.map(c => c.id === rechargeCard.id ? { ...c, balance: parseFloat((c.balance + rechargeAmount).toFixed(2)) } : c),
    }));
    message.success('充值成功，余额已更新');
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
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}>编辑</Button>
          <Button type="text" size="small" icon={<WalletOutlined />} onClick={() => { setRechargeCard(rec); setRechargeAmount(0); setRechargeOpen(true); }} style={{ color: '#10B981', fontSize: fs.tableCell.fontSize }}>充值</Button>
          <Popconfirm title={`确定删除 ${rec.phone_number}？`} onConfirm={() => handleDelete(rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: fs.tableCell.fontSize }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input prefix={<SearchOutlined style={{ color: c.muted }} />}
          placeholder="搜索号码..." value={keyword}
          onChange={e => { setKeyword(e.target.value); }}
          style={{ ...inputStyle, width: 200, height: 36 }} />
        <Button onClick={() => setAdvOpen(!advOpen)}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, color: c.text, background: c.surfaceTint, border: '1px solid ' + c.border }}>{advOpen ? '收起筛选' : '高级筛选'}</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setFilters({ carrier: '', location: '', balanceMin: '', balanceMax: '' }); }}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, color: c.muted, background: c.surfaceTint, border: '1px solid ' + c.border }} />
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>添加号卡</Button>
      </div>

      {/* Advanced filters */}
      {advOpen && (
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>运营商</div>
              <Select value={filters.carrier} onChange={v => setFilters(p => ({ ...p, carrier: v }))}
                placeholder="全部" allowClear style={{ width: '100%' }}
                dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                options={carrierOptions} />
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>归属地</div>
              <Input value={filters.location} onChange={e => setFilters(p => ({ ...p, location: e.target.value }))}
                placeholder="归属地" style={{ ...inputStyle, height: 36 }} />
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>最小余额</div>
              <Input type="number" value={filters.balanceMin} onChange={e => setFilters(p => ({ ...p, balanceMin: e.target.value }))}
                placeholder="最小值" style={{ ...inputStyle, height: 36 }} />
            </div>
            <div>
              <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>最大余额</div>
              <Input type="number" value={filters.balanceMax} onChange={e => setFilters(p => ({ ...p, balanceMax: e.target.value }))}
                placeholder="最大值" style={{ ...inputStyle, height: 36 }} />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <Table dataSource={paged} columns={columns} rowKey="id" pagination={false} size="middle"
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无号卡</span> }} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle}
            page={page} totalPages={totalPages} onPageChange={setPage}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal title={modalTitle(editCard ? '编辑号卡' : '添加号卡', c)} open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText="确定" cancelText="取消"
        okButtonProps={okBtn} cancelButtonProps={cancelBtn(c)}
        styles={modalStyles(c)} width={640}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
          <div>
            <label style={labelStyle}>电话号码 <span style={{ color: '#ef4444' }}>*</span></label>
            <Input value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} placeholder="请输入号码" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>运营商 <span style={{ color: '#ef4444' }}>*</span></label>
            <Select value={form.carrier} onChange={v => setForm(p => ({ ...p, carrier: v }))}
              placeholder="选择运营商" style={{ width: '100%', ...inputStyle }}
              dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
              options={carrierOptions} />
          </div>
          <div>
            <label style={labelStyle}>余额（元）</label>
            <InputNumber value={form.balance} onChange={v => setForm(p => ({ ...p, balance: v || 0 }))}
              min={0} step={0.01} precision={2} style={{ width: '100%', ...inputStyle }} />
          </div>
          <div>
            <label style={labelStyle}>月租（元）</label>
            <InputNumber value={form.monthly_fee} onChange={v => setForm(p => ({ ...p, monthly_fee: v || 0 }))}
              min={0} step={0.01} precision={2} style={{ width: '100%', ...inputStyle }} />
          </div>
          <div>
            <label style={labelStyle}>月结日</label>
            <InputNumber value={form.billing_day} onChange={v => setForm(p => ({ ...p, billing_day: v || 1 }))}
              min={1} max={31} style={{ width: '100%', ...inputStyle }} />
          </div>
          <div>
            <label style={labelStyle}>归属地</label>
            <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="如：上海" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>流量套餐</label>
            <Input value={form.data_plan} onChange={e => setForm(p => ({ ...p, data_plan: e.target.value }))} placeholder="如：5GB/月" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>通话分钟</label>
            <Input value={form.call_minutes} onChange={e => setForm(p => ({ ...p, call_minutes: e.target.value }))} placeholder="如：100分钟/月" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>短信条数</label>
            <Input value={form.sms_count} onChange={e => setForm(p => ({ ...p, sms_count: e.target.value }))} placeholder="如：50条/月" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>开卡时间</label>
            <DatePicker value={form.activation_date} onChange={v => setForm(p => ({ ...p, activation_date: v }))}
              style={{ width: '100%', ...inputStyle }} placeholder="选择日期" />
          </div>
        </div>
      </Modal>

      {/* Recharge Modal */}
      <Modal title={modalTitle('充值 - ' + (rechargeCard?.phone_number || ''), c)} open={rechargeOpen}
        onCancel={() => setRechargeOpen(false)}
        onOk={doRecharge} okText="确认充值" cancelText="取消"
        okButtonProps={{ style: { background: '#10B981', borderColor: '#10B981', borderRadius: 8 } }}
        cancelButtonProps={cancelBtn(c)}
        styles={modalStyles(c)} width={420}>
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
          <InputNumber value={rechargeAmount} onChange={v => setRechargeAmount(v || 0)}
            min={0} step={10} precision={2} placeholder="输入充值金额"
            style={{ width: '100%', ...inputStyle }} />
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════
   BillManagement Tab — 账单管理
   ═══════════════════════════════════════ */
function BillManagementTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const bills = useMemo(() => [...data.bills].sort((a, b) => b.id - a.id), [data.bills]);
  const totalPages = Math.max(1, Math.ceil(bills.length / pageSize));
  const paged = bills.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, bills: prev.bills.filter(b => b.id !== id) }));
    message.success('已删除');
  };

  // Export CSV
  const handleExport = () => {
    if (!bills.length) { message.error('暂无账单数据可导出'); return; }
    const headers = ['月份', '电话号码', '月租', '实际扣费', '额外费用', '总费用', '备注'];
    const rows = bills.map(b => [b.billing_month, b.phone_number, b.monthly_fee, b.actual_fee, b.extra_charges, b.total_fee, b.note || '']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '账单导出_' + dayjs().format('YYYY-MM-DD') + '.csv';
    a.click();
    message.success('导出成功');
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
        <Popconfirm title="确定删除此账单？" onConfirm={() => handleDelete(rec.id)} okText="确定" cancelText="取消">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      {/* Left: Bill table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ ...fs.sectionTitle, color: c.text }}>账单记录</div>
          <Button icon={<DownloadOutlined />} onClick={handleExport}
            style={{ height: 32, fontSize: 13, border: '1px solid ' + c.border, color: c.text, background: c.surfaceTint }}>导出</Button>
        </div>
        <Table dataSource={paged} columns={columns} rowKey="id" pagination={false} size="middle"
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无账单</span> }} />
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
            <UploadOutlined style={{ fontSize: 36, color: c.muted }} />
            <div style={{ color: c.muted, fontSize: 14, marginTop: 12 }}>拖拽文件到此处，或点击选择文件</div>
            <div style={{ color: c.muted2, fontSize: 12, marginTop: 4 }}>仅支持 CSV 格式文件</div>
            <Button onClick={handleTemplate} style={{ marginTop: 16, border: '1px solid ' + c.border, color: c.text, background: c.surfaceTint, height: 36, fontSize: 13 }}>
              <DownloadOutlined /> 下载模板
            </Button>
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
        <Select value={carrierFilter} onChange={setCarrierFilter}
          style={{ width: 150 }}
          dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
          options={carrierOptions} />
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

  useEffect(() => { setSettings(data.settings); }, [data.settings]);

  const handleSaveSettings = () => {
    setData(prev => ({ ...prev, settings }));
    message.success('设置已保存');
  };

  // Carrier CRUD
  const handleAddCarrier = () => {
    if (!carrierName.trim()) { message.error('请输入运营商名称'); return; }
    if (data.carriers.some(c => c.name === carrierName.trim())) { message.error('运营商已存在'); return; }
    const maxId = data.carriers.reduce((m, c) => Math.max(m, c.id), 0);
    setData(prev => ({ ...prev, carriers: [...prev.carriers, { id: maxId + 1, name: carrierName.trim() }] }));
    setCarrierName('');
    message.success('已添加');
  };

  const handleEditCarrier = (c) => { setEditingCarrier(c); setCarrierName(c.name); setEditModalOpen(true); };

  const handleSaveCarrier = () => {
    if (!carrierName.trim()) { message.error('运营商名称不能为空'); return; }
    setData(prev => ({
      ...prev,
      carriers: prev.carriers.map(c => c.id === editingCarrier.id ? { ...c, name: carrierName.trim() } : c),
    }));
    setEditModalOpen(false);
    message.success('已更新');
  };

  const handleDeleteCarrier = (c) => {
    const count = data.simCards.filter(s => s.carrier === c.name).length;
    if (count > 0) {
      Modal.confirm({
        title: '确认删除',
        content: `运营商"${c.name}"下有 ${count} 张号卡，删除将清空关联运营商信息`,
        okText: '确定', cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => {
          setData(prev => ({
            ...prev,
            carriers: prev.carriers.filter(x => x.id !== c.id),
            simCards: prev.simCards.map(s => s.carrier === c.name ? { ...s, carrier: '未知' } : s),
          }));
          message.success('已删除');
        },
      });
    } else {
      setData(prev => ({ ...prev, carriers: prev.carriers.filter(x => x.id !== c.id) }));
      message.success('已删除');
    }
  };

  const carrierColumns = [
    { title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>运营商名称</span>, dataIndex: 'name', render: v => <span style={{ color: c.text, fontWeight: 500, fontSize: fs.tableCell.fontSize }}>{v}</span> },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>, width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditCarrier(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}>编辑</Button>
          <Popconfirm title={`确定删除"${rec.name}"？`} onConfirm={() => handleDeleteCarrier(rec)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: fs.tableCell.fontSize }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Button type={carrierTab === 'notification' ? 'primary' : 'default'}
          onClick={() => setCarrierTab('notification')}
          style={{ height: 36, fontSize: 14, borderRadius: 8 }}>通知设置</Button>
        <Button type={carrierTab === 'carrier' ? 'primary' : 'default'}
          onClick={() => setCarrierTab('carrier')}
          style={{ height: 36, fontSize: 14, borderRadius: 8 }}>运营商管理</Button>
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
                <Radio.Group value={settings.notification_type} onChange={e => setSettings(p => ({ ...p, notification_type: e.target.value }))}
                  style={{ marginTop: 8 }}>
                  <Radio value="email" style={{ color: c.text }}>邮件通知</Radio>
                  <Radio value="wechat" style={{ color: c.text }}>企业微信</Radio>
                  <Radio value="both" style={{ color: c.text }}>两者都启用</Radio>
                </Radio.Group>
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
                    <InputNumber value={settings.balance_threshold} onChange={v => setSettings(p => ({ ...p, balance_threshold: v || 0 }))}
                      min={0} style={{ width: '100%', ...inputStyle }} />
                  </div>
                  <div>
                    <label style={labelStyle}>提前通知天数</label>
                    <InputNumber value={settings.notification_days_before} onChange={v => setSettings(p => ({ ...p, notification_days_before: v || 0 }))}
                      min={0} style={{ width: '100%', ...inputStyle }} />
                  </div>
                </div>
              </div>

              <Button type="primary" onClick={handleSaveSettings} style={{ height: 40, fontSize: 14, borderRadius: 8, alignSelf: 'flex-start' }}>保存设置</Button>
            </div>
          </div>
        </div>
      ) : (
        /* Carrier management */
        <div>
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input value={carrierName} onChange={e => setCarrierName(e.target.value)}
              onPressEnter={handleAddCarrier} placeholder="输入运营商名称"
              style={{ ...inputStyle, width: 300, height: 36 }} />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCarrier}
              style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>添加运营商</Button>
          </div>
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
            <Table dataSource={data.carriers} columns={carrierColumns} rowKey="id" pagination={false} size="middle"
              style={{ background: 'transparent' }}
              locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无运营商</span> }} />
          </div>

          <Modal title={modalTitle('编辑运营商', c)} open={editModalOpen}
            onCancel={() => setEditModalOpen(false)}
            onOk={handleSaveCarrier} okText="确定" cancelText="取消"
            okButtonProps={okBtn} cancelButtonProps={cancelBtn(c)}
            styles={modalStyles(c)} width={420}>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>运营商名称</label>
              <Input value={carrierName} onChange={e => setCarrierName(e.target.value)}
                onPressEnter={handleSaveCarrier} placeholder="请输入运营商名称" style={inputStyle} />
            </div>
          </Modal>
        </div>
      )}
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
    { value: 'cards', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><PhoneOutlined />号卡管理</span> },
    { value: 'bills', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><WalletOutlined />账单管理</span> },
    { value: 'stats', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChartOutlined />数据统计</span> },
    { value: 'settings', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SettingOutlined />系统设置</span> },
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
      <Segmented value={tab} onChange={handleTabChange} options={tabItems}
        style={{ marginBottom: 20, background: c.surfaceTint, borderRadius: 10, padding: 3 }} />
      {renderTab()}
    </div>
  );
}
