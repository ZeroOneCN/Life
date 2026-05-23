import { useState, useMemo, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';

const breadcrumbMap = {
  '/dashboard': ['首页'],
  '/health/step': ['健康中心', '运动步数'],
  '/health/fitness': ['健康中心', '健身减肥'],
  '/health/checkup': ['健康中心', '体检数据'],
  '/health/medication': ['健康中心', '日常用药'],
  '/finance/shopping': ['财务中心', '网上购物'],
  '/finance/travel': ['财务中心', '旅行游玩'],
  '/finance/loan': ['财务中心', '借款还款'],
  '/finance/subscription': ['财务中心', '服务订阅'],
  '/finance/rent': ['财务中心', '房租水电'],
  '/life/storage': ['生活中心', '物品归纳'],
  '/life/card': ['生活中心', '号卡管理'],
  '/life/todo': ['生活中心', '待办事项'],
  '/investment/forex': ['投资中心', '外汇市场'],
  '/investment/crypto': ['投资中心', '加密市场'],
  '/investment/hk-stock': ['投资中心', '港股市场'],
  '/investment/us-stock': ['投资中心', '美股市场'],
};

function getInitTheme() {
  try { return localStorage.getItem('theme') !== 'light'; }
  catch { return true; }
}

export default function MainLayout() {
  const [isDark, setIsDark] = useState(getInitTheme);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const crumbs = useMemo(() => {
    return breadcrumbMap[location.pathname] || [];
  }, [location.pathname]);

  const sidebarWidth = collapsed ? 80 : 240;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-canvas)' }}>
      {/* Sidebar */}
      <aside style={{
        overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20,
        width: sidebarWidth, backgroundColor: 'var(--color-surface-3)',
        borderRight: '1px solid var(--color-hairline)',
        transition: 'width 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}>
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-ink)', fontSize: collapsed ? 14 : 18, fontWeight: 600,
          letterSpacing: '-0.4px', borderBottom: '1px solid var(--color-hairline)',
        }}>
          {collapsed ? 'LO' : 'LifeOS'}
        </div>
        <SideMenu collapsed={collapsed} isDark={isDark} navigate={navigate} location={location} />
      </aside>

      {/* Header */}
      <header style={{
        position: 'fixed', top: 0, left: sidebarWidth, right: 0, height: 52, padding: '0 24px',
        display: 'flex', alignItems: 'center', zIndex: 10,
        backgroundColor: isDark ? 'rgba(24, 25, 26, 0.78)' : 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid var(--color-hairline)`,
        transition: 'left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}>
        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
          {crumbs.map((name, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--color-ink-tertiary)' }}>/</span>}
              <span style={{ color: i === crumbs.length - 1 ? 'var(--color-ink)' : 'var(--color-ink-subtle)' }}>{name}</span>
            </span>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={toggleTheme} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            color: 'var(--color-ink-subtle)', fontSize: 17, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
            )}
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div style={{
        marginLeft: sidebarWidth, paddingTop: 52,
        transition: 'margin-left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}>
        <main style={{ padding: '32px 24px', minHeight: 280 }}>
          <Outlet />
        </main>
        <footer style={{
          textAlign: 'center', color: 'var(--color-ink-tertiary)', fontSize: 12,
          padding: '16px 24px', borderTop: '1px solid var(--color-hairline)',
        }}>
          LifeOS Admin &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
