import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * SplitView 左右分屏容器组件
 *
 * 提供可拖拽分隔条，左右两个 Pane 各自独立滚动。
 * 拖拽分隔条调整左 Pane 宽度比例（20%~80%）。
 *
 * 用法（B6 页面改造示例）：
 * ```tsx
 * <SplitView
 *   left={<ShoppingList onSelect={setSelectedId} />}
 *   right={<ShoppingDetail id={selectedId} />}
 * />
 * ```
 *
 * 响应式：移动端（< 768px）自动退化为上下堆叠。
 *
 * @param props.left - 左 Pane 内容（通常是列表）
 * @param props.right - 右 Pane 内容（通常是详情）
 * @param props.minLeft - 左 Pane 最小宽度百分比（默认 25）
 * @param props.maxLeft - 左 Pane 最大宽度百分比（默认 60）
 * @returns SplitView JSX
 */
export default function SplitView({
  left,
  right,
  minLeft = 25,
  maxLeft = 60,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  minLeft?: number;
  maxLeft?: number;
}) {
  const [leftPercent, setLeftPercent] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offset = e.clientX - rect.left;
      const percent = (offset / rect.width) * 100;
      const clamped = Math.max(minLeft, Math.min(maxLeft, percent));
      setLeftPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minLeft, maxLeft]);

  return (
    <div
      className={`split-view ${isDragging ? 'is-dragging' : ''}`}
      ref={containerRef}
      style={{ '--split-left': `${leftPercent}%` } as React.CSSProperties}
    >
      <div className="split-view-pane split-view-left">
        {left}
      </div>
      <div
        className="split-view-divider"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整分屏比例"
        tabIndex={0}
      >
        <span className="split-view-divider-grip" aria-hidden="true" />
      </div>
      <div className="split-view-pane split-view-right">
        {right}
      </div>
    </div>
  );
}
