import { Card, Grid, Typography } from '@arco-design/web-react';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';

import { EmptyState, SectionCard, StatGrid } from '../../page';
import { Tag, TrendArrow } from '../../ui';
import type { HealthReportChange, HealthReportRangeSummary } from '../../../types/healthReport';

const TypographyText = Typography.Text;

interface HealthReportSummarySectionProps {
  current: HealthReportRangeSummary | null;
  previous: HealthReportRangeSummary | null;
  changes: {
    step: HealthReportChange;
    exercise: HealthReportChange;
    diet: HealthReportChange;
    weight: HealthReportChange;
  } | null;
  loading: boolean;
  /** 报告周期操作栏（日期选择 / 刷新 / 导出），嵌入数据汇总卡片右上角 */
  toolbar?: ReactNode;
}

/**
 * 格式化百分比变化：保留 1 位小数并带正负号。
 * @param percent - 变化百分比
 * @returns 格式化后的字符串
 */
function formatPercent(percent: number | null) {
  if (percent === null) return '—';
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

/**
 * 格式化日期为中文短格式。
 * @param dateStr - 日期字符串
 * @returns 格式化后的字符串
 */
function formatDateShort(dateStr: string) {
  return dayjs(dateStr).format('YYYY年M月D日');
}

/**
 * 根据 BMI 推算健康度标签。
 * @param change - 同环比变化
 * @returns 标签元组
 */
function describeWeightChange(change: HealthReportChange) {
  if (change.trend === 'none' || change.percent === null) {
    return { tone: 'default' as const, text: '无变化' };
  }
  if (change.trend === 'down') return { tone: 'green' as const, text: '下降' };
  if (change.trend === 'up') return { tone: 'orange' as const, text: '上升' };
  return { tone: 'blue' as const, text: '持平' };
}

/**
 * 数据汇总 Section：展示当前周期六大维度的核心指标，并显示同比变化。
 * @param current - 当前周期汇总
 * @param previous - 上一周期汇总
 * @param changes - 同环比变化
 * @param loading - 是否加载中
 */
export function HealthReportSummarySection({
  current,
  previous,
  changes,
  loading,
  toolbar,
}: HealthReportSummarySectionProps) {
  if (loading) {
    return (
      <SectionCard title="数据汇总" description="正在加载当前周期健康指标…">
        <Grid.Row gutter={[12, 12]}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Grid.Col key={index} xs={12} sm={8} md={6} lg={4} xl={4}>
              <Card bordered={false} bodyStyle={{ padding: '16px 20px' }}>
                <TypographyText
                  type="secondary"
                  style={{ fontSize: 13, display: 'block', marginBottom: 4 }}
                >
                  加载中
                </TypographyText>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-3)' }}>—</div>
              </Card>
            </Grid.Col>
          ))}
        </Grid.Row>
      </SectionCard>
    );
  }

  if (!current) {
    return (
      <SectionCard title="数据汇总" description="当前周期暂无数据">
        <EmptyState title="暂无汇总数据" description="请先录入步数 / 体重 / 运动等数据后再查看。" />
      </SectionCard>
    );
  }

  const weightTag = changes ? describeWeightChange(changes.weight) : null;

  const items = [
    {
      label: '步数（总）',
      value: `${current.step.totalSteps.toLocaleString()} 步`,
      helper: `日均 ${current.step.avgSteps.toLocaleString()} 步 · 达标 ${current.step.goalHitDays} 天 · 距离 ${current.step.totalDistanceKm} 公里`,
      accent: undefined as string | undefined,
    },
    {
      label: '体重（最新）',
      value:
        current.weight.latestWeight !== null ? `${current.weight.latestWeight.toFixed(1)} kg` : '-',
      helper:
        current.weight.weightChange !== null
          ? `周期变化 ${current.weight.weightChange > 0 ? '+' : ''}${current.weight.weightChange.toFixed(1)} kg · 共 ${current.weight.recordCount} 条记录`
          : '周期内仅有部分体重记录',
      accent: undefined as string | undefined,
    },
    {
      label: '运动消耗',
      value: `${current.exercise.totalCalories.toLocaleString()} kcal`,
      helper: `运动 ${current.exercise.activeDays} 天 · ${current.exercise.totalSessions} 次 · 时长 ${current.exercise.totalDuration} 分钟`,
      accent: undefined as string | undefined,
    },
    {
      label: '饮食摄入',
      value: `${current.diet.intakeCalories.toLocaleString()} kcal`,
      helper: `净热量 ${current.diet.netCalories.toLocaleString()} kcal · 日均净 ${current.diet.avgNetCalories.toLocaleString()} kcal · ${current.diet.recordCount} 条记录`,
      accent: Math.abs(current.diet.avgNetCalories) > 500 ? '#e5484d' : '#27a644',
    },
    {
      label: '用药记录',
      value: `${current.medication.recordDays} 天`,
      helper: `共 ${current.medication.recordCount} 条记录`,
      accent: undefined as string | undefined,
    },
    {
      label: '体检指标',
      value: `${current.checkup.totalRecords} 项`,
      helper: `异常 ${current.checkup.abnormalCount} 项 · 关注 ${current.checkup.attentionCount} 项`,
      accent: current.checkup.abnormalCount > 0 ? '#e5484d' : '#27a644',
    },
  ];

  return (
    <SectionCard
      title="数据汇总"
      description={`${current.label}（${formatDateShort(current.start)} - ${formatDateShort(current.end)}）`}
      action={
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          {previous ? (
            <span className="health-report-previous-tag">对比：{previous.label}</span>
          ) : null}
          {toolbar}
        </div>
      }
    >
      <StatGrid items={items} />

      {changes ? (
        <div className="health-report-changes">
          <div className="health-report-change-card">
            <span className="health-report-change-label">步数同比</span>
            <div className="health-report-change-value">
              <TrendArrow direction={changes.step.trend === 'none' ? 'flat' : changes.step.trend} />
              <strong>{formatPercent(changes.step.percent)}</strong>
            </div>
            {weightTag && changes.step.percent === null ? (
              <span className="muted">上一周期无数据</span>
            ) : null}
          </div>
          <div className="health-report-change-card">
            <span className="health-report-change-label">运动同比</span>
            <div className="health-report-change-value">
              <TrendArrow
                direction={changes.exercise.trend === 'none' ? 'flat' : changes.exercise.trend}
              />
              <strong>{formatPercent(changes.exercise.percent)}</strong>
            </div>
            {changes.exercise.percent === null ? (
              <span className="muted">上一周期无数据</span>
            ) : null}
          </div>
          <div className="health-report-change-card">
            <span className="health-report-change-label">净热量同比</span>
            <div className="health-report-change-value">
              <TrendArrow direction={changes.diet.trend === 'none' ? 'flat' : changes.diet.trend} />
              <strong>{formatPercent(changes.diet.percent)}</strong>
            </div>
            {changes.diet.percent === null ? <span className="muted">上一周期无数据</span> : null}
          </div>
          <div className="health-report-change-card">
            <span className="health-report-change-label">体重变化</span>
            <div className="health-report-change-value">
              {weightTag ? (
                <Tag tone={weightTag.tone} size="sm">
                  {weightTag.text}
                </Tag>
              ) : null}
              <strong>
                {current.weight.weightChange !== null
                  ? `${current.weight.weightChange > 0 ? '+' : ''}${current.weight.weightChange.toFixed(1)} kg`
                  : '—'}
              </strong>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
