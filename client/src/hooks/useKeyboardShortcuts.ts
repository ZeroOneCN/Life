import { useEffect } from 'react';

type ShortcutAction = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  /** 是否阻止默认行为，默认 true */
  preventDefault?: boolean;
};

/**
 * 全局键盘快捷键注册
 *
 * 支持修饰键（Ctrl/Cmd/Shift）+ 普通键组合。
 * 默认在 Mac 上使用 Cmd，Windows 上使用 Ctrl。
 * 可通过 ctrl / meta 明确指定。
 *
 * @param shortcuts - 快捷键配置数组
 * @param enabled - 是否启用（默认 true）
 */
export function useKeyboardShortcuts(shortcuts: ShortcutAction[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const isCtrl = e.ctrlKey;
        const isMeta = e.metaKey;
        const isShift = e.shiftKey;
        const targetKey = e.key.toLowerCase();

        const matchCtrl = shortcut.ctrl !== undefined ? shortcut.ctrl : false;
        const matchMeta = shortcut.meta !== undefined ? shortcut.meta : false;
        const useCtrl = shortcut.ctrl !== undefined ? shortcut.ctrl : !navigator.userAgent.includes('Mac');
        const useMeta = shortcut.meta !== undefined ? shortcut.meta : navigator.userAgent.includes('Mac');

        const ctrlOk = matchCtrl ? isCtrl : !useCtrl || isCtrl === useCtrl;
        const metaOk = matchMeta ? isMeta : !useMeta || isMeta === useMeta;
        const shiftOk = !shortcut.shift || isShift;

        if (ctrlOk && metaOk && shiftOk && targetKey === shortcut.key.toLowerCase()) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}