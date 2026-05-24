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
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
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
          <h2 className="section-title">{title}</h2>
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
  items: Array<{ label: string; value: string; accent?: string; helper?: string }>;
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
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
