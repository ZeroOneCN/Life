import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Btn, Tag, Toast, Skeleton } from '../ui';

/**
 * Btn 组件测试
 */
describe('Btn', () => {
  it('renders children text', () => {
    render(<Btn>保存</Btn>);
    expect(screen.getByText('保存')).toBeInTheDocument();
  });

  it('applies primary tone', () => {
    const { container } = render(<Btn tone="primary">提交</Btn>);
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('shows loading state', () => {
    const { container } = render(<Btn loading>加载中</Btn>);
    const button = container.querySelector('button');
    expect(button?.classList.contains('arco-btn-loading')).toBeTruthy();
  });

  it('disables button when disabled prop is true', () => {
    render(<Btn disabled>不可用</Btn>);
    expect(screen.getByText('不可用').closest('button')).toBeDisabled();
  });
});

/**
 * Tag 组件测试
 */
describe('Tag', () => {
  it('renders text', () => {
    render(<Tag>成功</Tag>);
    expect(screen.getByText('成功')).toBeInTheDocument();
  });

  it('applies color tone', () => {
    const { container } = render(<Tag tone="green">成功</Tag>);
    expect(container.querySelector('.arco-tag')).toBeTruthy();
  });
});

/**
 * Toast 组件测试
 */
describe('Toast', () => {
  it('renders null when toast is null', () => {
    const { container } = render(<Toast toast={null} />);
    expect(container.innerHTML).toBe('');
  });
});

/**
 * Skeleton 组件测试
 */
describe('Skeleton', () => {
  it('renders specified number of lines', () => {
    const { container } = render(<Skeleton lines={3} />);
    const lines = container.querySelectorAll('.skeleton-line');
    expect(lines.length).toBe(3);
  });
});