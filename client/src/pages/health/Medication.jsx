import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Input, Button, Select, Table, Modal, message,
  Popconfirm, Tag, Segmented, Calendar, InputNumber, ConfigProvider,
} from 'antd';
import locale from 'antd/locale/zh_CN';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  FileTextOutlined, MedicineBoxOutlined, CalendarOutlined,
  LineChartOutlined, PieChartOutlined, BarChartOutlined,
  TrophyOutlined, DatabaseOutlined,
  ExportOutlined, ImportOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const STORAGE_KEY = 'lifeos_medication_data';

const MEDICINES = ['阿莫西林', '布洛芬', '维生素C', '板蓝根', '头孢', '感冒灵', '黄连素', '氯雷他定', '蒙脱石散', '藿香正气水'];
const CHANNELS = ['药店', '京东', '淘宝', '拼多多'];
const UNITS = ['盒', '瓶', '支', '袋', '板', '粒'];
const CHANNEL_OPTIONS = CHANNELS.map(v => ({ value: v, label: v }));
const UNIT_OPTIONS = UNITS.map(v => ({ value: v, label: v }));
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
const MEAL_COLORS = { breakfast: '#3B82F6', lunch: '#10B981', dinner: '#F59E0B' };

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function todayStr() { return dayjs().format('YYYY-MM-DD'); }

