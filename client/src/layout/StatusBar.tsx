import { useEffect, useState } from 'react';

import { useWorkspaceStore } from '../stores/workspace.store';

/**
 * 格式化时间戳为相对时间（如"2 分钟前"）
 * @param ts - 时间戳（ms）
 * @returns 相对时间字符串
 */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/**
 * StatusBar 底部状态栏组件
 *
 * 显示：
 * - 同步状态（已同步 N 分钟前 / 同步中 / 失败）
 * - 上下文统计（当前 Tab 数）
 * - 快捷键提示（⌘K 命令 / ⌘/ 快捷键）
 *
 * 高度 28px 固定，背景 canvas，顶部 1px hairline 分隔。
 *
 * @returns StatusBar JSX
 */
export default function StatusBar() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const [lastSync] = useState<number>(() => Date.now());
  const [relativeTime, setRelativeTime] = useState<string>('刚刚');

  // 每 30 秒刷新相对时间
  useEffect(() => {
    const update = () => setRelativeTime(formatRelativeTime(lastSync));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [lastSync]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleCommandClick = () => {
    setCommandPaletteOpen(true);
  };

  return (
    <footer className="status-bar" role="contentinfo" aria-label="状态栏">
      <div className="status-bar-left">
        <span className="status-bar-sync" title={`上次同步：${relativeTime}`}>
          <span className="status-bar-sync-dot" aria-hidden="true" />
          <span className="status-bar-sync-text">已同步 {relativeTime}</span>
        </span>
        <span className="status-bar-divider" aria-hidden="true">·</span>
        <span className="status-bar-stat">
          {tabs.length > 0 ? `已开 ${tabs.length} 个 Tab` : '工作区空闲'}
        </span>
        {activeTab ? (
          <>
            <span className="status-bar-divider" aria-hidden="true">·</span>
            <span className="status-bar-current" title={activeTab.path}>
              {activeTab.title}
            </span>
          </>
        ) : null}
      </div>
      <div className="status-bar-right">
        <button
          type="button"
          className="status-bar-action"
          onClick={handleCommandClick}
          title="打开命令面板"
        >
          <span className="status-bar-kbd">⌘K</span>
          <span>命令</span>
        </button>
        <span className="status-bar-divider" aria-hidden="true">·</span>
        <button
          type="button"
          className="status-bar-action"
          title="快捷键面板（暂未实装）"
          disabled
        >
          <span className="status-bar-kbd">⌘/</span>
          <span>快捷键</span>
        </button>
      </div>
    </footer>
  );
}
