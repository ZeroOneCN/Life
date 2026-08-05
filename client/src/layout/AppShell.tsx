import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { AssistantLauncher } from '../components/shared/AssistantLauncher';
import { BreadcrumbTailProvider } from '../hooks/useBreadcrumbTail';
import { initDensity } from '../hooks/useDeviceCapabilities';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useWorkspaceStore } from '../stores/workspace.store';

import CommandBar from './CommandBar';
import CommandPalette from './CommandPalette';
import Inspector from './Inspector';
import NavRail from './NavRail';
import StatusBar from './StatusBar';
import WorkspaceTabBar from './WorkspaceTabBar';

/**
 * AppShell 应用骨架组件
 *
 * 替代 MainLayout，采用 Workspace 布局架构：
 * - CommandBar（顶部 48px）：⌘K 触发器 + 面包屑 + 密度/主题/通知/用户
 * - NavRail（左侧 64/240px）：6 模块图标 + 收藏区 + 二级菜单
 * - WorkspaceTabBar（条件渲染）：工作区标签栏
 * - WorkspaceArea（弹性）：渲染当前路由（Outlet）
 * - StatusBar（底部 28px）：同步状态 + 快捷键提示
 *
 * 阶段 B：Tab 持久化 + URL 同步 + 全局快捷键。
 *
 * @returns AppShell JSX
 */
export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const commandPaletteOpen = useWorkspaceStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openTab = useWorkspaceStore((s) => s.openTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const restore = useWorkspaceStore((s) => s.restore);

  // 用 ref 标记是否已完成首次恢复，避免恢复期间重复 openTab
  const restoredRef = useRef(false);

  // 初始化密度（从 localStorage 恢复到 <html data-density>）
  useEffect(() => {
    initDensity();
  }, []);

  // 从 localStorage 恢复工作区 Tab 状态
  useEffect(() => {
    restore();
    restoredRef.current = true;
  }, [restore]);

  // 路由变化时同步 Tab：为当前路由创建/激活对应 Tab
  useEffect(() => {
    if (!restoredRef.current) return;
    const existing = tabs.find((t) => t.path === location.pathname);
    if (existing) {
      if (existing.id !== activeTabId) {
        setActiveTab(existing.id);
      }
    } else {
      openTab({ path: location.pathname });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, restoredRef.current]);

  // 路由切换时滚动到顶部（绕过 CSS smooth 动画）
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = '';
  }, [location.pathname]);

  // 当活跃 Tab 变化（如关闭 Tab 后切换）但路由不匹配时，自动导航
  useEffect(() => {
    if (!restoredRef.current) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && activeTab.path !== location.pathname) {
      navigate(activeTab.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, restoredRef.current]);

  // 全局快捷键
  useKeyboardShortcuts([
    {
      key: 'k',
      mod: true,
      handler: () => setCommandPaletteOpen(!commandPaletteOpen),
      description: '打开/关闭命令面板',
    },
    {
      key: 'w',
      mod: true,
      handler: () => {
        if (activeTabId) closeTab(activeTabId);
      },
      description: '关闭当前 Tab',
    },
    {
      key: 't',
      mod: true,
      handler: () => {
        setCommandPaletteOpen(true);
      },
      description: '新 Tab（打开命令面板）',
    },
    {
      key: '[',
      mod: true,
      handler: () => navigate(-1),
      description: '后退',
    },
    {
      key: ']',
      mod: true,
      handler: () => navigate(1),
      description: '前进',
    },
    // ⌘1-8 切换到对应 Tab
    ...Array.from({ length: 8 }, (_, i) => ({
      key: String(i + 1),
      mod: true,
      handler: () => {
        const target = tabs[i];
        if (target) {
          setActiveTab(target.id);
          navigate(target.path);
        }
      },
      description: `切换到 Tab ${i + 1}`,
    })),
  ]);

  return (
    <BreadcrumbTailProvider>
      <div className="app-shell" data-layout="v2">
        <CommandBar />
        <div className="app-shell-body">
          <NavRail />
          <div className="workspace-container">
            <WorkspaceTabBar />
            <main className="workspace-area" role="main">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </main>
          </div>
          <Inspector />
        </div>
        <StatusBar />
        <AssistantLauncher />
        {commandPaletteOpen ? <CommandPalette /> : null}
      </div>
    </BreadcrumbTailProvider>
  );
}
