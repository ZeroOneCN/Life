import { useState, useEffect, useMemo } from 'react';
import { Modal, DeleteModal, Toast, Btn, PillTabs, DataTable } from '../../components/ui';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* ── Inline SVG Icons ── */
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;
const IconDelete = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>;
const IconHome = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconSettings = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IconChart = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const STORAGE_KEY = 'lifeos_rent_data';

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rfloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

/* ── Mock data ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let recordId = 1, channelId = 1;
  const channels = [
    { id: channelId++, name: '贝壳找房' },
    { id: channelId++, name: '自如' },
    { id: channelId++, name: '链家' },
    { id: channelId++, name: '房东直租' },
  ];

  const baseRecords = [
    { address: '北京市朝阳区建国路88号SOHO现代城1-1203', channelIdx: 1, moveIn: '2024-03-01', moveOut: null, rent: 3800, deposit: 3800, electricity: 0, water: 0, gas: 0, agency: 3800, cleaning: 0, laundry: 0, service: 0, notes: '交通便利，离公司近' },
    { address: '上海市浦东新区张江高科技园区碧波路100号', channelIdx: 0, moveIn: '2024-01-15', moveOut: '2024-12-01', rent: 4500, deposit: 4500, electricity: 320, water: 180, gas: 240, agency: 0, cleaning: 200, laundry: 100, service: 50, notes: '合租，室友友好' },
    { address: '广州市天河区体育西路30号A栋1506', channelIdx: 2, moveIn: '2024-06-01', moveOut: null, rent: 3200, deposit: 3200, electricity: 280, water: 120, gas: 180, agency: 3200, cleaning: 150, laundry: 0, service: 30, notes: '' },
    { address: '深圳市南山区科技园南区R3-B栋', channelIdx: 3, moveIn: '2023-09-01', moveOut: '2024-05-15', rent: 5000, deposit: 5000, electricity: 450, water: 200, gas: 300, agency: 0, cleaning: 0, laundry: 0, service: 0, notes: '个人转租，无中介费' },
    { address: '杭州市滨江区江南大道788号', channelIdx: 1, moveIn: '2024-08-15', moveOut: null, rent: 2800, deposit: 2800, electricity: 180, water: 90, gas: 120, agency: 1400, cleaning: 100, laundry: 0, service: 20, notes: '精装修拎包入住' },
    { address: '成都市武侯区人民南路四段27号', channelIdx: 0, moveIn: '2024-04-01', moveOut: '2025-02-28', rent: 2200, deposit: 2200, electricity: 160, water: 80, gas: 100, agency: 0, cleaning: 80, laundry: 0, service: 0, notes: '' },
    { address: '南京市鼓楼区汉口路22号', channelIdx: 3, moveIn: '2024-11-01', moveOut: null, rent: 2600, deposit: 2600, electricity: 200, water: 100, gas: 150, agency: 0, cleaning: 0, laundry: 0, service: 0, notes: '房东直租，无中介费' },
    { address: '武汉市洪山区珞喻路1037号', channelIdx: 2, moveIn: '2023-03-01', moveOut: '2024-06-30', rent: 1800, deposit: 1800, electricity: 140, water: 70, gas: 90, agency: 1800, cleaning: 0, laundry: 50, service: 0, notes: '离学校近' },
  ];

  const records = baseRecords.map(r => {
    const moveIn = dayjs(r.moveIn);
    const moveOut = r.moveOut ? dayjs(r.moveOut) : dayjs();
    const stayDays = moveOut.diff(moveIn, 'day');
    const totalCost = r.rent + r.deposit + r.electricity + r.water + r.gas + r.agency + r.cleaning + r.laundry + r.service;
    const dailyCost = stayDays > 0 ? totalCost / stayDays : 0;
    return {
      id: recordId++,
      address: r.address,
      housing_channel: channels[r.channelIdx].name,
      housing_channel_id: channels[r.channelIdx].id,
      move_in_date: r.moveIn,
      move_out_date: r.moveOut,
      rent: r.rent, deposit: r.deposit,
      electricity_fee: r.electricity, water_fee: r.water, gas_fee: r.gas,
      agency_fee: r.agency, cleaning_fee: r.cleaning, laundry_fee: r.laundry, service_fee: r.service,
      total_cost: parseFloat(totalCost.toFixed(2)),
      stay_days: stayDays,
      daily_cost: parseFloat(dailyCost.toFixed(2)),
      notes: r.notes,
    };
  });

  return { records, channels };
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
   Home Tab — 住房记录
   ═══════════════════════════════════════ */
function HomeTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [keyword, setKeyword] = useState('');
  const [channelFilter, setChannelFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailRecord, setDetailRecord] = useState(null);
  const [toast, setToast] = useState(null);
  const [delRecordId, setDelRecordId] = useState(null);

  const filtered = useMemo(() => {
    let list = [...data.records];
    if (keyword) { list = list.filter(r => r.address.includes(keyword)); }
    if (channelFilter) { list = list.filter(r => r.housing_channel_id === channelFilter); }
    return list.sort((a, b) => b.id - a.id);
  }, [data.records, keyword, channelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [keyword, channelFilter]);

  const handleDelete = (id) => {
    setDelRecordId(id);
  };

  const confirmDeleteRecord = () => {
    if (!delRecordId) return;
    setData(prev => ({ ...prev, records: prev.records.filter(r => r.id !== delRecordId) }));
    setToast({type:'success', message:'已删除'});
    setDelRecordId(null);
  };

  const channelOptions = data.channels.map(c => ({ value: c.id, label: c.name }));

  const columns = [
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>地址</span>,
      dataIndex: 'address', width: 280,
      render: v => <span style={{ color: c.text, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>渠道</span>,
      dataIndex: 'housing_channel', width: 100,
      render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>入住日期</span>,
      dataIndex: 'move_in_date', width: 120,
      render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v ? dayjs(v).format('YYYY/M/D') : '-'}</span>,
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>退房日期</span>,
      dataIndex: 'move_out_date', width: 120,
      render: v => <span style={{ color: c.textSecondary, fontSize: fs.tableCellSm.fontSize }}>{v ? dayjs(v).format('YYYY/M/D') : '至今'}</span>,
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>总花费</span>,
      dataIndex: 'total_cost', width: 110, align: 'right',
      render: v => <span style={{ color: '#5e6ad2', fontWeight: 600, fontSize: fs.tableCellSm.fontSize }}>¥{v.toFixed(2)}</span>,
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>,
      width: 120,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Btn type="ghost" onClick={() => setDetailRecord(rec)}
            style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}>详情</Btn>
          <Btn type="danger" onClick={() => handleDelete(rec.id)} style={{ fontSize: fs.tableCell.fontSize }}><IconDelete /> 删除</Btn>
        </div>
      ),
    },
  ];

  const calcMonthlyRent = (r) => r && r.stay_days > 0 ? (r.rent * 30) / r.stay_days : 0;
  const calcQuarterlyRent = (r) => calcMonthlyRent(r) * 3;

  return (
    <div>
      {/* Search bar */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, width: 240, height: 36, gap: 6 }}>
          <IconSearch />
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="搜索地址..." style={{ background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: 14, flex: 1 }} />
        </div>
        <select value={channelFilter ?? ''} onChange={e => setChannelFilter(e.target.value ? Number(e.target.value) : null)}
          style={{ width: 150, height: 36, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
          <option value="">全部渠道</option>
          {channelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Btn onClick={() => { setKeyword(''); setChannelFilter(null); }}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, color: c.muted }}><IconRefresh /> 重置</Btn>
      </div>

      {/* Table */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={paged} columns={columns} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>暂无住房记录</span>}
          minWidth={860} />
        {filtered.length > 0 && (
          <TablePagination c={c} inputStyle={inputStyle}
            page={page} totalPages={totalPages} onPageChange={setPage}
            pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} />
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailRecord} onClose={() => setDetailRecord(null)}
        title="记录详情" width={720}
        footer={<Btn onClick={() => setDetailRecord(null)}>关闭</Btn>}>
        {detailRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
            {/* Basic info */}
            <div>
              <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>基本信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: '住房地址', value: detailRecord.address },
                  { label: '住房渠道', value: detailRecord.housing_channel || '未知' },
                  { label: '入住日期', value: detailRecord.move_in_date ? dayjs(detailRecord.move_in_date).format('YYYY-M-D') : '-' },
                  { label: '退房日期', value: detailRecord.move_out_date ? dayjs(detailRecord.move_out_date).format('YYYY-M-D') : '至今' },
                  { label: '居住天数', value: detailRecord.stay_days + ' 天' },
                  { label: '单日花费', value: '¥' + detailRecord.daily_cost.toFixed(2) },
                ].map(s => (
                  <div key={s.label} style={{ background: c.surfaceTint2, borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ color: c.text, fontWeight: 600, fontSize: 15 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee summary */}
            <div>
              <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>费用汇总</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {[
                  { label: '总费用', value: '¥' + detailRecord.total_cost.toFixed(2), primary: true },
                  { label: '单月租金', value: '¥' + calcMonthlyRent(detailRecord).toFixed(2) },
                  { label: '季度租金', value: '¥' + calcQuarterlyRent(detailRecord).toFixed(2) },
                  { label: '押金', value: '¥' + (detailRecord.deposit || 0).toFixed(2) },
                  { label: '剩余押金', value: '¥' + Math.max(0, (detailRecord.deposit || 0) - (detailRecord.move_out_date ? 0 : 0)).toFixed(2) },
                ].map(s => (
                  <div key={s.label} style={{ background: c.surfaceTint2, borderRadius: 8, padding: '14px', textAlign: 'center' }}>
                    <div style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>{s.label}</div>
                    <div style={{ color: s.primary ? '#5e6ad2' : c.text, fontWeight: 700, fontSize: 18 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fee details */}
            <div>
              <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>费用明细</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: '房租', value: detailRecord.rent },
                  { label: '电费', value: detailRecord.electricity_fee },
                  { label: '水费', value: detailRecord.water_fee },
                  { label: '燃气费', value: detailRecord.gas_fee },
                  { label: '中介费', value: detailRecord.agency_fee },
                  { label: '卫生费', value: detailRecord.cleaning_fee },
                  { label: '洗衣费', value: detailRecord.laundry_fee },
                  { label: '服务费', value: detailRecord.service_fee },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: c.surfaceTint2, borderRadius: 8 }}>
                    <span style={{ color: c.muted, fontSize: 13 }}>{s.label}</span>
                    <span style={{ color: c.text, fontWeight: 600, fontSize: 14 }}>¥{(s.value || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {detailRecord.notes && (
              <div>
                <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 8 }}>备注</div>
                <div style={{ background: c.surfaceTint2, borderRadius: 8, padding: '12px 16px', color: c.textSecondary, fontSize: 14, lineHeight: 1.6 }}>{detailRecord.notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <DeleteModal open={!!delRecordId} onClose={() => setDelRecordId(null)} onConfirm={confirmDeleteRecord}
        title="确认删除记录？">
        <p>确定要删除此住房记录吗？</p>
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Add Tab — 新增记录
   ═══════════════════════════════════════ */
function AddTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [form, setForm] = useState({
    address: '', housing_channel_id: null,
    move_in_date: null, move_out_date: null,
    rent: 0, deposit: 0, electricity_fee: 0, water_fee: 0, gas_fee: 0,
    agency_fee: 0, cleaning_fee: 0, laundry_fee: 0, service_fee: 0,
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const costPreview = useMemo(() => {
    const moveIn = form.move_in_date ? dayjs(form.move_in_date) : null;
    const moveOut = form.move_out_date ? dayjs(form.move_out_date) : dayjs();
    const stayDays = moveIn ? Math.max(0, Math.ceil(moveOut.diff(moveIn, 'day', true))) : 0;
    const totalCost =
      (form.rent || 0) + (form.electricity_fee || 0) + (form.water_fee || 0) +
      (form.gas_fee || 0) + (form.agency_fee || 0) + (form.cleaning_fee || 0) +
      (form.laundry_fee || 0) + (form.service_fee || 0);
    const dailyCost = stayDays > 0 ? totalCost / stayDays : 0;
    const monthlyRent = stayDays > 0 ? ((form.rent || 0) * 30) / stayDays : 0;
    return { stayDays, totalCost, dailyCost, monthlyRent, quarterlyRent: monthlyRent * 3 };
  }, [form]);

  const validate = () => {
    const err = {};
    if (!form.address.trim()) err.address = '请输入地址';
    if (!form.move_in_date) err.move_in_date = '请选择入住日期';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) { setToast({type:'error', message:'请检查表单填写'}); return; }
    const moveIn = dayjs(form.move_in_date);
    const moveOut = form.move_out_date ? dayjs(form.move_out_date) : null;
    const stayDays = moveOut ? moveOut.diff(moveIn, 'day') : dayjs().diff(moveIn, 'day');
    const totalCost =
      (form.rent || 0) + (form.deposit || 0) + (form.electricity_fee || 0) +
      (form.water_fee || 0) + (form.gas_fee || 0) + (form.agency_fee || 0) +
      (form.cleaning_fee || 0) + (form.laundry_fee || 0) + (form.service_fee || 0);
    const dailyCost = stayDays > 0 ? totalCost / stayDays : 0;
    const channel = form.housing_channel_id
      ? data.channels.find(c => c.id === form.housing_channel_id)
      : null;

    const maxId = data.records.reduce((m, r) => Math.max(m, r.id), 0);
    const newRecord = {
      id: maxId + 1,
      address: form.address.trim(),
      housing_channel: channel ? channel.name : '未知',
      housing_channel_id: form.housing_channel_id,
      move_in_date: form.move_in_date,
      move_out_date: form.move_out_date || null,
      rent: form.rent || 0, deposit: form.deposit || 0,
      electricity_fee: form.electricity_fee || 0, water_fee: form.water_fee || 0, gas_fee: form.gas_fee || 0,
      agency_fee: form.agency_fee || 0, cleaning_fee: form.cleaning_fee || 0,
      laundry_fee: form.laundry_fee || 0, service_fee: form.service_fee || 0,
      total_cost: parseFloat(totalCost.toFixed(2)),
      stay_days: stayDays,
      daily_cost: parseFloat(dailyCost.toFixed(2)),
      notes: form.notes || '',
    };
    setData(prev => ({ ...prev, records: [newRecord, ...prev.records] }));
    setToast({type:'success', message:'记录已添加'});

    // Reset form
    setForm({
      address: '', housing_channel_id: null,
      move_in_date: null, move_out_date: null,
      rent: 0, deposit: 0, electricity_fee: 0, water_fee: 0, gas_fee: 0,
      agency_fee: 0, cleaning_fee: 0, laundry_fee: 0, service_fee: 0,
      notes: '',
    });
    setErrors({});
  };

  const handleReset = () => {
    setForm({
      address: '', housing_channel_id: null,
      move_in_date: null, move_out_date: null,
      rent: 0, deposit: 0, electricity_fee: 0, water_fee: 0, gas_fee: 0,
      agency_fee: 0, cleaning_fee: 0, laundry_fee: 0, service_fee: 0,
      notes: '',
    });
    setErrors({});
  };

  const feeFields = [
    { key: 'rent', label: '房租' },
    { key: 'deposit', label: '押金' },
    { key: 'agency_fee', label: '中介费' },
    { key: 'electricity_fee', label: '电费' },
    { key: 'water_fee', label: '水费' },
    { key: 'gas_fee', label: '燃气费' },
    { key: 'cleaning_fee', label: '卫生费' },
    { key: 'laundry_fee', label: '洗衣费' },
    { key: 'service_fee', label: '服务费' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Two columns: left = housing info + other info, right = fee info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Housing info */}
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
            <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 18 }}>住房信息</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>详细地址 <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={form.address} onChange={e => { set('address', e.target.value); setErrors(p => ({ ...p, address: '' })); }}
                  placeholder="请输入详细的住房地址"
                  style={{ width: '100%', ...inputStyle, borderColor: errors.address ? '#ef4444' : undefined }} />
                {errors.address && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.address}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>入住日期 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" value={form.move_in_date ?? ''} onChange={e => { set('move_in_date', e.target.value || null); setErrors(p => ({ ...p, move_in_date: '' })); }}
                    style={{ width: '100%', ...inputStyle }} />
                  {errors.move_in_date && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.move_in_date}</div>}
                </div>
                <div>
                  <label style={labelStyle}>退租日期</label>
                  <input type="date" value={form.move_out_date ?? ''} onChange={e => set('move_out_date', e.target.value || null)}
                    style={{ width: '100%', ...inputStyle }} />
                </div>
              </div>
            </div>
          </div>

          {/* Other info */}
          <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
            <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 18 }}>其他信息</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>住房渠道</label>
                <select value={form.housing_channel_id ?? ''} onChange={e => set('housing_channel_id', e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%', height: 42, background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, cursor: 'pointer', padding: '0 8px' }}>
                  <option value="">请选择住房渠道</option>
                  {data.channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>备注信息</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="请输入备注信息（如居住体验、注意事项等）" rows={4}
                  style={{ width: '100%', background: c.surfaceTint, border: '1px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, padding: '10px 12px', lineHeight: 1.5 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Fee info */}
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 18 }}>费用信息</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {feeFields.map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}（元）</label>
                <input type="number" value={form[f.key]} onChange={e => set(f.key, parseFloat(e.target.value) || 0)}
                  min={0} step="0.01"
                  style={{ width: '100%', ...inputStyle, textAlign: 'right' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost preview — no gradient, theme-aware */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 24 }}>
        <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 18 }}>费用预览</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { label: '居住天数', value: costPreview.stayDays + ' 天' },
            { label: '总费用', value: '¥' + costPreview.totalCost.toFixed(2), accent: true },
            { label: '单日花费', value: '¥' + costPreview.dailyCost.toFixed(2) },
            { label: '单月租金', value: '¥' + costPreview.monthlyRent.toFixed(2) },
            { label: '季度租金', value: '¥' + costPreview.quarterlyRent.toFixed(2) },
          ].map(s => (
            <div key={s.label} style={{ background: c.surfaceTint2, borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: c.muted, marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.accent ? '#5e6ad2' : c.text }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: 20, background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12 }}>
        <Btn onClick={handleReset}
          style={{ height: 42, fontSize: 15, borderRadius: 8, border: '1px solid ' + c.border, color: c.text, background: c.surfaceTint, minWidth: 120 }}>重置</Btn>
        <Btn type="primary" onClick={handleSubmit}
          style={{ height: 42, fontSize: 15, borderRadius: 8, fontWeight: 500, minWidth: 140 }}><IconPlus /> 提交记录</Btn>
      </div>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Settings Tab — 渠道管理
   ═══════════════════════════════════════ */
function SettingsTab({ c, fs, data, setData, inputStyle, labelStyle }) {
  const [newName, setNewName] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [toast, setToast] = useState(null);
  const [delChannel, setDelChannel] = useState(null);

  const handleAdd = () => {
    if (!newName.trim()) { setToast({type:'error', message:'渠道名称不能为空'}); return; }
    if (data.channels.some(c => c.name === newName.trim())) { setToast({type:'error', message:'渠道名称已存在'}); return; }
    const maxId = data.channels.reduce((m, c) => Math.max(m, c.id), 0);
    setData(prev => ({ ...prev, channels: [...prev.channels, { id: maxId + 1, name: newName.trim() }] }));
    setNewName('');
    setToast({type:'success', message:'已添加'});
  };

  const openEdit = (ch) => { setEditing(ch); setEditName(ch.name); setEditModalOpen(true); };

  const handleEditSave = () => {
    if (!editName.trim()) { setToast({type:'error', message:'渠道名称不能为空'}); return; }
    if (data.channels.some(c => c.name === editName.trim() && c.id !== editing.id)) { setToast({type:'error', message:'渠道名称已存在'}); return; }
    setData(prev => ({
      ...prev,
      channels: prev.channels.map(c => c.id === editing.id ? { ...c, name: editName.trim() } : c),
      records: prev.records.map(r => r.housing_channel_id === editing.id ? { ...r, housing_channel: editName.trim() } : r),
    }));
    setEditModalOpen(false);
    setToast({type:'success', message:'已更新'});
  };

  const handleDelete = (ch) => {
    const count = data.records.filter(r => r.housing_channel_id === ch.id).length;
    if (count > 0) {
      setDelChannel(ch);
    } else {
      setData(prev => ({ ...prev, channels: prev.channels.filter(c => c.id !== ch.id) }));
      setToast({type:'success', message:'已删除'});
    }
  };

  const confirmDeleteChannel = () => {
    if (!delChannel) return;
    setData(prev => ({
      ...prev,
      channels: prev.channels.filter(c => c.id !== delChannel.id),
      records: prev.records.map(r => r.housing_channel_id === delChannel.id ? { ...r, housing_channel: '未知', housing_channel_id: null } : r),
    }));
    setToast({type:'success', message:'已删除'});
    setDelChannel(null);
  };

  const delChanCount = delChannel ? data.records.filter(r => r.housing_channel_id === delChannel.id).length : 0;

  const columns = [
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>渠道名称</span>,
      dataIndex: 'name', width: 300,
      render: v => <span style={{ color: c.text, fontWeight: 500, fontSize: fs.tableCell.fontSize }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: fs.tableCellSm.fontSize, fontWeight: 600 }}>操作</span>,
      width: 200,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn type="ghost" onClick={() => openEdit(rec)} style={{ color: c.muted, fontSize: fs.tableCell.fontSize }}><IconEdit /> 编辑</Btn>
          <Btn type="danger" onClick={() => handleDelete(rec)} style={{ fontSize: fs.tableCell.fontSize }}><IconDelete /> 删除</Btn>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Add channel */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="输入渠道名称" style={{ ...inputStyle, width: 300, height: 36 }} />
        <Btn type="primary" onClick={handleAdd}
          style={{ height: 36, fontSize: fs.tableCell.fontSize, fontWeight: 500 }}><IconPlus /> 添加渠道</Btn>
      </div>

      {/* Channel list */}
      <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
        <DataTable data={data.channels} columns={columns} rowKey="id"
          emptyText={<span style={{ color: c.muted2 }}>暂无渠道</span>}
          minWidth={500} />
      </div>

      {/* Edit modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)}
        title="编辑渠道名称" width={420}
        footer={<><Btn onClick={() => setEditModalOpen(false)}>取消</Btn><Btn type="primary" onClick={handleEditSave}>确定</Btn></>}>
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>渠道名称</label>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); }}
            placeholder="请输入新的渠道名称" style={{ width: '100%', ...inputStyle }} />
        </div>
      </Modal>

      <DeleteModal open={!!delChannel} onClose={() => setDelChannel(null)} onConfirm={confirmDeleteChannel}
        title={`确认删除"${delChannel?.name}"？`}>
        {delChannel && <p>渠道"{delChannel.name}"下有 {delChanCount} 条住房记录，删除将一并清空关联渠道信息</p>}
      </DeleteModal>
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════
   Statistics Tab — 数据统计
   ═══════════════════════════════════════ */
function StatisticsTab({ c, fs, isLight, data }) {
  const records = data.records;

  const stats = useMemo(() => {
    const totalRecords = records.length;
    const totalDays = records.reduce((s, r) => s + (r.stay_days || 0), 0);
    const totalCost = records.reduce((s, r) => s + (r.total_cost || 0), 0);
    const avgDaily = totalDays > 0 ? totalCost / totalDays : 0;
    const avgMonthly = totalDays > 0 ? totalCost / (totalDays / 30) : 0;
    return { totalRecords, totalDays, totalCost, avgDaily, avgMonthly };
  }, [records]);

  const costBreakdown = useMemo(() => {
    const rentTotal = records.reduce((s, r) => s + (r.rent || 0), 0);
    const depositTotal = records.reduce((s, r) => s + (r.deposit || 0), 0);
    const agencyTotal = records.reduce((s, r) => s + (r.agency_fee || 0), 0);
    const electricityTotal = records.reduce((s, r) => s + (r.electricity_fee || 0), 0);
    const waterTotal = records.reduce((s, r) => s + (r.water_fee || 0), 0);
    const gasTotal = records.reduce((s, r) => s + (r.gas_fee || 0), 0);
    const cleaningTotal = records.reduce((s, r) => s + (r.cleaning_fee || 0), 0);
    const laundryTotal = records.reduce((s, r) => s + (r.laundry_fee || 0), 0);
    const serviceTotal = records.reduce((s, r) => s + (r.service_fee || 0), 0);

    const itemsTotal = rentTotal + depositTotal + agencyTotal + electricityTotal + waterTotal + gasTotal + cleaningTotal + laundryTotal + serviceTotal;

    const items = [
      { label: '房租', value: rentTotal, color: '#5e6ad2' },
      { label: '押金', value: depositTotal, color: '#10B981' },
      { label: '中介费', value: agencyTotal, color: '#F59E0B' },
      { label: '电费', value: electricityTotal, color: '#ef4444' },
      { label: '水费', value: waterTotal, color: '#3B82F6' },
      { label: '燃气费', value: gasTotal, color: '#8B5CF6' },
      { label: '卫生费', value: cleaningTotal, color: '#EC4899' },
      { label: '洗衣费', value: laundryTotal, color: '#F97316' },
      { label: '服务费', value: serviceTotal, color: '#14B8A6' },
    ];

    return items.map(item => ({
      ...item,
      percentage: itemsTotal > 0 ? (item.value / itemsTotal) * 100 : 0,
    })).filter(item => item.value > 0);
  }, [records]);

  const channelStats = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const ch = r.housing_channel || '未知';
      map[ch] = (map[ch] || 0) + 1;
    });
    return Object.entries(map).map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count);
  }, [records]);

  // ECharts pie chart
  const pieChartId = useMemo(() => 'rent-pie-' + Math.random().toString(36).slice(2, 8), []);
  useEffect(() => {
    if (!records.length) return;
    const dom = document.getElementById(pieChartId);
    if (!dom) return;
    const chart = echarts.init(dom);
    const pieData = costBreakdown.map(i => ({ name: i.label, value: i.value }));
    chart.setOption({
      tooltip: { trigger: 'item', backgroundColor: c.dropdownBg, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 } },
      legend: { type: 'scroll', bottom: 0, left: 'center', textStyle: { color: c.muted, fontSize: 12 }, icon: 'circle', itemWidth: 10, itemHeight: 10 },
      color: ['#5e6ad2', '#10B981', '#F59E0B', '#ef4444', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6'],
      series: [{
        type: 'pie', radius: ['38%', '65%'], center: ['50%', '46%'],
        itemStyle: { borderRadius: 8, borderColor: c.surface, borderWidth: 3 },
        label: { show: true, fontSize: 12, color: c.text, formatter: (p) => `${p.name}\n¥${p.value.toFixed(2)}` },
        data: pieData,
      }],
      backgroundColor: 'transparent',
    });
    return () => chart.dispose();
  }, [records, isLight]);

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: '总记录数', value: stats.totalRecords, color: '#5e6ad2' },
          { label: '总居住天数', value: stats.totalDays + ' 天', color: '#0f766e' },
          { label: '总花费', value: '¥' + stats.totalCost.toFixed(2), color: '#2f7a16' },
          { label: '平均单日花费', value: '¥' + stats.avgDaily.toFixed(2), color: '#b45309' },
          { label: '平均单月花费', value: '¥' + stats.avgMonthly.toFixed(2), color: '#c2410c' },
        ].map(s => (
          <div key={s.label} style={{
            background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: '16px 18px',
            textAlign: 'center',
          }}>
            <div style={{ color: c.muted, fontSize: 13, marginBottom: 8 }}>{s.label}</div>
            <div style={{ color: s.color, ...fs.cardValue }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Cost breakdown + Channel distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Cost breakdown */}
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 16 }}>费用类型分布</div>
          {costBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {costBreakdown.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                    <span style={{ color: c.text, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                      {item.label}
                    </span>
                    <span style={{ color: c.text, fontWeight: 600 }}>¥{item.value.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 8, background: c.surfaceTint2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: item.percentage + '%', height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: c.muted, marginTop: 2 }}>{item.percentage.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: c.muted, fontSize: 14 }}>暂无数据</div>
          )}
        </div>

        {/* Channel distribution */}
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 16 }}>住房渠道分布</div>
          {channelStats.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {channelStats.map((item, idx) => {
                const pct = ((item.count / records.length) * 100).toFixed(1);
                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 18px', background: c.surfaceTint2, borderRadius: 10,
                  }}>
                    <span style={{ color: c.text, fontWeight: 600, fontSize: 15 }}>{item.channel}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: c.muted, fontSize: 14 }}>{item.count} 次</span>
                      <span style={{ padding: '2px 10px', background: '#5e6ad220', color: '#5e6ad2', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: c.muted, fontSize: 14 }}>暂无数据</div>
          )}
        </div>
      </div>

      {/* Pie chart */}
      {records.length > 0 && (
        <div style={{ background: c.cardBg, border: '1px solid ' + c.border, borderRadius: 12, padding: 20, marginTop: 16 }}>
          <div style={{ ...fs.sectionTitle, color: c.text, marginBottom: 12 }}>费用分布图</div>
          <div id={pieChartId} style={{ width: '100%', height: 300 }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Main Rent Component
   ═══════════════════════════════════════ */
export default function Rent() {
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

  const defaultTab = 'records';
  const [tab, setTab] = useState(() => window.location.hash?.slice(1) || defaultTab);
  const handleTabChange = (v) => { setTab(v); window.location.hash = v; };
  useEffect(() => {
    const onHashChange = () => { const h = window.location.hash?.slice(1); if (h) setTab(h); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const tabItems = [
    { value: 'records', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconHome />住房记录</span> },
    { value: 'add', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconPlus />新增记录</span> },
    { value: 'settings', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconSettings />渠道管理</span> },
    { value: 'stats', label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconChart />数据统计</span> },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'records': return <HomeTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />;
      case 'add': return <AddTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />;
      case 'settings': return <SettingsTab c={c} fs={fs} data={data} setData={setData} inputStyle={inputStyle} labelStyle={labelStyle} />;
      case 'stats': return <StatisticsTab c={c} fs={fs} isLight={isLight} data={data} />;
      default: return null;
    }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>房租水电</h1>
      <PillTabs value={tab} onChange={handleTabChange} options={tabItems}
        style={{ marginBottom: 20, background: c.surfaceTint, borderRadius: 10, padding: 3 }} />
      {renderTab()}
    </div>
  );
}
