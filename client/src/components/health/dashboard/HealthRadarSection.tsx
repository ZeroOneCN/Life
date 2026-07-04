import { useMemo } from 'react';
import {
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../../page';
import type { HealthRadarSummary } from '../../../types/healthDashboard';

interface HealthRadarSectionProps {
  radar: HealthRadarSummary | null;
  loading: boolean;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

/**
 * 将分数映射为评级文字。
 * @param score - 0-100 的分数
 * @returns 评级描述
 */
function describeScore(score: number) {
  if (score >= 85) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 50) return '一般';
  if (score >= 30) return '偏弱';
  return '需改善';
}

/**
 * 综合健康度雷达图 Section：六维评分（步数 / 运动 / 饮食 / 用药 / 体检 / 体重）。
 * @param radar - 后端返回的雷达图数据
 * @param loading - 是否加载中
 */
export function HealthRadarSection({ radar, loading }: HealthRadarSectionProps) {
  const chartData = useMemo(() => {
    if (!radar) return [];
    return radar.dimensions.map((dim) => ({
      subject: dim.label,
      score: dim.score,
      value: dim.value,
      unit: dim.unit,
    }));
  }, [radar]);

  if (loading) {
    return <SectionCard title="综合健康度" description="正在加载评分…"><div className="skeleton-block" /></SectionCard>;
  }

  if (!radar || chartData.length === 0) {
    return (
      <SectionCard title="综合健康度" description="六维健康度评分（0-100）">
        <EmptyState
          title="暂无评分数据"
          description="需要至少录入 30 天的步数 / 运动 / 用药 / 体检数据后才能形成雷达图。"
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="综合健康度"
      description={`近 30 天六维健康度评分 · 综合得分 ${radar.overallScore} 分`}
    >
      <StatGrid
        items={[
          {
            label: '综合得分',
            value: `${radar.overallScore}`,
            helper: describeScore(radar.overallScore),
            accent: radar.overallScore >= 70 ? '#27a644' : radar.overallScore >= 50 ? '#f59e0b' : '#e5484d',
          },
          {
            label: '统计周期',
            value: '近 30 天',
            helper: `起始 ${radar.last30DaysStart}`,
          },
        ]}
      />
      <div style={{ width: '100%', height: 320, marginTop: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="75%">
            <PolarGrid stroke="var(--color-hairline)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-ink-2)', fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }} stroke="var(--color-hairline)" />
            <Radar
              name="健康度"
              dataKey="score"
              stroke="#5e6ad2"
              fill="#5e6ad2"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ fontWeight: 600 }}
              formatter={(value, _name, item) => {
                const payload = (item as { payload?: { unit?: string; value?: number; subject?: string } })?.payload;
                const unit = payload?.unit ?? '';
                const raw = payload?.value;
                return [`评分 ${value} / 100 · 数值 ${raw} ${unit}`, payload?.subject ?? ''];
              }}
            />
            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="health-radar-dimensions">
        {radar.dimensions.map((dim) => (
          <div key={dim.key} className="health-radar-dimension">
            <span className="health-radar-dimension-label">{dim.label}</span>
            <strong className="health-radar-dimension-score">{dim.score}</strong>
            <span className="health-radar-dimension-detail">
              {dim.value} {dim.unit}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
