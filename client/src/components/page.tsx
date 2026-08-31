import { memo, type ReactNode } from 'react';

import { Button, Card, Empty, Grid, Space, Typography } from '@arco-design/web-react';

const { Title, Text } = Typography;

/**
 * 页面头部 — 使用 Arco Typography + Space。
 * 统一放置于页面顶部，包含标题、副标题和操作区域。
 */
export const PageHeader = memo(function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <Title heading={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {subtitle ? (
          <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
            {subtitle}
          </Text>
        ) : null}
      </div>
      {actions ? <Space size="small">{actions}</Space> : null}
    </div>
  );
});

/**
 * 区块卡片 — 使用 Arco Card。
 * 统一放置于页面内容区，包含标题、描述和操作区域。
 */
export const SectionCard = memo(function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={className}
      title={title}
      extra={action}
      bordered={false}
      style={{ marginBottom: 16 }}
      bodyStyle={{ paddingTop: description ? 8 : 0 }}
    >
      {description ? (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          {description}
        </Text>
      ) : null}
      {children}
    </Card>
  );
});

/**
 * 统计指标网格 — 使用 Arco Card + Grid。
 * 每项展示一个指标标签和数值，支持强调色和辅助文字。
 */
export const StatGrid = memo(function StatGrid({
  items,
  className = '',
}: {
  items: Array<{ label: string; value: string | ReactNode; accent?: string; helper?: string }>;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <Grid.Row className={className || undefined} gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {items.map((item) => (
        <Grid.Col key={item.label} xs={12} sm={8} md={6} lg={4} xl={3}>
          <Card bordered={false} bodyStyle={{ padding: '16px 20px' }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
              {item.label}
            </Text>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                lineHeight: 1.3,
                color: item.accent ?? 'var(--color-text-1)',
              }}
            >
              {item.value}
            </div>
            {item.helper ? (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                {item.helper}
              </Text>
            ) : null}
          </Card>
        </Grid.Col>
      ))}
    </Grid.Row>
  );
});

/**
 * 空状态 — 使用 Arco Empty。
 * 支持自定义图标和操作按钮。
 */
export const EmptyState = memo(function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <Empty
        icon={icon}
        description={
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {description}
            </Text>
          </div>
        }
      />
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
});

/**
 * 上下文栏 — 使用 Arco Space。
 * 横向排列账本/货币/周期等上下文选择器与统计标签。
 */
export const ContextBar = memo(function ContextBar({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Space size="small" wrap>
        {label ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {label}
          </Text>
        ) : null}
        {children}
      </Space>
    </div>
  );
});

/**
 * 统一页面模板 — 使用 Arco Skeleton 和 Empty。
 * 减少各页面重复的加载/空态/错误/分页处理逻辑。
 */
export function PageTemplate({
  loading = false,
  loadingTip,
  empty = false,
  emptyTitle = '暂无数据',
  emptyDesc = '当前没有可显示的数据。',
  emptyIcon,
  emptyAction,
  error = null,
  onRetry,
  skeleton,
  batchBar,
  children,
}: {
  loading?: boolean;
  loadingTip?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  error?: Error | null;
  onRetry?: () => void;
  skeleton?: ReactNode;
  batchBar?: ReactNode;
  children: ReactNode;
}) {
  const wrapperStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };

  /* 错误状态优先 */
  if (error) {
    return (
      <div style={wrapperStyle}>
        <Card bordered={false} style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--color-danger-6)' }}>!</div>
          <Title heading={5}>加载失败</Title>
          <Text type="secondary">{error.message || '数据加载出错，请重试。'}</Text>
          {onRetry ? (
            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={onRetry}>
                重试
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  /* 加载状态 */
  if (loading) {
    return (
      <div style={wrapperStyle}>
        {skeleton ?? (
          <Card bordered={false} style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">{loadingTip ?? '加载中...'}</Text>
          </Card>
        )}
      </div>
    );
  }

  /* 空状态 */
  if (empty) {
    return (
      <div style={wrapperStyle}>
        <EmptyState
          title={emptyTitle}
          description={emptyDesc}
          icon={emptyIcon}
          action={emptyAction}
        />
      </div>
    );
  }

  /* 批量操作栏 */
  return (
    <div style={wrapperStyle}>
      {batchBar ? <div style={{ marginBottom: 8 }}>{batchBar}</div> : null}
      {children}
    </div>
  );
}
