import { useState, useMemo, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, ConfigProvider, theme, Breadcrumb, Button } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import SideMenu from './SideMenu';

const { Header, Sider, Content, Footer } = Layout;

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

const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#5e6ad2',
    colorPrimaryHover: '#828fff',
    colorText: '#f7f8f8',
    colorTextSecondary: '#d0d6e0',
    colorBgLayout: '#010102',
    colorBgContainer: '#0f1011',
    colorBorder: '#23252a',
    colorBorderSecondary: '#23252a',
    fontSize: 17,
    fontFamily: "Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif",
    borderRadius: 8,
    borderRadiusLG: 12,
  },
  components: {
    Layout: { headerBg: 'transparent', siderBg: '#18191a', bodyBg: '#010102' },
    Menu: {
      darkItemBg: 'transparent',
      darkItemColor: '#d0d6e0',
      darkItemHoverBg: 'rgba(255,255,255,0.04)',
      darkItemSelectedBg: 'rgba(94,106,210,0.15)',
      darkItemSelectedColor: '#5e6ad2',
      darkSubMenuItemBg: 'transparent',
    },
    Segmented: {
      trackBg: 'transparent',
      itemActiveBg: '#5e6ad2',
      itemColor: '#8a8f98',
      itemHoverBg: 'rgba(94,106,210,0.12)',
      itemSelectedBg: '#5e6ad2',
      itemSelectedColor: '#ffffff',
    },
  },
};

const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#5e6ad2',
    colorPrimaryHover: '#828fff',
    colorText: '#1d1d1f',
    colorTextSecondary: '#62666d',
    colorBgLayout: '#f5f6f7',
    colorBgContainer: '#ffffff',
    colorBorder: '#e5e7eb',
    colorBorderSecondary: '#e5e7eb',
    fontSize: 17,
    fontFamily: "Inter, 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif",
    borderRadius: 8,
    borderRadiusLG: 12,
  },
  components: {
    Layout: { headerBg: 'transparent', siderBg: '#f0f1f2', bodyBg: '#f5f6f7' },
    Segmented: {
      trackBg: 'transparent',
      itemActiveBg: '#5e6ad2',
      itemColor: '#6b6f76',
      itemHoverBg: 'rgba(94,106,210,0.08)',
      itemSelectedBg: '#5e6ad2',
      itemSelectedColor: '#ffffff',
    },
  },
};

function getInitTheme() {
  try {
    const saved = localStorage.getItem('theme');
    return saved !== 'light'; // default dark
  } catch {
    return true;
  }
}

export default function MainLayout() {
  const [isDark, setIsDark] = useState(getInitTheme);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  const breadcrumbItems = useMemo(() => {
    const items = breadcrumbMap[location.pathname] || [];
    return items.map((name) => ({ title: name }));
  }, [location.pathname]);

  return (
    <ConfigProvider theme={isDark ? darkTheme : lightTheme}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme={isDark ? 'dark' : 'light'}
          width={240}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 20,
            borderRight: '1px solid',
            borderRightColor: isDark ? '#23252a' : '#e5e7eb',
          }}
        >
          <div
            style={{
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? '#f7f8f8' : '#1d1d1f',
              fontSize: collapsed ? 14 : 18,
              fontWeight: 600,
              letterSpacing: '-0.4px',
              borderBottom: `1px solid ${isDark ? '#23252a' : '#e5e7eb'}`,
            }}
          >
            {collapsed ? 'LO' : 'LifeOS'}
          </div>

          <SideMenu
            collapsed={collapsed}
            isDark={isDark}
            onSelect={({ key }) => navigate(key)}
            selectedKeys={[location.pathname]}
          />
        </Sider>

        {/* Fixed header — spans from sidebar edge to viewport edge */}
        <Header
          style={{
            position: 'fixed',
            top: 0,
            left: collapsed ? 80 : 240,
            right: 0,
            height: 52,
            padding: '0 24px',
            background: isDark
              ? 'rgba(24, 25, 26, 0.78)'
              : 'rgba(255, 255, 255, 0.78)',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 10,
            borderBottom: `1px solid ${isDark ? '#23252a' : '#e5e7eb'}`,
            transition: 'left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          <Breadcrumb items={breadcrumbItems} />
          <div style={{ marginLeft: 'auto' }}>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              style={{
                color: isDark ? '#8a8f98' : '#62666d',
                fontSize: 17,
              }}
            />
          </div>
        </Header>

        <Layout
          style={{
            marginLeft: collapsed ? 80 : 240,
            paddingTop: 52,
            transition: 'margin-left 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          <Content style={{ padding: '32px 24px', minHeight: 280 }}>
            <Outlet />
          </Content>

          <Footer
            style={{
              textAlign: 'center',
              color: isDark ? '#62666d' : '#9ca3af',
              fontSize: 12,
              padding: '16px 24px',
              borderTop: `1px solid ${isDark ? '#23252a' : '#e5e7eb'}`,
            }}
          >
            LifeOS Admin &copy; {new Date().getFullYear()}
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
