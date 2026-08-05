import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { menuItems } from '../config/navigation';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { IconKey } from '../types/navigation';

/**
 * 命令面板项类型
 */
type CommandItemType = 'page' | 'action';

/**
 * 命令面板项
 */
interface CommandItem {
  /** 唯一 key */
  key: string;
  /** 显示标题 */
  title: string;
  /** 副标题/分组 */
  group: string;
  /** 类型 */
  type: CommandItemType;
  /** 跳转路径（page 类型） */
  path?: string;
  /** 图标 key（可选） */
  icon?: IconKey;
}

/**
 * 扁平化所有可跳转的页面项（含二级菜单）
 * @returns CommandItem 数组
 */
function flattenPages(): CommandItem[] {
  const items: CommandItem[] = [];
  for (const item of menuItems) {
    if (item.children?.length) {
      for (const child of item.children) {
        items.push({
          key: child.key,
          title: child.label,
          group: item.label,
          type: 'page',
          path: child.key,
          icon: child.icon,
        });
      }
    } else if (item.key.startsWith('/')) {
      items.push({
        key: item.key,
        title: item.label,
        group: '系统',
        type: 'page',
        path: item.key,
        icon: item.icon,
      });
    }
  }
  return items;
}

/**
 * 简单 fuzzy 匹配：检查 query 是否匹配 title 或 group（不区分大小写）
 * @param item - 命令项
 * @param query - 用户输入
 * @returns 是否匹配
 */
function matchItem(item: CommandItem, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return item.title.toLowerCase().includes(q) || item.group.toLowerCase().includes(q);
}

/**
 * CommandPalette 命令面板组件（阶段 A 占位版）
 *
 * 阶段 A：仅支持页面搜索与跳转，无记录搜索、无动作执行。
 * 阶段 B 将扩展为完整命令面板（页面/记录/动作三类 + 历史权重）。
 *
 * 交互：
 * - ↑↓ 选择
 * - Enter 执行（跳转）
 * - Esc 关闭
 * - 输入 `>` 仅搜索动作（阶段 B）
 * - 输入 `@` 仅搜索记录（阶段 B）
 * - 输入 `/` 仅搜索页面（阶段 B）
 *
 * @returns CommandPalette JSX
 */
export default function CommandPalette() {
  const navigate = useNavigate();
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allPages = useMemo(() => flattenPages(), []);

  const filtered = useMemo(() => {
    return allPages.filter((item) => matchItem(item, query));
  }, [allPages, query]);

  // 确保 activeIndex 在范围内
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(0);
    }
  }, [filtered.length, activeIndex]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 键盘交互
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        const target = filtered[activeIndex];
        if (target.path) {
          navigate(target.path);
          setCommandPaletteOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIndex, navigate, setCommandPaletteOpen]);

  // 点击背景关闭
  const handleBackdropClick = () => {
    setCommandPaletteOpen(false);
  };

  // 点击面板阻止冒泡
  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleItemClick = (item: CommandItem) => {
    if (item.path) {
      navigate(item.path);
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div
      className="command-palette-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      onClick={handleBackdropClick}
    >
      <div className="command-palette" onClick={handlePanelClick}>
        <div className="command-palette-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="搜索页面...（阶段 B 将支持记录与动作）"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            aria-label="搜索命令"
          />
          <span className="command-palette-kbd" aria-hidden="true">Esc 关闭</span>
        </div>

        <div className="command-palette-list">
          {filtered.length === 0 ? (
            <div className="command-palette-empty">无匹配结果</div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`command-palette-item ${index === activeIndex ? 'is-active' : ''}`}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="command-palette-item-title">{item.title}</span>
                <span className="command-palette-item-group">{item.group}</span>
              </button>
            ))
          )}
        </div>

        <div className="command-palette-footer">
          <span><span className="command-palette-kbd-inline">↑↓</span> 选择</span>
          <span><span className="command-palette-kbd-inline">Enter</span> 跳转</span>
          <span><span className="command-palette-kbd-inline">Esc</span> 关闭</span>
          <span className="command-palette-hint">阶段 A 占位 · 阶段 B 实装完整搜索</span>
        </div>
      </div>
    </div>
  );
}
