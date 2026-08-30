import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import {
  Layout,
  Menu,
  Modal,
  Avatar,
  Dropdown,
  Button,
  Message,
  Breadcrumb,
  Drawer,
} from '@arco-design/web-react';
import {
  IconHome,
  IconHeart,
  IconSafe,
  IconApps,
  IconDashboard,
  IconNotification,
  IconUser,
  IconSkin,
  IconNav,
  IconFile,
  IconExperiment,
  IconStar,
  IconStorage,
  IconIdcard,
  IconOrderedList,
  IconCalendar,
  IconSwap,
  IconSend,
  IconExclamation,
  IconList,
  IconMenuFold,
  IconMenuUnfold,
  IconSearch,
  IconExport,
  IconCommand,
} from '@arco-design/web-react/icon';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { AssistantLauncher } from '../components/shared/AssistantLauncher';
import { menuItems, routes } from '../config/navigation';
import { BreadcrumbTailProvider, useBreadcrumbTailContext } from '../hooks/useBreadcrumbTail';
import { logout, useAuthState } from '../services/auth';
import { useWorkspaceStore } from '../stores/workspace.store';
import CommandPalette from './CommandPalette';
import type { MenuItemConfig } from '../types/navigation';

const { Header, Sider, Content, Footer } = Layout;
const MenuItem = Menu.Item;
const SubMenu = Menu.SubMenu;

/* ====================================================================
 * 完整的 Arco Design 图标映射表
 * 覆盖 menuIcons.tsx 中定义的所有 26+ 个图标 key
 * ==================================================================== */
const COMPLETE_ICON_MAP: Record<string, React.ReactNode> = {
  home: <IconHome />,
  heart: <IconHeart />,
  wallet: <IconSafe />,
  grid: <IconApps />,
  chart: <IconDashboard />,
  bell: <IconNotification />,
  user: <IconUser />,
  pulse: <IconHeart />,
  moon: <IconMoon />,
  dumbbell: <IconSkin />,
  steps: <IconNav />,
  clipboard: <IconFile />,
  pill: <IconExperiment />,
  doc: <IconFile />,
  pie: <IconDashboard />,
  receipt: <IconFile />,
  cart: <IconSafe />,
  plane: <IconSend />,
  list: <IconList />,
  alert: <IconExclamation />,
  target: <IconStar />,
  box: <IconStorage />,
  card: <IconIdcard />,
  checklist: <IconOrderedList />,
  calendar: <IconCalendar />,
  exchange: <IconSwap />,
  'user-group': <IconUser />,
};

/**
 * 根据图标 key 获取 Arco 图标组件
 */
function getArcoIcon(iconName: string): React.ReactNode {
  return COMPLETE_ICON_MAP[iconName] ?? <IconCommand />;
}

/* ====================================================================
 * 递归渲染 Arco 菜单项（含分组）
 * ==================================================================== */
function renderMenuItems(items: MenuItemConfig[]): React.ReactNode[] {
  const groups = new Map<string, MenuItemConfig[]>();
  items.forEach((item) => {
    const group = item.groupLabel || 'default';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  });

  return Array.from(groups.entries()).map(([groupLabel, groupItems]) => (
    <Menu.ItemGroup key={groupLabel} title={groupLabel}>
      {groupItems.map((item) => {
        if (item.children?.length) {
          return (
            <SubMenu
              key={item.key}
              title={
                <>
                  {getArcoIcon(item.icon)}
                  <span>{item.label}</span>
                </>
              }
            >
              {item.children.map((child) => (
                <MenuItem key={child.key}>
                  {getArcoIcon(child.icon)}
                  <span>{child.label}</span>
                </MenuItem>
              ))}
            </SubMenu>
          );
        }
        return (
          <MenuItem key={item.key}>
            {getArcoIcon(item.icon)}
            <span>{item.label}</span>
          </MenuItem>
        );
      })}
    </Menu.ItemGroup>
  ));
}

/* ====================================================================
 * 查找当前路由对应的面包屑配置
 * ==================================================================== */
function findBreadcrumb(pathname: string): string[] {
  const route = routes.find((r) => r.path === pathname);
  return route?.breadcrumb ?? ['页面'];
}

/* ====================================================================
 * 面包屑栏组件（独立组件，渲染在 BreadcrumbTailProvider 内部，
 * 确保能正确读取 useBreadcrumbTailContext 的动态 tail 值）
 * ==================================================================== */
function BreadcrumbBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tail } = useBreadcrumbTailContext();

  const breadcrumbItems = useMemo(() => {
    const base = findBreadcrumb(location.pathname);
    const items = tail ? [...base, tail] : base;
    return items.map((label, index) => {
      if (index < items.length - 1) {
        // 第一级可点击跳转到模块概览
        const pathParts = location.pathname.split('/').filter(Boolean);
        if (index === 0 && pathParts.length >= 2) {
          const moduleKey = pathParts[0];
          const overviewPath = `/${moduleKey}/overview`;
          const hasOverview = routes.some((r) => r.path === overviewPath);
          return { label, href: hasOverview ? overviewPath : undefined };
        }
        return { label, href: undefined };
      }
      return { label };
    });
  }, [location.pathname, tail]);

  return (
    <Breadcrumb className="arco-layout-breadcrumb">
      {breadcrumbItems.map((item, index) => (
        <Breadcrumb.Item key={`${item.label}-${index}`}>
          {item.href ? (
            <a
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.href!);
              }}
            >
              {item.label}
            </a>
          ) : (
            <span>{item.label}</span>
          )}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}

/* ====================================================================
 * 悬浮返回顶部按钮
 * ==================================================================== */
function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      className="arco-layout-back-top"
      onClick={scrollToTop}
      aria-label="返回顶部"
      title="返回顶部"
    >
      <IconToTop />
    </button>
  );
}

/* ====================================================================
 * 页面内容区（渲染 Outlet，带过渡动画）
 * ==================================================================== */
function PageContent() {
  const location = useLocation();

  return (
    <Content className="arco-layout-content" style={{ padding: 0 }}>
      <ErrorBoundary>
        <div className="arco-layout-page" key={location.pathname}>
          <Outlet />
        </div>
      </ErrorBoundary>
    </Content>
  );
}

/* ====================================================================
 * ArcoLayout - 基于 Arco Design 的完整中后台布局
 *
 * 布局结构：
 * ┌──────────────────────────────────────────┐
 * │  Layout.Sider  │  Layout.Header          │
 * │  (可折叠菜单)    │  (面包屑/搜索/用户/主题) │
 * │                ├─────────────────────────┤
 * │                │  Layout.Content         │
 * │                │  (<Outlet />)           │
 * │                ├─────────────────────────┤
 * │                │  Layout.Footer          │
 * └──────────────────────────────────────────┘
 *
 * 特性：
 * - 完整 Arco Design 图标映射
 * - 响应式侧边栏自动折叠（1280px 断点）
 * - 移动端 Drawer 抽屉菜单
 * - 亮/暗/自动三态主题切换
 * - 面包屑导航（含页面动态第三级）
 * - 命令面板（⌘K）
 * - 页面过渡动画
 * - 返回顶部按钮
 * ==================================================================== */
