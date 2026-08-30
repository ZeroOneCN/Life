import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Menu } from '@arco-design/web-react';
import { Btn, Modal } from '../components/ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AssistantLauncher } from '../components/shared/AssistantLauncher';
import { menuItems, routes } from '../config/navigation';
import { MenuIcon } from '../config/menuIcons';
import { useTheme } from '../hooks/useTheme';
import { BreadcrumbTailProvider, useBreadcrumbTailContext } from '../hooks/useBreadcrumbTail';
import { logout, useAuthState } from '../services/auth';
import type { MenuItemConfig } from '../types/navigation';

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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

function ThemeIcon({ mode, isDark }: { mode: string; isDark: boolean }) {
  if (mode === 'auto') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (isDark) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NotificationBellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function findParentKey(pathname: string) {
  const prefix = pathname.split('/')[1];
  return ['health', 'finance', 'life', 'investment'].includes(prefix) ? prefix : null;
}

/**
 * 面包屑导航组件。
 *
 * 在静态面包屑（来自路由配置）基础上，从 BreadcrumbTailContext 读取
 * 页面组件注入的第三级标签（通常是当前 Tab 名称），动态追加到末尾。
 */
function BreadcrumbNav({ breadcrumb }: { breadcrumb: string[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tail } = useBreadcrumbTailContext();

  const items = useMemo(() => {
    const result: Array<{ label: string; path?: string }> = [];
    const pathParts = location.pathname.split('/').filter(Boolean);
    const effectiveBreadcrumb = tail ? [...breadcrumb, tail] : breadcrumb;

    effectiveBreadcrumb.forEach((label, index) => {
      if (index === effectiveBreadcrumb.length - 1) {
        result.push({ label });
      } else if (index === 0 && pathParts.length >= 2) {
        const moduleKey = pathParts[0];
        const overviewPath = `/${moduleKey}/overview`;
        const hasOverview = routes.some((r) => r.path === overviewPath);
        result.push({
          label,
          path: hasOverview ? overviewPath : '/dashboard',
        });
      } else {
        result.push({ label });
      }
    });

    return result;
  }, [breadcrumb, tail, location.pathname]);

  return (
    <div className="breadcrumb" aria-label="面包屑导航">
      {items.map((item, index) => (
        <span key={item.label} className={index === items.length - 1 ? 'is-current' : ''}>
          {index ? <span className="breadcrumb-sep" aria-hidden="true">/</span> : null}
          {item.path ? (
            <button
              type="button"
              className="breadcrumb-link"
              onClick={() => navigate(item.path!)}
              aria-label={`跳转到${item.label}`}
            >
              {item.label}
            </button>
          ) : (
            <span aria-current={index === items.length - 1 ? 'page' : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * 使用 Arco Menu 渲染菜单项（含分组和子菜单）
 */
function ArcoMenuItems({ items }: { items: MenuItemConfig[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, MenuItemConfig[]>();
    items.forEach((item) => {
      const group = item.groupLabel || 'default';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <>
      {groups.map(([groupLabel, groupItems]) => (
        <Menu.ItemGroup key={groupLabel} title={groupLabel}>
          {groupItems.map((item) => {
            if (item.children?.length) {
              return (
                <Menu.SubMenu
                  key={item.key}
                  title={
                    <>
                      <MenuIcon name={item.icon} />
                      <span>{item.label}</span>
                    </>
                  }
                >
                  {item.children.map((child) => (
                    <Menu.Item key={child.key}>
                      <MenuIcon name={child.icon} />
                      <span>{child.label}</span>
                    </Menu.Item>
                  ))}
                </Menu.SubMenu>
              );
            }
            return (
              <Menu.Item key={item.key}>
                <MenuIcon name={item.icon} />
                <span>{item.label}</span>
              </Menu.Item>
            );
          })}
        </Menu.ItemGroup>
      ))}
    </>
  );
}

export default function MainLayout() {
  const navigate = useNavigate();
  const { isDark, mode, toggleTheme } = useTheme();
  const authState = useAuthState();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const parent = findParentKey(location.pathname);
    return parent ? [parent] : [];
  });
  const [showBackToTop, setShowBackToTop] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const route = routes.find((item) => item.path === location.pathname);
  const breadcrumb = route?.breadcrumb ?? ['页面'];

  const sidebarWidth = collapsed ? 88 : 260;
  const currentUser = authState.session?.user ?? null;
  const userDisplayName = useMemo(
    () => currentUser?.nickname || currentUser?.username || '当前用户',
    [currentUser],
  );
  const userSummary = useMemo(
    () => currentUser?.email || currentUser?.timezone || '已登录会话',
    [currentUser],
  );
  const userInitial = useMemo(
    () => userDisplayName.slice(0, 1).toUpperCase(),
    [userDisplayName],
  );

  useEffect(() => {
    const parent = findParentKey(location.pathname);
    setOpenGroups((previous) => {
      if (parent && !previous.includes(parent)) {
        return [...previous, parent];
      }
      return previous;
    });
    setUserMenuOpen(false);
    setMobileMenuOpen(false);

    // 路由切换时立即滚动到顶部（绕过 CSS smooth 平滑动画）
    const html = document.documentElement;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = '';
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1025px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setMobileMenuOpen(false);
      }
    };
    mq.addEventListener('change', handler);
    if (mq.matches) {
      setMobileMenuOpen(false);
    }
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 小屏自动折叠侧边栏
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1280px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setCollapsed(true);
      }
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`layout-shell ${collapsed ? 'is-collapsed' : ''}`}>
      {/* 移动端侧边栏遮罩 */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? 'is-visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar${mobileMenuOpen ? ' is-mobile-open' : ''}`} style={{ width: sidebarWidth }}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-copy">
            <strong>{collapsed ? 'LO' : 'LifeOS'}</strong>
            {!collapsed ? <span className="subtle-text brand-subtitle">个人生活数字化管理平台</span> : null}
          </div>
        </div>
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="vertical"
          collapse={collapsed}
          accordion
          selectedKeys={[location.pathname]}
          openKeys={openGroups}
          onClickMenuItem={(key) => {
            navigate(key);
          }}
          onClickSubMenu={(key, newOpenKeys) => {
            setOpenGroups(newOpenKeys);
          }}
          style={{ border: 'none', overflow: 'auto', flex: 1 }}
        >
          <ArcoMenuItems items={menuItems} />
        </Menu>
      </aside>

      <div className="layout-main" style={{ marginLeft: sidebarWidth }}>
        <header className="topbar">
          <div className="topbar-left">
            {/* 移动端汉堡菜单按钮 */}
            <button
              className="icon-button sidebar-toggle-mobile"
              type="button"
              aria-label="打开导航菜单"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <HamburgerIcon />
            </button>
            {/* PC 端折叠/展开按钮 */}
            <button
              className="icon-button sidebar-toggle-desktop"
              type="button"
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              onClick={() => setCollapsed((previous) => !previous)}
            >
              <SidebarToggleIcon collapsed={collapsed} />
            </button>
            <BreadcrumbNav breadcrumb={breadcrumb} />
          </div>

          <div className="topbar-right">
            <button
              className="icon-button theme-toggle"
              type="button"
              aria-label={mode === 'auto' ? '跟随系统' : isDark ? '切换到浅色模式' : '切换到深色模式'}
              title={mode === 'auto' ? '跟随系统' : isDark ? '切换到浅色模式' : '切换到深色模式'}
              onClick={toggleTheme}
            >
              <ThemeIcon mode={mode} isDark={isDark} />
            </button>

            <button
              className="icon-button notification-bell"
              type="button"
              aria-label="通知中心"
              title="通知中心"
              onClick={() => navigate('/notifications')}
            >
              <NotificationBellIcon />
            </button>

            <div className="topbar-user-menu" ref={userMenuRef}>
              <button
                className={`topbar-user-trigger ${userMenuOpen ? 'is-open' : ''}`}
                type="button"
                aria-expanded={userMenuOpen}
                aria-label="打开用户菜单"
                onClick={() => setUserMenuOpen((previous) => !previous)}
              >
                {currentUser?.avatarUrl ? (
                  <img className="topbar-user-avatar" src={currentUser.avatarUrl} alt={userDisplayName} />
                ) : (
                  <span className="topbar-user-avatar topbar-user-avatar-fallback">{userInitial}</span>
                )}
              </button>

              {userMenuOpen ? (
                <div className="topbar-user-dropdown">
                  <div className="topbar-user-dropdown-header">
                    <strong>{userDisplayName}</strong>
                    <span>{userSummary}</span>
                  </div>
                  <button
                    type="button"
                    className="topbar-user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings/profile');
                    }}
                  >
                    进入个人中心
                  </button>
                  <button
                    type="button"
                    className="topbar-user-dropdown-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings/profile?tab=security');
                    }}
                  >
                    修改密码
                  </button>
                  <button
                    type="button"
                    className="topbar-user-dropdown-item is-danger"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setLogoutConfirmOpen(true);
                    }}
                  >
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="content" key={location.pathname}>
          <div className="page-transition">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <Modal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="确认退出登录"
        width={440}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setLogoutConfirmOpen(false)}>取消</Btn>
            <Btn
              tone="danger-fill"
              onClick={() => {
                setLogoutConfirmOpen(false);
                void logout();
              }}
            >
              确认退出
            </Btn>
          </>
        )}
      >
        <p>确定要退出当前账户吗？退出后需要重新登录才能使用。</p>
      </Modal>

      <nav className="bottom-nav" aria-label="底部导航">
        <Link
          to="/dashboard"
          className={`bottom-nav-item ${location.pathname === '/dashboard' ? 'is-active' : ''}`}
        >
          <MenuIcon name="home" />
          <span>首页</span>
        </Link>
        <Link
          to="/health/overview"
          className={`bottom-nav-item ${location.pathname.startsWith('/health') ? 'is-active' : ''}`}
        >
          <MenuIcon name="heart" />
          <span>健康</span>
        </Link>
        <Link
          to="/finance/overview"
          className={`bottom-nav-item ${location.pathname.startsWith('/finance') ? 'is-active' : ''}`}
        >
          <MenuIcon name="wallet" />
          <span>财务</span>
        </Link>
        <Link
          to="/life/todo"
          className={`bottom-nav-item ${location.pathname.startsWith('/life') ? 'is-active' : ''}`}
        >
          <MenuIcon name="grid" />
          <span>生活</span>
        </Link>
        <Link
          to="/investment/forex"
          className={`bottom-nav-item ${location.pathname.startsWith('/investment') ? 'is-active' : ''}`}
        >
          <MenuIcon name="chart" />
          <span>投资</span>
        </Link>
        <Link
          to="/settings/profile"
          className={`bottom-nav-item ${location.pathname.startsWith('/settings') ? 'is-active' : ''}`}
        >
          <MenuIcon name="user" />
          <span>我的</span>
        </Link>
      </nav>

      {showBackToTop ? (
        <button
          type="button"
          className="back-to-top show"
          onClick={scrollToTop}
          aria-label="返回顶部"
          title="返回顶部"
        >
          ↑
        </button>
      ) : null}

      <AssistantLauncher />
    </div>
  );
}
