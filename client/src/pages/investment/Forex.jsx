import { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

/* ═══════════════════════════════════════
   Constants & helpers
   ═══════════════════════════════════════ */
const CARD = { backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: '28px' };
const CARD_STAT = { backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' };
const BTN_PRIMARY = { backgroundColor: 'var(--color-primary)', color: '#ffffff', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 15 };
const BTN_SECONDARY = { backgroundColor: 'var(--color-surface-1)', color: 'var(--color-ink)', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: '1px solid var(--color-hairline)', cursor: 'pointer', fontSize: 15 };
const BTN_GHOST = { backgroundColor: 'transparent', color: 'var(--color-primary)', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '8px 14px', border: '1px solid transparent', cursor: 'pointer', fontSize: 14 };

const today = () => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rfloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const STORAGE_KEY = 'lifeos_forex_data';

/* ═══════════════════════════════════════
   Seed mock data
   ═══════════════════════════════════════ */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }
  let tradeId = 1, capitalId = 1;
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
  return { trades, capitals: [
    { id: capitalId++, flow_date: today(), flow_type: 'deposit', amount: 10000, remark: '初始入金' },
    { id: capitalId++, flow_date: today(), flow_type: 'withdrawal', amount: 2000, remark: '部分出金' },
  ], tradeIdCounter: tradeId, capitalIdCounter: capitalId };
}

/* ═══════════════════════════════════════
   Main
   ═══════════════════════════════════════ */
