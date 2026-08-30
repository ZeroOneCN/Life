import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 排序列表项渲染函数
 * 返回的内容会被包裹在拖拽容器中
 */
export interface SortableItemRenderProps<T> {
  /** 当前项数据 */
  item: T;
  /** 拖拽手柄是否激活 */
  dragHandleProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    style: { cursor: 'grab' };
  };
}

/**
 * 可拖拽排序列表组件
 *
 * 基于 @dnd-kit/sortable，支持键盘/鼠标/触屏拖拽排序。
 * 拖拽结束后通过 onDragEnd 回调返回排序后的完整列表。
 *
 * @template T - 列表项数据类型，必须包含 id 字段
 *
 * @example
 * ```tsx
 * <SortableList
 *   items={tasks}
 *   onDragEnd={handleReorder}
 *   renderItem={({ item, dragHandleProps }) => (
 *     <div>
 *       <span {...dragHandleProps}>⠿</span>
 *       <span>{item.title}</span>
 *     </div>
 *   )}
 * />
 * ```
 */
export function SortableList<T extends { id: string }>({
  items,
  onDragEnd,
  renderItem,
  className = '',
  useDragHandle = true,
}: {
  /** 列表数据 */
  items: T[];
  /** 拖拽结束回调，参数为排序后的新列表 */
  onDragEnd: (sortedItems: T[]) => void;
  /** 渲染每一项 */
  renderItem: (props: SortableItemRenderProps<T>) => ReactNode;
  /** 额外样式类 */
  className?: string;
  /** 是否使用拖拽手柄（true=仅手柄可拖拽，false=整行可拖拽） */
  useDragHandle?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  const handleDragStart = useCallback((event: DragEndEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEndWrapper = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const sorted = [...items];
      const [moved] = sorted.splice(oldIndex, 1);
      sorted.splice(newIndex, 0, moved);
      onDragEnd(sorted);
    },
    [items, onDragEnd],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEndWrapper}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className={`sortable-list ${className} ${activeId ? 'is-dragging' : ''}`}>
          {items.map((item) => (
            <SortableItemWrapper
              key={item.id}
              id={item.id}
              item={item}
              renderItem={renderItem}
              useDragHandle={useDragHandle}
              isActive={item.id === activeId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItemWrapper<T extends { id: string }>({
  id,
  item,
  renderItem,
  useDragHandle,
  isActive,
}: {
  id: string;
  item: T;
  renderItem: (props: SortableItemRenderProps<T>) => ReactNode;
  useDragHandle: boolean;
  isActive: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 100 : 1,
  };

  const dragHandleProps = useDragHandle
    ? {
        onMouseDown: listeners?.onMouseDown as (e: React.MouseEvent) => void,
        onTouchStart: listeners?.onTouchStart as (e: React.TouchEvent) => void,
        style: { cursor: 'grab' as const },
      }
    : undefined;

  const itemProps = useDragHandle
    ? { ref: setNodeRef, style }
    : { ref: setNodeRef, style, ...attributes, ...listeners };

  return (
    <div
      {...itemProps}
      className={`sortable-item ${isActive ? 'sortable-item-active' : ''} ${isDragging ? 'sortable-item-dragging' : ''}`}
      {...(useDragHandle ? attributes : {})}
    >
      {renderItem({ item, dragHandleProps })}
    </div>
  );
}