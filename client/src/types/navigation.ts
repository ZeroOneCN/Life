import type { LazyExoticComponent, ComponentType } from 'react';

export type IconKey =
  | 'dashboard'
  | 'heart'
  | 'wallet'
  | 'spark'
  | 'trend'
  | 'bell'
  | 'task'
  | 'card'
  | 'shield'
  | 'chart'
  | 'box'
  | 'calendar';

export interface MenuItemConfig {
  key: string;
  label: string;
  icon: IconKey;
  description?: string;
  groupLabel?: string;
  children?: MenuItemConfig[];
}

export interface RouteConfig {
  path: string;
  label: string;
  breadcrumb: string[];
  menuKey: string;
  component: LazyExoticComponent<ComponentType>;
}