export default function Forex() {
  const [data, setData] = useState(seedMock);
  const [tab, setTab] = useState('overview');
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  const TABS = [
    { key: 'overview', label: '统计分析' },
    { key: 'trades', label: '交易记录' },
    { key: 'calculator', label: '交易计算' },
    { key: 'capital', label: '资金管理' },
  ];
  return (
    <div>
      <h1 className="page-title">外汇市场</h1>
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '6px 18px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              backgroundColor: tab === t.key ? 'var(--color-surface-2)' : 'var(--color-canvas)',
              color: tab === t.key ? 'var(--color-ink)' : 'var(--color-ink-subtle)',
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        {tab === 'overview' && <OverviewTab data={data} setData={setData} />}
        {tab === 'trades' && <TradesTab data={data} setData={setData} />}
        {tab === 'calculator' && <CalculatorTab />}
        {tab === 'capital' && <CapitalTab data={data} setData={setData} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Shared components
   ═══════════════════════════════════════ */
function StatCard({ label, value, prefix, color }) {
  const num = typeof value === 'number' ? value : NaN;
  const displayValue = typeof value === 'number'
    ? (prefix || '') + (prefix ? num.toFixed(2) : num.toLocaleString())
    : value;
  return (
    <div style={CARD_STAT}>
      <div className="text-[14px] mb-1.5" style={{ color: 'var(--color-ink-subtle)' }}>{label}</div>
      <div className="text-2xl font-semibold font-mono tracking-tight" style={{ color: color || 'var(--color-ink)' }}>{displayValue}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder, readOnly, width, hint }) {
  const isLocked = readOnly;
  return (
    <div style={width ? { width } : undefined}>
      <label className="block text-[13px] mb-1.5" style={{ color: isLocked ? 'var(--color-ink-tertiary)' : 'var(--color-ink-subtle)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full"
        step={type === 'number' ? 'any' : undefined} readOnly={readOnly}
        style={isLocked ? { cursor: 'default', backgroundColor: 'var(--color-surface-1)', color: value ? 'var(--color-ink)' : 'var(--color-ink-tertiary)', borderStyle: 'dashed', userSelect: 'none' } : undefined} />
      {hint && <span className="block text-[11px] mt-1" style={{ color: 'var(--color-ink-tertiary)' }}>{hint}</span>}
    </div>
  );
}

function FormSelect({ label, value, onChange, options, width }) {
  return (
    <div style={width ? { width } : undefined}>
      <label className="block text-[13px] mb-1.5" style={{ color: 'var(--color-ink-subtle)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Pagination({ page, totalPages, totalItems, onPageChange }) {
  const [jumpInput, setJumpInput] = useState('');
  const btn = (disabled) => ({ ...BTN_SECONDARY, padding: '8px 14px', fontSize: 14, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' });
  const doJump = () => { const p = parseInt(jumpInput, 10); if (p >= 1 && p <= totalPages) { onPageChange(p); setJumpInput(''); } };
  return (
    <div className="flex items-center justify-center gap-2">
      <button style={btn(page <= 1)} disabled={page <= 1} onClick={() => onPageChange(1)}>首页</button>
      <button style={btn(page <= 1)} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button>
      <span className="text-[15px]" style={{ color: 'var(--color-ink-muted)' }}>第 {page} / {totalPages} 页{totalItems != null ? `（共 ${totalItems} 条）` : ''}</span>
      <button style={btn(page >= totalPages)} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
      <button style={btn(page >= totalPages)} disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>末页</button>
      <span className="text-[14px]" style={{ color: 'var(--color-ink-subtle)' }}>跳转</span>
      <input type="number" value={jumpInput} onChange={e => setJumpInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doJump(); }}
        min={1} max={totalPages} style={{ width: 56, textAlign: 'center', padding: '8px 6px', fontSize: 14 }} />
      <button style={{ ...BTN_SECONDARY, padding: '8px 12px', fontSize: 14 }} onClick={doJump}>GO</button>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className="fixed bottom-8 right-8 z-50 animate-bounce" style={{
      backgroundColor: toast.type === 'success' ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-surface-2))' : 'color-mix(in srgb, var(--color-danger) 20%, var(--color-surface-2))',
      border: `1px solid ${toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
      borderRadius: 'var(--radius-md)', padding: '14px 22px', maxWidth: '360px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div className="flex items-center gap-3">
        {toast.type === 'success' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
        )}
        <span className="text-[15px] font-medium" style={{ color: 'var(--color-ink)' }}>{toast.message}</span>
      </div>
    </div>
  );
}

function DeleteModal({ title, onCancel, onConfirm, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '440px' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className="text-[20px] font-semibold mb-2 tracking-[-0.4px]" style={{ color: 'var(--color-ink)' }}>确认删除</h3>
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: 'var(--color-ink-muted)' }}>{title}</p>
        {children}
        <div className="flex justify-end gap-3 mt-6">
          <button style={BTN_SECONDARY} onClick={onCancel}>取消</button>
          <button style={{ backgroundColor: 'var(--color-danger)', color: '#ffffff', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 15 }} onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Tab 1: 统计分析 — full Dashboard layout
   ═══════════════════════════════════════ */
function OverviewTab({ data }) {
  const trades = data.trades || [];
  const capitals = data.capitals || [];

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter(t => parseFloat(t.pnl) > 0).length;
    const losses = trades.filter(t => parseFloat(t.pnl) < 0).length;
    const totalPnl = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);
    const totalCommission = trades.reduce((s, t) => s + (Math.abs(parseFloat(t.commission)) || 0), 0);
    const buys = trades.filter(t => t.order_type === 'buy').length;
    const sells = trades.filter(t => t.order_type === 'sell').length;
    const avgWin = wins > 0 ? trades.filter(t => parseFloat(t.pnl) > 0).reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => parseFloat(t.pnl) < 0).reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0) / losses) : 0;
    return { total, wins, losses, totalPnl, totalCommission, buys, sells, winRate: total > 0 ? (wins / total * 100).toFixed(1) : '0.0', profitLossRatio: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '--' };
  }, [trades]);

  const dailyPnl = useMemo(() => {
    const map = {};
    trades.forEach(t => { map[t.trade_date] = (map[t.trade_date] || 0) + (parseFloat(t.pnl) || 0); });
    return Object.entries(map).map(([date, pnl]) => ({ trade_date: date, total_pnl: Math.round(pnl * 100) / 100 })).sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  }, [trades]);

  const byInstrument = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      if (!map[t.instrument]) map[t.instrument] = { cnt: 0, totalPnl: 0, wins: 0 };
      map[t.instrument].cnt++; map[t.instrument].totalPnl += parseFloat(t.pnl) || 0;
      if (parseFloat(t.pnl) > 0) map[t.instrument].wins++;
    });
    return Object.entries(map).map(([k, v]) => ({ instrument: k, ...v, avgPnl: v.cnt > 0 ? v.totalPnl / v.cnt : 0, winRate: v.cnt > 0 ? ((v.wins / v.cnt) * 100).toFixed(0) : '0' }));
  }, [trades]);

  const winRateData = [{ name: '盈利', value: stats.wins, color: 'var(--color-success)' }, { name: '亏损', value: stats.losses, color: 'var(--color-danger)' }];

  const capSummary = useMemo(() => {
    const deposits = capitals.filter(c => c.flow_type === 'deposit').reduce((s, c) => s + (c.amount || 0), 0);
    const withdrawals = capitals.filter(c => c.flow_type === 'withdrawal').reduce((s, c) => s + (c.amount || 0), 0);
    const net = deposits - withdrawals;
    const equity = net + stats.totalPnl;
    const roi = deposits > 0 ? ((equity - deposits) / deposits * 100).toFixed(1) : '0.0';
    return { deposits, withdrawals, net, equity, roi };
  }, [capitals, stats.totalPnl]);

  return (
    <div className="space-y-8">
      {/* Row 1: 8 stat cards (4x2 grid) */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard label="总交易笔数" value={stats.total} />
        <StatCard label="净盈亏" value={stats.totalPnl} prefix="$" color={stats.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="胜率" value={`${stats.winRate}%`} color={parseFloat(stats.winRate) >= 50 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="手续费" value={stats.totalCommission} prefix="$" />
        <StatCard label="盈利笔数" value={stats.wins} />
        <StatCard label="亏损笔数" value={stats.losses} />
        <StatCard label="做多笔数" value={stats.buys} />
        <StatCard label="做空笔数" value={stats.sells} />
      </div>

      {/* Row 2: 5 capital cards */}
      <div className="grid grid-cols-5 gap-5">
        <StatCard label="累计入金" value={capSummary.deposits} prefix="$" />
        <StatCard label="累计出金" value={capSummary.withdrawals} prefix="$" />
        <StatCard label="净入金" value={capSummary.net} prefix="$" color={capSummary.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="当前净值" value={capSummary.equity} prefix="$" color={capSummary.equity >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
        <StatCard label="收益率" value={`${capSummary.roi}%`} color={parseFloat(capSummary.roi) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} />
      </div>

      {/* Row 3: Charts (2 columns) */}
      <div className="grid grid-cols-2 gap-6">
        <div style={CARD}>
          <h3 className="text-[18px] font-medium mb-5" style={{ color: 'var(--color-ink)' }}>每日盈亏曲线</h3>
          {dailyPnl.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyPnl}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                <XAxis dataKey="trade_date" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)', borderRadius: '8px', color: 'var(--color-ink)', fontSize: 14 }} formatter={(v) => [`$${v}`, '盈亏']} />
                <Line type="monotone" dataKey="total_pnl" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-[15px] py-12 text-center" style={{ color: 'var(--color-ink-subtle)' }}>暂无数据</p>}
        </div>
        <div style={CARD}>
          <h3 className="text-[18px] font-medium mb-5" style={{ color: 'var(--color-ink)' }}>盈亏分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={winRateData} cx="50%" cy="50%" innerRadius={75} outerRadius={110} paddingAngle={4} dataKey="value">
                {winRateData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)', borderRadius: '8px', color: 'var(--color-ink)', fontSize: 14 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-8 mt-3">
            <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} /><span className="text-[15px]" style={{ color: 'var(--color-ink-muted)' }}>盈利 {stats.wins} 笔</span></div>
            <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: 'var(--color-danger)' }} /><span className="text-[15px]" style={{ color: 'var(--color-ink-muted)' }}>亏损 {stats.losses} 笔</span></div>
            <div className="flex items-center gap-2.5">
              <span className="text-[14px]" style={{ color: 'var(--color-ink-tertiary)' }}>盈亏比</span>
              <span className="text-[15px] font-semibold font-mono" style={{ color: parseFloat(stats.profitLossRatio) >= 1 ? 'var(--color-success)' : 'var(--color-danger)' }}>{stats.profitLossRatio}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instrument analysis table */}
      {byInstrument.length > 0 && (
        <div style={CARD}>
          <h3 className="text-[18px] font-medium mb-5" style={{ color: 'var(--color-ink)' }}>品种分析</h3>
          <table className="w-full text-[15px]">
            <thead><tr style={{ color: 'var(--color-ink-subtle)', borderBottom: '1px solid var(--color-hairline)' }}>
              <th className="text-left py-3 font-medium">品种</th><th className="text-right py-3 font-medium">笔数</th><th className="text-right py-3 font-medium">总盈亏</th><th className="text-right py-3 font-medium">均盈</th><th className="text-right py-3 font-medium">胜率</th>
            </tr></thead>
            <tbody>{byInstrument.map(item => (
              <tr key={item.instrument} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                <td className="py-3 text-[16px] font-medium" style={{ color: 'var(--color-ink)' }}>{item.instrument}</td>
                <td className="py-3 text-right" style={{ color: 'var(--color-ink-muted)' }}>{item.cnt}</td>
                <td className="py-3 text-right font-mono text-[16px] font-medium" style={{ color: item.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>${item.totalPnl.toFixed(2)}</td>
                <td className="py-3 text-right font-mono" style={{ color: 'var(--color-ink-muted)' }}>${item.avgPnl.toFixed(2)}</td>
                <td className="py-3 text-right" style={{ color: 'var(--color-ink-muted)' }}>{item.winRate}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* AI Analysis */}
      <div style={CARD}>
        <div className="flex items-center gap-2 mb-5">
          <h3 className="text-[18px] font-medium" style={{ color: 'var(--color-ink)' }}>AI 智能分析</h3>
          <span className="text-[12px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>DeepSeek</span>
        </div>
        <p className="text-[14px] mb-5" style={{ color: 'var(--color-ink-muted)' }}>选择日期范围，由 AI 根据交易记录进行多维度分析（仅在你手动点击后触发）</p>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="起始日期 (yyyy/mm/dd)" style={{ width: 160 }} />
          <span style={{ color: 'var(--color-ink-subtle)' }}>—</span>
          <input type="text" placeholder="结束日期 (yyyy/mm/dd)" style={{ width: 160 }} />
          <button style={BTN_PRIMARY} disabled>开始分析</button>
        </div>
        <p className="text-[13px] mt-3" style={{ color: 'var(--color-ink-tertiary)' }}>AI 分析仅在你手动点击后触发，可手动指定分析的时间范围</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Tab 2: 交易记录 — Trades pattern
   ═══════════════════════════════════════ */
function TradesTab({ data, setData }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ instrument: '', order_type: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const pageSize = 15;

  const showToast = (type, msg) => { setToast({ type, message: msg }); setTimeout(() => setToast(null), 3000); };

  const trades = useMemo(() => {
    let list = [...(data.trades || [])];
    if (filter.instrument) list = list.filter(t => t.instrument === filter.instrument);
    if (filter.order_type) list = list.filter(t => t.order_type === filter.order_type);
    return list.sort((a, b) => b.id - a.id);
  }, [data.trades, filter]);

  useEffect(() => { setPage(1); }, [filter.instrument, filter.order_type]);

  const totalPages = Math.max(1, Math.ceil(trades.length / pageSize));
  const paged = trades.slice((page - 1) * pageSize, page * pageSize);

  const getUnits = (inst) => inst === 'XAGUSD' ? 5000 : inst === 'EURUSD' || inst === 'GBPUSD' ? 100000 : inst === 'USDJPY' ? 1000 : 100;

  const calcPnl = (type, open, close, lot, inst) => {
    const o = parseFloat(open), c = parseFloat(close), l = parseFloat(lot);
    if (isNaN(o) || isNaN(c) || isNaN(l) || l <= 0) return '';
    return String(Math.round((type === 'buy' ? (c - o) : (o - c)) * l * getUnits(inst) * 100) / 100);
  };
  const calcComm = (lot) => { const n = parseFloat(lot); return isNaN(n) || n <= 0 ? '0' : String(Math.round(-n * 6 * 100) / 100); };

  const emptyForm = () => ({ trade_date: today(), instrument: 'XAUUSD', order_type: 'buy', open_price: '', lot_size: '0.01', commission: '-0.06', close_price: '', pnl: '', open_time: '', close_time: '', hold_time: '', remark: '' });

  const openCreate = () => { setForm(emptyForm()); setEditingId(null); setShowForm(true); };
  const openEdit = (t) => { setForm({ trade_date: t.trade_date, instrument: t.instrument, order_type: t.order_type, open_price: t.open_price, lot_size: t.lot_size, commission: t.commission, close_price: t.close_price || '', pnl: t.pnl || '', open_time: t.open_time || '', close_time: t.close_time || '', hold_time: t.hold_time || '', remark: t.remark || '' }); setEditingId(t.id); setShowForm(true); };

  const updateForm = (key, value) => {
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === 'lot_size') next.commission = calcComm(value);
      if (['order_type', 'open_price', 'close_price', 'lot_size', 'instrument'].includes(key))
        next.pnl = calcPnl(key === 'order_type' ? value : next.order_type, key === 'open_price' ? value : next.open_price, key === 'close_price' ? value : next.close_price, key === 'lot_size' ? value : next.lot_size, key === 'instrument' ? value : next.instrument);
      return next;
    });
  };

  const handleSave = () => {
    if (!form.trade_date || !form.open_price) { showToast('error', '请填写必填字段'); return; }
    const entry = { trade_date: form.trade_date, instrument: form.instrument, order_type: form.order_type, open_price: form.open_price, lot_size: form.lot_size, commission: form.commission || '0', close_price: form.close_price || '', pnl: form.pnl || '', open_time: form.open_time || '', close_time: form.close_time || '', hold_time: form.hold_time || '', remark: form.remark || '' };
    if (editingId) { setData(p => ({ ...p, trades: p.trades.map(t => t.id === editingId ? { ...t, ...entry } : t) })); }
    else { setData(p => ({ ...p, trades: [{ id: p.tradeIdCounter, ...entry }, ...p.trades], tradeIdCounter: p.tradeIdCounter + 1 })); }
    setShowForm(false); showToast('success', editingId ? '记录更新成功' : '记录新增成功');
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setData(p => ({ ...p, trades: p.trades.filter(t => t.id !== deleteConfirm.id) }));
    showToast('success', '记录已删除'); setDeleteConfirm(null);
  };

  const handleFile = (file) => {
    if (!file || !['csv', 'xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) { alert('仅支持 .csv / .xlsx / .xls 文件'); return; }
    setImporting(true);
    setTimeout(() => { setImporting(false); showToast('success', '导入完成（模拟）'); }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <select value={filter.instrument} onChange={e => setFilter(f => ({ ...f, instrument: e.target.value }))}>
            <option value="">全部品种</option>
            <option value="XAUUSD">XAUUSD 黄金</option><option value="XAGUSD">XAGUSD 白银</option><option value="EURUSD">EURUSD 欧元</option><option value="GBPUSD">GBPUSD 英镑</option><option value="USDJPY">USDJPY 日元</option>
          </select>
          <select value={filter.order_type} onChange={e => setFilter(f => ({ ...f, order_type: e.target.value }))}>
            <option value="">全部类型</option><option value="buy">做多 (Buy)</option><option value="sell">做空 (Sell)</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button style={BTN_GHOST}>下载模板</button>
          <button style={BTN_SECONDARY} onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? '导入中...' : '导入数据'}</button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
          <button style={BTN_PRIMARY} onClick={openCreate}>+ 新增记录</button>
        </div>
      </div>

      {/* Drag import zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-hairline-strong)'}`, borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center', backgroundColor: dragOver ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--color-surface-1)', transition: 'all 0.2s ease', cursor: 'pointer' }}
      >
        <p className="text-[15px]" style={{ color: 'var(--color-ink-muted)' }}><span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>点击上传</span> 或将 Excel/CSV 文件拖拽至此</p>
        <p className="text-[13px] mt-1" style={{ color: 'var(--color-ink-tertiary)' }}>支持 .xlsx / .xls / .csv 格式，请使用标准模板</p>
      </div>

      {/* Table */}
      <div style={{ ...CARD, padding: 0, overflow: 'auto' }}>
        <table className="w-full" style={{ minWidth: 1200, fontSize: 15 }}>
          <thead><tr style={{ color: 'var(--color-ink-subtle)', borderBottom: '1px solid var(--color-hairline)' }}>
            {['ID', '日期', '品种', '类型', '开仓价', '手数', '手续费', '平仓价', '盈亏', '开仓时间', '平仓时间', '持仓', '备注', '操作'].map(h => (
              <th key={h} className="text-left py-3.5 px-4 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {paged.length === 0 ? <tr><td colSpan={14} className="text-center py-12" style={{ color: 'var(--color-ink-subtle)' }}>暂无交易记录</td></tr> : paged.map(t => {
              const pnl = parseFloat(t.pnl);
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-hairline)' }} className="hover:brightness-110">
                  <td className="py-3 px-4 font-mono text-[13px]" style={{ color: 'var(--color-ink-tertiary)' }}>{t.id}</td>
                  <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'var(--color-ink-muted)' }}>{t.trade_date}</td>
                  <td className="py-3 px-4 font-medium text-[16px]" style={{ color: 'var(--color-ink)' }}>{t.instrument}</td>
                  <td className="py-3 px-4"><span className="px-2.5 py-1 rounded-full text-[13px] font-medium" style={{ backgroundColor: t.order_type === 'buy' ? 'color-mix(in srgb, var(--color-success) 20%, transparent)' : 'color-mix(in srgb, var(--color-danger) 20%, transparent)', color: t.order_type === 'buy' ? 'var(--color-success)' : 'var(--color-danger)' }}>{t.order_type === 'buy' ? '做多' : '做空'}</span></td>
                  <td className="py-3 px-4 font-mono text-[15px]" style={{ color: 'var(--color-ink)' }}>{parseFloat(t.open_price).toFixed(2)}</td>
                  <td className="py-3 px-4 font-mono" style={{ color: 'var(--color-ink-muted)' }}>{parseFloat(t.lot_size).toFixed(2)}</td>
                  <td className="py-3 px-4 font-mono" style={{ color: parseFloat(t.commission) < 0 ? 'var(--color-danger)' : 'var(--color-ink-muted)' }}>{t.commission}</td>
                  <td className="py-3 px-4 font-mono" style={{ color: 'var(--color-ink-muted)' }}>{t.close_price ? parseFloat(t.close_price).toFixed(2) : '-'}</td>
                  <td className="py-3 px-4 font-mono font-medium text-[15px]" style={{ color: pnl > 0 ? 'var(--color-success)' : pnl < 0 ? 'var(--color-danger)' : 'var(--color-ink-muted)' }}>{isNaN(pnl) ? '-' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`}</td>
                  <td className="py-3 px-4 text-[14px]" style={{ color: 'var(--color-ink-muted)' }}>{t.open_time || '-'}</td>
                  <td className="py-3 px-4 text-[14px]" style={{ color: 'var(--color-ink-muted)' }}>{t.close_time || '-'}</td>
                  <td className="py-3 px-4 text-[14px]" style={{ color: 'var(--color-ink-muted)' }}>{t.hold_time || '-'}</td>
                  <td className="py-3 px-4 text-[14px]" style={{ color: 'var(--color-ink-subtle)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.remark || '-'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <button style={{ background: 'none', color: 'var(--color-primary)', border: 'none', cursor: 'pointer', fontSize: 14, padding: '4px 10px' }} onClick={() => openEdit(t)}>编辑</button>
                    <button style={{ background: 'none', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', fontSize: 14, padding: '4px 10px' }} onClick={() => setDeleteConfirm(t)}>删除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {trades.length > pageSize && <Pagination page={page} totalPages={totalPages} totalItems={trades.length} onPageChange={setPage} />}

      {/* Form Modal — matching Trades.jsx pattern */}
      {showForm && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditingId(null); } }}>
          <div onMouseDown={e => e.stopPropagation()} style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)', borderRadius: 'var(--radius-lg)', padding: '32px', width: '640px', maxHeight: '85vh', overflow: 'auto' }}>
            <h2 className="text-[22px] font-semibold mb-6 tracking-[-0.4px]" style={{ color: 'var(--color-ink)' }}>{editingId ? '编辑交易记录' : '新增交易记录'}</h2>
            <div className="grid grid-cols-2 gap-5">
              <FormField label="日期" value={form.trade_date} onChange={v => setForm(f => ({ ...f, trade_date: v }))} placeholder="yyyy/mm/dd" />
              <FormSelect label="品种" value={form.instrument} onChange={v => updateForm('instrument', v)} options={INSTRUMENTS.map(i => ({ value: i.value, label: i.value }))} />
              <FormSelect label="类型" value={form.order_type} onChange={v => updateForm('order_type', v)} options={[{ value: 'buy', label: 'buy' }, { value: 'sell', label: 'sell' }]} />
              <FormField label="开仓价格" value={form.open_price} onChange={v => updateForm('open_price', v)} type="number" />
              <FormField label="手数" value={form.lot_size} onChange={v => updateForm('lot_size', v)} type="number" />
              <FormField label="手续费" value={form.commission} onChange={v => setForm(f => ({ ...f, commission: v }))} type="number" />
              <FormField label="平仓价格" value={form.close_price} onChange={v => updateForm('close_price', v)} type="number" />
              <FormField label="盈亏金额（自动）" value={form.pnl} onChange={v => setForm(f => ({ ...f, pnl: v }))} type="number" placeholder="自动计算" readOnly />
              <FormField label="开仓时间" value={form.open_time} onChange={v => setForm(f => ({ ...f, open_time: v }))} placeholder="00:00:00" />
              <FormField label="平仓时间" value={form.close_time} onChange={v => setForm(f => ({ ...f, close_time: v }))} placeholder="00:00:00" />
              <FormField label="持仓时间" value={form.hold_time} onChange={v => setForm(f => ({ ...f, hold_time: v }))} placeholder="自动填充" />
              <div className="col-span-2">
                <label className="block text-[13px] mb-1.5" style={{ color: 'var(--color-ink-subtle)' }}>备注</label>
                <input value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} className="w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-7">
              <button style={BTN_SECONDARY} onClick={() => { setShowForm(false); setEditingId(null); }}>取消</button>
              <button style={BTN_PRIMARY} onClick={handleSave}>{editingId ? '保存修改' : '新增'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <DeleteModal title="此操作不可撤销。确定要删除以下交易记录吗？" onCancel={() => setDeleteConfirm(null)} onConfirm={handleDelete}>
          <div className="p-4 rounded-md text-[14px] space-y-1.5" style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)' }}>
            <Row label="ID" value={`#${deleteConfirm.id}`} mono />
            <Row label="品种" value={deleteConfirm.instrument} bold />
            <Row label="类型" value={deleteConfirm.order_type === 'buy' ? '做多' : '做空'} color={deleteConfirm.order_type === 'buy' ? 'var(--color-success)' : 'var(--color-danger)'} />
            <Row label="开仓价" value={parseFloat(deleteConfirm.open_price).toFixed(2)} mono />
            <Row label="日期" value={deleteConfirm.trade_date} muted />
          </div>
        </DeleteModal>
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}

function Row({ label, value, color, mono, bold, muted }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--color-ink-subtle)' }}>{label}</span>
      <span className={mono ? 'font-mono' : ''} style={{ color: color || (muted ? 'var(--color-ink-muted)' : 'var(--color-ink)'), fontWeight: bold ? 500 : undefined }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════
   Tab 3: 交易计算 — Calculator pattern
   ═══════════════════════════════════════ */
function CalculatorTab() {
  const CONTRACTS = { XAUUSD: { name: '黄金/美元', units: 100, minLot: 0.01, maxLot: 100 }, XAGUSD: { name: '白银/美元', units: 5000, minLot: 0.01, maxLot: 100 }, EURUSD: { name: '欧元/美元', units: 100000, minLot: 0.01, maxLot: 100 }, GBPUSD: { name: '英镑/美元', units: 100000, minLot: 0.01, maxLot: 100 }, USDJPY: { name: '美元/日元', units: 1000, minLot: 0.01, maxLot: 100 } };

  const CK = 'forex_calc';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(CK)); } catch {} })();
  const [positions, setPositions] = useState(saved?.positions || [{ instrument: 'XAUUSD', order_type: 'buy', open_price: '', lot_size: '0.01', close_price: '' }]);
  const [shared, setShared] = useState(saved?.shared || { leverage: '500', balance: '', forced_liquidation_ratio: '0.5' });
  const [result, setResult] = useState(saved?.result || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { localStorage.setItem(CK, JSON.stringify({ positions, shared, result })); }, [positions, shared, result]);
  useEffect(() => { if (shared.balance) return; fetch('/api/stats/overview').then(r => r.json()).then(d => { if (d.capital?.equity) setShared(p => ({ ...p, balance: String(Math.round(d.capital.equity * 100) / 100) })); }).catch(() => {}); }, []);

  const updatePos = (i, k, v) => setPositions(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const addPos = () => setPositions(p => [...p, { instrument: 'XAUUSD', order_type: 'buy', open_price: '', lot_size: '0.01', close_price: '' }]);
  const remPos = (i) => { if (positions.length > 1) setPositions(p => p.filter((_, j) => j !== i)); };

  const handleCompute = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/calculator/compute-multi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positions: positions.map(p => ({ instrument: p.instrument, order_type: p.order_type, open_price: parseFloat(p.open_price) || 0, lot_size: parseFloat(p.lot_size) || 0, close_price: p.close_price ? parseFloat(p.close_price) : null })), leverage: parseFloat(shared.leverage) || 500, balance: parseFloat(shared.balance) || 0, forced_liquidation_ratio: parseFloat(shared.forced_liquidation_ratio) || 0.5 }) });
      const data = await res.json();
      if (res.ok) { setResult(data); } else { setError(data.error || '计算失败'); setResult(null); }
    } catch { setError('网络请求失败'); setResult(null); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div style={CARD}>
            <h3 className="text-[18px] font-medium mb-4" style={{ color: 'var(--color-ink)' }}>账户参数</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="杠杆倍数" value={shared.leverage} onChange={v => setShared(p => ({ ...p, leverage: v }))} type="number" hint="常用: 100/200/500" />
              <div>
                <label className="block text-[13px] mb-1.5" style={{ color: 'var(--color-ink-subtle)' }}>账户余额 ($)</label>
                <div className="flex gap-1.5">
                  <input type="number" value={shared.balance} onChange={e => setShared(p => ({ ...p, balance: e.target.value }))} className="flex-1" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
                  <button onClick={() => { fetch('/api/stats/overview').then(r => r.json()).then(d => { if (d.capital?.equity) setShared(p => ({ ...p, balance: String(Math.round(d.capital.equity * 100) / 100) })); }).catch(() => {}); }} style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-md)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '6px 10px', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                  </button>
                </div>
                <span className="block text-[11px] mt-1" style={{ color: 'var(--color-ink-tertiary)' }}>点击右侧按钮从账户同步最新净值</span>
              </div>
            </div>
            <div className="mt-3"><FormField label="强平比例" value={shared.forced_liquidation_ratio} onChange={v => setShared(p => ({ ...p, forced_liquidation_ratio: v }))} type="number" hint="默认 50%" /></div>
          </div>
          <div style={CARD}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-[18px] font-medium" style={{ color: 'var(--color-ink)' }}>仓位列表</h3><button style={BTN_GHOST} onClick={addPos}>+ 添加仓位</button></div>
            <div className="space-y-3">
              {positions.map((p, i) => (
                <div key={i} className="p-4 rounded-md" style={{ backgroundColor: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
                  <div className="flex items-center justify-between mb-3"><span className="text-[13px] font-mono" style={{ color: 'var(--color-ink-tertiary)' }}>仓位 #{i + 1}</span>{positions.length > 1 && <button style={{ backgroundColor: 'var(--color-danger)', color: '#fff', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 14 }} onClick={() => remPos(i)}>删除</button>}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormSelect label="品种" value={p.instrument} onChange={v => updatePos(i, 'instrument', v)} options={Object.entries(CONTRACTS).map(([k, v]) => ({ value: k, label: v.name }))} />
                    <FormSelect label="方向" value={p.order_type} onChange={v => updatePos(i, 'order_type', v)} options={[{ value: 'buy', label: '做多 Buy' }, { value: 'sell', label: '做空 Sell' }]} />
                    <FormField label="开仓价格" value={p.open_price} onChange={v => updatePos(i, 'open_price', v)} type="number" />
                    <FormField label="手数" value={p.lot_size} onChange={v => updatePos(i, 'lot_size', v)} type="number" />
                  </div>
                  <div className="mt-3"><FormField label="平仓价格（可选）" value={p.close_price} onChange={v => updatePos(i, 'close_price', v)} type="number" hint="填平仓价后可计算各仓位盈亏" /></div>
                </div>
              ))}
            </div>
            <button style={{ ...BTN_PRIMARY, width: '100%', marginTop: '16px' }} onClick={handleCompute} disabled={loading}>{loading ? '计算中...' : `计算 ${positions.length} 个仓位`}</button>
            {error && <div className="mt-3 text-sm p-3 rounded-md" style={{ color: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)' }}>{error}</div>}
          </div>
        </div>
        <div className="space-y-4">
          {result?.summary ? (
            <div style={CARD}>
              <h3 className="text-[18px] font-medium mb-4" style={{ color: 'var(--color-ink)' }}>汇总结果</h3>
              <div className="space-y-3">
                <CalcRow label="仓位数量" value={`${result.summary.position_count || 0} 个`} />
                <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '12px' }}>
                  <CalcRow label="总合约价值" value={`$${(result.summary.total_contract_value || 0).toLocaleString()}`} /><CalcRow label="总保证金" value={`$${(result.summary.total_margin || 0).toLocaleString()}`} highlight />
                  <CalcRow label="账户余额" value={`$${(result.summary.balance || 0).toLocaleString()}`} /><CalcRow label="净值" value={`$${(result.summary.equity || 0).toLocaleString()}`} />
                  <CalcRow label="保证金比例" value={`${result.summary.margin_ratio || 0}%`} color={result.summary.margin_ratio > 1000 ? 'var(--color-success)' : result.summary.margin_ratio > 200 ? 'var(--color-primary)' : 'var(--color-danger)'} highlight />
                </div>
                {result.summary.total_pnl != null && <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '12px' }}><CalcRow label="总预计盈亏" value={`$${result.summary.total_pnl}`} color={result.summary.total_pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} highlight /></div>}
                <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '12px', marginTop: '12px' }}>
                  <div className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-danger)' }}>爆仓分析</div>
                  <CalcRow label="爆仓净值阈值" value={`$${(result.summary.fl_threshold || 0).toLocaleString()}`} color="var(--color-danger)" />
                  <CalcRow label="可承受亏损" value={`$${(result.summary.available_loss || 0).toLocaleString()}`} color={result.summary.available_loss > 0 ? 'var(--color-success)' : 'var(--color-danger)'} highlight />
                  <CalcRow label="风险评级" value={result.summary.risk_level || '--'} color={result.summary.risk_level === '安全' ? 'var(--color-success)' : result.summary.risk_level === '正常' ? 'var(--color-primary)' : 'var(--color-danger)'} highlight />
                </div>
              </div>
            </div>
          ) : (
            <div style={CARD}><div className="flex items-center justify-center h-64" style={{ color: 'var(--color-ink-subtle)' }}><p className="text-[15px]">添加仓位并点击「计算 N 个仓位」查看结果</p></div></div>
          )}
        </div>
      </div>

      {/* Contract specs — full width at bottom */}
      <div style={CARD}>
        <h3 className="text-[18px] font-medium mb-5" style={{ color: 'var(--color-ink)' }}>合约规格参考</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(CONTRACTS).map(([k, v]) => (
            <div key={k} className="p-3 rounded-md text-center" style={{ backgroundColor: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
              <div className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-primary)' }}>{v.name}</div>
              <div className="text-[12px] space-y-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                <div>{v.units.toLocaleString()} 单位/手</div><div>最小 {v.minLot} / 最大 {v.maxLot}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalcRow({ label, value, color, highlight }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[14px]" style={{ color: 'var(--color-ink-subtle)' }}>{label}</span>
      <span className="font-mono font-medium" style={{ color: color || 'var(--color-ink)', fontSize: highlight ? '18px' : '14px' }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════
   Tab 4: 资金管理 — Capital pattern
   ═══════════════════════════════════════ */
function CapitalTab({ data, setData }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ flow_date: today(), flow_type: 'deposit', amount: '', remark: '' });
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const pageSize = 10;

  const showToast = (type, msg) => { setToast({ type, message: msg }); setTimeout(() => setToast(null), 3000); };

  const capitals = useMemo(() => [...(data.capitals || [])].sort((a, b) => b.id - a.id), [data.capitals]);
  const totalPages = Math.max(1, Math.ceil(capitals.length / pageSize));
  const paged = capitals.slice((page - 1) * pageSize, page * pageSize);

  const summary = useMemo(() => {
    const d = capitals.filter(c => c.flow_type === 'deposit').reduce((s, c) => s + (c.amount || 0), 0);
    const w = capitals.filter(c => c.flow_type === 'withdrawal').reduce((s, c) => s + (c.amount || 0), 0);
    return { deposits: d, withdrawals: w, net: d - w };
  }, [capitals]);

  const openCreate = () => { setForm({ flow_date: today(), flow_type: 'deposit', amount: '', remark: '' }); setEditingId(null); setShowForm(true); };
  const openEdit = (c) => { setForm({ flow_date: c.flow_date, flow_type: c.flow_type, amount: String(c.amount), remark: c.remark || '' }); setEditingId(c.id); setShowForm(true); };

  const handleSave = () => {
    if (!form.flow_date || !form.amount) { showToast('error', '请填写必填字段'); return; }
    const entry = { flow_date: form.flow_date, flow_type: form.flow_type, amount: parseFloat(form.amount) || 0, remark: form.remark || '' };
    if (editingId) { setData(p => ({ ...p, capitals: p.capitals.map(c => c.id === editingId ? { ...c, ...entry } : c) })); }
    else { setData(p => ({ ...p, capitals: [{ id: p.capitalIdCounter, ...entry }, ...p.capitals], capitalIdCounter: p.capitalIdCounter + 1 })); }
    setShowForm(false); showToast('success', editingId ? '记录更新成功' : '记录新增成功');
  };

  const handleDelete = () => {
    if (!deleteId) return;
    setData(p => ({ ...p, capitals: p.capitals.filter(c => c.id !== deleteId) }));
    showToast('success', '记录已删除'); setDeleteId(null);
  };

  const delItem = capitals.find(c => c.id === deleteId);

  return (
    <div className="space-y-4">
      {/* 3 summary cards */}
      <div className="grid grid-cols-3 gap-5">
        <CapCard label="累计入金" value={summary.deposits} color="var(--color-success)" prefix="+" />
        <CapCard label="累计出金" value={summary.withdrawals} color="var(--color-danger)" prefix="-" />
        <CapCard label="净入金" value={summary.net} color={summary.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} prefix={summary.net >= 0 ? '+' : ''} />
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={CARD}>
          <h3 className="text-[18px] font-medium mb-5" style={{ color: 'var(--color-ink)' }}>{editingId ? '编辑记录' : '新增记录'}</h3>
          <div className="flex items-end gap-6 flex-wrap">
            <FormField label="日期" value={form.flow_date} onChange={v => setForm(f => ({ ...f, flow_date: v }))} width={130} />
            <FormSelect label="类型" value={form.flow_type} onChange={v => setForm(f => ({ ...f, flow_type: v }))} width={120} options={[{ value: 'deposit', label: '入金' }, { value: 'withdrawal', label: '出金' }]} />
            <FormField label="金额($)" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} type="number" width={150} />
            <div className="flex-1 min-w-[180px]"><FormField label="备注" value={form.remark} onChange={v => setForm(f => ({ ...f, remark: v }))} placeholder="如：初始入金" /></div>
            <button style={BTN_PRIMARY} onClick={handleSave}>{editingId ? '保存修改' : '保存'}</button>
            <button style={BTN_SECONDARY} onClick={() => { setShowForm(false); setEditingId(null); }}>取消</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[15px]" style={{ color: 'var(--color-ink-muted)' }}>管理账户存取款</span>
        <button style={BTN_PRIMARY} onClick={openCreate}>+ 新增记录</button>
      </div>

      {/* Table */}
      <div style={CARD}>
        <h3 className="text-[18px] font-medium mb-5" style={{ color: 'var(--color-ink)' }}>记录列表</h3>
        {capitals.length > 0 ? (
          <table className="w-full text-[15px]">
            <thead><tr style={{ color: 'var(--color-ink-subtle)', borderBottom: '1px solid var(--color-hairline)' }}>
              <th className="text-left py-3 px-4 font-medium">日期</th><th className="text-left py-3 px-4 font-medium">类型</th><th className="text-right py-3 px-4 font-medium">金额</th><th className="text-left py-3 px-4 font-medium">备注</th><th className="text-right py-3 px-4 font-medium">操作</th>
            </tr></thead>
            <tbody>{paged.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--color-hairline)' }} className="hover:brightness-110">
                <td className="py-3 px-4" style={{ color: 'var(--color-ink-muted)' }}>{r.flow_date}</td>
                <td className="py-3 px-4"><span className="px-2.5 py-1 rounded-full text-[13px] font-medium" style={{ backgroundColor: r.flow_type === 'deposit' ? 'color-mix(in srgb, var(--color-success) 18%, transparent)' : 'color-mix(in srgb, var(--color-danger) 18%, transparent)', color: r.flow_type === 'deposit' ? 'var(--color-success)' : 'var(--color-danger)' }}>{r.flow_type === 'deposit' ? '入金' : '出金'}</span></td>
                <td className="py-3 px-4 text-right font-mono font-medium text-[16px]" style={{ color: r.flow_type === 'deposit' ? 'var(--color-success)' : 'var(--color-danger)' }}>{r.flow_type === 'deposit' ? '+' : '-'}${(r.amount || 0).toFixed(2)}</td>
                <td className="py-3 px-4" style={{ color: 'var(--color-ink-subtle)' }}>{r.remark || '-'}</td>
                <td className="py-3 px-4 text-right">
                  <button style={{ background: 'none', color: 'var(--color-primary)', border: 'none', cursor: 'pointer', fontSize: 14, padding: '4px 10px' }} onClick={() => openEdit(r)}>编辑</button>
                  <button style={{ background: 'none', color: 'var(--color-danger)', border: 'none', cursor: 'pointer', fontSize: 14, padding: '4px 10px' }} onClick={() => setDeleteId(r.id)}>删除</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        ) : (
          <p className="text-[15px] py-12 text-center" style={{ color: 'var(--color-ink-subtle)' }}>暂无出入金记录，点击「+ 新增记录」添加</p>
        )}
      </div>

      {capitals.length > pageSize && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Delete Confirm */}
      {deleteId && delItem && (
        <DeleteModal title="此操作不可撤销。确定要删除以下出入金记录吗？" onCancel={() => setDeleteId(null)} onConfirm={handleDelete}>
          <div className="p-4 rounded-md text-[14px] space-y-1.5" style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-hairline)' }}>
            <Row label="日期" value={delItem.flow_date} muted />
            <Row label="类型" value={delItem.flow_type === 'deposit' ? '入金' : '出金'} color={delItem.flow_type === 'deposit' ? 'var(--color-success)' : 'var(--color-danger)'} />
            <Row label="金额" value={`$${Number(delItem.amount || 0).toFixed(2)}`} mono bold />
            <Row label="备注" value={delItem.remark || '-'} muted />
          </div>
        </DeleteModal>
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}

function CapCard({ label, value, color, prefix }) {
  return (
    <div style={CARD_STAT}>
      <div className="text-[14px] mb-1.5" style={{ color: 'var(--color-ink-subtle)' }}>{label}</div>
      <div className="text-2xl font-semibold font-mono" style={{ color }}>{prefix}${Number(value).toFixed(2)}</div>
    </div>
  );
}
