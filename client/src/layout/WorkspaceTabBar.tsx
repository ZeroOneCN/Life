import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { routes } from '../config/navigation';
import { useWorkspaceStore } from '../stores/workspace.store';
import type { WorkspaceTab } from '../stores/workspace.store';

/**
 * 根据路径查找 Tab 标题
 * @param path - 路由路径
 * @returns 标题（找不到则取路径末段）
 */
function resolveTabTitle(path: string): string {
  const route = routes.find((r) => r.path === path);
  return route?.label ?? path.split('/').filter(Boolean).pop() ?? path;
}

/**
 * 右键菜单状态
 */
interface ContextMenuState {
  /** 触发菜单的 Tab ID */
  tabId: string;
  /** 屏幕坐标 X */
  x: number;
  /** 屏幕坐标 Y */
  y: number;
}

/**
 * WorkspaceTabBar 工作区标签栏组件
 *
 * 功能：
 * - 横向显示所有打开的 Tab
 * - 点击切换活跃 Tab（导航到 Tab.path）
 * - 中键或关闭按钮关闭 Tab
 * - 右键菜单：关闭/关闭其他/Pin/复制路径
 * - HTML5 拖拽排序
 * - Pin Tab 排到最前，显示固定图标
 *
 * 仅在 tabs.length > 0 时渲染。
 *
 * @returns WorkspaceTabBar JSX
 */
export default function WorkspaceTabBar() {
  const navigate = useNavigate();
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const pinTab = useWorkspaceStore((s) => s.pinTab);
  const reorderTabs = useWorkspaceStore((s) => s.reorderTabs);
  const closeOtherTabs = useWorkspaceStore((s) => s.closeOtherTabs);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return undefined;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [contextMenu]);

  // 路由变化时关闭菜单
  useEffect(() => {
    setContextMenu(null);
  }, [activeTabId]);

  if (tabs.length === 0) return null;

  const handleTabClick = (tab: WorkspaceTab) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  };

  const handleMiddleClick = (e: React.MouseEvent, id: string) => {
    if (e.button === 1) {
      e.preventDefault();
      closeTab(id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.preventDefault();
    setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent, tab: WorkspaceTab) => {
    setDraggingId(tab.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
  };

  const handleDragOver = (e: React.DragEvent, tab: WorkspaceTab) => {
    if (!draggingId || draggingId === tab.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(tab.id);
  };

  const handleDrop = (e: React.DragEvent, tab: WorkspaceTab) => {
    e.preventDefault();
    if (draggingId && draggingId !== tab.id) {
      reorderTabs(draggingId, tab.id);
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const contextTab = contextMenu ? tabs.find((t) => t.id === contextMenu.tabId) : null;

  return (
    <div className="workspace-tab-bar" role="tablist" aria-label="工作区标签">
      <div className="workspace-tab-bar-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDragOver = dragOverId === tab.id;
          const isDragging = draggingId === tab.id;
          return (
            <div
              key={tab.id}
              className={`workspace-tab ${isActive ? 'is-active' : ''} ${isDragOver ? 'is-drag-over' : ''} ${isDragging ? 'is-dragging' : ''} ${tab.pinned ? 'is-pinned' : ''}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              draggable
              onClick={() => handleTabClick(tab)}
              onMouseDown={(e) => handleMiddleClick(e, tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              onDragStart={(e) => handleDragStart(e, tab)}
              onDragOver={(e) => handleDragOver(e, tab)}
              onDrop={(e) => handleDrop(e, tab)}
              onDragEnd={handleDragEnd}
              title={tab.path}
            >
              {tab.pinned ? (
                <span className="workspace-tab-pin-icon" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 4l-1 2 4 4-2 1-3-3-3 3-2-1 4-4-1-2h-4V2h12v2h-4z" />
                  </svg>
                </span>
              ) : null}
              <span className="workspace-tab-title">{resolveTabTitle(tab.path)}</span>
              {!tab.pinned ? (
                <button
                  type="button"
                  className="workspace-tab-close"
                  onClick={(e) => handleClose(e, tab.id)}
                  aria-label={`关闭 ${resolveTabTitle(tab.path)}`}
                  title="关闭"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {contextMenu && contextTab ? (
        <div
          className="workspace-tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          ref={menuRef}
          role="menu"
        >
          <button
            type="button"
            className="workspace-tab-context-item"
            onClick={() => {
              setActiveTab(contextTab.id);
              navigate(contextTab.path);
              setContextMenu(null);
            }}
            role="menuitem"
          >
            激活
          </button>
          <button
            type="button"
            className="workspace-tab-context-item"
            onClick={() => {
              pinTab(contextTab.id, !contextTab.pinned);
              setContextMenu(null);
            }}
            role="menuitem"
          >
            {contextTab.pinned ? '取消固定' : '固定 Tab'}
          </button>
          <button
            type="button"
            className="workspace-tab-context-item"
            onClick={() => {
              closeOtherTabs(contextTab.id);
              setContextMenu(null);
            }}
            role="menuitem"
            disabled={tabs.length <= 1}
          >
            关闭其他
          </button>
          <div className="workspace-tab-context-divider" />
          <button
            type="button"
            className="workspace-tab-context-item is-danger"
            onClick={() => {
              closeTab(contextTab.id);
              setContextMenu(null);
            }}
            role="menuitem"
          >
            关闭
          </button>
        </div>
      ) : null}
    </div>
  );
}
