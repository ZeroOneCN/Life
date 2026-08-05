import { useEffect, useRef, useState } from 'react';

import { useWorkspaceStore } from '../../stores/workspace.store';

const POSITION_STORAGE_KEY = 'lifeos-assistant-position-v1';
const DEFAULT_POSITION = { right: 24, bottom: 24 };

interface AssistantPosition {
  right: number;
  bottom: number;
}

/**
 * 从 localStorage 加载 FAB 位置
 * @returns 位置对象
 */
function loadPosition(): AssistantPosition {
  if (typeof window === 'undefined') return DEFAULT_POSITION;
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw) as Partial<AssistantPosition>;
    if (typeof parsed.right === 'number' && typeof parsed.bottom === 'number') {
      return { right: parsed.right, bottom: parsed.bottom };
    }
  } catch {
    // 静默失败
  }
  return DEFAULT_POSITION;
}

/**
 * 持久化 FAB 位置
 * @param position - 位置对象
 */
function savePosition(position: AssistantPosition): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // 静默失败
  }
}

/**
 * AssistantLauncher：AI 助理入口（FAB）
 *
 * 阶段 C 起，AI 对话面板已迁入 Inspector（AI 模式）。
 * 本组件仅保留右下角悬浮按钮：
 * - 点击：打开/关闭 Inspector AI 模式
 * - 按住拖动：调整 FAB 位置（位置持久化）
 * - 移动端：作为底部入口（Inspector 移动端转全屏）
 *
 * @returns FAB 按钮 JSX
 */
export function AssistantLauncher() {
  const inspectorMode = useWorkspaceStore((s) => s.inspectorMode);
  const setInspectorMode = useWorkspaceStore((s) => s.setInspectorMode);
  const [position, setPosition] = useState<AssistantPosition>(() => loadPosition());
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    width: number;
    height: number;
  } | null>(null);
  const fabDragRef = useRef<number | null>(null);

  const open = inspectorMode === 'ai';

  useEffect(() => {
    savePosition(position);
  }, [position]);

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
      width: rect.width,
      height: rect.height,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // 忽略不支持的浏览器
    }
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const nextRight = drag.startRight - deltaX;
      const nextBottom = drag.startBottom - deltaY;
      const maxRight = Math.max(0, window.innerWidth - drag.width);
      const maxBottom = Math.max(0, window.innerHeight - drag.height);
      setPosition({
        right: Math.min(maxRight, Math.max(0, nextRight)),
        bottom: Math.min(maxBottom, Math.max(0, nextBottom)),
      });
    };
    const handleEnd = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const moved = Math.hypot(dx, dy) >= 4;
      dragStateRef.current = null;
      if (moved) {
        fabDragRef.current = Date.now();
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, []);

  const toggleInspector = () => {
    setInspectorMode(open ? null : 'ai');
  };

  return (
    <button
      type="button"
      className={`assistant-fab ${open ? 'is-open' : ''}`.trim()}
      style={{ right: `${position.right}px`, bottom: `${position.bottom}px` }}
      aria-label={open ? '关闭 AI 助理' : '打开 AI 助理'}
      onClick={() => {
        if (fabDragRef.current && Date.now() - fabDragRef.current < 50) {
          fabDragRef.current = null;
          return;
        }
        toggleInspector();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        fabDragRef.current = null;
        handleDragStart(event);
      }}
      title="按住拖动 · 点击展开 AI 副驾"
    >
      <span aria-hidden="true">{open ? '×' : '🤖'}</span>
      <span className="assistant-fab-tooltip">{open ? '关闭' : 'AI 助理'}</span>
    </button>
  );
}
