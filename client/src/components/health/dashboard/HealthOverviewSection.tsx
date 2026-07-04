import { Link } from 'react-router-dom';

import { EmptyState, SectionCard, StatGrid } from '../../page';
import { Tag } from '../../ui';
import type { HealthDashboardOverview } from '../../../types/healthDashboard';

interface HealthOverviewSectionProps {
  overview: HealthDashboardOverview | null;
  loading: boolean;
}

interface MetricCardConfig {
  key: string;
  label: string;
  value: string;
  helper?: string;
  accent?: string;
  link?: string;
  linkText?: string;
  tag?: { tone: 'green' | 'red' | 'orange' | 'blue' | 'pink' | 'default'; text: string };
}

/**
 * 计算体检异常占比对应标签。
 * @param abnormalCount - 异常数
 * @param total - 总数
 * @returns 标签元组（tone + text）
 */
function describeCheckupStatus(abnormalCount: number, total: number) {
  if (total <= 0) return { tone: 'default' as const, text: '暂无数据' };
  if (abnormalCount <= 0) return { tone: 'green' as const, text: '全部正常' };
  const rate = abnormalCount / total;
  if (rate >= 0.35) return { tone: 'red' as const, text: `异常 ${abnormalCount}/${total}` };
  if (rate >= 0.1) return { tone: 'orange' as const, text: `异常 ${abnormalCount}/${total}` };
  return { tone: 'blue' as const, text: `异常 ${abnormalCount}/${total}` };
}

/**
 * 根据 BMI 推算健康度标签。
 * @param bmi - BMI 值
 * @returns 标签元组
 */
function describeBmi(bmi: number | null) {
  if (bmi === null) return { tone: 'default' as const, text: '未录入' };
  if (bmi < 18.5) return { tone: 'orange' as const, text: '偏瘦' };
  if (bmi <= 24) return { tone: 'green' as const, text: '正常' };
  if (bmi <= 28) return { tone: 'orange' as const, text: '超重' };
  return { tone: 'red' as const, text: '肥胖' };
}

/**
 * 健康概览 Section：展示步数 / 体重 / 运动 / 饮食 / 用药 / 体检六大维度的关键指标。
 * @param overview - 后端返回的概览数据
 * @param loading - 是否处于加载中
 */
export function HealthOverviewSection({ overview, loading }: HealthOverviewSectionProps) {
  if (loading) {
    return <SectionCard title="健康概览" description="正在加载综合指标…"><div className="stat-grid" /></SectionCard>;
  }

  if (!overview) {
    return (
      <SectionCard title="健康概览" description="跨模块健康数据综合展示">
        <EmptyState
          title="暂无概览数据"
          description="请先录入步数 / 体重 / 用药 / 体检等数据后再查看综合概览。"
        />
      </SectionCard>
    );
  }

  const checkupTag = describeCheckupStatus(overview.checkup.abnormalCount, overview.checkup.totalRecords);
  const bmiTag = describeBmi(overview.weight.bmi);

  const cards: MetricCardConfig[] = [
    {
      key: 'step',
      label: '今日步数',
      value: overview.step.todaySteps.toLocaleString(),
      helper: `${overview.step.todayDistanceKm.toFixed(2)} 公里 · 本月 ${overview.step.currentMonthSteps.toLocaleString()} 步`,
      link: '/health/step',
      linkText: '查看明细',
    },
    {
      key: 'weight',
      label: '最新体重',
      value: overview.weight.latestWeightKg !== null ? `${overview.weight.latestWeightKg.toFixed(1)} kg` : '-',
      helper: overview.weight.latestDate ? `录入于 ${overview.weight.latestDate}` : '尚未录入',
      accent: overview.weight.bmi !== null && overview.weight.bmi >= 18.5 && overview.weight.bmi <= 24 ? '#27a644' : '#f59e0b',
      link: '/health/fitness',
      linkText: '查看明细',
      tag: bmiTag,
    },
    {
      key: 'exercise',
      label: '今日运动消耗',
      value: `${overview.exercise.todayCaloriesOut.toFixed(0)} kcal`,
      helper: `近 30 天运动 ${overview.exercise.workoutDays30} 天`,
      link: '/health/fitness',
      linkText: '查看明细',
    },
    {
      key: 'diet',
      label: '近 30 天日均净热量',
      value: `${overview.diet.avgNetCalories30} kcal`,
      helper: '摄入减去运动消耗后的日均净值',
      accent: Math.abs(overview.diet.avgNetCalories30) > 500 ? '#e5484d' : '#27a644',
      link: '/health/fitness',
      linkText: '查看明细',
    },
    {
      key: 'medication',
      label: '近 30 天用药',
      value: `${overview.medication.recordDays30} / ${overview.medication.plannedDays30} 天`,
      helper: '已记录天数 / 计划天数',
      accent: overview.medication.recordDays30 / Math.max(1, overview.medication.plannedDays30) >= 0.8 ? '#27a644' : '#f59e0b',
      link: '/health/medication',
      linkText: '查看明细',
    },
    {
      key: 'checkup',
      label: '体检记录',
      value: overview.checkup.totalRecords > 0 ? overview.checkup.totalRecords.toLocaleString() : '0',
      helper: overview.checkup.latestDate ? `最近体检 ${overview.checkup.latestDate}` : '尚未录入',
      link: '/health/checkup',
      linkText: '查看明细',
      tag: checkupTag,
    },
  ];

  return (
    <SectionCard
      title="健康概览"
      description="跨子模块综合指标，点击「查看明细」可跳转到对应模块"
    >
      <StatGrid
        items={cards.map((card) => ({
          label: card.label,
          value: card.value,
          helper: card.helper,
          accent: card.accent,
        }))}
      />
      <div className="health-overview-actions">
        {cards.map((card) => (
          <div key={card.key} className="health-overview-cell">
            <div className="health-overview-cell-tag">
              {card.tag ? <Tag tone={card.tag.tone}>{card.tag.text}</Tag> : <span />}
              {card.link ? (
                <Link className="health-overview-cell-link" to={card.link}>
                  {card.linkText ?? '查看明细'}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