/* ── mock seed ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let id = 1;
  const today = dayjs();
  const records = [];
  const purchases = [];
  const summaries = {};

  for (let d = 29; d >= 0; d--) {
    const date = today.subtract(d, 'day');
    if (Math.random() > 0.25) {
      const medCount = rand(1, 3);
      for (let m = 0; m < medCount; m++) {
        records.push({
          id: id++,
          date: date.format('YYYY-MM-DD'),
          medicineName: MEDICINES[rand(0, MEDICINES.length - 1)],
          breakfast: Math.random() > 0.3 ? rand(1, 2) : 0,
          lunch: Math.random() > 0.4 ? rand(1, 2) : 0,
          dinner: Math.random() > 0.3 ? rand(1, 2) : 0,
        });
      }
    }
  }

  for (let d = 29; d >= 0; d -= rand(3, 7)) {
    const date = today.subtract(d, 'day');
    const price = parseFloat((rand(10, 100) + Math.random()).toFixed(2));
    const qty = rand(1, 5);
    purchases.push({
      id: id++,
      purchaseDate: date.format('YYYY-MM-DD'),
      medicineName: MEDICINES[rand(0, MEDICINES.length - 1)],
      quantity: qty,
      unit: UNITS[rand(0, UNITS.length - 1)],
      unitPrice: price,
      totalPrice: parseFloat((qty * price).toFixed(2)),
      channel: CHANNELS[rand(0, CHANNELS.length - 1)],
      notes: '',
    });
  }

  for (let d = 29; d >= 0; d -= rand(2, 6)) {
    const date = today.subtract(d, 'day').format('YYYY-MM-DD');
    const symptoms = ['头痛', '发烧', '咳嗽', '感冒', '腹泻', '过敏', '牙痛', '胃痛'];
    summaries[date] = `今日服用药物，${symptoms[rand(0, symptoms.length - 1)]}症状有所缓解。`;
  }

  const data = { records, purchases, summaries };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

/* ── theme hook ── */
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

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function Medication() {
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
  const [activeTab, setActiveTab] = useState(() => window.location.hash?.slice(1) || 'home');
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
  const labelStyle = { color: c.textSecondary, fontWeight: 500, fontSize: 14, marginBottom: 6, display: 'block' };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>日常用药</h1>

      <style>{`.med-tabs .ant-segmented-item { margin-right: 4px; } .med-tabs .ant-segmented-item:last-child { margin-right: 0; }`}</style>
      <div style={{ marginBottom: 24 }}>
        <Segmented value={activeTab} onChange={v => { setActiveTab(v); window.location.hash = v; }}
          options={[
            { value: 'home', label: '用药记录' },
            { value: 'analysis', label: '数据分析' },
            { value: 'purchase', label: '购买记录' },
            { value: 'settings', label: '设置' },
          ]}
          className="med-tabs"
          style={{ background: c.surfaceTint, borderRadius: 8, padding: '3px 4px', fontSize: 14 }}
        />
      </div>

      {activeTab === 'home' && <HomeTab c={c} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'analysis' && <AnalysisTab c={c} isLight={isLight} data={data} />}
      {activeTab === 'purchase' && <PurchaseTab c={c} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />}
      {activeTab === 'settings' && <SettingsTab c={c} data={data} setData={setData} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   Pagination widget (shared)
   ═══════════════════════════════════════ */
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
   HomeTab — 用药记录
   ═══════════════════════════════════════ */
function HomeTab({ c, data, setData, inputStyle, labelStyle }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selIds, setSelIds] = useState([]);

  /* filters */
  const [filterName, setFilterName] = useState('');
  const [filterMin, setFilterMin] = useState(null);
  const [filterMax, setFilterMax] = useState(null);

  /* modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ date: todayStr(), medicineName: '', breakfast: 0, lunch: 0, dinner: 0 });
  const [keepAdding, setKeepAdding] = useState(false);

  /* summary */
  const [selSummaryDate, setSelSummaryDate] = useState(dayjs());
  const [summaryText, setSummaryText] = useState('');

  const list = useMemo(() => {
    let l = [...data.records];
    if (filterName) l = l.filter(r => r.medicineName.includes(filterName));
    if (filterMin !== null) l = l.filter(r => [r.breakfast, r.lunch, r.dinner].some(v => v >= filterMin));
    if (filterMax !== null) l = l.filter(r => [r.breakfast, r.lunch, r.dinner].some(v => v <= filterMax));
    return l.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.records, filterName, filterMin, filterMax]);

  const totalPages = Math.ceil(list.length / pageSize);
  const pageData = list.slice((page - 1) * pageSize, page * pageSize);
  const selectAll = selIds.length === list.length && list.length > 0;
  const indeterminate = selIds.length > 0 && selIds.length < list.length;

  /* stats */
  const stats = useMemo(() => {
    const totalRecords = data.records.length;
    const totalDosage = data.records.reduce((s, r) => s + r.breakfast + r.lunch + r.dinner, 0);
    const uniqueDates = new Set(data.records.map(r => r.date)).size;
    const avgDosage = uniqueDates > 0 ? Math.round(totalDosage / uniqueDates) : 0;
    return { totalRecords, totalDosage, uniqueDates, avgDosage };
  }, [data.records]);

  /* totals by date for summary */
  const totalsByDate = useMemo(() => {
    const map = new Map();
    data.records.forEach(r => {
      const key = r.date;
      map.set(key, (map.get(key) || 0) + r.breakfast + r.lunch + r.dinner);
    });
    return map;
  }, [data.records]);

  useEffect(() => {
    const key = selSummaryDate.format('YYYY-MM-DD');
    setSummaryText(data.summaries[key] || '');
  }, [selSummaryDate, data.summaries]);

  const selDateKey = selSummaryDate.format('YYYY-MM-DD');
  const selDateTotal = totalsByDate.get(selDateKey) || 0;

  function resetFilters() {
    setFilterName('');
    setFilterMin(null);
    setFilterMax(null);
    setPage(1);
  }

  function addRecord(rec) {
    const maxId = data.records.reduce((m, r) => Math.max(m, r.id || 0), 0);
    setData(prev => ({ ...prev, records: [{ id: maxId + 1, ...rec }, ...prev.records] }));
    message.success('记录已添加');
    setPage(1);
  }

  function updateRecord(id, updates) {
    setData(prev => ({
      ...prev,
      records: prev.records.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
    message.success('记录已更新');
  }

  function deleteRecord(id) {
    setData(prev => ({ ...prev, records: prev.records.filter(r => r.id !== id) }));
    setSelIds(p => p.filter(s => s !== id));
    message.success('记录已删除');
  }

  function batchDelete() {
    if (!selIds.length) { message.warning('请选择要删除的记录'); return; }
    Modal.confirm({
      title: '确认删除', content: `确定要删除选中的 ${selIds.length} 条记录吗？`,
      okText: '确定', cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const idset = new Set(selIds);
        setData(prev => ({ ...prev, records: prev.records.filter(r => !idset.has(r.id)) }));
        setSelIds([]); message.success(`成功删除 ${idset.size} 条记录`);
      },
    });
  }

  function saveSummary() {
    const key = selDateKey;
    setData(prev => {
      const next = { ...prev.summaries };
      if (summaryText.trim()) {
        next[key] = summaryText;
      } else {
        delete next[key];
      }
      return { ...prev, summaries: next };
    });
    message.success('总结已保存');
  }

  /* saved summary list for current month */
  const savedSummaryList = useMemo(() => {
    const month = selSummaryDate.format('YYYY-MM');
    return Object.entries(data.summaries)
      .filter(([date, text]) => date.startsWith(month) && text.trim())
      .map(([date, text]) => ({ date, excerpt: text.trim().replace(/\s+/g, ' ').slice(0, 20) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.summaries, selSummaryDate]);

  function openAdd() {
    setIsEdit(false); setEditId(null);
    setForm({ date: todayStr(), medicineName: '', breakfast: 0, lunch: 0, dinner: 0 });
    setKeepAdding(false);
    setModalOpen(true);
  }

  function openEdit(rec) {
    setIsEdit(true); setEditId(rec.id);
    setForm({ date: rec.date, medicineName: rec.medicineName, breakfast: rec.breakfast, lunch: rec.lunch, dinner: rec.dinner });
    setModalOpen(true);
  }

  function handleOk() {
    if (!form.date || !form.medicineName) { message.error('请填写日期和药品名称'); return; }
    const payload = {
      date: form.date,
      medicineName: form.medicineName,
      breakfast: parseInt(form.breakfast) || 0,
      lunch: parseInt(form.lunch) || 0,
      dinner: parseInt(form.dinner) || 0,
    };
    if (isEdit) {
      updateRecord(editId, payload);
      setModalOpen(false);
    } else {
      addRecord(payload);
      if (keepAdding) {
        setForm(f => ({ ...f, medicineName: '', breakfast: 0, lunch: 0, dinner: 0 }));
        return;
      }
      setModalOpen(false);
    }
  }

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    { title: '药品名称', dataIndex: 'medicineName', width: 130, render: v => <span style={{ fontWeight: 500, color: c.text }}>{v}</span> },
    { title: '早餐', dataIndex: 'breakfast', width: 70, render: v => v > 0 ? <Tag color="#3B82F6" bordered={false}>{v} 颗</Tag> : <span style={{ color: c.muted2 }}>-</span> },
    { title: '午餐', dataIndex: 'lunch', width: 70, render: v => v > 0 ? <Tag color="#10B981" bordered={false}>{v} 颗</Tag> : <span style={{ color: c.muted2 }}>-</span> },
    { title: '晚餐', dataIndex: 'dinner', width: 70, render: v => v > 0 ? <Tag color="#F59E0B" bordered={false}>{v} 颗</Tag> : <span style={{ color: c.muted2 }}>-</span> },
    {
      title: '操作', width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord(rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '总记录数', value: stats.totalRecords, icon: <FileTextOutlined />, bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
          { label: '累计用药', value: `${stats.totalDosage} 颗`, icon: <MedicineBoxOutlined />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
          { label: '记录天数', value: stats.uniqueDates, icon: <CalendarOutlined />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
          { label: '日均用量', value: `${stats.avgDosage} 颗`, icon: <LineChartOutlined />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
        ].map(s => (
          <div key={s.label} className="linear-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="linear-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>药品名称</label>
            <Input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="搜索药品" style={{ ...inputStyle, width: 160 }} />
          </div>
          <div>
            <label style={labelStyle}>最小用量</label>
            <InputNumber value={filterMin} onChange={v => setFilterMin(v)} min={0} style={{ width: 100, height: 42 }} inputStyle={{ textAlign: 'center' }} />
          </div>
          <div>
            <label style={labelStyle}>最大用量</label>
            <InputNumber value={filterMax} onChange={v => setFilterMax(v)} min={0} style={{ width: 100, height: 42 }} inputStyle={{ textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={resetFilters} style={{ ...inputStyle, height: 42, background: c.surfaceTint, borderColor: c.border, color: c.text }}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42 }}>添加记录</Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="linear-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Button danger disabled={!selIds.length} onClick={batchDelete}
            icon={<DeleteOutlined />} style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
          {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 项</span>}
        </div>
        <Table dataSource={pageData} columns={columns} rowKey="id" pagination={false}
          rowSelection={{
            type: 'checkbox', selectedRowKeys: selIds, onChange: keys => setSelIds(keys),
          }}
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无用药记录</span> }}
          scroll={{ x: 650 }} size="middle" />
        <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
          onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
          pageSize={pageSize} onPageSizeChange={setPageSize} total={list.length} />
      </div>

      {/* Daily Summary */}
      <div className="linear-card" style={{ padding: 24, marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 16 }}>用药日历</div>
            <ConfigProvider locale={locale}>
            <div style={{ border: '1px solid ' + c.border, borderRadius: 12, overflow: 'hidden', background: c.surfaceTint2 }}>
            <Calendar fullscreen={false} value={selSummaryDate} onChange={d => setSelSummaryDate(d)}
              cellRender={(date) => {
                const key = date.format('YYYY-MM-DD');
                const total = totalsByDate.get(key);
                return total ? <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#5e6ad2' }} /> : null;
              }}
            />
            </div>
            </ConfigProvider>
            {savedSummaryList.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid ' + c.border, paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 8 }}>本月已写（{savedSummaryList.length}）</div>
                {savedSummaryList.map(item => (
                  <div key={item.date} onClick={() => { setSelSummaryDate(dayjs(item.date)); }}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', color: c.text, fontSize: 13, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = c.surfaceTint}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 600, marginRight: 8 }}>{item.date}</span>
                    <span style={{ color: c.muted2 }}>{item.excerpt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: c.text }}>{selDateKey}</span>
              <span style={{ fontSize: 13, color: c.muted }}>当日总用量：{selDateTotal} 颗</span>
            </div>
            <textarea value={summaryText} onChange={e => setSummaryText(e.target.value)}
              placeholder="可记录当天用药情况、症状变化、注意事项等"
              rows={6}
              style={{ width: '100%', background: c.surfaceTint2, border: '1px solid ' + c.border, borderRadius: 8, padding: 12, color: c.text, fontSize: 14, resize: 'vertical', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button type="primary" onClick={saveSummary}
                style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42, padding: '0 24px' }}>保存总结</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>{isEdit ? '编辑记录' : '添加记录'}</span>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        okText="确定" cancelText="取消"
        okButtonProps={{ style: { background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 } }}
        cancelButtonProps={{ style: { background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 } }}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>日期</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>药品名称</label>
              <Input value={form.medicineName} onChange={e => setForm(f => ({ ...f, medicineName: e.target.value }))} placeholder="输入药品名称" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>早餐用量</label>
              <InputNumber value={form.breakfast} onChange={v => setForm(f => ({ ...f, breakfast: v || 0 }))} min={0} style={{ width: '100%', height: 42 }} />
            </div>
            <div>
              <label style={labelStyle}>午餐用量</label>
              <InputNumber value={form.lunch} onChange={v => setForm(f => ({ ...f, lunch: v || 0 }))} min={0} style={{ width: '100%', height: 42 }} />
            </div>
            <div>
              <label style={labelStyle}>晚餐用量</label>
              <InputNumber value={form.dinner} onChange={v => setForm(f => ({ ...f, dinner: v || 0 }))} min={0} style={{ width: '100%', height: 42 }} />
            </div>
          </div>
          {!isEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: c.textSecondary }}>
                <input type="checkbox" checked={keepAdding} onChange={e => setKeepAdding(e.target.checked)} />
                确定后继续添加
              </label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════
   AnalysisTab — 数据分析
   ═══════════════════════════════════════ */
function AnalysisTab({ c, isLight, data }) {
  const [trendRange, setTrendRange] = useState('30');
  const [calendarYear, setCalendarYear] = useState(dayjs().year());

  const trendChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const heatmapChartRef = useRef(null);

  /* stats */
  const stats = useMemo(() => {
    const totalRecords = data.records.length;
    const totalDosage = data.records.reduce((s, r) => s + r.breakfast + r.lunch + r.dinner, 0);
    const uniqueDates = new Set(data.records.map(r => r.date)).size;
    const avgDosage = uniqueDates > 0 ? Math.round(totalDosage / uniqueDates) : 0;
    return { totalRecords, totalDosage, uniqueDates, avgDosage };
  }, [data.records]);

  /* trend data */
  const trendData = useMemo(() => {
    const days = parseInt(trendRange);
    const map = new Map();
    for (let i = days - 1; i >= 0; i--) {
      map.set(dayjs().subtract(i, 'day').format('YYYY-MM-DD'), { breakfast: 0, lunch: 0, dinner: 0, total: 0 });
    }
    data.records.forEach(r => {
      if (map.has(r.date)) {
        const item = map.get(r.date);
        item.breakfast += r.breakfast;
        item.lunch += r.lunch;
        item.dinner += r.dinner;
        item.total += r.breakfast + r.lunch + r.dinner;
      }
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.records, trendRange]);

  useEffect(() => {
    if (!trendChartRef.current || !trendData.length) return;
    const chart = echarts.init(trendChartRef.current);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: c.text, fontSize: 13 } },
      legend: { data: ['早餐', '午餐', '晚餐', '总计'], textStyle: { color: c.muted, fontSize: 12 }, bottom: 0 },
      grid: { left: 65, right: 20, top: 10, bottom: 50 },
      xAxis: { type: 'category', data: trendData.map(d => dayjs(d.date).format('MM-DD')), axisLabel: { color: c.muted, fontSize: 10 }, axisLine: { lineStyle: { color: c.border } }, axisTick: { show: false }, boundaryGap: false },
      yAxis: { type: 'value', name: '用量（颗）', nameTextStyle: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } }, axisLabel: { color: c.muted, fontSize: 11 } },
      series: [
        { name: '早餐', type: 'line', smooth: true, data: trendData.map(d => d.breakfast), itemStyle: { color: '#3B82F6' }, symbol: 'circle', symbolSize: 3 },
        { name: '午餐', type: 'line', smooth: true, data: trendData.map(d => d.lunch), itemStyle: { color: '#10B981' }, symbol: 'circle', symbolSize: 3 },
        { name: '晚餐', type: 'line', smooth: true, data: trendData.map(d => d.dinner), itemStyle: { color: '#F59E0B' }, symbol: 'circle', symbolSize: 3 },
        { name: '总计', type: 'line', smooth: true, data: trendData.map(d => d.total), lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: '#6366F1' }, symbol: 'diamond', symbolSize: 4 },
      ],
    });
    return () => chart.dispose();
  }, [trendData, c, isLight]);

  /* pie data */
  const pieData = useMemo(() => {
    const map = new Map();
    data.records.forEach(r => {
      const total = r.breakfast + r.lunch + r.dinner;
      map.set(r.medicineName, (map.get(r.medicineName) || 0) + total);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [data.records]);

  const pieColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#84CC16'];

  useEffect(() => {
    if (!pieChartRef.current || !pieData.length) return;
    const chart = echarts.init(pieChartRef.current);
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}颗 ({d}%)', backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: c.text, fontSize: 13 } },
      legend: { orient: 'vertical', right: '5%', top: 'center', type: 'scroll', textStyle: { color: c.muted, fontSize: 11 } },
      series: [{ type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'], avoidLabelOverlap: true, itemStyle: { borderRadius: 6, borderColor: c.surface, borderWidth: 2 }, label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } }, data: pieData, color: pieColors }],
    });
    return () => chart.dispose();
  }, [pieData, c, isLight]);

  /* bar data (meal time comparison) */
  const barData = useMemo(() => {
    const data2 = { breakfast: 0, lunch: 0, dinner: 0 };
    data.records.forEach(r => { data2.breakfast += r.breakfast; data2.lunch += r.lunch; data2.dinner += r.dinner; });
    return data2;
  }, [data.records]);

  useEffect(() => {
    if (!barChartRef.current) return;
    const chart = echarts.init(barChartRef.current);
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: c.text, fontSize: 13 } },
      grid: { left: 50, right: 20, bottom: 20, top: 10 },
      xAxis: { type: 'category', data: ['早餐', '午餐', '晚餐'], axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.muted, fontSize: 12 } },
      yAxis: { type: 'value', name: '用量（颗）', nameTextStyle: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } }, axisLabel: { color: c.muted, fontSize: 11 } },
      series: [{
        type: 'bar', barWidth: '40%',
        data: [
          { value: barData.breakfast, itemStyle: { color: '#3B82F6', borderRadius: [4, 4, 0, 0] } },
          { value: barData.lunch, itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] } },
          { value: barData.dinner, itemStyle: { color: '#F59E0B', borderRadius: [4, 4, 0, 0] } },
        ],
        label: { show: true, position: 'top', formatter: '{c}颗', color: c.muted, fontSize: 11 },
      }],
    });
    return () => chart.dispose();
  }, [barData, c, isLight]);

  /* heatmap data */
  const heatmapData = useMemo(() => {
    const map = new Map();
    data.records.forEach(r => {
      const date = dayjs(r.date);
      if (date.year() === calendarYear) {
        const total = r.breakfast + r.lunch + r.dinner;
        map.set(r.date, (map.get(r.date) || 0) + total);
      }
    });
    return Array.from(map.entries()).map(([date, value]) => [date, value]);
  }, [data.records, calendarYear]);

  const heatmapMax = useMemo(() => Math.max(...heatmapData.map(d => d[1]), 10), [heatmapData]);

  useEffect(() => {
    if (!heatmapChartRef.current || !heatmapData.length) return;
    const chart = echarts.init(heatmapChartRef.current);
    chart.setOption({
      tooltip: { formatter: p => `${p.value[0]}: ${p.value[1]}颗`, backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: c.text, fontSize: 12 } },
      visualMap: { min: 0, max: heatmapMax, type: 'piecewise', orient: 'horizontal', left: 'center', top: 0, inRange: { color: isLight ? ['#f0f1f2', '#BFDBFE', '#60A5FA', '#3B82F6', '#1D4ED8'] : ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'] }, textStyle: { color: c.muted }, text: ['少', '多'] },
      calendar: { top: 60, left: 30, right: 30, cellSize: ['auto', 15], range: String(calendarYear), itemStyle: { borderWidth: 3, borderColor: c.surface }, yearLabel: { show: true, color: c.text }, dayLabel: { firstDay: 1, nameMap: ['日', '一', '二', '三', '四', '五', '六'], color: c.muted }, monthLabel: { nameMap: 'cn', color: c.muted } },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: heatmapData }],
    });
    return () => chart.dispose();
  }, [heatmapData, calendarYear, c, isLight, heatmapMax]);

  /* ranking */
  const rankData = useMemo(() => {
    const map = new Map();
    data.records.forEach(r => {
      const total = r.breakfast + r.lunch + r.dinner;
      map.set(r.medicineName, (map.get(r.medicineName) || 0) + total);
    });
    const totalAll = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total, percent: totalAll > 0 ? Math.round((total / totalAll) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [data.records]);

  const rankColors = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#84CC16'];

  const yearOptions = [calendarYear - 2, calendarYear - 1, calendarYear];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总记录数', value: stats.totalRecords, icon: <FileTextOutlined />, bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
          { label: '累计用药', value: `${stats.totalDosage} 颗`, icon: <MedicineBoxOutlined />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
          { label: '记录天数', value: stats.uniqueDates, icon: <CalendarOutlined />, bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
          { label: '日均用量', value: `${stats.avgDosage} 颗`, icon: <LineChartOutlined />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
        ].map(s => (
          <div key={s.label} className="linear-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="linear-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: c.text, margin: 0 }}>用药趋势</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {['7', '30', '90'].map(v => (
              <Button key={v} size="small"
                onClick={() => setTrendRange(v)}
                style={{
                  background: trendRange === v ? '#5e6ad2' : c.surfaceTint,
                  borderColor: trendRange === v ? '#5e6ad2' : c.border,
                  color: trendRange === v ? '#fff' : c.text,
                  borderRadius: 6, fontSize: 12,
                }}
              >近{v}天</Button>
            ))}
          </div>
        </div>
        <div ref={trendChartRef} style={{ height: 260, background: c.surfaceTint2, borderRadius: 12, padding: 16 }} />
      </div>

      {/* Pie + Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="linear-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 20, margin: 0 }}>药品用量占比</h2>
          <div ref={pieChartRef} style={{ height: 260, marginTop: 12 }} />
        </div>
        <div className="linear-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 20, margin: 0 }}>时段用量对比</h2>
          <div ref={barChartRef} style={{ height: 260, marginTop: 12 }} />
        </div>
      </div>

      {/* Heatmap */}
      <div className="linear-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: c.text, margin: 0 }}>用药日历热力图</h2>
          <Select value={calendarYear} onChange={v => setCalendarYear(v)}
            style={{ width: 100, height: 36 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={yearOptions.map(y => ({ value: y, label: `${y}年` }))} />
        </div>
        <div ref={heatmapChartRef} style={{ height: 180, background: c.surfaceTint2, borderRadius: 12 }} />
      </div>

      {/* Ranking */}
      <div className="linear-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 20, margin: 0 }}>药品用量排行</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: c.textSecondary, borderBottom: '1px solid ' + c.border, width: 80 }}>排名</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: c.textSecondary, borderBottom: '1px solid ' + c.border }}>药品名称</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: c.textSecondary, borderBottom: '1px solid ' + c.border, width: 100 }}>总用量</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: c.textSecondary, borderBottom: '1px solid ' + c.border }}>占比</th>
            </tr>
          </thead>
          <tbody>
            {rankData.map((item, idx) => (
              <tr key={item.name}>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid ' + c.border }}>
                  {idx < 3 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, fontSize: 12, fontWeight: 600, background: rankColors[idx], color: '#fff' }}>{idx + 1}</span>
                  ) : (
                    <span style={{ color: c.muted2 }}>{idx + 1}</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid ' + c.border, fontWeight: 500, color: c.text, fontSize: 14 }}>{item.name}</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid ' + c.border, color: c.text }}>{item.total} 颗</td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid ' + c.border }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: c.surfaceTint, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: rankColors[idx % rankColors.length], width: item.percent + '%', transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: 13, color: c.muted2, minWidth: 40 }}>{item.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   PurchaseTab — 购买记录
   ═══════════════════════════════════════ */
function PurchaseTab({ c, data, setData, inputStyle, labelStyle }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selIds, setSelIds] = useState([]);

  const [filterName, setFilterName] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ purchaseDate: todayStr(), medicineName: '', quantity: 1, unit: '盒', unitPrice: 0, totalPrice: 0, channel: '药店', notes: '' });

  const list = useMemo(() => {
    let l = [...data.purchases];
    if (filterName) l = l.filter(r => r.medicineName.includes(filterName));
    return l.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  }, [data.purchases, filterName]);

  const totalPages = Math.ceil(list.length / pageSize);
  const pageData = list.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => ({
    totalRecords: data.purchases.length,
    totalQuantity: data.purchases.reduce((s, r) => s + r.quantity, 0),
    totalAmount: data.purchases.reduce((s, r) => s + (r.totalPrice || 0), 0),
  }), [data.purchases]);

  function addRecord(rec) {
    const maxId = [].concat(...Object.values(data)).reduce((m, r) => Math.max(m, r.id || 0), 0);
    setData(prev => ({ ...prev, purchases: [{ id: maxId + 1, ...rec }, ...prev.purchases] }));
    message.success('购买记录已添加');
    setPage(1);
  }

  function updateRecord(id, updates) {
    setData(prev => ({ ...prev, purchases: prev.purchases.map(r => r.id === id ? { ...r, ...updates } : r) }));
    message.success('记录已更新');
  }

  function deleteRecord(id) {
    setData(prev => ({ ...prev, purchases: prev.purchases.filter(r => r.id !== id) }));
    setSelIds(p => p.filter(s => s !== id));
    message.success('记录已删除');
  }

  function batchDelete() {
    if (!selIds.length) { message.warning('请选择要删除的记录'); return; }
    Modal.confirm({
      title: '确认删除', content: `确定要删除选中的 ${selIds.length} 条记录吗？`,
      okText: '确定', cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const idset = new Set(selIds);
        setData(prev => ({ ...prev, purchases: prev.purchases.filter(r => !idset.has(r.id)) }));
        setSelIds([]); message.success(`成功删除 ${idset.size} 条记录`);
      },
    });
  }

  function calcTotal() {
    setForm(f => ({ ...f, totalPrice: parseFloat(((f.quantity || 0) * (f.unitPrice || 0)).toFixed(2)) }));
  }

  function openAdd() {
    setIsEdit(false); setEditId(null);
    setForm({ purchaseDate: todayStr(), medicineName: '', quantity: 1, unit: '盒', unitPrice: 0, totalPrice: 0, channel: '药店', notes: '' });
    setModalOpen(true);
  }

  function openEdit(rec) {
    setIsEdit(true); setEditId(rec.id);
    setForm({ purchaseDate: rec.purchaseDate, medicineName: rec.medicineName, quantity: rec.quantity, unit: rec.unit, unitPrice: rec.unitPrice, totalPrice: rec.totalPrice, channel: rec.channel, notes: rec.notes || '' });
    setModalOpen(true);
  }

  function handleOk() {
    if (!form.purchaseDate || !form.medicineName) { message.error('请填写日期和药品名称'); return; }
    const payload = {
      purchaseDate: form.purchaseDate,
      medicineName: form.medicineName,
      quantity: parseInt(form.quantity) || 0,
      unit: form.unit,
      unitPrice: parseFloat(form.unitPrice) || 0,
      totalPrice: parseFloat(form.totalPrice) || 0,
      channel: form.channel,
      notes: form.notes,
    };
    if (isEdit) { updateRecord(editId, payload); setModalOpen(false); }
    else { addRecord(payload); setModalOpen(false); }
  }

  const columns = [
    { title: '购买日期', dataIndex: 'purchaseDate', width: 110, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    { title: '药品名称', dataIndex: 'medicineName', width: 120, render: v => <span style={{ fontWeight: 500, color: c.text }}>{v}</span> },
    { title: '数量', dataIndex: 'quantity', width: 70, render: v => <span style={{ color: c.text }}>{v}</span> },
    { title: '单位', dataIndex: 'unit', width: 60, render: v => <Tag bordered={false} style={{ color: c.muted }}>{v}</Tag> },
    { title: '单价', dataIndex: 'unitPrice', width: 90, render: v => <span style={{ color: c.textSecondary }}>¥{v?.toFixed(2)}</span> },
    { title: '总价', dataIndex: 'totalPrice', width: 90, render: v => <span style={{ fontWeight: 600, color: '#ff6b6b' }}>¥{v?.toFixed(2)}</span> },
    { title: '渠道', dataIndex: 'channel', width: 80, render: v => <span style={{ color: c.muted }}>{v || '-'}</span> },
    {
      title: '操作', width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord(rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '购买次数', value: stats.totalRecords, icon: <FileTextOutlined />, bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
          { label: '总数量', value: stats.totalQuantity, icon: <MedicineBoxOutlined />, bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
          { label: '总花费', value: `¥${stats.totalAmount.toFixed(2)}`, icon: <TrophyOutlined />, bg: 'rgba(99,102,241,0.12)', color: '#6366F1' },
        ].map(s => (
          <div key={s.label} className="linear-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.text, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div className="linear-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>药品名称</label>
            <Input value={filterName} onChange={e => { setFilterName(e.target.value); setPage(1); }} placeholder="搜索药品" style={{ ...inputStyle, width: 200 }} />
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
            style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42 }}>添加记录</Button>
        </div>
      </div>

      {/* Table */}
      <div className="linear-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Button danger disabled={!selIds.length} onClick={batchDelete}
            icon={<DeleteOutlined />} style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
          {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 项</span>}
        </div>
        <Table dataSource={pageData} columns={columns} rowKey="id" pagination={false}
          rowSelection={{ type: 'checkbox', selectedRowKeys: selIds, onChange: keys => setSelIds(keys) }}
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无购买记录</span> }}
          scroll={{ x: 800 }} size="middle" />
        <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
          onPageChange={fn => setPage(typeof fn === 'function' ? fn(page) : fn)}
          pageSize={pageSize} onPageSizeChange={setPageSize} total={list.length} />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>{isEdit ? '编辑记录' : '添加记录'}</span>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleOk}
        okText="确定" cancelText="取消"
        okButtonProps={{ style: { background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 } }}
        cancelButtonProps={{ style: { background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 } }}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>购买日期</label>
              <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>药品名称</label>
              <Input value={form.medicineName} onChange={e => setForm(f => ({ ...f, medicineName: e.target.value }))} placeholder="输入药品名称" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>数量</label>
              <InputNumber value={form.quantity} onChange={v => { setForm(f => ({ ...f, quantity: v || 0 })); setTimeout(calcTotal, 0); }} min={0} style={{ width: '100%', height: 42 }} />
            </div>
            <div>
              <label style={labelStyle}>单位</label>
              <Select value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))}
                style={{ width: '100%', height: 42 }}
                popupStyle={{ background: c.dropdownBg }}
                dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                options={UNIT_OPTIONS} />
            </div>
            <div>
              <label style={labelStyle}>购买渠道</label>
              <Select value={form.channel} onChange={v => setForm(f => ({ ...f, channel: v }))}
                style={{ width: '100%', height: 42 }}
                popupStyle={{ background: c.dropdownBg }}
                dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                options={CHANNEL_OPTIONS} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>单价 (元)</label>
              <InputNumber value={form.unitPrice} onChange={v => { setForm(f => ({ ...f, unitPrice: v || 0 })); setTimeout(calcTotal, 0); }} min={0} step={0.1} style={{ width: '100%', height: 42 }} />
            </div>
            <div>
              <label style={labelStyle}>总价 (元)</label>
              <InputNumber value={form.totalPrice} onChange={v => setForm(f => ({ ...f, totalPrice: v || 0 }))} min={0} step={0.1} style={{ width: '100%', height: 42 }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>备注</label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="可选" style={inputStyle} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════
   SettingsTab — 设置
   ═══════════════════════════════════════ */
function SettingsTab({ c, data, setData }) {
  function exportData() {
    const rows = data.records.map(r => ({
      '日期': r.date,
      '药品名称': r.medicineName,
      '早餐用量': r.breakfast,
      '午餐用量': r.lunch,
      '晚餐用量': r.dinner,
    }));
    const bom = '﻿';
    const headers = Object.keys(rows[0] || {});
    const csv = bom + headers.join(',') + '\n' + rows.map(r => headers.map(h => r[h]).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `用药记录_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { message.error('文件格式错误'); return; }
        const headerMap = { '日期': 'date', '药品名称': 'medicineName', '早餐用量': 'breakfast', '午餐用量': 'lunch', '晚餐用量': 'dinner' };
        const headers = lines[0].split(',').map(h => headerMap[h.trim()] || h.trim());
        const imported = [];
        let maxId = [].concat(...Object.values(data)).reduce((m, r) => Math.max(m, r.id || 0), 0);
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',');
          const rec = { id: ++maxId };
          headers.forEach((h, idx) => { rec[h] = vals[idx]?.trim() || ''; });
          if (rec.date && rec.medicineName) {
            rec.breakfast = parseInt(rec.breakfast) || 0;
            rec.lunch = parseInt(rec.lunch) || 0;
            rec.dinner = parseInt(rec.dinner) || 0;
            imported.push(rec);
          }
        }
        if (!imported.length) { message.error('未找到有效数据'); return; }
        setData(prev => ({ ...prev, records: [...prev.records, ...imported] }));
        message.success(`成功导入 ${imported.length} 条记录`);
      } catch { message.error('导入失败，请检查文件格式'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div>
      <div className="linear-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: c.text, marginBottom: 24, margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />数据操作
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: c.surfaceTint, borderRadius: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#3B82F6', flexShrink: 0 }}><ExportOutlined /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>导出数据</div>
              <div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>将所有用药记录导出为 CSV 文件</div>
            </div>
            <Button onClick={exportData} style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, color: '#fff', height: 40 }}>导出</Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: c.surfaceTint, borderRadius: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#10B981', flexShrink: 0 }}><ImportOutlined /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>导入数据</div>
              <div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>从 CSV 文件导入用药记录</div>
            </div>
            <label>
              <input type="file" accept=".csv" onChange={importData} hidden />
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px', height: 40, borderRadius: 8, border: '1px solid ' + c.border, background: c.surfaceTint, color: c.text, fontSize: 14, cursor: 'pointer' }}>导入</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
