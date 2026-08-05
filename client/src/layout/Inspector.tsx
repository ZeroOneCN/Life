import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AssistantChatPanel } from '../components/shared/AssistantChatPanel';
import { routes } from '../config/navigation';
import { useWorkspaceStore } from '../stores/workspace.store';

/**
 * Inspector 模式元信息
 */
const MODE_META: Record<'detail' | 'ai' | 'actions', { title: string; icon: string }> = {
  detail: { title: '详情', icon: 'M12 3v18M3 12h18' },
  ai: { title: 'AI 副驾', icon: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
  actions: { title: '快捷操作', icon: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z' },
};

/**
 * Inspector 右侧面板组件
 *
 * 三模式切换（由 workspace.store 的 inspectorMode 控制）：
 * - detail: 选中项详情（阶段 C 页面逐步接入）
 * - ai: AI 副驾（复用 AssistantChatPanel + C3 上下文注入）
 * - actions: 快捷操作（占位）
 *
 * 支持拖拽左边框调整宽度（280~560px）。
 * 移动端（< 768px）自动转为全屏覆盖层。
 *
 * @returns Inspector JSX
 */
export default function Inspector() {
  const location = useLocation();
  const mode = useWorkspaceStore((s) => s.inspectorMode);
  const detail = useWorkspaceStore((s) => s.inspectorDetail);
  const width = useWorkspaceStore((s) => s.inspectorWidth);
  const setInspectorMode = useWorkspaceStore((s) => s.setInspectorMode);
  const setInspectorWidth = useWorkspaceStore((s) => s.setInspectorWidth);

  const [isDragging, setIsDragging] = useState(false);
  const inspectorRef = useRef<HTMLDivElement | null>(null);

  // 拖拽调整宽度
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return undefined;
    const handleMove = (e: MouseEvent) => {
      const inspector = inspectorRef.current;
      if (!inspector) return;
      const rect = inspector.getBoundingClientRect();
      const nextWidth = rect.right - e.clientX;
      setInspectorWidth(nextWidth);
    };
    const handleUp = () => setIsDragging(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, setInspectorWidth]);

  // 路由切换时自动关闭 detail 模式（保留 ai）
  useEffect(() => {
    if (mode === 'detail') {
      setInspectorMode(null);
    }
  }, [location.pathname, mode, setInspectorMode]);

  // C3 上下文注入：构建当前页面上下文描述；detail 模式时附带选中记录摘要
  const aiContext = useMemo(() => {
    const route = routes.find((r) => r.path === location.pathname);
    const pageLabel = route?.label ?? location.pathname;
    const pageDesc = `用户当前在「${pageLabel}」页面（${location.pathname}）。回答时优先关联该页面相关的数据。`;
    if (mode === 'detail' && detail) {
      const summary = detail.fields.map((f) => `${f.label}：${f.value}`).join('；');
      return `${pageDesc}\n当前选中的记录：${detail.title}${detail.subtitle ? `（${detail.subtitle}）` : ''}${summary ? `。字段：${summary}` : ''}`;
    }
    return pageDesc;
  }, [location.pathname, mode, detail]);

  if (mode === null) return null;

  const meta = MODE_META[mode];

  return (
    <aside
      className={`inspector ${isDragging ? 'is-dragging' : ''}`}
      style={{ width }}
      ref={inspectorRef}
      aria-label={meta.title}
    >
      <div
        className="inspector-resizer"
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整面板宽度"
      />

      <header className="inspector-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={meta.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="inspector-title">{meta.title}</span>
        <button
          type="button"
          className="inspector-close"
          onClick={() => setInspectorMode(null)}
          aria-label={`关闭${meta.title}面板`}
          title="关闭"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="inspector-body">
        {mode === 'ai' ? (
          <AssistantChatPanel context={aiContext} />
        ) : mode === 'detail' ? (
          detail ? (
            <div className="inspector-detail">
              <h3 className="inspector-detail-title">{detail.title}</h3>
              {detail.subtitle ? <p className="inspector-detail-subtitle">{detail.subtitle}</p> : null}
              <dl className="inspector-detail-fields">
                {detail.fields.map((field) => (
                  <div className="inspector-detail-field" key={field.label}>
                    <dt>{field.label}</dt>
                    <dd style={field.accent ? { color: field.accent } : undefined}>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="inspector-empty">
              <p>尚未选择详情项</p>
              <span>在列表中选中一条记录后，这里会显示详情。该能力随页面 Split 改造（阶段 C）逐步接入。</span>
            </div>
          )
        ) : (
          <div className="inspector-empty">
            <p>快捷操作</p>
            <span>常用操作入口将在此集中展示（随页面适配逐步补充）。</span>
          </div>
        )}
      </div>
    </aside>
  );
}
