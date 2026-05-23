import { useState } from 'react';

/* ═══════════════════════════════════════
   DESIGN.md Linear component library
   ═══════════════════════════════════════ */

export function Toast({ toast }) {
  if (!toast) return null;
  const s = toast.type === 'success';
  return (
    <div className="fixed bottom-8 right-8 z-50" style={{
      background: s ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-surface-2))' : 'color-mix(in srgb, var(--color-danger) 20%, var(--color-surface-2))',
      border: `1px solid ${s ? 'var(--color-success)' : 'var(--color-danger)'}`,
      borderRadius: 'var(--radius-md)', padding: '14px 22px', maxWidth: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div className="flex items-center gap-3">
        {s ? (
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
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" onMouseDown={e => e.stopPropagation()} style={{ width }}>
        {title && <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)', marginBottom: 24 }}>{title}</h2>}
        {children}
        {footer && <div className="flex justify-end gap-3" style={{ marginTop: 28 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ── */
export function DeleteModal({ open, onClose, onConfirm, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" onMouseDown={e => e.stopPropagation()} style={{ width: 440 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)', marginBottom: 8 }}>确认删除</h3>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-ink-muted)', marginBottom: 16 }}>{title}</p>
        {children}
        <div className="flex justify-end gap-3" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-danger-fill" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}

/* ── Button ── */
export function Btn({ children, type = 'secondary', onClick, className = '', ...rest }) {
  const map = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger', 'danger-fill': 'btn-danger-fill' };
  return <button className={`btn ${map[type] || 'btn-secondary'} ${className}`} onClick={onClick} {...rest}>{children}</button>;
}

/* ── Pill tabs (Segmented replacement) ── */
export function PillTabs({ options, value, onChange }) {
  return (
    <div className="tab-bar">
      {options.map(opt => (
        <button key={opt.value} className={`tab ${value === opt.value ? 'active' : ''}`} onClick={() => onChange(opt.value)}>
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
        className="w-full" readOnly={readOnly} step={type === 'number' ? 'any' : undefined} />
      {hint && <span style={{ display: 'block', fontSize: 11, marginTop: 4, color: 'var(--color-ink-tertiary)' }}>{hint}</span>}
    </div>
  );
}

/* ── Tag ── */
const tagMap = { red: 'tag-red', green: 'tag-green', blue: 'tag-blue', orange: 'tag-orange', purple: 'tag-purple', default: '' };
export function Tag({ color, children }) {
  return <span className={`tag ${tagMap[color] || ''}`}>{children}</span>;
}

/* ── DataTable ── */
export function DataTable({ columns, data, rowKey, emptyText = '暂无数据', loading, minWidth }) {
  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-ink-subtle)', fontSize: 15 }}>加载中...</div>;
  if (!data || data.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-ink-subtle)', fontSize: 15 }}>{emptyText}</div>;
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', minWidth }}>
        <thead><tr>{columns.map(col => (
          <th key={col.key || col.dataIndex} style={{ textAlign: col.align || 'left', padding: '12px 16px', whiteSpace: 'nowrap', width: col.width }}>
            {col.title}
          </th>
        ))}</tr></thead>
        <tbody>{data.map((row, i) => (
          <tr key={rowKey ? row[rowKey] : i}>
            {columns.map(col => (
              <td key={col.key || col.dataIndex} style={{
                textAlign: col.align || 'left', padding: '12px 16px', fontSize: 14, whiteSpace: col.ellipsis ? 'nowrap' : undefined,
                ...col.onCell ? col.onCell(row) : {},
              }}>
                {col.render ? col.render(row[col.dataIndex], row, i) : row[col.dataIndex]}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* ── Pagination ── */
export function Pagination({ page, totalPages, totalItems, onPageChange }) {
  const [jumpInput, setJumpInput] = useState('');
  const doJump = () => { const p = parseInt(jumpInput); if (p >= 1 && p <= totalPages) { onPageChange(p); setJumpInput(''); } };
  return (
    <div className="pagination">
      <button className="btn btn-secondary" disabled={page <= 1} style={{ opacity: page <= 1 ? .4 : 1 }} onClick={() => onPageChange(1)}>首页</button>
      <button className="btn btn-secondary" disabled={page <= 1} style={{ opacity: page <= 1 ? .4 : 1 }} onClick={() => onPageChange(p => p - 1)}>上一页</button>
      <span style={{ color: 'var(--color-ink-muted)', fontSize: 14 }}>第 {page} / {totalPages} 页{totalItems != null ? `（共 ${totalItems} 条）` : ''}</span>
      <button className="btn btn-secondary" disabled={page >= totalPages} style={{ opacity: page >= totalPages ? .4 : 1 }} onClick={() => onPageChange(p => p + 1)}>下一页</button>
      <button className="btn btn-secondary" disabled={page >= totalPages} style={{ opacity: page >= totalPages ? .4 : 1 }} onClick={() => onPageChange(totalPages)}>末页</button>
      <span style={{ color: 'var(--color-ink-subtle)', fontSize: 13 }}>跳转</span>
      <input type="number" value={jumpInput} onChange={e => setJumpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doJump()} min={1} max={totalPages} />
      <button className="btn btn-secondary" onClick={doJump}>GO</button>
    </div>
  );
}

/* ── Switch ── */
export function Switch({ checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="switch-track" />
      <span className="switch-knob" />
    </label>
  );
}

/* ── Checkbox ── */
export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
