import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { menuItems } from '../config/navigation';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { IconKey, MenuItemConfig } from '../types/navigation';

/**
 * Nav Rail 图标 SVG path 表（与 MainLayout 同步，后续统一抽离）
 */
const iconMap: Record<IconKey, string> = {
  dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  wallet: 'M21 7H3V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2zm0 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9h18zm-5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  spark: 'M13 3l-2.47 4.94L6 10.41l4.53 2.47L13 17.82l2.47-4.94L20 10.41l-4.53-2.47L13 3z',
  trend: 'M3 17l6-6 4 4 8-8v5h2V3h-9v2h5l-6 6-4-4-7 7 1 1z',
  bell: 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z',
  task: 'M19 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-8 14-4-4 1.41-1.41L11 14.17l5.59-5.58L18 10l-7 7z',
  card: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4H4V6h16v2zm0 10H4v-6h16v6z',
  shield: 'M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zm0 9 4 4-1.41 1.41L12 13.83l-2.59 2.58L8 15l4-4z',
  chart: 'M5 9.2h3V19H5zm5.5-4h3V19h-3zm5.5 7h3V19h-3z',
  box: 'M3 6.5 12 2l9 4.5V17l-9 5-9-5V6.5zm9-2.3L6.2 7 12 9.9 17.8 7 12 4.2zm-7 4.5v7L11 19v-7.1L5 8.7zm14 0-6 3.2V19l6-3.3V8.7z',
  calendar: 'M7 2v2H4a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3V2h-2v2H9V2H7zm-2 7h14v10H5V9z',
};

/**
 * 渲染 Nav Rail 图标
 * @param name - 图标 key
 */
function Icon({ name }: { name: IconKey }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={iconMap[name]} />
    </svg>
  );
}

/**
 * 判定给定 pathname 所属的一级菜单 key（用于自动展开对应组）
 * @param pathname - 当前路由路径
 * @returns 一级菜单 key 或 null
 */
function findParentKey(pathname: string): string | null {
  const prefix = pathname.split('/')[1];
  return ['health', 'finance', 'life', 'investment'].includes(prefix) ? prefix : null;
}

/**
 * 判定给定 pathname 是否匹配某个菜单项（含子项）
 * @param item - 菜单项配置
 * @param pathname - 当前路由路径
 */
function isItemActive(item: MenuItemConfig, pathname: string): boolean {
  if (item.key === pathname) return true;
  if (item.children?.some((child) => child.key === pathname)) return true;
  return false;
}

/**
 * Nav Rail 单个节点（含二级 popover）
 */
