import { useState, useEffect, useMemo } from 'react';

/* ═══════════════════════════════════════
   Styling constants
   ═══════════════════════════════════════ */
const S = {
  card: { backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: '24px' },
  cardTight: { backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: '18px' },
  btnPrimary: { backgroundColor: 'var(--color-primary)', color: '#ffffff', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 15 },
  btnSecondary: { backgroundColor: 'var(--color-surface-1)', color: 'var(--color-ink)', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: '1px solid var(--color-hairline)', cursor: 'pointer', fontSize: 15 },
  btnGhost: { backgroundColor: 'transparent', color: 'var(--color-primary)', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '8px 14px', border: '1px solid transparent', cursor: 'pointer', fontSize: 14 },
  btnDanger: { backgroundColor: 'transparent', color: 'var(--color-danger)', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '6px 12px', border: '1px solid transparent', cursor: 'pointer', fontSize: 14 },
  input: { backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--color-ink)', fontSize: 15, width: '100%' },
  select: { backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--color-ink)', fontSize: 15, width: '100%' },
  label: { display: 'block', fontSize: 14, marginBottom: 6, color: 'var(--color-ink-subtle)' },
};

const today = () => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rfloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const INSTRUMENTS = [
  { value: 'XAUUSD', label: 'XAUUSD 黄金/美元' },
  { value: 'XAGUSD', label: 'XAGUSD 白银/美元' },
  { value: 'EURUSD', label: 'EURUSD 欧元/美元' },
  { value: 'GBPUSD', label: 'GBPUSD 英镑/美元' },
  { value: 'USDJPY', label: 'USDJPY 美元/日元' },
];

const STORAGE_KEY = 'lifeos_forex_data';

function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let tradeId = 1, capitalId = 1, logId = 1;

  const instruments = ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY'];
  const trades = [];
  for (let i = 0; i < 25; i++) {
    const instrument = instruments[rand(0, 4)];
    const type = Math.random() > 0.5 ? 'buy' : 'sell';
    const open = rfloat(1800, 2000);
    const close = open + rfloat(-50, 50);
    const lot = parseFloat((rand(1, 30) * 0.01).toFixed(2));
    const units = instrument === 'XAGUSD' ? 5000 : 100;
    const diff = type === 'buy' ? close - open : open - close;
    const pnl = parseFloat((diff * lot * units).toFixed(2));
    const d = new Date(); d.setDate(d.getDate() - rand(0, 60));
    trades.push({
      id: tradeId++, trade_date: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
      instrument, order_type: type, open_price: String(open), close_price: String(close),
      lot_size: String(lot), commission: String(parseFloat((-lot * 6).toFixed(2))),
      pnl: String(pnl), open_time: '10:' + String(rand(0, 59)).padStart(2, '0') + ':00',
      close_time: '11:' + String(rand(0, 59)).padStart(2, '0') + ':00',
      hold_time: rand(10, 120) + '分钟', remark: '',
    });
  }

  const capitals = [
    { id: capitalId++, flow_date: today(), flow_type: 'deposit', amount: 10000, remark: '初始入金' },
    { id: capitalId++, flow_date: today(), flow_type: 'withdrawal', amount: 2000, remark: '部分出金' },
  ];

  return { trades, capitals, tradeIdCounter: tradeId, capitalIdCounter: capitalId, logIdCounter: logId };
}

/* ═══════════════════════════════════════
   Shared mini-components
   ═══════════════════════════════════════ */
