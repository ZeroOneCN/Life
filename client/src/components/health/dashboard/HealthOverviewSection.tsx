import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { Grid } from '@arco-design/web-react';

import { EmptyState, SectionCard } from '../../page';
import { Tag } from '../../ui';
import type { HealthDashboardOverview } from '../../../types/healthDashboard';

const Row = Grid.Row;
const Col = Grid.Col;

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
 * 格式化日期为中文短格式。
 * @param dateStr - 日期字符串
 * @returns 格式化后的日期，如「2026年6月15日」
 */
function formatDateShort(dateStr: string | null) {
  if (!dateStr) return '';
  return dayjs(dateStr).format('YYYY年M月D日');
}

/**
 * 健康概览 Section：展示步数 / 体重 / 运动 / 饮食 / 用药 / 体检六大维度的关键指标。
 * 每个指标卡片内嵌状态标签与「查看明细」链接，布局与现有 stat-card 风格一致。
 * @param overview - 后端返回的概览数据
 * @param loading - 是否处于加载中
 */
export function HealthOverviewSection({ overview, loading }: HealthOverviewSectionProps) {
  if (loading) {
    return (
      <SectionCard title="健康概览" description="正在加载综合指标…">
        <Row gutter={[12, 12]}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Col span={8} key={index}>
              <div className="stat-card">
                <span className="stat-label">加载中</span>
                <strong className="stat-value skeleton-text">—</strong>
              </div>
            </Col>
          ))}
        </Row>
      </SectionCard>
    );
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

  const checkupTag = describeCheckupStatus(
    overview.checkup.abnormalCount,
    overview.checkup.totalRecords,
  );
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
      value:
        overview.weight.latestWeightKg !== null
          ? `${overview.weight.latestWeightKg.toFixed(1)} kg`
          : '-',
      helper: overview.weight.latestDate
        ? `录入于 ${formatDateShort(overview.weight.latestDate)}`
        : '尚未录入',
      accent:
        overview.weight.bmi !== null && overview.weight.bmi >= 18.5 && overview.weight.bmi <= 24
          ? '#27a644'
          : '#f59e0b',
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
      accent:
        overview.medication.recordDays30 / Math.max(1, overview.medication.plannedDays30) >= 0.8
          ? '#27a644'
          : '#f59e0b',
      link: '/health/checkup',
      linkText: '查看明细',
    },
    {
      key: 'checkup',
      label: '体检记录',
      value:
        overview.checkup.totalRecords > 0 ? overview.checkup.totalRecords.toLocaleString() : '0',
      helper: overview.checkup.latestDate
        ? `最近体检 ${formatDateShort(overview.checkup.latestDate)}`
        : '尚未录入',
      link: '/health/checkup',
      linkText: '查看明细',
      tag: checkupTag,
    },
  ];

  return (
    <SectionCard title="健康概览" description="跨子模块综合指标，点击「查看明细」可跳转到对应模块">
      <Row gutter={[12, 12]}>
        {cards.map((card) => (
          <Col span={8} key={card.key}>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">{card.label}</span>
                {card.tag ? (
                  <Tag tone={card.tag.tone} size="sm">
                    {card.tag.text}
                  </Tag>
                ) : null}
              </div>
              <strong
                className="stat-value"
                style={card.accent ? { color: card.accent } : undefined}
              >
                {card.value}
              </strong>
              <span className="stat-helper">{card.helper}</span>
              {card.link ? (
                <Link className="stat-card-link" to={card.link}>
                  {card.linkText ?? '查看明细'} →
                </Link>
              ) : null}
            </div>
          </Col>
        ))}
      </Row>
    </SectionCard>
  );
}