function NavRailNode({
  item,
  pathname,
  expanded,
  activeMenuKey,
  onSelect,
}: {
  item: MenuItemConfig;
  pathname: string;
  expanded: boolean;
  activeMenuKey: string;
  onSelect: (key: string) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  // popover 固定定位坐标（折叠态使用，避免被 rail 的 overflow/层叠裁剪）
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const isActive = activeMenuKey === item.key || isItemActive(item, pathname);
  const hasChildren = !!item.children?.length;

  // 点击外部关闭 popover
  useEffect(() => {
    if (!popoverOpen) return undefined;
    const handle = (e: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [popoverOpen]);

  // 折叠态：点击带子项的节点 → 在按钮右侧弹出二级菜单；无子项 → 直接选中
  // 展开态：点击带子项的节点 → 选中并展开二级（直接显示在 Rail 内）
  const handleClick = (e: React.MouseEvent) => {
    onSelect(item.key);
    if (hasChildren && !expanded) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // 右侧空间不足（popover 约 200px）时改为左侧弹出
      const left = rect.right + 8 + 200 > window.innerWidth ? rect.left - 208 : rect.right + 8;
      setPopoverPos({ top: rect.top, left: Math.max(8, left) });
      setPopoverOpen((v) => !v);
    } else {
      setPopoverOpen(false);
      // 无子项节点（首页/通知/个人中心）：直接路由跳转
      if (!hasChildren) {
        navigate(item.key);
      }
    }
  };

  return (
    <div className={`nav-rail-node ${isActive ? 'is-active' : ''}`} ref={nodeRef}>
      <button
        type="button"
        className="nav-rail-item"
        onClick={handleClick}
        aria-expanded={hasChildren ? expanded || popoverOpen : undefined}
        aria-current={isActive ? 'page' : undefined}
        title={expanded ? undefined : item.label}
      >
        <span className="nav-rail-item-icon">
          <Icon name={item.icon} />
        </span>
        {expanded ? <span className="nav-rail-item-label">{item.label}</span> : null}
        {hasChildren && expanded ? (
          <svg
            className={`nav-rail-chevron ${popoverOpen ? 'is-open' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>

      {/* 折叠态：popover 显示二级（Portal 到 body，fixed 定位，避免被 rail 裁剪/遮挡） */}
      {/* 注意：popover 内阻止 mousedown 冒泡，避免外部关闭监听器先卸载 Link 导致导航丢失 */}
      {hasChildren && !expanded && popoverOpen && popoverPos ? (
        createPortal(
          <div
            className="nav-rail-popover"
            role="menu"
            style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="nav-rail-popover-title">{item.label}</div>
            {item.children!.map((child) => (
              <Link
                key={child.key}
                to={child.key}
                className={`nav-rail-popover-item ${pathname === child.key ? 'is-active' : ''}`}
                onClick={() => {
                  setPopoverOpen(false);
                  onSelect(item.key);
                }}
              >
                <Icon name={child.icon} />
                <span>{child.label}</span>
              </Link>
            ))}
          </div>,
          document.body,
        )
      ) : null}

      {/* 展开态：二级直接渲染 */}
      {hasChildren && expanded ? (
        <div className="nav-rail-submenu">
          {item.children!.map((child) => (
            <Link
              key={child.key}
              to={child.key}
              className={`nav-rail-submenu-item ${pathname === child.key ? 'is-active' : ''}`}
              onClick={() => onSelect(item.key)}
            >
              <Icon name={child.icon} />
              <span>{child.label}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Nav Rail 左侧导航栏组件
 *
 * 双模式：
 * - Rail 模式（默认，64px）：仅显示图标 + hover tooltip + 激活态主色条
 * - Expanded 模式（240px）：显示图标 + 文字 + 二级菜单
 *
 * 状态由 workspace.store 的 navRailExpanded 控制。
 *
 * @returns Nav Rail JSX
 */
export default function NavRail() {
  const location = useLocation();
  const navRailExpanded = useWorkspaceStore((s) => s.navRailExpanded);
  const toggleNavRail = useWorkspaceStore((s) => s.toggleNavRail);
  const pins = useWorkspaceStore((s) => s.pins);
  const removePin = useWorkspaceStore((s) => s.removePin);
  const [activeMenuKey, setActiveMenuKey] = useState<string>(() => findParentKey(location.pathname) ?? location.pathname);

  // 路由切换时同步激活态
  useEffect(() => {
    setActiveMenuKey(findParentKey(location.pathname) ?? location.pathname);
  }, [location.pathname]);

  const handleSelect = (key: string) => {
    setActiveMenuKey(key);
  };

  // 分组：主菜单 vs 底部系统
  const mainItems = menuItems.filter((item) => !['系统'].includes(item.groupLabel ?? ''));
  const systemItems = menuItems.filter((item) => item.groupLabel === '系统');

  return (
    <aside
      className={`nav-rail ${navRailExpanded ? 'is-expanded' : 'is-collapsed'}`}
      aria-label="主导航"
    >
      {/* 品牌区 */}
      <div className="nav-rail-brand">
        <button
          type="button"
          className="nav-rail-brand-btn"
          onClick={toggleNavRail}
          aria-label={navRailExpanded ? '折叠导航栏' : '展开导航栏'}
          title={navRailExpanded ? '折叠' : '展开'}
        >
          <span className="nav-rail-brand-mark">LO</span>
        </button>
        {navRailExpanded ? <span className="nav-rail-brand-text">LifeOS2</span> : null}
      </div>

      {/* 收藏区 */}
      <div className="nav-rail-section nav-rail-pinned" aria-label="收藏">
        <div className="nav-rail-section-label">{navRailExpanded ? '收藏' : ''}</div>
        {pins.length === 0 ? (
          <div className="nav-rail-empty-hint">
            {navRailExpanded ? '在页面菜单中点击 ☆ 收藏' : ''}
          </div>
        ) : (
          <div className="nav-rail-pin-list">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className={`nav-rail-pin ${location.pathname === pin.path ? 'is-active' : ''}`}
                title={pin.path}
              >
                <Link
                  to={pin.path ?? '#'}
                  className="nav-rail-pin-link"
                  onClick={() => setActiveMenuKey(findParentKey(pin.path ?? '') ?? pin.path ?? '')}
                >
                  <span className="nav-rail-item-icon">
                    <Icon name={(pin.icon as IconKey) ?? 'dashboard'} />
                  </span>
                  {navRailExpanded ? <span className="nav-rail-pin-title">{pin.title}</span> : null}
                </Link>
                {navRailExpanded ? (
                  <button
                    type="button"
                    className="nav-rail-pin-remove"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removePin(pin.id);
                    }}
                    aria-label={`取消收藏 ${pin.title}`}
                    title="取消收藏"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 主导航 */}
      <nav className="nav-rail-section nav-rail-main" aria-label="主菜单">
        <div className="nav-rail-section-label">{navRailExpanded ? '主菜单' : ''}</div>
        {mainItems.map((item) => (
          <NavRailNode
            key={item.key}
            item={item}
            pathname={location.pathname}
            expanded={navRailExpanded}
            activeMenuKey={activeMenuKey}
            onSelect={handleSelect}
          />
        ))}
      </nav>

      {/* 底部系统菜单 */}
      <nav className="nav-rail-section nav-rail-system" aria-label="系统">
        {systemItems.map((item) => (
          <NavRailNode
            key={item.key}
            item={item}
            pathname={location.pathname}
            expanded={navRailExpanded}
            activeMenuKey={activeMenuKey}
            onSelect={handleSelect}
          />
        ))}
      </nav>
    </aside>
  );
}