function StatCard({ label, value, color, prefix, sub }) {
  return (
    <div style={S.cardTight}>
      <div style={{ fontSize: 13, color: 'var(--color-ink-subtle)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.3px', color: color || 'var(--color-ink)' }}>
        {prefix || ''}{value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-ink-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, width, readOnly }) {
  return (
    <div style={width ? { width } : undefined}>
      <label style={S.label}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={S.input} readOnly={readOnly} step={type === 'number' ? 'any' : undefined} />
    </div>
  );
}

function Select({ label, value, onChange, options, width }) {
  return (
    <div style={width ? { width } : undefined}>
      <label style={S.label}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={S.select}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function toast(msg, type = 'success') {
  // Used inline via showToast
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
const TABS = [
  { key: 'overview', label: '📊 市场概览' },
  { key: 'trades', label: '📋 交易记录' },
  { key: 'calculator', label: '🧮 交易计算' },
  { key: 'capital', label: '💰 出入金' },
];

export default function Forex() {
  const [data, setData] = useState(seedMock);
  const [tab, setTab] = useState('overview');
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const showToast = (message, type = 'success') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.8px]" style={{ color: 'var(--color-ink)' }}>外汇市场</h1>
          <p className="mt-1 text-[16px]" style={{ color: 'var(--color-ink-muted)' }}>外汇交易管理、分析与计算</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500,
              background: tab === t.key ? 'var(--color-surface-2)' : 'transparent',
              color: tab === t.key ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab data={data} showToast={showToast} />}
      {tab === 'trades' && <TradesTab data={data} setData={setData} showToast={showToast} />}
      {tab === 'calculator' && <CalculatorTab showToast={showToast} />}
      {tab === 'capital' && <CapitalTab data={data} setData={setData} showToast={showToast} />}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-8 right-8 z-50" style={{
          backgroundColor: toastMsg.type === 'success' ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-surface-2))' : 'color-mix(in srgb, var(--color-danger) 20%, var(--color-surface-2))',
          border: `1px solid ${toastMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
          borderRadius: 'var(--radius-md)', padding: '14px 22px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <span className="text-[15px] font-medium" style={{ color: 'var(--color-ink)' }}>{toastMsg.message}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Overview Tab — 市场概览
   ═══════════════════════════════════════ */
function OverviewTab({ data }) {
  const trades = data.trades || [];

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter(t => parseFloat(t.pnl) > 0).length;
    const losses = trades.filter(t => parseFloat(t.pnl) < 0).length;
    const totalPnl = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);
    const totalCommission = trades.reduce((s, t) => s + (Math.abs(parseFloat(t.commission)) || 0), 0);
    const buys = trades.filter(t => t.order_type === 'buy').length;
    const sells = trades.filter(t => t.order_type === 'sell').length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
    return { total, wins, losses, totalPnl, totalCommission, buys, sells, winRate };
  }, [trades]);

  const byInstrument = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      if (!map[t.instrument]) map[t.instrument] = { cnt: 0, totalPnl: 0, wins: 0 };
      map[t.instrument].cnt++;
      map[t.instrument].totalPnl += parseFloat(t.pnl) || 0;
      if (parseFloat(t.pnl) > 0) map[t.instrument].wins++;
    });
    return Object.entries(map).map(([k, v]) => ({ instrument: k, ...v, winRate: v.cnt > 0 ? ((v.wins / v.cnt) * 100).toFixed(0) : '0' }));
  }, [trades]);

  const maxPnl = useMemo(() => {
    if (!trades.length) return 0;
    return trades.reduce((m, t) => Math.abs(parseFloat(t.pnl) || 0) > Math.abs(m) ? (parseFloat(t.pnl) || 0) : m, 0);
  }, [trades]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="总交易笔数" value={stats.total} sub={`盈利 ${stats.wins} / 亏损 ${stats.losses}`} />
        <StatCard label="净盈亏" value={`$${stats.totalPnl.toFixed(2)}`} color={stats.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="胜率" value={`${stats.winRate}%`} color={parseFloat(stats.winRate) >= 50 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="手续费" value={`$${stats.totalCommission.toFixed(2)}`} color="var(--color-ink-tertiary)" />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="做多笔数" value={stats.buys} color="var(--color-success)" />
        <StatCard label="做空笔数" value={stats.sells} color="var(--color-danger)" />
        <StatCard label="平均盈亏" value={trades.length > 0 ? `$${(stats.totalPnl / trades.length).toFixed(2)}` : '$0.00'} color={stats.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="最大单笔盈亏" value={`$${maxPnl.toFixed(2)}`} color={maxPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
      </div>

      {/* By Instrument */}
      {byInstrument.length > 0 && (
        <div style={S.card}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 16 }}>品种分析</h3>
          <table className="w-full" style={{ fontSize: 15 }}>
            <thead>
              <tr style={{ color: 'var(--color-ink-subtle)', borderBottom: '1px solid var(--color-hairline)' }}>
                <th className="text-left py-3 font-medium">品种</th>
                <th className="text-right py-3 font-medium">笔数</th>
                <th className="text-right py-3 font-medium">总盈亏</th>
                <th className="text-right py-3 font-medium">平均盈亏</th>
                <th className="text-right py-3 font-medium">胜率</th>
              </tr>
            </thead>
            <tbody>
              {byInstrument.map(item => (
                <tr key={item.instrument} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td className="py-3 font-medium" style={{ color: 'var(--color-ink)' }}>{item.instrument}</td>
                  <td className="py-3 text-right" style={{ color: 'var(--color-ink-muted)' }}>{item.cnt}</td>
                  <td className="py-3 text-right font-mono font-medium" style={{ color: item.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    ${item.totalPnl.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                    ${(item.totalPnl / item.cnt).toFixed(2)}
                  </td>
                  <td className="py-3 text-right" style={{ color: 'var(--color-ink-muted)' }}>{item.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trades.length === 0 && (
        <div style={S.card}>
          <p className="text-center py-12" style={{ color: 'var(--color-ink-subtle)', fontSize: 15 }}>暂无交易数据，请先添加交易记录</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Trades Tab — 交易记录
   ═══════════════════════════════════════ */
function TradesTab({ data, setData, showToast }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ instrument: '', order_type: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const pageSize = 15;

  const trades = useMemo(() => {
    let list = [...data.trades];
    if (filter.instrument) list = list.filter(t => t.instrument === filter.instrument);
    if (filter.order_type) list = list.filter(t => t.order_type === filter.order_type);
    return list.sort((a, b) => b.id - a.id);
  }, [data.trades, filter]);

  const totalPages = Math.max(1, Math.ceil(trades.length / pageSize));
  const paged = trades.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [filter.instrument, filter.order_type]);

  const emptyForm = () => ({
    trade_date: today(), instrument: 'XAUUSD', order_type: 'buy',
    open_price: '', lot_size: '0.01', commission: '-0.06', close_price: '', pnl: '',
    open_time: '', close_time: '', hold_time: '', remark: '',
  });

  const openCreate = () => { setForm(emptyForm()); setEditingId(null); setShowForm(true); };

  const openEdit = (t) => {
    setForm({
      trade_date: t.trade_date, instrument: t.instrument, order_type: t.order_type,
      open_price: t.open_price, lot_size: t.lot_size, commission: t.commission,
      close_price: t.close_price || '', pnl: t.pnl || '',
      open_time: t.open_time || '', close_time: t.close_time || '',
      hold_time: t.hold_time || '', remark: t.remark || '',
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.trade_date || !form.open_price) { showToast('请填写必填字段', 'error'); return; }
    const entry = {
      trade_date: form.trade_date, instrument: form.instrument, order_type: form.order_type,
      open_price: form.open_price, lot_size: form.lot_size,
      commission: form.commission || '0', close_price: form.close_price || '',
      pnl: form.pnl || '', open_time: form.open_time || '',
      close_time: form.close_time || '', hold_time: form.hold_time || '',
      remark: form.remark || '',
    };
    if (editingId) {
      setData(prev => ({ ...prev, trades: prev.trades.map(t => t.id === editingId ? { ...t, ...entry } : t) }));
      showToast('记录已更新');
    } else {
      setData(prev => ({ ...prev, trades: [{ id: prev.tradeIdCounter, ...entry }, ...prev.trades], tradeIdCounter: prev.tradeIdCounter + 1 }));
      showToast('记录已添加');
    }
    setShowForm(false);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setData(prev => ({ ...prev, trades: prev.trades.filter(t => t.id !== deleteConfirm.id) }));
    setDeleteConfirm(null);
    showToast('记录已删除');
  };

  const getContractUnits = (instrument) => instrument === 'XAGUSD' ? 5000 : 100;

  const fmtPnl = (v, instrument) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '-';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
  };

  const calcPnl = (type, open, close, lot, instrument) => {
    const o = parseFloat(open), c = parseFloat(close), l = parseFloat(lot);
    if (isNaN(o) || isNaN(c) || isNaN(l) || l <= 0) return '';
    const diff = type === 'buy' ? (c - o) : (o - c);
    return String(Math.round(diff * l * getContractUnits(instrument) * 100) / 100);
  };

  const updatePnl = (f) => {
    if (f.close_price) {
      return calcPnl(f.order_type, f.open_price, f.close_price, f.lot_size, f.instrument);
    }
    return f.pnl;
  };

  const handleFieldChange = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      if (['order_type', 'open_price', 'close_price', 'lot_size', 'instrument'].includes(key)) {
        next.pnl = updatePnl(next);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <select value={filter.instrument} onChange={e => setFilter(f => ({ ...f, instrument: e.target.value }))} style={S.select}>
            <option value="">全部品种</option>
            {INSTRUMENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
          <select value={filter.order_type} onChange={e => setFilter(f => ({ ...f, order_type: e.target.value }))} style={S.select}>
            <option value="">全部类型</option>
            <option value="buy">做多 (Buy)</option>
            <option value="sell">做空 (Sell)</option>
          </select>
        </div>
        <button style={S.btnPrimary} onClick={openCreate}>+ 新增记录</button>
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: 'auto' }}>
        <table className="w-full" style={{ minWidth: 1100, fontSize: 14 }}>
          <thead>
            <tr style={{ color: 'var(--color-ink-subtle)', borderBottom: '1px solid var(--color-hairline)' }}>
              {['日期', '品种', '类型', '开仓价', '手数', '手续费', '平仓价', '盈亏', '开仓时间', '平仓时间', '持仓', '备注', '操作'].map(h => (
                <th key={h} className="text-left py-3 px-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-12" style={{ color: 'var(--color-ink-subtle)' }}>暂无交易记录</td></tr>
            ) : (
              paged.map(t => {
                const pnl = parseFloat(t.pnl);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                    <td className="py-2.5 px-3 whitespace-nowrap" style={{ color: 'var(--color-ink-muted)' }}>{t.trade_date}</td>
                    <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--color-ink)' }}>{t.instrument}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[12px] font-medium" style={{
                        backgroundColor: t.order_type === 'buy' ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : 'color-mix(in srgb, var(--color-danger) 20%, transparent)',
                        color: t.order_type === 'buy' ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>{t.order_type === 'buy' ? '做多' : '做空'}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono" style={{ color: 'var(--color-ink)' }}>{parseFloat(t.open_price).toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-mono" style={{ color: 'var(--color-ink-muted)' }}>{parseFloat(t.lot_size).toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-mono" style={{ color: 'var(--color-ink-muted)' }}>{t.commission}</td>
                    <td className="py-2.5 px-3 font-mono" style={{ color: 'var(--color-ink-muted)' }}>{t.close_price ? parseFloat(t.close_price).toFixed(2) : '-'}</td>
                    <td className="py-2.5 px-3 font-mono font-medium" style={{ color: pnl > 0 ? 'var(--color-success)' : pnl < 0 ? 'var(--color-danger)' : 'var(--color-ink-muted)' }}>
                      {fmtPnl(t.pnl)}
                    </td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>{t.open_time || '-'}</td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>{t.close_time || '-'}</td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>{t.hold_time || '-'}</td>
                    <td className="py-2.5 px-3" style={{ color: 'var(--color-ink-subtle)', fontSize: 13, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.remark || '-'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button style={S.btnGhost} onClick={() => openEdit(t)}>编辑</button>
                      <button style={S.btnDanger} onClick={() => setDeleteConfirm(t)}>删除</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {trades.length > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page <= 1 ? 0.4 : 1 }} disabled={page <= 1} onClick={() => setPage(1)}>首页</button>
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page <= 1 ? 0.4 : 1 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span style={{ color: 'var(--color-ink-muted)', fontSize: 15 }}>第 {page} / {totalPages} 页（共 {trades.length} 条）</span>
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page >= totalPages ? 0.4 : 1 }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page >= totalPages ? 0.4 : 1 }} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)', borderRadius: 'var(--radius-lg)', padding: 28, width: 560, maxHeight: '85vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 20 }}>{editingId ? '编辑交易记录' : '新增交易记录'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="日期" value={form.trade_date} onChange={v => handleFieldChange('trade_date', v)} placeholder="yyyy/mm/dd" />
              <Select label="品种" value={form.instrument} onChange={v => handleFieldChange('instrument', v)} options={INSTRUMENTS} />
              <Select label="类型" value={form.order_type} onChange={v => handleFieldChange('order_type', v)} options={[
                { value: 'buy', label: '做多 Buy' }, { value: 'sell', label: '做空 Sell' },
              ]} />
              <Field label="开仓价格" value={form.open_price} onChange={v => handleFieldChange('open_price', v)} type="number" />
              <Field label="手数" value={form.lot_size} onChange={v => handleFieldChange('lot_size', v)} type="number" />
              <Field label="手续费" value={form.commission} onChange={v => handleFieldChange('commission', v)} type="number" />
              <Field label="平仓价格" value={form.close_price} onChange={v => handleFieldChange('close_price', v)} type="number" />
              <Field label="盈亏（自动计算）" value={form.pnl} readOnly placeholder="填平仓价自动计算" />
              <Field label="开仓时间" value={form.open_time} onChange={v => handleFieldChange('open_time', v)} placeholder="00:00:00" />
              <Field label="平仓时间" value={form.close_time} onChange={v => handleFieldChange('close_time', v)} placeholder="00:00:00" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>备注</label>
              <input value={form.remark} onChange={e => handleFieldChange('remark', e.target.value)} placeholder="可选备注" style={S.input} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button style={S.btnSecondary} onClick={() => setShowForm(false)}>取消</button>
              <button style={S.btnPrimary} onClick={handleSave}>{editingId ? '保存修改' : '新增'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)', borderRadius: 'var(--radius-lg)', padding: 28, width: 420 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>确认删除</h3>
            <p style={{ color: 'var(--color-ink-muted)', fontSize: 15, marginBottom: 16 }}>此操作不可撤销，确定要删除此交易记录吗？</p>
            <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 20, fontSize: 14 }}>
              <div className="flex justify-between py-1"><span style={{ color: 'var(--color-ink-subtle)' }}>品种</span><span style={{ color: 'var(--color-ink)' }}>{deleteConfirm.instrument}</span></div>
              <div className="flex justify-between py-1"><span style={{ color: 'var(--color-ink-subtle)' }}>类型</span><span style={{ color: deleteConfirm.order_type === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>{deleteConfirm.order_type === 'buy' ? '做多' : '做空'}</span></div>
              <div className="flex justify-between py-1"><span style={{ color: 'var(--color-ink-subtle)' }}>开仓价</span><span className="font-mono" style={{ color: 'var(--color-ink)' }}>{parseFloat(deleteConfirm.open_price).toFixed(2)}</span></div>
              <div className="flex justify-between py-1"><span style={{ color: 'var(--color-ink-subtle)' }}>日期</span><span style={{ color: 'var(--color-ink-muted)' }}>{deleteConfirm.trade_date}</span></div>
            </div>
            <div className="flex justify-end gap-3">
              <button style={S.btnSecondary} onClick={() => setDeleteConfirm(null)}>取消</button>
              <button style={{ background: 'var(--color-danger)', color: '#fff', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 15 }} onClick={handleDelete}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Calculator Tab — 交易计算
   ═══════════════════════════════════════ */
function CalculatorTab({ showToast }) {
  const [positions, setPositions] = useState([{ instrument: 'XAUUSD', order_type: 'buy', open_price: '', lot_size: '0.01', close_price: '' }]);
  const [shared, setShared] = useState({ leverage: '500', balance: '', forced_liquidation_ratio: '0.5' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const CALC_KEY = 'forex_calc';
  const CONTRACTS = { XAUUSD: { name: '黄金/美元', units: 100 }, XAGUSD: { name: '白银/美元', units: 5000 }, EURUSD: { name: '欧元/美元', units: 100000 }, GBPUSD: { name: '英镑/美元', units: 100000 }, USDJPY: { name: '美元/日元', units: 1000 } };

  useEffect(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem(CALC_KEY)); } catch {} })();
    if (saved) { setPositions(saved.positions); setShared(saved.shared); setResult(saved.result); }
  }, []);

  useEffect(() => {
    localStorage.setItem(CALC_KEY, JSON.stringify({ positions, shared, result }));
  }, [positions, shared, result]);

  const updatePos = (idx, key, value) => setPositions(prev => prev.map((p, i) => i === idx ? { ...p, [key]: value } : p));
  const addPos = () => setPositions(prev => [...prev, { instrument: 'XAUUSD', order_type: 'buy', open_price: '', lot_size: '0.01', close_price: '' }]);
  const removePos = (idx) => { if (positions.length > 1) setPositions(prev => prev.filter((_, i) => i !== idx)); };

  const handleCompute = async () => {
    setError('');
    setLoading(true);
    try {
      const body = {
        positions: positions.map(p => ({
          instrument: p.instrument, order_type: p.order_type,
          open_price: parseFloat(p.open_price) || 0, lot_size: parseFloat(p.lot_size) || 0,
          close_price: p.close_price ? parseFloat(p.close_price) : null,
        })),
        leverage: parseFloat(shared.leverage) || 500,
        balance: parseFloat(shared.balance) || 0,
        forced_liquidation_ratio: parseFloat(shared.forced_liquidation_ratio) || 0.5,
      };
      const res = await fetch('/api/calculator/compute-multi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) { setResult(data); } else { setError(data.error || '计算失败'); setResult(null); }
    } catch { setError('网络请求失败，使用本地计算'); setResult(null); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Parameters */}
        <div className="space-y-4">
          {/* Account params */}
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 14 }}>账户参数</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="杠杆倍数" value={shared.leverage} onChange={v => setShared(p => ({ ...p, leverage: v }))} type="number" />
              <div>
                <label style={S.label}>账户余额 ($)</label>
                <div style={{ display: 'flex', gap: 0 }}>
                  <input type="number" value={shared.balance} onChange={e => setShared(p => ({ ...p, balance: e.target.value }))}
                    style={{ ...S.input, borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }} />
                  <button onClick={() => {
                    fetch('/api/stats/overview').then(r => r.json()).then(d => {
                      if (d.capital?.equity) setShared(p => ({ ...p, balance: String(Math.round(d.capital.equity * 100) / 100) }));
                    }).catch(() => showToast('无法获取净值', 'error'));
                  }} style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderLeft: 'none', borderRadius: 'var(--radius-md)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="强平比例" value={shared.forced_liquidation_ratio} onChange={v => setShared(p => ({ ...p, forced_liquidation_ratio: v }))} type="number" />
            </div>
          </div>

          {/* Positions */}
          <div style={S.card}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>仓位列表</h3>
              <button style={S.btnGhost} onClick={addPos}>+ 添加仓位</button>
            </div>
            <div className="space-y-3">
              {positions.map((p, idx) => (
                <div key={idx} style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 12, color: 'var(--color-ink-tertiary)', fontFamily: 'monospace' }}>仓位 #{idx + 1}</span>
                    {positions.length > 1 && <button style={S.btnDanger} onClick={() => removePos(idx)}>删除</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="品种" value={p.instrument} onChange={v => updatePos(idx, 'instrument', v)} options={Object.entries(CONTRACTS).map(([k, v]) => ({ value: k, label: v.name }))} />
                    <Select label="方向" value={p.order_type} onChange={v => updatePos(idx, 'order_type', v)} options={[{ value: 'buy', label: '做多 Buy' }, { value: 'sell', label: '做空 Sell' }]} />
                    <Field label="开仓价格" value={p.open_price} onChange={v => updatePos(idx, 'open_price', v)} type="number" />
                    <Field label="手数" value={p.lot_size} onChange={v => updatePos(idx, 'lot_size', v)} type="number" />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Field label="平仓价格（可选）" value={p.close_price} onChange={v => updatePos(idx, 'close_price', v)} type="number" />
                  </div>
                </div>
              ))}
            </div>
            <button style={{ ...S.btnPrimary, width: '100%', marginTop: 14 }} onClick={handleCompute} disabled={loading}>
              {loading ? '计算中...' : `计算 ${positions.length} 个仓位`}
            </button>
            {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-md)', fontSize: 14, background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)' }}>{error}</div>}
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {result && result.summary ? (
            <div style={S.card}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 14 }}>汇总结果</h3>
              <div className="space-y-2">
                <Row label="仓位数量" value={`${result.summary.position_count || 0} 个`} />
                <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 10 }}>
                  <Row label="总合约价值" value={`$${(result.summary.total_contract_value || 0).toLocaleString()}`} />
                  <Row label="总保证金" value={`$${(result.summary.total_margin || 0).toLocaleString()}`} highlight />
                  <Row label="账户余额" value={`$${(result.summary.balance || 0).toLocaleString()}`} />
                  <Row label="净值" value={`$${(result.summary.equity || 0).toLocaleString()}`} />
                  <Row label="保证金比例" value={`${result.summary.margin_ratio || 0}%`} color={result.summary.margin_ratio > 200 ? 'var(--color-success)' : 'var(--color-danger)'} />
                </div>
                {result.summary.total_pnl != null && (
                  <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 10 }}>
                    <Row label="总预计盈亏" value={`$${result.summary.total_pnl}`} color={result.summary.total_pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} highlight />
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>爆仓分析</div>
                  <Row label="爆仓净值阈值" value={`$${(result.summary.fl_threshold || 0).toLocaleString()}`} color="var(--color-danger)" />
                  <Row label="可承受亏损" value={`$${(result.summary.available_loss || 0).toLocaleString()}`} color={result.summary.available_loss > 0 ? 'var(--color-success)' : 'var(--color-danger)'} highlight />
                  <Row label="风险评级" value={result.summary.risk_level || '--'} color={result.summary.risk_level === '安全' ? 'var(--color-success)' : result.summary.risk_level === '正常' ? 'var(--color-primary)' : 'var(--color-danger)'} />
                </div>
              </div>
            </div>
          ) : (
            <div style={S.card}>
              <div className="flex items-center justify-center h-48" style={{ color: 'var(--color-ink-subtle)', fontSize: 15 }}>
                添加仓位并点击计算查看结果
              </div>
            </div>
          )}

          {/* Contract specs */}
          <div style={S.card}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 14 }}>合约规格</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {Object.entries(CONTRACTS).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{v.name}</span>
                  <span style={{ color: 'var(--color-ink-muted)' }}>{v.units.toLocaleString()} 单位/手</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color, highlight }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span style={{ color: 'var(--color-ink-subtle)', fontSize: 14 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: highlight ? 700 : 500, fontSize: highlight ? 17 : 14, color: color || 'var(--color-ink)' }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════
   Capital Tab — 出入金
   ═══════════════════════════════════════ */
function CapitalTab({ data, setData, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ flow_date: today(), flow_type: 'deposit', amount: '', remark: '' });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const capitals = useMemo(() => [...(data.capitals || [])].sort((a, b) => b.id - a.id), [data.capitals]);
  const totalPages = Math.max(1, Math.ceil(capitals.length / pageSize));
  const paged = capitals.slice((page - 1) * pageSize, page * pageSize);

  const summary = useMemo(() => {
    const deposits = capitals.filter(c => c.flow_type === 'deposit').reduce((s, c) => s + (c.amount || 0), 0);
    const withdrawals = capitals.filter(c => c.flow_type === 'withdrawal').reduce((s, c) => s + (c.amount || 0), 0);
    return { deposits, withdrawals, net: deposits - withdrawals };
  }, [capitals]);

  const openCreate = () => { setForm({ flow_date: today(), flow_type: 'deposit', amount: '', remark: '' }); setEditingId(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ flow_date: c.flow_date, flow_type: c.flow_type, amount: String(c.amount), remark: c.remark || '' }); setEditingId(c.id); setShowForm(true); };

  const handleSave = () => {
    if (!form.flow_date || !form.amount) { showToast('请填写必填字段', 'error'); return; }
    const entry = { flow_date: form.flow_date, flow_type: form.flow_type, amount: parseFloat(form.amount) || 0, remark: form.remark || '' };
    if (editingId) {
      setData(prev => ({ ...prev, capitals: prev.capitals.map(c => c.id === editingId ? { ...c, ...entry } : c) }));
      showToast('记录已更新');
    } else {
      setData(prev => ({ ...prev, capitals: [{ id: prev.capitalIdCounter, ...entry }, ...prev.capitals], capitalIdCounter: prev.capitalIdCounter + 1 }));
      showToast('记录已添加');
    }
    setShowForm(false);
  };

  const handleDelete = (id) => {
    setData(prev => ({ ...prev, capitals: prev.capitals.filter(c => c.id !== id) }));
    showToast('记录已删除');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span style={{ color: 'var(--color-ink-muted)', fontSize: 15 }}>管理账户存取款</span>
        </div>
        <button style={S.btnPrimary} onClick={openCreate}>+ 新增记录</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="累计入金" value={`$${summary.deposits.toFixed(2)}`} color="var(--color-success)" />
        <StatCard label="累计出金" value={`$${summary.withdrawals.toFixed(2)}`} color="var(--color-danger)" />
        <StatCard label="净入金" value={`$${summary.net.toFixed(2)}`} color={summary.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
      </div>

      {/* Form */}
      {showForm && (
        <div style={S.cardTight}>
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="日期" value={form.flow_date} onChange={v => setForm(f => ({ ...f, flow_date: v }))} width={130} />
            <Select label="类型" value={form.flow_type} onChange={v => setForm(f => ({ ...f, flow_type: v }))} width={120} options={[
              { value: 'deposit', label: '入金' }, { value: 'withdrawal', label: '出金' },
            ]} />
            <Field label="金额 ($)" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} type="number" width={150} />
            <Field label="备注" value={form.remark} onChange={v => setForm(f => ({ ...f, remark: v }))} width={180} />
            <button style={S.btnPrimary} onClick={handleSave}>{editingId ? '保存修改' : '保存'}</button>
            <button style={S.btnSecondary} onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: 'auto' }}>
        <table className="w-full" style={{ fontSize: 15 }}>
          <thead>
            <tr style={{ color: 'var(--color-ink-subtle)', borderBottom: '1px solid var(--color-hairline)' }}>
              <th className="text-left py-3 px-4 font-medium">日期</th>
              <th className="text-left py-3 px-4 font-medium">类型</th>
              <th className="text-right py-3 px-4 font-medium">金额</th>
              <th className="text-left py-3 px-4 font-medium">备注</th>
              <th className="text-right py-3 px-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12" style={{ color: 'var(--color-ink-subtle)' }}>暂无出入金记录</td></tr>
            ) : (
              paged.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                  <td className="py-3 px-4" style={{ color: 'var(--color-ink-muted)' }}>{c.flow_date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-[13px] font-medium" style={{
                      background: c.flow_type === 'deposit' ? 'color-mix(in srgb, var(--color-success) 18%, transparent)' : 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
                      color: c.flow_type === 'deposit' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>{c.flow_type === 'deposit' ? '入金' : '出金'}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-[16px]" style={{ color: c.flow_type === 'deposit' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {c.flow_type === 'deposit' ? '+' : '-'}${(c.amount || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--color-ink-subtle)' }}>{c.remark || '-'}</td>
                  <td className="py-3 px-4 text-right">
                    <button style={S.btnGhost} onClick={() => openEdit(c)}>编辑</button>
                    <button style={S.btnDanger} onClick={() => handleDelete(c.id)}>删除</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {capitals.length > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page <= 1 ? 0.4 : 1 }} disabled={page <= 1} onClick={() => setPage(1)}>首页</button>
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page <= 1 ? 0.4 : 1 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span style={{ color: 'var(--color-ink-muted)', fontSize: 15 }}>第 {page} / {totalPages} 页</span>
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page >= totalPages ? 0.4 : 1 }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
          <button style={{ ...S.btnSecondary, padding: '8px 14px', fontSize: 14, opacity: page >= totalPages ? 0.4 : 1 }} disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</button>
        </div>
      )}
    </div>
  );
}
