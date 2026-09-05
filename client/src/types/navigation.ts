import type { LazyExoticComponent, ComponentType } from 'react';

export type IconKey =
  | 'home'
  | 'heart'
  | 'wallet'
  | 'grid'
  | 'chart'
  | 'bell'
  | 'user'
  | 'pulse'
  | 'moon'
  | 'dumbbell'
  | 'steps'
  | 'clipboard'
  | 'pill'
  | 'doc'
  | 'pie'
  | 'receipt'
  | 'cart'
  | 'plane'
  | 'list'
  | 'alert'
  | 'target'
  | 'box'
  | 'card'
  | 'checklist'
  | 'calendar'
  | 'exchange'
  | 'export';

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
