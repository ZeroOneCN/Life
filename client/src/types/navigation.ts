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
  | 'box';

export interface MenuItemConfig {
  key: string;
  label: string;
  icon: IconKey;
  description?: string;
  children?: MenuItemConfig[];
}

export interface RouteConfig {
  path: string;
  label: string;
  breadcrumb: string[];
  menuKey: string;
  component: LazyExoticComponent<ComponentType>;
}
