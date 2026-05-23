import { useState, useEffect } from 'react';

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  fire: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  trend: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
  file: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  medicine: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 11h-3v3h-4v-3H7v-4h3V7h4v3h3v4z',
  bank: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  cart: 'M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  compass: 'M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.21 4.21l-9.86 2.82c-.49.14-.73.68-.49 1.08l4.2 7.73c.34.61 1.13.61 1.47 0l4.2-7.73c.24-.4 0-.94-.49-1.08l-9.86-2.82c-.33-.09-.66.24-.54.57l2.24 7.85c.06.21.27.36.5.36.23 0 .44-.16.5-.36l2.24-7.85c.12-.33-.21-.66-.54-.57z',
  swap: 'M7.83 18l-1.41-1.41L10.41 13H2v-2h8.41l-3.99-3.59L7.83 6l6 6-6 6zm8.34-12l1.41 1.41L13.59 11H22v2h-8.41l3.99 3.59L16.17 18l-6-6 6-6z',
  calendar: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V10h14v9zm0-11H5V5h14v3z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  smile: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
  inbox: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.44 2s2.75-.81 3.44-2H19v3zm0-5h-4.12c-.51.76-1.34 1.25-2.38 1.25s-1.87-.49-2.38-1.25H5V5h14v9z',
  card: 'M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  check: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 13.17l4.59-4.58L18 10l-6 6z',
  fund: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
  globe: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  chart: 'M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2 2H5V5h14v14zm0-16H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  line: 'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
};

const menuItems = [
  { key: '/dashboard', icon: 'dashboard', label: '首页' },
  { key: 'health', icon: 'heart', label: '健康中心', children: [
    { key: '/health/step', icon: 'fire', label: '运动步数' },
    { key: '/health/fitness', icon: 'trend', label: '健身减肥' },
    { key: '/health/checkup', icon: 'file', label: '体检数据（待开发）' },
    { key: '/health/medication', icon: 'medicine', label: '日常用药' },
  ]},
  { key: 'finance', icon: 'bank', label: '财务中心', children: [
    { key: '/finance/shopping', icon: 'cart', label: '网上购物' },
    { key: '/finance/travel', icon: 'compass', label: '旅行游玩' },
    { key: '/finance/loan', icon: 'swap', label: '借款还款' },
    { key: '/finance/subscription', icon: 'calendar', label: '服务订阅（待开发）' },
    { key: '/finance/rent', icon: 'home', label: '房租水电' },
  ]},
  { key: 'life', icon: 'smile', label: '生活中心', children: [
    { key: '/life/storage', icon: 'inbox', label: '物品归纳' },
    { key: '/life/card', icon: 'card', label: '号卡管理' },
    { key: '/life/todo', icon: 'check', label: '待办事项' },
  ]},
  { key: 'investment', icon: 'fund', label: '投资中心', children: [
    { key: '/investment/forex', icon: 'globe', label: '外汇市场' },
    { key: '/investment/crypto', icon: 'shield', label: '加密市场（待开发）' },
    { key: '/investment/hk-stock', icon: 'chart', label: '港股市场（待开发）' },
    { key: '/investment/us-stock', icon: 'line', label: '美股市场（待开发）' },
  ]},
];

function getOpenKeys(pathname) {
  const prefix = pathname.split('/')[1];
  if (['health', 'finance', 'life', 'investment'].includes(prefix)) return [prefix];
  return [];
}

export default function SideMenu({ collapsed, isDark, navigate, location }) {
  const [openKeys, setOpenKeys] = useState(() => getOpenKeys(location.pathname));

  useEffect(() => { if (collapsed) setOpenKeys([]); }, [collapsed]);
  useEffect(() => {
    if (!collapsed) { const k = getOpenKeys(location.pathname); if (k.length) setOpenKeys(k); }
  }, [location.pathname, collapsed]);

  const toggleGroup = (key) => {
    setOpenKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [key]);
  };

  const linkStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: collapsed ? '10px 0' : '10px 16px',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: collapsed ? 13 : 15, fontWeight: active ? 500 : 400,
    backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-ink-subtle)',
    transition: 'all 0.15s', justifyContent: collapsed ? 'center' : 'flex-start',
    border: 'none', width: '100%', textAlign: 'left',
  });

  const SVG = ({ name, size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d={ICONS[name]} />
    </svg>
  );

  return (
    <nav style={{ padding: collapsed ? '16px 12px' : '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {menuItems.map(item => {
        const isActive = item.key === location.pathname || (item.children && item.children.some(c => c.key === location.pathname));
        const isOpen = openKeys.includes(item.key);
        if (item.children && !collapsed) {
          return (
            <div key={item.key}>
              <button onClick={() => toggleGroup(item.key)} style={{
                ...linkStyle(isActive), width: '100%', justifyContent: 'space-between',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SVG name={item.icon} />
                  {item.label}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isOpen && (
                <div style={{ marginLeft: 24, marginTop: 2 }}>
                  {item.children.map(child => {
                    const childActive = child.key === location.pathname;
                    return (
                      <button key={child.key} onClick={() => navigate(child.key)} style={linkStyle(childActive)}>
                        <SVG name={child.icon} size={16} />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
        if (!item.children) {
          return (
            <button key={item.key} onClick={() => navigate(item.key)} style={linkStyle(isActive)}>
              <SVG name={item.icon} />
              {!collapsed && item.label}
            </button>
          );
        }
        return null;
      })}
    </nav>
  );
}
