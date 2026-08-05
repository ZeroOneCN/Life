import type { ReactNode } from 'react';

export function PageHeader({
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
}

export function SectionCard({
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
}

export function StatGrid({
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
}

export function EmptyState({
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
}

/**
 * 上下文栏：横向排列账本/货币/周期等上下文选择器 + 统计 Tag
 *
 * 统一放置于 PageHeader 与内容区之间，替代各页面散落的"当前上下文"SectionCard。
 * 使用方式：将 Select / 切换按钮 / Tag 作为 children 传入，组件负责横向排布与间距。
 *
 * @param label - 可选分组前缀文案（如"当前账本"）
 * @param children - 上下文控件（SelectField、PillTabs、Tag 等）
 */
export function ContextBar({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="context-bar">
      {label ? <span className="context-bar-label">{label}</span> : null}
      {children}
    </div>
  );
}
