import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader, SectionCard, StatGrid } from '../page';

/**
 * PageHeader 组件测试
 */
describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="测试标题" subtitle="测试副标题" />);
    expect(screen.getByText('测试标题')).toBeInTheDocument();
    expect(screen.getByText('测试副标题')).toBeInTheDocument();
  });
});

/**
 * SectionCard 组件测试
 */
describe('SectionCard', () => {
  it('renders title and description', () => {
    render(
      <SectionCard title="区块标题" description="区块描述">
        <div>内容</div>
      </SectionCard>,
    );
    expect(screen.getByText('区块标题')).toBeInTheDocument();
    expect(screen.getByText('区块描述')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <SectionCard title="区块">
        <div>子元素</div>
      </SectionCard>,
    );
    expect(screen.getByText('子元素')).toBeInTheDocument();
  });
});

/**
 * StatGrid 组件测试
 */
describe('StatGrid', () => {
  const items = [
    { label: '总数', value: '100' },
    { label: '活跃', value: '80' },
    { label: '异常', value: '5', accent: 'var(--color-danger-6)' },
  ];

  it('renders stat items', () => {
    render(<StatGrid items={items} />);
    expect(screen.getByText('总数')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('活跃')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders all items', () => {
    const { container } = render(<StatGrid items={items} />);
    /* StatGrid 现在使用 Arco Card 实现，每个指标项对应一个 .arco-card */
    const statCards = container.querySelectorAll('.arco-card');
    expect(statCards.length).toBe(3);
  });
});
