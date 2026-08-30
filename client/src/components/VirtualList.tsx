import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * 固定高度虚拟列表组件
 *
 * 只渲染可见区域内的列表项，大幅减少 DOM 节点数量。
 * 适用于长列表（> 100 项）的性能优化场景。
 *
 * 实现原理：基于容器滚动位置计算可见范围，仅渲染该范围内的项目 + 上下缓冲区。
 *
 * @example
 * ```tsx
 * <VirtualList
 *   items={allLogs}
 *   itemHeight={48}
 *   containerHeight={600}
 *   renderItem={(item, index) => (
 *     <div style={{ height: 48 }}>
 *       <span>{item.title}</span>
 *     </div>
 *   )}
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight = 500,
  overscan = 5,
  className = '',
  onScroll,
}: {
  /** 列表数据 */
  items: T[];
  /** 每项固定高度（px） */
  itemHeight: number;
  /** 渲染每一项 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 容器高度（px） */
  containerHeight?: number;
  /** 上下额外渲染项数（缓冲） */
  overscan?: number;
  /** 额外样式类 */
  className?: string;
  /** 滚动回调 */
  onScroll?: (scrollTop: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const top = containerRef.current.scrollTop;
      setScrollTop(top);
      onScroll?.(top);
    }
  }, [onScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const listener = handleScroll;
    container.addEventListener('scroll', listener, { passive: true });
    return () => container.removeEventListener('scroll', listener);
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`.trim()}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div
        className="virtual-list-inner"
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        <div
          className="virtual-list-viewport"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map((item, index) => (
            <VirtualListItem
              key={startIndex + index}
              item={item}
              index={startIndex + index}
              itemHeight={itemHeight}
              renderItem={renderItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface VirtualListItemProps<T> {
  item: T;
  index: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
}

const VirtualListItem = memo(function VirtualListItem<T>({
  item,
  index,
  itemHeight,
  renderItem,
}: VirtualListItemProps<T>) {
  return (
    <div
      className="virtual-list-item"
      style={{
        height: itemHeight,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {renderItem(item, index)}
    </div>
  );
}) as <T>(props: VirtualListItemProps<T>) => JSX.Element;