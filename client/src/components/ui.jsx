import { useState } from 'react';

/* ═══════════════════════════════════════
   Native UI components — DESIGN.md Linear style
   ═══════════════════════════════════════ */

/* ── Toast notification ── */
export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-8 right-8 z-50" style={{
      backgroundColor: toast.type === 'success' ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-surface-2))' : 'color-mix(in srgb, var(--color-danger) 20%, var(--color-surface-2))',
      border: `1px solid ${toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
      borderRadius: 'var(--radius-md)', padding: '14px 22px', maxWidth: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div className="flex items-center gap-3">
        {toast.type === 'success' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
        )}
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-ink)' }}>{toast.message}</span>
      </div>
    </div>
  );
}

/* ── Modal ── */
export function Modal({ open, onClose, title, children, footer, width = 520 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)',
        borderRadius: 'var(--radius-lg)', padding: 32, width, maxHeight: '85vh', overflow: 'auto',
      }}>
        {title && <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)', marginBottom: 24 }}>{title}</h2>}
        {children}
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ── */
export function DeleteModal({ open, onClose, onConfirm, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline-strong)',
        borderRadius: 'var(--radius-lg)', padding: 32, width: 440,
      }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)', marginBottom: 8 }}>确认删除</h3>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-ink-muted)', marginBottom: 16 }}>{title}</p>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Btn onClick={onClose}>取消</Btn>
          <button onClick={onConfirm} style={{ backgroundColor: 'var(--color-danger)', color: '#fff', fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 15 }}>确认删除</button>
        </div>
      </div>
    </div>
  );
}

/* ── Button variants ── */
export function Btn({ children, onClick, type = 'secondary', style, ...rest }) {
  const base = {
    fontWeight: 500, borderRadius: 'var(--radius-md)', padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 14,
    display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s',
  };
  const variants = {
    primary: { ...base, backgroundColor: 'var(--color-primary)', color: '#fff' },
    secondary: { ...base, backgroundColor: 'var(--color-surface-1)', color: 'var(--color-ink)', border: '1px solid var(--color-hairline)' },
    ghost: { ...base, backgroundColor: 'transparent', color: 'var(--color-primary)' },
    danger: { ...base, backgroundColor: 'transparent', color: 'var(--color-danger)' },
  };
  return <button onClick={onClick} style={{ ...variants[type], ...style }} {...rest}>{children}</button>;
}

/* ── Tag / Badge ── */
export function Tag({ color, children, style }) {
  const colors = {
    red: { bg: 'color-mix(in srgb, var(--color-danger) 18%, transparent)', text: 'var(--color-danger)' },
    green: { bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)', text: 'var(--color-success)' },
    blue: { bg: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', text: 'var(--color-primary)' },
    orange: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
    purple: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
    default: { bg: 'var(--color-surface-2)', text: 'var(--color-ink-muted)' },
  };
  const c = colors[color] || colors.default;
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 500, backgroundColor: c.bg, color: c.text, ...style }}>{children}</span>
  );
}

/* ── Pill tabs (Segmented replacement) ── */
export function PillTabs({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'inline-flex', gap: 8, ...style }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '6px 18px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: value === opt.value ? 500 : 400,
          backgroundColor: value === opt.value ? 'var(--color-primary)' : 'transparent',
          color: value === opt.value ? '#ffffff' : 'var(--color-ink-subtle)',
          transition: 'all 0.25s',
        }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Form field ── */
export function Field({ label, value, onChange, type = 'text', placeholder, readOnly, width, hint }) {
  return (
    <div style={width ? { width } : undefined}>
      {label && <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: readOnly ? 'var(--color-ink-tertiary)' : 'var(--color-ink-subtle)', fontWeight: 500 }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', ...(readOnly ? { cursor: 'default', borderStyle: 'dashed', userSelect: 'none' } : {}) }}
        readOnly={readOnly} step={type === 'number' ? 'any' : undefined} />
      {hint && <span style={{ display: 'block', fontSize: 11, marginTop: 4, color: 'var(--color-ink-tertiary)' }}>{hint}</span>}
    </div>
  );
}

/* ── Native Table ── */
export function DataTable({ columns, data, rowKey, emptyText = '暂无数据', loading, minWidth }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-ink-subtle)', fontSize: 15 }}>加载中...</div>;
  if (!data || data.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-ink-subtle)', fontSize: 15 }}>{emptyText}</div>;
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', minWidth, fontSize: 14, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-hairline)' }}>
            {columns.map(col => (
              <th key={col.key || col.dataIndex} style={{
                textAlign: col.align || 'left', padding: '12px 16px', fontWeight: 500, fontSize: 13,
                color: 'var(--color-ink-subtle)', whiteSpace: 'nowrap',
                width: col.width,
              }}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={rowKey ? row[rowKey] : i} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
              {columns.map(col => (
                <td key={col.key || col.dataIndex} style={{
                  textAlign: col.align || 'left', padding: '12px 16px', fontSize: 14,
                  color: 'var(--color-ink-muted)', whiteSpace: col.ellipsis ? 'nowrap' : undefined,
                  ...col.onCell ? col.onCell(row) : {},
                }}>
                  {col.render ? col.render(row[col.dataIndex], row, i) : row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Pagination ── */
export function Pagination({ page, totalPages, totalItems, onPageChange }) {
  const [jumpInput, setJumpInput] = useState('');
  const disabled = (d) => ({ opacity: d ? 0.4 : 1, cursor: d ? 'default' : 'pointer' });
  const doJump = () => { const p = parseInt(jumpInput); if (p >= 1 && p <= totalPages) { onPageChange(p); setJumpInput(''); } };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
      <Btn type="secondary" onClick={() => onPageChange(1)} style={{ padding: '6px 12px', fontSize: 13, ...disabled(page <= 1) }}>首页</Btn>
      <Btn type="secondary" onClick={() => onPageChange(p => p - 1)} style={{ padding: '6px 12px', fontSize: 13, ...disabled(page <= 1) }}>上一页</Btn>
      <span style={{ color: 'var(--color-ink-muted)', fontSize: 14 }}>第 {page} / {totalPages} 页{totalItems != null ? `（共 ${totalItems} 条）` : ''}</span>
      <Btn type="secondary" onClick={() => onPageChange(p => p + 1)} style={{ padding: '6px 12px', fontSize: 13, ...disabled(page >= totalPages) }}>下一页</Btn>
      <Btn type="secondary" onClick={() => onPageChange(totalPages)} style={{ padding: '6px 12px', fontSize: 13, ...disabled(page >= totalPages) }}>末页</Btn>
      <span style={{ color: 'var(--color-ink-subtle)', fontSize: 13 }}>跳转</span>
      <input type="number" value={jumpInput} onChange={e => setJumpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doJump()}
        min={1} max={totalPages} style={{ width: 52, textAlign: 'center', padding: '6px 8px', fontSize: 13 }} />
      <Btn type="secondary" onClick={doJump} style={{ padding: '6px 10px', fontSize: 13 }}>GO</Btn>
    </div>
  );
}

/* ── Spinner ── */
export function Spinner({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="var(--color-hairline)" strokeWidth="3" />
      <path d="M12 2a10 10 0 019.95 9" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

/* ── Checkbox (native) ── */
export function Checkbox({ checked, onChange, children, style }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: 'var(--color-ink-muted)', ...style }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, cursor: 'pointer' }} />
      {children}
    </label>
  );
}

/* ── Switch (native checkbox styled as toggle) ── */
export function Switch({ checked, onChange, style }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, ...style }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-hairline-strong)',
        borderRadius: 'var(--radius-pill)', transition: '0.2s',
      }} />
      <span style={{
        position: 'absolute', content: '', height: 18, width: 18, left: checked ? 23 : 3, bottom: 3,
        backgroundColor: '#fff', borderRadius: '50%', transition: '0.2s',
      }} />
    </label>
  );
}
