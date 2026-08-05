import { useEffect, useRef } from 'react';

/**
 * 快捷键处理函数类型
 */
export type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * 快捷键定义
 */
export interface ShortcutDefinition {
  /** 键盘按键（小写，如 'k', 't', 'w', '1', '[', ']'） */
  key: string;
  /** 是否需要 Cmd (macOS) / Ctrl (Windows/Linux) */
  mod?: boolean;
  /** 是否需要 Shift */
  shift?: boolean;
  /** 是否需要 Alt/Option */
  alt?: boolean;
  /** 处理函数 */
  handler: ShortcutHandler;
  /** 是否阻止默认行为与冒泡（默认 true） */
  preventDefault?: boolean;
  /** 描述（用于快捷键面板展示） */
  description?: string;
}

/**
 * 快捷键匹配判定
 * @param event - 键盘事件
 * @param def - 快捷键定义
 * @returns 是否匹配
 */
function matches(event: KeyboardEvent, def: ShortcutDefinition): boolean {
  const key = event.key.toLowerCase();
  if (def.key.toLowerCase() !== key) return false;
  if ((def.mod ?? false) !== (event.metaKey || event.ctrlKey)) return false;
  if ((def.shift ?? false) !== event.shiftKey) return false;
  if ((def.alt ?? false) !== event.altKey) return false;
  return true;
}

/**
 * 判定事件是否发生在输入元素内（input/textarea/select/contentEditable）
 * @param event - 键盘事件
 * @returns 是否在输入元素内
 */
function isInsideInput(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return target.isContentEditable;
}

/**
 * 全局快捷键注册 Hook
 *
 * 用法：
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'k', mod: true, handler: () => setPaletteOpen(true), description: '打开命令面板' },
 *   { key: '1', mod: true, handler: () => switchTab(0), description: '切换到 Tab 1' },
 * ]);
 * ```
 *
 * 默认行为：
 * - 输入元素内不触发（除非显式设置 alt/shift 组合，避免误触）
 * - 自动 preventDefault + stopPropagation（可通过 preventDefault: false 关闭）
 * - 支持多个相同组合键（按注册顺序执行）
 *
 * @param shortcuts - 快捷键定义数组
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  // 使用 ref 保存最新 shortcuts，避免每次渲染都重新绑定监听器
  const shortcutsRef = useRef<ShortcutDefinition[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // 单键快捷键（无修饰键）允许在输入框触发；带修饰键的在输入框内也允许（如 ⌘K）
      // 但纯字母数字单键在输入框内不触发，避免干扰输入
      const hasMod = event.metaKey || event.ctrlKey;
      const insideInput = isInsideInput(event);
      if (insideInput && !hasMod) {
        // 仅放行 Esc 键
        if (event.key !== 'Escape') return;
      }

      const list = shortcutsRef.current;
      for (const def of list) {
        if (!matches(event, def)) continue;
        if ((def.preventDefault ?? true)) {
          event.preventDefault();
          event.stopPropagation();
        }
        def.handler(event);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}

/**
 * 当前平台修饰键名称（用于快捷键提示展示）
 * @returns '⌘' (macOS) 或 'Ctrl' (其他平台)
 */
export function getModKeyName(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘' : 'Ctrl';
}
