import { menuItems } from './navigation';
import type { IconKey } from '../types/navigation';

/**
 * 菜单图标 SVG path 表（统一 24x24 线稿风格，stroke 绘制）
 *
 * 规则：每个菜单项必须使用独立图标，严禁复用同一个 path。
 * NavRail / MainLayout（classic）共用此表，避免两处维护不一致。
 */
export const iconMap: Record<IconKey, string> = {
  home: 'M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5',
  heart: 'M12 20.5C7 16.6 3 13.3 3 9.6 3 7.1 5 5.1 7.5 5.1c1.7 0 3.2.9 4.5 2.3 1.3-1.4 2.8-2.3 4.5-2.3C19 5.1 21 7.1 21 9.6c0 3.7-4 7-9 10.9z',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5M16.5 13.5h1',
  grid: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z',
  chart: 'M6 20V10M12 20V4M18 20v-6',
  bell: 'M12 21a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-4a6 6 0 1 0-12 0v4l-2 2v1h16v-1l-2-2z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 8c0-3.3 3.6-5 8-5s8 1.7 8 5',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  dumbbell: 'M3 9v6M21 9v6M6.5 6.5v11M17.5 6.5v11M6.5 12h11',
  steps: 'M7 4a3 3 0 0 1 3 3c0 2.5-1.2 6-3 6s-3-3.5-3-6a3 3 0 0 1 3-3zm10 8a3 3 0 0 1 3 3c0 2.5-1.2 6-3 6s-3-3.5-3-6a3 3 0 0 1 3-3z',
  clipboard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a3 3 0 0 1 6 0M9 5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1M9 11h6M9 15h4',
  pill: 'M10.5 20a5.5 5.5 0 0 0 3.9-1.6l8.8-8.8a5.5 5.5 0 0 0-7.8-7.8l-8.8 8.8A5.5 5.5 0 0 0 10.5 20zM7.9 12.5l9.6 9.6',
  doc: 'M6 3h8l4 4v14H6V3zm8 0l4 4h-4V3zM9 12h6M9 16h6',
  pie: 'M12 3a9 9 0 1 0 9 9h-9V3zM12 12l6.4-6.4',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6M9 12h6',
  cart: 'M3 4h2l2.5 13h10L20 8H6M10 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  list: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2M8 4h8M10 11h4M10 15h4',
  alert: 'M12 3 2 20h20L12 3zm0 6v5M12 16.5v.5',
  target: 'M12 3a9 9 0 1 0 9 9M12 8a4 4 0 1 0 4 4M12 13h.01',
  box: 'M3 7l9-5 9 5v10l-9 5-9-5V7zm0 0l9 5 9-5M12 12v10',
  card: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm0 4h16M8 14h5',
  checklist: 'M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  calendar: 'M4 7h16v14H4V7zM8 3v4M16 3v4M4 11h16',
  exchange: 'M4 7h13M17 7l-3-3M17 7l-3 3M20 17H7M7 17l3-3M7 17l3 3',
};

/**
 * 菜单图标组件（统一 18px 线稿）
 * @param name - 图标 key；未知 key 时兜底为 home，避免旧持久化数据渲染空白
 * @param size - 图标尺寸，默认 18
 */
export function MenuIcon({ name, size = 18 }: { name: string; size?: number }) {
  const d = iconMap[name as IconKey] ?? iconMap.home;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * 根据路径在 menuItems 中查找对应菜单图标 key（供收藏 Pin 等使用）
 * @param pathname - 路由路径
 * @returns 图标 key；未找到返回 null
 */
export function findIconByPath(pathname: string): IconKey | null {
  for (const item of menuItems) {
    if (item.key === pathname) return item.icon;
    const child = item.children?.find((c) => c.key === pathname);
    if (child) return child.icon;
  }
  return null;
}
