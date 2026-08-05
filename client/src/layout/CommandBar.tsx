import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useTheme } from '../hooks/useTheme';
import { routes } from '../config/navigation';
import { useWorkspaceStore } from '../stores/workspace.store';
import { setDensity } from '../hooks/useDeviceCapabilities';
import type { DeviceCapabilities } from '../hooks/useDeviceCapabilities';
import { useBreadcrumbTailContext } from '../hooks/useBreadcrumbTail';
import { logout, useAuthState } from '../services/auth';

type ThemeMode = 'light' | 'dark' | 'auto';
type Density = DeviceCapabilities['density'];

/**
 * 主题图标（light/dark/auto 三态）
 * @param mode - 主题模式
 * @param isDark - 当前是否暗色
 */
function ThemeIcon({ mode, isDark }: { mode: ThemeMode; isDark: boolean }) {
  if (mode === 'auto') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (isDark) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 通知铃铛图标
 */
function NotificationBellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 密度图标
 */
function DensityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 计算当前路由的面包屑（三级：模块 > 页面 > Tail）
 * @param pathname - 当前路径
 * @param tail - 上下文注入的第三级标签
 * @returns 面包屑项数组
 */
function buildBreadcrumb(pathname: string, tail: string | null | undefined): Array<{ label: string; path?: string }> {
  const route = routes.find((r) => r.path === pathname);
  const baseBreadcrumb = route?.breadcrumb ?? ['页面'];
  const effective = tail ? [...baseBreadcrumb, tail] : baseBreadcrumb;
  const pathParts = pathname.split('/').filter(Boolean);
  return effective.map((label, index) => {
    if (index === effective.length - 1) return { label };
    if (index === 0 && pathParts.length >= 2) {
      const moduleKey = pathParts[0];
      const overviewPath = `/${moduleKey}/overview`;
      const hasOverview = routes.some((r) => r.path === overviewPath);
      return { label, path: hasOverview ? overviewPath : '/dashboard' };
    }
    return { label };
  });
}

/**
 * CommandBar 顶部命令栏组件
 *
 * 五大元素：
 * - 左侧：⌘K 触发器 + 面包屑
 * - 右侧：密度切换 / 主题切换 / 通知铃铛 / 用户菜单
 *
 * 高度 48px 固定，背景 canvas，底部 1px hairline 分隔。
 * 命令面板（⌘K）当前为占位，阶段 B 实装完整搜索。
 *
 * @returns CommandBar JSX
 */
export default function CommandBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, mode, setMode } = useTheme();
  const authState = useAuthState();
  const { tail } = useBreadcrumbTailContext();
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const commandPaletteOpen = useWorkspaceStore((s) => s.commandPaletteOpen);

  const [densityOpen, setDensityOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [currentDensity, setCurrentDensity] = useState<Density>(() => {
    if (typeof window === 'undefined') return 'cozy';
    return (localStorage.getItem('lifeos-density') as Density) || 'cozy';
  });

  const densityRef = useRef<HTMLDivElement | null>(null);
  const themeRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const breadcrumb = useMemo(() => buildBreadcrumb(location.pathname, tail), [location.pathname, tail]);

  const currentUser = authState.session?.user ?? null;
  const userDisplayName = currentUser?.nickname || currentUser?.username || '当前用户';
  const userInitial = userDisplayName.slice(0, 1).toUpperCase();

  // 全局 ⌘K 监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (densityRef.current && !densityRef.current.contains(e.target as Node)) setDensityOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // 路由切换时关闭所有下拉
  useEffect(() => {
    setDensityOpen(false);
    setThemeOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleCommandTrigger = () => {
    setCommandPaletteOpen(true);
  };

  const handleDensitySelect = (next: Density) => {
    setCurrentDensity(next);
    setDensity(next);
    setDensityOpen(false);
  };

  const handleThemeSelect = (next: ThemeMode) => {
    setMode(next);
    setThemeOpen(false);
  };

  const handleLogout = async () => {
    setLogoutConfirmOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="command-bar" role="banner">
      {/* 左侧：⌘K 触发器 + 面包屑 */}
      <div className="command-bar-left">
        <button
          type="button"
          className="command-bar-trigger"
          onClick={handleCommandTrigger}
          aria-label="打开命令面板"
          title="搜索页面、记录、动作（⌘K）"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="command-bar-trigger-text">搜索或输入命令</span>
          <span className="command-bar-trigger-kbd" aria-hidden="true">⌘K</span>
        </button>

        <nav className="command-bar-breadcrumb" aria-label="面包屑导航">
          {breadcrumb.map((item, index) => (
            <span key={`${item.label}-${index}`} className="command-bar-breadcrumb-item">
              {index > 0 ? <span className="command-bar-breadcrumb-sep" aria-hidden="true">/</span> : null}
              {item.path ? (
                <button
                  type="button"
                  className="command-bar-breadcrumb-link"
                  onClick={() => navigate(item.path!)}
                >
                  {item.label}
                </button>
              ) : (
                <span aria-current={index === breadcrumb.length - 1 ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* 右侧：密度 / 主题 / 通知 / 用户 */}
      <div className="command-bar-right">
        {/* 密度切换 */}
        <div className="command-bar-dropdown" ref={densityRef}>
          <button
            type="button"
            className="command-bar-icon-btn"
            onClick={() => setDensityOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={densityOpen}
            title={`密度：${currentDensity}`}
          >
            <DensityIcon />
          </button>
          {densityOpen ? (
            <div className="command-bar-menu" role="menu">
              <div className="command-bar-menu-title">密度</div>
              {(['compact', 'cozy', 'comfortable'] as Density[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`command-bar-menu-item ${currentDensity === d ? 'is-active' : ''}`}
                  onClick={() => handleDensitySelect(d)}
                  role="menuitem"
                >
                  <span>{d === 'compact' ? '紧凑' : d === 'cozy' ? '舒适（默认）' : '宽松'}</span>
                  {currentDensity === d ? <span className="command-bar-menu-check" aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* 主题切换 */}
        <div className="command-bar-dropdown" ref={themeRef}>
          <button
            type="button"
            className="command-bar-icon-btn"
            onClick={() => setThemeOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={themeOpen}
            title={`主题：${mode}`}
          >
            <ThemeIcon mode={mode} isDark={isDark} />
          </button>
          {themeOpen ? (
            <div className="command-bar-menu" role="menu">
              <div className="command-bar-menu-title">主题</div>
              {(['light', 'dark', 'auto'] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`command-bar-menu-item ${mode === t ? 'is-active' : ''}`}
                  onClick={() => handleThemeSelect(t)}
                  role="menuitem"
                >
                  <span>{t === 'light' ? '亮色' : t === 'dark' ? '暗色' : '跟随系统'}</span>
                  {mode === t ? <span className="command-bar-menu-check" aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* 通知铃铛（占位，保留跳转通知中心） */}
        <button
          type="button"
          className="command-bar-icon-btn"
          onClick={() => navigate('/notifications')}
          title="通知中心"
          aria-label="通知中心"
        >
          <NotificationBellIcon />
        </button>

        {/* 用户菜单 */}
        <div className="command-bar-dropdown command-bar-user" ref={userMenuRef}>
          <button
            type="button"
            className="command-bar-avatar"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            title={userDisplayName}
          >
            <span className="command-bar-avatar-text" aria-hidden="true">{userInitial}</span>
          </button>
          {userMenuOpen ? (
            <div className="command-bar-menu command-bar-user-menu" role="menu">
              <div className="command-bar-user-info">
                <div className="command-bar-user-name">{userDisplayName}</div>
                <div className="command-bar-user-meta">{currentUser?.email || currentUser?.timezone || '已登录会话'}</div>
              </div>
              <div className="command-bar-menu-divider" />
              <button
                type="button"
                className="command-bar-menu-item"
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/settings/profile');
                }}
                role="menuitem"
              >
                <span>个人中心</span>
              </button>
              <button
                type="button"
                className="command-bar-menu-item is-danger"
                onClick={() => {
                  setUserMenuOpen(false);
                  setLogoutConfirmOpen(true);
                }}
                role="menuitem"
              >
                <span>退出登录</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* 退出确认弹窗 */}
      {logoutConfirmOpen ? (
        <div className="command-bar-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
          <div className="command-bar-modal">
            <div id="logout-confirm-title" className="command-bar-modal-title">确认退出登录？</div>
            <div className="command-bar-modal-desc">退出后需要重新登录才能访问数据。</div>
            <div className="command-bar-modal-actions">
              <button type="button" className="command-bar-modal-btn" onClick={() => setLogoutConfirmOpen(false)}>
                取消
              </button>
              <button type="button" className="command-bar-modal-btn is-primary is-danger" onClick={handleLogout}>
                退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
