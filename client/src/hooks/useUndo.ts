import { useCallback, useState } from 'react';

/**
 * 通用撤销/重做 Hook
 *
 * 维护一个历史栈，支持 setValue/undo/redo/reset 操作。
 * 适用于需要撤销/重做功能的表单编辑、列表排序等场景。
 *
 * @param initialValue - 初始值
 * @param maxHistory - 最大历史记录数（默认 50）
 *
 * @returns { current, setValue, undo, redo, canUndo, canRedo, reset }
 *
 * @example
 * ```tsx
 * const { current, setValue, undo, redo, canUndo, canRedo } = useUndo({ title: '', priority: 'medium' });
 *
 * // 更新值
 * setValue({ ...current, title: '新标题' });
 *
 * // 撤销/重做
 * <button disabled={!canUndo} onClick={undo}>撤销</button>
 * <button disabled={!canRedo} onClick={redo}>重做</button>
 * ```
 */
export function useUndo<T>(initialValue: T, maxHistory = 50) {
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const current = history[historyIndex];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const setValue = useCallback((nextValue: T | ((prev: T) => T)) => {
    setHistory((prev) => {
      const currentValue = prev[historyIndex];
      const computed = typeof nextValue === 'function'
        ? (nextValue as (prev: T) => T)(currentValue)
        : nextValue;
      if (computed === currentValue) return prev;
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(computed);
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, maxHistory - 1));
  }, [historyIndex, maxHistory]);

  const undo = useCallback(() => {
    setHistoryIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setHistoryIndex((prev) => Math.min(history.length - 1, prev + 1));
  }, [history.length]);

  const reset = useCallback((value: T) => {
    setHistory([value]);
    setHistoryIndex(0);
  }, []);

  return { current, setValue, undo, redo, canUndo, canRedo, reset };
}