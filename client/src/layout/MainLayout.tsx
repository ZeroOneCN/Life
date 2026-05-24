import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { menuItems, routes } from '../config/navigation';
import { useTheme } from '../hooks/useTheme';
import type { IconKey, MenuItemConfig } from '../types/navigation';

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
};

function Icon({ name }: { name: IconKey }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={iconMap[name]} />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`menu-chevron ${open ? 'is-open' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function findParentKey(pathname: string) {
  const prefix = pathname.split('/')[1];
  return ['health', 'finance', 'life', 'investment'].includes(prefix) ? prefix : null;
}

function getActiveMenuKey(pathname: string) {
  return findParentKey(pathname) ?? pathname;
}

function MenuNode({
  item,
  pathname,
  collapsed,
  openGroups,
  activeMenuKey,
  setOpenGroups,
  setActiveMenuKey,
}: {
  item: MenuItemConfig;
  pathname: string;
  collapsed: boolean;
  openGroups: string[];
  activeMenuKey: string;
  setOpenGroups: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveMenuKey: React.Dispatch<React.SetStateAction<string>>;
}) {
  const isRouteActive = item.key === pathname || item.children?.some((child) => child.key === pathname);
  const isOpen = openGroups.includes(item.key);
  const isActive = item.children?.length ? activeMenuKey === item.key : activeMenuKey === item.key || isRouteActive;

  if (item.children?.length) {
    return (
      <div className="menu-group">
        <button
          type="button"
          className={`menu-link ${isActive ? 'is-active' : ''}`}
          onClick={() => {
            setActiveMenuKey(item.key);
            setOpenGroups((previous) => (previous.includes(item.key) ? [] : [item.key]));
          }}
          aria-expanded={isOpen}
        >
          <span className="menu-link-main">
            <Icon name={item.icon} />
            {!collapsed ? <span className="menu-label">{item.label}</span> : null}
          </span>
          {!collapsed ? <ChevronIcon open={isOpen} /> : null}
        </button>
        {isOpen && !collapsed ? (
          <div className="submenu">
            {item.children.map((child) => (
              <Link
                key={child.key}
                to={child.key}
                className={`menu-link menu-child ${pathname === child.key ? 'is-active' : ''}`}
                onClick={() => setActiveMenuKey(item.key)}
              >
                <span className="menu-link-main">
                  <Icon name={child.icon} />
                  <span className="menu-label">{child.label}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      to={item.key}
      className={`menu-link ${isActive ? 'is-active' : ''}`}
      onClick={() => setActiveMenuKey(item.key)}
    >
      <span className="menu-link-main">
        <Icon name={item.icon} />
        {!collapsed ? <span className="menu-label">{item.label}</span> : null}
      </span>
    </Link>
  );
}

export default function MainLayout() {
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const parent = findParentKey(location.pathname);
    return parent ? [parent] : [];
  });
  const [activeMenuKey, setActiveMenuKey] = useState(() => getActiveMenuKey(location.pathname));

  const route = routes.find((item) => item.path === location.pathname);
  const breadcrumb = route?.breadcrumb ?? ['页面'];
  const sidebarWidth = collapsed ? 88 : 260;

  useEffect(() => {
    const parent = findParentKey(location.pathname);
    setOpenGroups(parent ? [parent] : []);
    setActiveMenuKey(getActiveMenuKey(location.pathname));
  }, [location.pathname]);

  return (
    <div className={`layout-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-copy">
            <strong>{collapsed ? 'LO' : 'LifeOS'}</strong>
            {!collapsed ? <span className="subtle-text brand-subtitle">TypeScript Admin</span> : null}
          </div>
        </div>
        <nav className="menu">
          {menuItems.map((item) => (
            <MenuNode
              key={item.key}
              item={item}
              pathname={location.pathname}
              collapsed={collapsed}
              openGroups={openGroups}
              activeMenuKey={activeMenuKey}
              setOpenGroups={setOpenGroups}
              setActiveMenuKey={setActiveMenuKey}
            />
          ))}
        </nav>
      </aside>

      <div className="layout-main" style={{ marginLeft: sidebarWidth }}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button"
              type="button"
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              onClick={() => setCollapsed((previous) => !previous)}
            >
              <SidebarToggleIcon collapsed={collapsed} />
            </button>
            <div className="breadcrumb">
              {breadcrumb.map((item, index) => (
                <span key={item} className={index === breadcrumb.length - 1 ? 'is-current' : ''}>
                  {index ? ' / ' : ''}
                  {item}
                </span>
              ))}
            </div>
          </div>
          <button
            className="icon-button theme-toggle"
            type="button"
            aria-label={isDark ? '切换到日间模式' : '切换到夜间模式'}
            onClick={toggleTheme}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
