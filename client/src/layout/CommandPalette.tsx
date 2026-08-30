import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { menuItems } from '../config/navigation';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { IconKey } from '../types/navigation';

/**
 * 命令项类型
 * - page: 页面跳转
 * - action: 动作执行（如新建 Tab、切换主题、切换密度）
 * - record: 记录搜索（阶段 C 接入后端 API）
 */
type CommandItemType = 'page' | 'action' | 'record';

/**
 * 命令项
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
  /** 执行动作（action 类型） */
  run?: () => void;
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
 * CommandPalette 命令面板组件
 *
 * 三类搜索：
 * - 页面（`/` 前缀或默认）：搜索菜单页面
 * - 动作（`>` 前缀）：搜索可执行动作（切换主题、切换密度、折叠 NavRail 等）
 * - 记录（`@` 前缀）：搜索业务记录（阶段 C 接入后端 API）
 *
 * 交互：
 * - ↑↓ 选择
 * - Enter 执行
 * - Esc 关闭
 * - 输入 `>` 仅搜索动作
 * - 输入 `@` 仅搜索记录
 * - 输入 `/` 仅搜索页面
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

  // 动作集合（随 store 状态动态生成）
  const actions = useMemo<CommandItem[]>(() => {
    return [
      {
        key: 'action-goto-dashboard',
        title: '前往仪表盘',
        group: '导航',
        type: 'action',
        run: () => navigate('/dashboard'),
      },
      {
        key: 'action-toggle-sidebar',
        title: '折叠/展开侧边栏',
        group: '视图',
        type: 'action',
        run: () => {
          // 通过 dispatch 事件触发侧边栏折叠
          window.dispatchEvent(new CustomEvent('arco-layout:toggle-sidebar'));
        },
      },
    ];
  }, [navigate]);

  // 解析查询前缀，确定过滤模式与实际查询词
  const { mode, searchQuery } = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.startsWith('>')) return { mode: 'action' as const, searchQuery: trimmed.slice(1) };
    if (trimmed.startsWith('@')) return { mode: 'record' as const, searchQuery: trimmed.slice(1) };
    if (trimmed.startsWith('/')) return { mode: 'page' as const, searchQuery: trimmed.slice(1) };
    return { mode: 'all' as const, searchQuery: trimmed };
  }, [query]);

  const filtered = useMemo(() => {
    // 全模式时合并页面与动作，页面优先
    if (mode === 'all') {
      const matchedPages = allPages.filter((item) => matchItem(item, searchQuery));
      const matchedActions = actions.filter((item) => matchItem(item, searchQuery));
      return [...matchedPages, ...matchedActions];
    }
    if (mode === 'record') return [];
    const pool = mode === 'action' ? actions : allPages;
    return pool.filter((item) => matchItem(item, searchQuery));
  }, [allPages, actions, mode, searchQuery]);

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
        } else if (target.run) {
          target.run();
          setCommandPaletteOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIndex, navigate, setCommandPaletteOpen]);

  const handleBackdropClick = () => {
    setCommandPaletteOpen(false);
  };

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleItemClick = (item: CommandItem) => {
    if (item.path) {
      navigate(item.path);
      setCommandPaletteOpen(false);
    } else if (item.run) {
      item.run();
      setCommandPaletteOpen(false);
    }
  };

  const placeholder =
    mode === 'action'
      ? '搜索动作...（如：切换主题、打开 AI）'
      : mode === 'record'
        ? '搜索记录...（阶段 C 接入后端 API）'
        : mode === 'page'
          ? '搜索页面...（如：仪表盘、购物记录）'
          : '搜索页面或动作...（> 动作 / @ 记录 / / 页面）';

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
            <path
              d="M21 21l-4.3-4.3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            aria-label="搜索命令"
          />
          <span className="command-palette-kbd" aria-hidden="true">
            Esc 关闭
          </span>
        </div>

        <div className="command-palette-list">
          {filtered.length === 0 ? (
            <div className="command-palette-empty">
              {mode === 'record' ? '记录搜索将在阶段 C 接入后端 API' : '无匹配结果'}
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`command-palette-item ${index === activeIndex ? 'is-active' : ''}`}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="command-palette-item-main">
                  <span
                    className={`command-palette-item-type type-${item.type}`}
                    aria-hidden="true"
                  >
                    {item.type === 'page' ? 'P' : item.type === 'action' ? 'A' : 'R'}
                  </span>
                  <span className="command-palette-item-title">{item.title}</span>
                </span>
                <span className="command-palette-item-group">{item.group}</span>
              </button>
            ))
          )}
        </div>

        <div className="command-palette-footer">
          <span>
            <span className="command-palette-kbd-inline">↑↓</span> 选择
          </span>
          <span>
            <span className="command-palette-kbd-inline">Enter</span> 执行
          </span>
          <span>
            <span className="command-palette-kbd-inline">Esc</span> 关闭
          </span>
          <span className="command-palette-hint">
            <span className="command-palette-kbd-inline">&gt;</span>动作
            <span className="command-palette-kbd-inline">@</span>记录
            <span className="command-palette-kbd-inline">/</span>页面
          </span>
        </div>
      </div>
    </div>
  );
}
