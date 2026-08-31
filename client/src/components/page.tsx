import { memo, type ReactNode } from 'react';

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
    <div className="page-header">
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <span className="page-subtitle">{subtitle}</span> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
});

export const SectionCard = memo(function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card section-card">
      <div className="section-card-header">
        <div>
          <div className="card-title-bar">
            <h2 className="section-title">{title}</h2>
          </div>
          {description ? <p className="section-description">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
});

export const StatGrid = memo(function StatGrid({
  items,
  className = '',
}: {
  items: Array<{ label: string; value: string | ReactNode; accent?: string; helper?: string }>;
  className?: string;
}) {
  return (
    <div className={`stat-grid ${className}`.trim()}>
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <span className="stat-label">{item.label}</span>
          <strong className="stat-value" style={item.accent ? { color: item.accent } : undefined}>
            {item.value}
          </strong>
          {item.helper ? <span className="stat-helper">{item.helper}</span> : null}
        </div>
      ))}
    </div>
  );
});

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
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <strong>{title}</strong>
      <span>{description}</span>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
});

/**
 * 上下文栏：横向排列账本/货币/周期等上下文选择器 + 统计 Tag
 *
 * 统一放置于 PageHeader 与内容区之间，替代各页面散落的"当前上下文"SectionCard。
 * 使用方式：将 Select / 切换按钮 / Tag 作为 children 传入，组件负责横向排布与间距。
 *
 * @param label - 可选分组前缀文案（如"当前账本"）
 * @param children - 上下文控件（SelectField、PillTabs、Tag 等）
 */
export const ContextBar = memo(function ContextBar({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="context-bar">
      {label ? <span className="context-bar-label">{label}</span> : null}
      {children}
    </div>
  );
});

/**
 * 统一页面模板，减少各页面重复的加载/空态/错误/分页处理逻辑。
 *
 * 使用方式：将 PageHeader / FilterBar / StatGrid / DataTable 等作为 children 传入，
 * 模板负责包裹 loading / empty / error 状态。
 *
 * @param loading - 是否显示加载骨架屏
 * @param loadingTip - 加载提示文案
 * @param empty - 是否显示空态（当 !loading && data.length === 0 时设为 true）
 * @param emptyTitle - 空态标题
 * @param emptyDesc - 空态描述
 * @param emptyIcon - 空态图标
 * @param emptyAction - 空态操作按钮
 * @param error - 错误信息（非 null 时显示错误降级）
 * @param onRetry - 错误重试回调
 * @param skeleton - 自定义骨架屏（默认使用 PageLoading）
 * @param batchBar - 批量操作栏（选中行时显示）
 * @param children - 页面内容（DataTable 等）
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
  /* 错误状态优先 */
  if (error) {
    return (
      <div className="page-stack">
        <div className="error-boundary-fallback">
          <div className="error-boundary-card">
            <div className="error-boundary-icon" aria-hidden="true">
              !
            </div>
            <h2 className="error-boundary-title">加载失败</h2>
            <p className="error-boundary-desc">{error.message || '数据加载出错，请重试。'}</p>
            {onRetry ? (
              <div className="error-boundary-actions">
                <button type="button" className="btn btn-primary" onClick={onRetry}>
                  重试
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  /* 加载状态 */
  if (loading) {
    return (
      <div className="page-stack">
        {skeleton ?? (
          <div className="page-loading" role="status" aria-label={loadingTip ?? '加载中...'}>
            <div className="page-loading-spinner" aria-hidden="true" />
            <span className="page-loading-tip">{loadingTip ?? '加载中...'}</span>
          </div>
        )}
      </div>
    );
  }

  /* 空状态 */
  if (empty) {
    return (
      <div className="page-stack">
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
    <div className="page-stack">
      {batchBar ? <div className="batch-action-bar">{batchBar}</div> : null}
      {children}
    </div>
  );
}
