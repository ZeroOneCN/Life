import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { AssistantLauncher } from '../components/shared/AssistantLauncher';
import { BreadcrumbTailProvider } from '../hooks/useBreadcrumbTail';
import { initDensity } from '../hooks/useDeviceCapabilities';
import { useWorkspaceStore } from '../stores/workspace.store';

import CommandBar from './CommandBar';
import CommandPalette from './CommandPalette';
import NavRail from './NavRail';
import StatusBar from './StatusBar';

/**
 * AppShell 应用骨架组件
 *
 * 替代 MainLayout，采用 Workspace 布局架构：
 * - CommandBar（顶部 48px）：⌘K 触发器 + 面包屑 + 密度/主题/通知/用户
 * - NavRail（左侧 64/240px）：6 模块图标 + 收藏区 + 二级菜单
 * - WorkspaceArea（弹性）：渲染当前路由（Outlet）
 * - StatusBar（底部 28px）：同步状态 + 快捷键提示
 *
 * 阶段 A：仅渲染骨架，Tab/Split/Inspector 在阶段 B/C 实装。
 * 移动端响应式：通过 CSS 处理，NavRail 在移动端转为底部导航。
 *
 * @returns AppShell JSX
 */
export default function AppShell() {
  const location = useLocation();
  const commandPaletteOpen = useWorkspaceStore((s) => s.commandPaletteOpen);
  const restore = useWorkspaceStore((s) => s.restore);

  // 初始化密度（从 localStorage 恢复到 <html data-density>）
  useEffect(() => {
    initDensity();
  }, []);

  // 恢复工作区 Tab 状态（阶段 A 暂不实际使用，但保持 store 一致性）
  useEffect(() => {
    restore();
  }, [restore]);

  // 路由切换时滚动到顶部（绕过 CSS smooth 动画）
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = '';
  }, [location.pathname]);

  return (
    <BreadcrumbTailProvider>
      <div className="app-shell" data-layout="v2">
        <CommandBar />
        <div className="app-shell-body">
          <NavRail />
          <main className="workspace-area" role="main">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <AssistantLauncher />
        {commandPaletteOpen ? <CommandPalette /> : null}
      </div>
    </BreadcrumbTailProvider>
  );
}
