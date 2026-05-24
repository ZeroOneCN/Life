import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Tag } from '../../components/ui';

export function ModulePlaceholderPage({
  title,
  subtitle,
  bullets,
  stats,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  stats: Array<{ label: string; value: string; helper?: string }>;
}) {
  return (
    <div className="page-stack">
      <PageHeader title={title} subtitle={subtitle} />
      <StatGrid items={stats} />
      <SectionCard
        title="模块状态"
        description="本页已迁移到 TypeScript 结构，并统一接入新的界面基建。"
        action={<Tag tone="blue">前端重构中</Tag>}
      >
        <div className="bullet-list">
          {bullets.map((bullet) => (
            <div key={bullet} className="bullet-item">
              <span className="bullet-dot" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
