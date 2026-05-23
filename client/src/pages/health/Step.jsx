import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Input, Button, Select, Table, Modal, message,
  Popconfirm, Tag, Segmented,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* ── constants ── */
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);
const PAGE_SIZE = 10;
const DEFAULT_STRIDE = 0.7;
const STORAGE_KEY = 'lifeos_step_records';

/* ── types ── */
/* record: { id, user_id, steps, hour (int|null), record_time (ISO string) } */

/* ── helpers ── */
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function formatDT(iso) { return iso ? iso.replace('T', ' ').slice(0, 19) : ''; }
function toDTLocal(iso) { return iso ? iso.slice(0, 16) : ''; }

/* ── mock seed ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  const data = [];
  let id = 1;
  const today = dayjs();
  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const date = today.subtract(dayOffset, 'day');
    // always add a "full-day" record
    data.push({
      id: id++, user_id: 'user01', steps: rand(3000, 15000),
      hour: null, record_time: date.hour(23).minute(59).format('YYYY-MM-DDTHH:mm'),
    });
    // sometimes add hourly records
    if (Math.random() > 0.4) {
      const h = HOURS[rand(0, HOURS.length - 1)];
      data.push({
        id: id++, user_id: 'user01', steps: rand(200, 3000),
        hour: h, record_time: date.hour(h).minute(rand(0, 59)).format('YYYY-MM-DDTHH:mm'),
      });
    }
  }
  // second user
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const date = today.subtract(dayOffset, 'day');
    data.push({
      id: id++, user_id: 'user02', steps: rand(5000, 20000),
      hour: null, record_time: date.hour(23).minute(59).format('YYYY-MM-DDTHH:mm'),
    });
  }
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
    const observer = new MutationObserver(() => setIsLight(el.classList.contains('light')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isLight;
}

/* ═══════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════ */
export default function Step() {
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
  }), [isLight]);
  /* ── state ── */
  const [records, setRecords] = useState(seedMock);
  const [userId, setUserId] = useState('user01');
  const [steps, setSteps] = useState('');
  const [hourSel, setHourSel] = useState(null);      // null = 全天
  const [recordTime, setRecordTime] = useState(dayjs().format('YYYY-MM-DDTHH:mm'));
  const [filterUserId, setFilterUserId] = useState('user01');
  const [tab, setTab] = useState('daily');
  const [filterMonth, setFilterMonth] = useState(dayjs().format('YYYY-MM'));
  const [filterYear, setFilterYear] = useState(dayjs().year());
  const [chartHour, setChartHour] = useState(null);
  const [stride, setStride] = useState(DEFAULT_STRIDE);
  const [selIds, setSelIds] = useState([]);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [statsPage, setStatsPage] = useState(1);

  /* edit modal */
  const [editOpen, setEditOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);

  /* confirm modal (duplicate overwrite) */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [pendingDup, setPendingDup] = useState(null);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  /* ── persist ── */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  /* ── computed: filtered records for table ── */
  const filteredRecords = useMemo(() => {
    let list = [...records];
    if (filterUserId) {
      list = list.filter(r => r.user_id === filterUserId);
    }
    // default: newest first, no column indicator
    if (sortField) {
      list.sort((a, b) => {
        let av, bv;
        if (sortField === 'steps') { av = a.steps; bv = b.steps; }
        else if (sortField === 'hour') { av = a.hour ?? 999; bv = b.hour ?? 999; }
        else if (sortField === 'record_time') { av = new Date(a.record_time).getTime(); bv = new Date(b.record_time).getTime(); }
        else { av = a[sortField]; bv = b[sortField]; }
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    } else {
      list.sort((a, b) => new Date(b.record_time).getTime() - new Date(a.record_time).getTime());
    }
    return list;
  }, [records, filterUserId, sortField, sortDir]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const pageRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  /* ── computed: stats ── */
  const statsData = useMemo(() => {
    let list = records.filter(r => !filterUserId || r.user_id === filterUserId);
    if (tab === 'daily') {
      const grouped = {};
      list.forEach(r => {
        const d = r.record_time.slice(0, 10);
        if (filterMonth && !d.startsWith(filterMonth)) return;
        if (chartHour !== null && r.hour !== null && r.hour !== chartHour) return;
        if (!grouped[d]) grouped[d] = { date: d, total_steps: 0, record_count: 0, distance_km: 0 };
        grouped[d].total_steps += r.steps;
        grouped[d].record_count += 1;
        grouped[d].distance_km = +(grouped[d].total_steps * stride / 1000).toFixed(1);
      });
      return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    } else {
      const grouped = {};
      const y = filterYear;
      list.forEach(r => {
        const d = r.record_time.slice(0, 7);
        if (parseInt(d.slice(0, 4)) !== y) return;
        if (chartHour !== null && r.hour !== null && r.hour !== chartHour) return;
        if (!grouped[d]) grouped[d] = { month: d, total_steps: 0, record_count: 0, distance_km: 0 };
        grouped[d].total_steps += r.steps;
        grouped[d].record_count += 1;
        grouped[d].distance_km = +(grouped[d].total_steps * stride / 1000).toFixed(1);
      });
      return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
    }
  }, [records, filterUserId, tab, filterMonth, filterYear, chartHour, stride]);

  const chartData = statsData; // same data
  const statsPageSize = 10;
  const statsTotalPages = Math.ceil(chartData.length / statsPageSize);
  const statsPageData = [...chartData].reverse().slice((statsPage - 1) * statsPageSize, statsPage * statsPageSize);

  /* ── month-over-month ── */
  const monthCompare = useMemo(() => {
    const current = dayjs().format('YYYY-MM');
    const prev = dayjs().subtract(1, 'month').format('YYYY-MM');
    const curRecs = records.filter(r => !filterUserId || r.user_id === filterUserId).filter(r => r.record_time.startsWith(current));
    const prevRecs = records.filter(r => !filterUserId || r.user_id === filterUserId).filter(r => r.record_time.startsWith(prev));
    const curSteps = curRecs.reduce((s, r) => s + r.steps, 0);
    const prevSteps = prevRecs.reduce((s, r) => s + r.steps, 0);
    const change = prevSteps ? Math.round((curSteps - prevSteps) / prevSteps * 100) : 0;
    return {
      current: { steps: curSteps, month: current, distance: +(curSteps * stride / 1000).toFixed(1) },
      previous: { steps: prevSteps, month: prev, distance: +(prevSteps * stride / 1000).toFixed(1) },
      change, label: change > 0 ? '↑ 增长' : change < 0 ? '↓ 下降' : '= 持平',
    };
  }, [records, filterUserId, stride]);

  /* ── chart ── */
  useEffect(() => {
    if (!chartRef.current || !chartData.length) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const sorted = [...chartData].sort((a, b) => (a.date || a.month).localeCompare(b.date || b.month));
    chartInstance.current.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
        borderWidth: 0,
        textStyle: { color: c.text, fontSize: 13 },
        formatter: (params) => {
          const p = params[0];
          const item = sorted[p.dataIndex];
          return `<div>${p.axisValue}</div><div style="color:#5e6ad2;font-weight:600;font-size:16px;margin-top:4px">${item.total_steps.toLocaleString()} 步</div><div style="color:${c.muted};font-size:12px">${item.record_count} 条记录 · ${item.distance_km} 公里</div>`;
        },
      },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: sorted.map(d => d.date || d.month),
        axisLabel: { color: c.muted, fontSize: 11 },
        axisLine: { lineStyle: { color: c.border } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: c.muted, fontSize: 11, formatter: v => v.toLocaleString() },
      },
      series: [{
        type: 'line',
        data: sorted.map(d => d.total_steps),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#5e6ad2', width: 2 },
        itemStyle: { color: '#5e6ad2' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(94,106,210,0.25)' },
            { offset: 1, color: 'rgba(94,106,210,0.02)' },
          ]),
        },
      }],
    });
    return () => { chartInstance.current?.dispose(); chartInstance.current = null; };
  }, [chartData, c, isLight]);

  /* ── resize chart ── */
  useEffect(() => {
    const onResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ── find duplicate ── */
  function findDuplicate(u, h, rt) {
    const date = rt.slice(0, 10);
    return records.find(r => r.user_id === u && r.record_time.startsWith(date) && (h === null ? r.hour === null : r.hour === h) && (h !== null || r.hour === null));
  }

  /* ── add record ── */
  const addRecord = useCallback(() => {
    if (!userId || !steps) { message.error('请填写用户 ID 和步数'); return; }
    const dup = findDuplicate(userId, hourSel, recordTime);
    if (dup) {
      setConfirmMsg(`发现重复记录\n\n${recordTime.slice(0, 10)} ${hourSel !== null ? `${String(hourSel).padStart(2, '0')}:00` : '全天'} 已有一条数据（ID: ${dup.id}）。\n点击「确定」覆盖原记录，点击「取消」保留原记录。`);
      setPendingDup({ id: dup.id, user_id: userId, steps: parseInt(steps), hour: hourSel, record_time: recordTime });
      setConfirmOpen(true);
      return;
    }
    doAdd({ user_id: userId, steps: parseInt(steps), hour: hourSel, record_time: recordTime });
  }, [userId, steps, hourSel, recordTime, records]);

  function doAdd(data) {
    const maxId = records.reduce((m, r) => Math.max(m, r.id), 0);
    const newRec = { ...data, id: maxId + 1 };
    setRecords(prev => [newRec, ...prev]);
    message.success('记录添加成功！');
    setSteps('');
    // advance to next hour
    if (hourSel !== null) {
      const next = HOURS.find(h => h > hourSel);
      if (next) { setHourSel(next); setRecordTime(dayjs().format(`YYYY-MM-DDTHH:mm`)); }
    }
    setPage(1);
  }

  /* overwrite duplicate */
  function overwriteDup(confirmed) {
    setConfirmOpen(false);
    if (!confirmed || !pendingDup) return;
    setRecords(prev => prev.map(r => r.id === pendingDup.id ? { ...r, steps: pendingDup.steps, hour: pendingDup.hour, record_time: pendingDup.record_time } : r));
    message.success('记录已更新');
    setSteps('');
    setPage(1);
    setPendingDup(null);
  }

  /* ── delete ── */
  const deleteRecord = useCallback((id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    message.success('记录已删除');
  }, []);

  /* ── batch delete ── */
  function batchDelete() {
    if (!selIds.length) { message.warning('请选择要删除的记录'); return; }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selIds.length} 条记录吗？`,
      okText: '确定', cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const idset = new Set(selIds);
        setRecords(prev => prev.filter(r => !idset.has(r.id)));
        setSelIds([]);
        message.success(`成功删除 ${idset.size} 条记录`);
        setPage(1);
      },
    });
  }

  /* ── edit ── */
  function openEdit(rec) {
    setEditRec({ ...rec });
    setEditOpen(true);
  }
  function saveEdit() {
    if (!editRec) return;
    if (!editRec.user_id || !editRec.steps) { message.error('请填写用户 ID 和步数'); return; }
    setRecords(prev => prev.map(r => r.id === editRec.id ? editRec : r));
    setEditOpen(false);
    setEditRec(null);
    message.success('记录已更新');
  }

  /* ── table columns ── */
  const columns = [
    {
      title: 'ID', dataIndex: 'id', sorter: true, width: 70,
      sortOrder: sortField === 'id' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
    },
    { title: '用户 ID', dataIndex: 'user_id', width: 110 },
    {
      title: '步数', dataIndex: 'steps', sorter: true, width: 100,
      sortOrder: sortField === 'steps' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      render: v => <span style={{ fontWeight: 600, color: c.text }}>{v.toLocaleString()}</span>,
    },
    {
      title: '时间段', dataIndex: 'hour', width: 90,
      sorter: true,
      sortOrder: sortField === 'hour' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      render: h => h !== null && h !== '' ? `${String(h).padStart(2, '0')}:00` : <Tag bordered={false} style={{ color: c.muted }}>全天</Tag>,
    },
    {
      title: '记录时间', dataIndex: 'record_time', sorter: true, width: 170,
      sortOrder: sortField === 'record_time' ? (sortDir === 'asc' ? 'ascend' : 'descend') : null,
      render: v => <span style={{ color: c.textSecondary }}>{formatDT(v)}</span>,
    },
    {
      title: '操作', width: 140, fixed: 'right',
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)}
            style={{ color: c.muted }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord(rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const handleTableChange = useCallback((pagination, _filters, sorter) => {
    if (sorter.order) {
      setSortField(sorter.field);
      setSortDir(sorter.order === 'ascend' ? 'asc' : 'desc');
    } else {
      setSortField(null);
      setSortDir('desc');
    }
    setPage(pagination.current || 1);
  }, []);

  /* ── render ── */
  const inputStyle = {
    background: c.surfaceTint,
    border: '1px solid ' + c.border,
    borderRadius: 8,
    color: c.text,
    height: 42,
  };
  const labelStyle = { color: c.textSecondary, fontWeight: 500, fontSize: 14, marginBottom: 6, display: 'block' };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>运动步数</h1>

      {/* ═══════ Add Record ═══════ */}
      <div className="linear-card" style={{ marginBottom: 24, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, marginBottom: 24 }}>添加步数记录</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap',
          padding: '14px 20px', borderRadius: 10, background: 'rgba(94,106,210,0.08)', border: '1px solid rgba(94,106,210,0.12)' }}>
          <div>
            <div style={{ fontWeight: 600, color: c.text, fontSize: 14 }}>
              当前记录：{hourSel !== null ? `${String(hourSel).padStart(2, '0')}:00 时间段` : '全天累计'}
            </div>
            <div style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
              {hourSel !== null ? '添加成功后会自动跳到下一个小时，连续录入更顺手。' : '适合补录全天数据。'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>用户 ID</label>
            <Input value={userId} onChange={e => setUserId(e.target.value)}
              placeholder="输入用户 ID" style={{ ...inputStyle, height: 42 }} />
          </div>
          <div>
            <label style={labelStyle}>步数</label>
            <Input value={steps} onChange={e => setSteps(e.target.value.replace(/\D/g, ''))}
              placeholder="输入步数" style={{ ...inputStyle, height: 42 }}
              onKeyDown={e => e.key === 'Enter' && addRecord()} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>时间段</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HOURS.map(h => (
              <Button key={h}
                style={{
                  width: 44, height: 38,
                  background: hourSel === h ? '#5e6ad2' : c.surfaceTint,
                  borderColor: hourSel === h ? '#5e6ad2' : c.border,
                  color: hourSel === h ? '#fff' : c.textSecondary,
                  fontWeight: hourSel === h ? 600 : 400,
                  borderRadius: 8,
                }}
                onClick={() => setHourSel(prev => prev === h ? null : h)}>{h}</Button>
            ))}
            <Button
              style={{
                width: 44, height: 38,
                background: hourSel === null ? '#5e6ad2' : c.surfaceTint,
                borderColor: hourSel === null ? '#5e6ad2' : c.border,
                color: hourSel === null ? '#fff' : c.textSecondary,
                fontWeight: hourSel === null ? 600 : 400,
                borderRadius: 8,
              }}
              onClick={() => setHourSel(null)}>全</Button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>记录时间</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input type="datetime-local" value={recordTime} onChange={e => setRecordTime(e.target.value)}
              style={{ ...inputStyle, width: 240, height: 42 }} />
            <span style={{ color: c.muted, fontSize: 13 }}>快速：</span>
            {[7, 8, 9, 12, 18, 23].map(h => (
              <Button key={h} size="small" style={{ ...inputStyle, height: 32, padding: '0 14px', fontSize: 13 }}
                onClick={() => {
                  const now = dayjs();
                  setRecordTime(now.hour(h).minute(h === 23 ? 59 : 0).format('YYYY-MM-DDTHH:mm'));
                  if (h !== 23) setHourSel(h);
                }}>{h}:00</Button>
            ))}
            <Button size="small" style={{ ...inputStyle, height: 32, padding: '0 14px', fontSize: 13 }}
              onClick={() => {
                const yes = dayjs().subtract(1, 'day');
                setRecordTime(yes.hour(23).minute(59).format('YYYY-MM-DDTHH:mm'));
                setHourSel(null);
              }}>昨天 23:59</Button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={addRecord}
            style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42, padding: '0 28px', fontWeight: 500, fontSize: 15 }}>
            添加记录
          </Button>
          <span style={{ color: c.muted2, fontSize: 13 }}>新增成功后，焦点会回到步数输入框。</span>
        </div>
      </div>

      {/* ═══════ Data Statistics ═══════ */}
      <div className="linear-card" style={{ marginBottom: 24, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, margin: 0 }}>数据统计</h2>
          <Segmented value={tab} onChange={v => { setTab(v); setStatsPage(1); }}
            options={[
              { value: 'daily', label: '每天' },
              { value: 'monthly', label: '每月' },
            ]}
            style={{ background: c.surfaceTint, borderRadius: 8 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>用户 ID</label>
            <Input value={filterUserId} onChange={e => { setFilterUserId(e.target.value); setPage(1); setStatsPage(1); }}
              placeholder="输入用户 ID" style={{ ...inputStyle, width: 160 }} />
          </div>
          <div>
            <label style={labelStyle}>步幅（米）</label>
            <Input type="number" value={stride} onChange={e => setStride(parseFloat(e.target.value) || DEFAULT_STRIDE)}
              step={0.01} min={0.1} max={2} style={{ ...inputStyle, width: 120 }} />
          </div>
          {tab === 'daily' ? (
            <div>
              <label style={labelStyle}>月份</label>
              <Input type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setStatsPage(1); }}
                style={{ ...inputStyle, width: 160 }} />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>年份</label>
              <Input type="number" value={filterYear} onChange={e => { setFilterYear(parseInt(e.target.value) || dayjs().year()); setStatsPage(1); }}
                style={{ ...inputStyle, width: 120 }} />
            </div>
          )}
        </div>

        {/* Hour filter for chart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ color: c.muted, fontSize: 13 }}>时间段筛选：</span>
          <Button size="small" style={{
            minWidth: 32, height: 30,
            background: chartHour === null ? '#5e6ad2' : c.surfaceTint,
            borderColor: chartHour === null ? '#5e6ad2' : c.border,
            color: chartHour === null ? '#fff' : c.textSecondary,
            borderRadius: 8,
          }} onClick={() => setChartHour(null)}>全部</Button>
          {HOURS.map(h => (
            <Button key={h} size="small" style={{
              minWidth: 32, height: 30,
              background: chartHour === h ? '#5e6ad2' : c.surfaceTint,
              borderColor: chartHour === h ? '#5e6ad2' : c.border,
              color: chartHour === h ? '#fff' : c.textSecondary,
              borderRadius: 8,
            }} onClick={() => setChartHour(prev => prev === h ? null : h)}>{h}</Button>
          ))}
        </div>

        {/* Chart */}
        <div ref={chartRef} style={{ height: 260, marginBottom: 28, padding: 20, background: c.surfaceTint2, borderRadius: 12 }} />

        {/* Month-over-month comparison */}
        {tab === 'monthly' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #5e6ad2 0%, #828fff 100%)', padding: 20, borderRadius: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>本月</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{monthCompare.current.steps.toLocaleString()}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{monthCompare.current.month} · {monthCompare.current.distance} 公里</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20, borderRadius: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>上月</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{monthCompare.previous.steps.toLocaleString()}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{monthCompare.previous.month} · {monthCompare.previous.distance} 公里</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', padding: 20, borderRadius: 12 }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>变化</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{monthCompare.change > 0 ? '+' : ''}{monthCompare.change}%</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{monthCompare.label} vs 上月</div>
            </div>
          </div>
        )}

        {/* Stats cards */}
        {filterUserId ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
              {statsPageData.map(item => (
                <div key={item.date || item.month} className="linear-card" style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#5e6ad2', lineHeight: 1.2 }}>
                    {(item.total_steps || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 14, color: c.textSecondary, marginTop: 8, fontWeight: 500 }}>
                    {item.date || item.month}
                  </div>
                  <div style={{ fontSize: 12, color: c.muted2, marginTop: 4 }}>
                    {item.record_count} 条记录
                  </div>
                  <div style={{ fontSize: 13, color: '#5e6ad2', fontWeight: 600, marginTop: 8 }}>
                    🏃 {item.distance_km} 公里
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid ' + c.border }}>
              <Button disabled={statsPage <= 1} onClick={() => setStatsPage(1)}
                style={{ ...inputStyle, height: 36, fontSize: 13 }}>首页</Button>
              <Button disabled={statsPage <= 1} onClick={() => setStatsPage(p => p - 1)}
                style={{ ...inputStyle, height: 36, fontSize: 13 }}>上一页</Button>
              <span style={{ color: c.muted, fontSize: 14, whiteSpace: 'nowrap' }}>第 {statsPage} / {statsTotalPages} 页</span>
              <Input type="number" min={1} max={statsTotalPages}
                onPressEnter={e => {
                  const v = parseInt(e.target.value);
                  if (v >= 1 && v <= statsTotalPages) setStatsPage(v);
                }}
                style={{ ...inputStyle, width: 56, height: 36, textAlign: 'center' }}
                placeholder="页" />
              <Button disabled={statsPage >= statsTotalPages} onClick={() => setStatsPage(p => p + 1)}
                style={{ ...inputStyle, height: 36, fontSize: 13 }}>下一页</Button>
              <Button disabled={statsPage >= statsTotalPages} onClick={() => setStatsPage(statsTotalPages)}
                style={{ ...inputStyle, height: 36, fontSize: 13 }}>末页</Button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: c.muted2, padding: '60px 0' }}>请输入用户 ID 查看统计</div>
        )}
      </div>

      {/* ═══════ All Records ═══════ */}
      <div className="linear-card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, marginBottom: 24 }}>所有记录</h2>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>用户 ID</label>
            <Input value={filterUserId} onChange={e => { setFilterUserId(e.target.value); setPage(1); }}
              placeholder="输入用户 ID" style={{ ...inputStyle, width: 180, height: 42 }} />
          </div>
          <Button danger disabled={!selIds.length} onClick={batchDelete}
            icon={<DeleteOutlined />}
            style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
          {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 条</span>}
        </div>

        <Table
          dataSource={pageRecords}
          columns={columns}
          rowKey="id"
          pagination={false}
          onChange={handleTableChange}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selIds,
            onChange: keys => setSelIds(keys),
          }}
          style={{ background: 'transparent' }}
          locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无记录</span> }}
          scroll={{ x: 700 }}
          size="middle"
        />
        {/* Custom pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 12 }}>
          <Select value={pageSize} onChange={v => { setPageSize(v); setPage(1); }}
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
            <Button disabled={page <= 1} onClick={() => setPage(1)}
              style={{ ...inputStyle, height: 36, fontSize: 13 }}>首页</Button>
            <Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ ...inputStyle, height: 36, fontSize: 13 }}>上一页</Button>
            <span style={{ color: c.muted, fontSize: 14, whiteSpace: 'nowrap' }}>第 {page} / {totalPages} 页</span>
            <Input type="number" min={1} max={totalPages}
              onPressEnter={e => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= totalPages) setPage(v);
              }}
              style={{ ...inputStyle, width: 56, height: 36, textAlign: 'center' }}
              placeholder="页" />
            <Button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ ...inputStyle, height: 36, fontSize: 13 }}>下一页</Button>
            <Button disabled={page >= totalPages} onClick={() => setPage(totalPages)}
              style={{ ...inputStyle, height: 36, fontSize: 13 }}>末页</Button>
          </div>
          <span style={{ color: c.muted, fontSize: 13 }}>共 {filteredRecords.length} 条</span>
        </div>
      </div>

      {/* ═══════ Edit Modal ═══════ */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>编辑记录</span>}
        open={editOpen}
        onCancel={() => { setEditOpen(false); setEditRec(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setEditOpen(false); setEditRec(null); }}
            style={{ background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 }}>取消</Button>,
          <Button key="save" type="primary" onClick={saveEdit}
            style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 }}>保存</Button>,
        ]}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={480}
      >
        {editRec && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>用户 ID</label>
              <Input value={editRec.user_id} onChange={e => setEditRec(p => ({ ...p, user_id: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>步数</label>
              <Input value={editRec.steps} onChange={e => setEditRec(p => ({ ...p, steps: parseInt(e.target.value) || 0 }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>时间段</label>
              <Select value={editRec.hour} onChange={v => setEditRec(p => ({ ...p, hour: v }))}
                style={{ width: '100%', height: 42 }}
                popupStyle={{ background: c.dropdownBg }}
                dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                options={[
                  { value: null, label: '全天' },
                  ...HOURS.map(h => ({ value: h, label: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00` })),
                ]}
              />
            </div>
            <div>
              <label style={labelStyle}>记录时间</label>
              <Input type="datetime-local" value={toDTLocal(editRec.record_time)}
                onChange={e => setEditRec(p => ({ ...p, record_time: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════ Confirm Modal (duplicate) ═══════ */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>⚠️ 重复记录提示</span>}
        open={confirmOpen}
        onCancel={() => overwriteDup(false)}
        footer={[
          <Button key="cancel" onClick={() => overwriteDup(false)}
            style={{ background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 }}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => overwriteDup(true)}
            style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 }}>确定</Button>,
        ]}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={440}
      >
        <div style={{
          background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 10,
          color: c.textSecondary, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-line',
        }}>
          {confirmMsg}
        </div>
      </Modal>
    </div>
  );
}
