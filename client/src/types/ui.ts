import type { CSSProperties, ReactNode } from 'react';

export interface TabOption {
  value: string;
  label: ReactNode;
}

export interface TableColumn<T> {
  key: string;
  title: ReactNode;
  dataIndex?: keyof T;
  width?: number | string;
  align?: CSSProperties['textAlign'];
  render?: (value: unknown, row: T, index: number) => ReactNode;
}