export default function ArcoLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const authState = useAuthState();
  const commandPaletteOpen = useWorkspaceStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);

  // 侧边栏折叠状态
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) return true;
    return false;
  });
  // 移动端抽屉菜单
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // 退出确认弹窗
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const currentUser = authState.session?.user ?? null;
  const userDisplayName = currentUser?.nickname || currentUser?.username || '当前用户';
  const userInitial = userDisplayName.slice(0, 1).toUpperCase();

  // 当前激活的菜单 key
  const selectedKeys = [location.pathname];

  // 自动展开父级菜单
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const prefix = location.pathname.split('/')[1];
    return ['health', 'finance', 'life', 'investment'].includes(prefix) ? [prefix] : [];
  });

  // 路由变化时自动展开对应父级
  useEffect(() => {
    const prefix = location.pathname.split('/')[1];
    if (['health', 'finance', 'life', 'investment'].includes(prefix)) {
      setOpenKeys((prev) => (prev.includes(prefix) ? prev : [...prev, prefix]));
    }
    // 关闭移动端抽屉
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // 小屏自动折叠
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1280px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setCollapsed(true);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 路由切换时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // 监听命令面板发出的侧边栏折叠事件
  useEffect(() => {
    const handler = () => setCollapsed((prev) => !prev);
    window.addEventListener('arco-layout:toggle-sidebar', handler);
    return () => window.removeEventListener('arco-layout:toggle-sidebar', handler);
  }, []);

  // 全局 ⌘K 快捷键打开命令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  const handleLogout = useCallback(async () => {
    setLogoutConfirmOpen(false);
    await logout();
    navigate('/login');
  }, [navigate]);

  const handleMenuClick = useCallback(
    (key: string) => {
      navigate(key);
      setMobileDrawerOpen(false);
    },
    [navigate],
  );

  // 用户下拉菜单
  const userDropdownList = useMemo(
    () => (
      <Menu
        onClickMenuItem={(key) => {
          if (key === 'logout') {
            setLogoutConfirmOpen(true);
          } else {
            navigate(key);
          }
        }}
      >
        <Menu.Item key="/settings/profile">
          <IconUser /> 个人中心
        </Menu.Item>
        <Menu.Item key="/settings/profile?tab=security">
          <IconSafe /> 修改密码
        </Menu.Item>
        <Menu.Item key="logout">
          <IconExport /> 退出登录
        </Menu.Item>
      </Menu>
    ),
    [navigate],
  );

  // 侧边栏菜单内容（共享给 PC Sider 和移动端 Drawer）
  const sidebarMenu = (
    <Menu
      theme="light"
      mode="vertical"
      collapse={collapsed && !mobileDrawerOpen}
      selectedKeys={selectedKeys}
      openKeys={mobileDrawerOpen ? openKeys : undefined}
      onClickMenuItem={handleMenuClick}
      onClickSubMenu={(_, keys) => setOpenKeys(keys)}
      style={{ border: 'none', width: '100%' }}
    >
      {renderMenuItems(menuItems)}
    </Menu>
  );

  return (
    <>
      <Layout className="arco-layout-wrapper" style={{ minHeight: '100vh' }}>
        {/* ============ PC 侧边栏 ============ */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          breakpoint="xl"
          width={240}
          collapsedWidth={60}
          className="arco-layout-sider"
        >
          {/* 品牌 Logo */}
          <div className="arco-layout-logo">
            <div className="arco-layout-logo-inner">
              <span className="arco-layout-logo-mark">{collapsed ? 'LO' : 'LifeOS'}</span>
            </div>
          </div>

          {/* 菜单 */}
          {sidebarMenu}
        </Sider>

        <Layout>
          {/* ============ 顶部栏 ============ */}
          <Header className="arco-layout-header">
            <div className="arco-layout-header-left">
              {/* 折叠按钮（PC） */}
              <Button
                className="arco-layout-header-btn"
                type="text"
                icon={collapsed ? <IconMenuUnfold /> : <IconMenuFold />}
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              />

              {/* 移动端菜单按钮 */}
              <Button
                className="arco-layout-header-btn arco-layout-header-mobile-menu"
                type="text"
                icon={<IconMenuUnfold />}
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="打开菜单"
              />

              {/* 搜索触发器 */}
              <Button
                className="arco-layout-header-btn"
                type="text"
                icon={<IconSearch />}
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="打开命令面板"
                title="搜索 (⌘K)"
              />

              {/* 面包屑 */}
              <BreadcrumbBar />
            </div>

            <div className="arco-layout-header-right">
              {/* 通知中心 */}
              <Button
                className="arco-layout-header-btn"
                type="text"
                icon={<IconNotification />}
                onClick={() => navigate('/notifications')}
                aria-label="通知中心"
                title="通知中心"
              />

              {/* 用户头像/下拉菜单 */}
              <Dropdown trigger="click" position="br" droplist={userDropdownList}>
                <Avatar
                  className="arco-layout-header-avatar"
                  size={32}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-primary-6)',
                  }}
                >
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={userDisplayName} />
                  ) : (
                    userInitial
                  )}
                </Avatar>
              </Dropdown>
            </div>
          </Header>

          {/* ============ 主内容区 ============ */}
          <BreadcrumbTailProvider>
            <PageContent />
          </BreadcrumbTailProvider>

          {/* ============ 底部状态栏 ============ */}
          <Footer className="arco-layout-footer">
            <span className="arco-layout-footer-left">
              <span>LifeOS v2.0</span>
              <span className="arco-layout-footer-sep">·</span>
              <span>个人生活数字化管理平台</span>
            </span>
            <span className="arco-layout-footer-right">
              <Button
                className="arco-layout-footer-btn"
                type="text"
                size="mini"
                icon={<IconCommand />}
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="打开命令面板"
              >
                ⌘K
              </Button>
            </span>
          </Footer>
        </Layout>
      </Layout>

      {/* ============ 移动端 Drawer 菜单 ============ */}
      <Drawer
        className="arco-layout-mobile-drawer"
        title={null}
        placement="left"
        visible={mobileDrawerOpen}
        onCancel={() => setMobileDrawerOpen(false)}
        width={260}
        footer={null}
        autoFocus={false}
        focusLock={false}
      >
        <div className="arco-layout-drawer-logo">
          <span className="arco-layout-drawer-logo-text">LifeOS</span>
          <span className="arco-layout-drawer-logo-sub">个人生活数字化管理平台</span>
        </div>
        <Menu
          theme="light"
          mode="vertical"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onClickMenuItem={handleMenuClick}
          onClickSubMenu={(_, keys) => setOpenKeys(keys)}
          style={{ border: 'none', width: '100%' }}
        >
          {renderMenuItems(menuItems)}
        </Menu>
      </Drawer>

      {/* ============ 退出确认弹窗 ============ */}
      <Modal
        title="确认退出登录"
        visible={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onOk={handleLogout}
        okText="确认退出"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        style={{ width: 400 }}
        autoFocus={false}
        focusLock={false}
      >
        <p>确定要退出当前账户吗？退出后需要重新登录才能使用。</p>
      </Modal>

      {/* ============ 返回顶部按钮 ============ */}
      <BackToTopButton />

      {/* ============ AI 助手 FAB ============ */}
      <AssistantLauncher />

      {/* ============ 命令面板 ============ */}
      {commandPaletteOpen ? <CommandPalette /> : null}
    </>
  );
}

/* 辅助图标组件（Arco 的 IconToTop 不直接导出，需手动补充） */
function IconToTop() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20V4M5 11l7-7 7 7" />
    </svg>
  );
}
