import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { menuItems } from '../config/navigation';
import { MenuIcon } from '../config/menuIcons';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { MenuItemConfig } from '../types/navigation';

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
  groupOpen,
  onToggleGroup,
  onSelect,
}: {
  item: MenuItemConfig;
  pathname: string;
  expanded: boolean;
  activeMenuKey: string;
  groupOpen: boolean;
  onToggleGroup: (key: string) => void;
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
  // 展开态：点击带子项的节点 → 切换二级显示（互斥，同时只展开一组）
  const handleClick = (e: React.MouseEvent) => {
    onSelect(item.key);
    if (hasChildren && !expanded) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // 右侧空间不足（popover 约 200px）时改为左侧弹出
      const left = rect.right + 8 + 200 > window.innerWidth ? rect.left - 208 : rect.right + 8;
      setPopoverPos({ top: rect.top, left: Math.max(8, left) });
      setPopoverOpen((v) => !v);
    } else if (hasChildren && expanded) {
      // 展开态：展开/收起自己的二级；打开其他组时当前组自动关闭（互斥）
      setPopoverOpen(false);
      onToggleGroup(item.key);
    } else {
      setPopoverOpen(false);
      // 无子项节点（首页/通知/个人中心）：直接路由跳转
      navigate(item.key);
    }
  };

  return (
    <div className={`nav-rail-node ${isActive ? 'is-active' : ''}`} ref={nodeRef}>
      <button
        type="button"
        className="nav-rail-item"
        onClick={handleClick}
        aria-expanded={hasChildren ? (expanded ? groupOpen : popoverOpen) : undefined}
        aria-current={isActive ? 'page' : undefined}
        title={expanded ? undefined : item.label}
      >
        <span className="nav-rail-item-icon">
          <MenuIcon name={item.icon} />
        </span>
        {expanded ? <span className="nav-rail-item-label">{item.label}</span> : null}
        {hasChildren && expanded ? (
          <svg
            className={`nav-rail-chevron ${groupOpen ? 'is-open' : ''}`}
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
                <MenuIcon name={child.icon} />
                <span>{child.label}</span>
              </Link>
            ))}
          </div>,
          document.body,
        )
      ) : null}

      {/* 展开态：二级渲染（仅当前组展开时显示） */}
      {hasChildren && expanded && groupOpen ? (
        <div className="nav-rail-submenu">
          {item.children!.map((child) => (
            <Link
              key={child.key}
              to={child.key}
              className={`nav-rail-submenu-item ${pathname === child.key ? 'is-active' : ''}`}
              onClick={() => onSelect(item.key)}
            >
              <MenuIcon name={child.icon} />
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
  // 展开态下当前展开（显示二级）的一级菜单 key；互斥，同时只展开一组
  const [openGroupKey, setOpenGroupKey] = useState<string>(() => findParentKey(location.pathname) ?? '');

  // 路由切换时同步激活态与展开组
  useEffect(() => {
    const parent = findParentKey(location.pathname);
    setActiveMenuKey(parent ?? location.pathname);
    if (parent) setOpenGroupKey(parent);
  }, [location.pathname]);

  const handleSelect = (key: string) => {
    setActiveMenuKey(key);
  };

  // 展开态切换一级组：打开其他组时当前组自动关闭（互斥）
  const handleToggleGroup = (key: string) => {
    setOpenGroupKey((prev) => (prev === key ? '' : key));
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
                    <MenuIcon name={pin.icon ?? 'home'} />
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
            groupOpen={openGroupKey === item.key}
            onToggleGroup={handleToggleGroup}
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
            groupOpen={openGroupKey === item.key}
            onToggleGroup={handleToggleGroup}
            onSelect={handleSelect}
          />
        ))}
      </nav>
    </aside>
  );
}
