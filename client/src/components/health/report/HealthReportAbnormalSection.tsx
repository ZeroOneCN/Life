import dayjs from 'dayjs';

import { EmptyState, SectionCard } from '../../page';
import { Tag } from '../../ui';
import type { HealthReportAbnormal } from '../../../types/healthReport';

interface HealthReportAbnormalSectionProps {
  abnormal: HealthReportAbnormal | null;
  loading: boolean;
}

/**
 * 根据体检状态返回标签 tone。
 * @param status - 状态值（abnormal / attention / normal）
 * @returns 标签 tone
 */
function describeCheckupStatus(status: string) {
  if (status === 'abnormal') return { tone: 'red' as const, text: '异常' };
  if (status === 'attention') return { tone: 'orange' as const, text: '关注' };
  return { tone: 'green' as const, text: '正常' };
}

/**
 * 格式化日期为中文短格式。
 * @param dateStr - 日期字符串
 * @returns 格式化后的字符串
 */
function formatDateShort(dateStr: string) {
  const parsed = dayjs(dateStr);
  return parsed.isValid() ? parsed.format('YYYY年M月D日') : dateStr;
}

/**
 * 异常指标 Section：展示周期内异常体检记录、用药覆盖率与体重变化告警。
 * @param abnormal - 异常识别结果
 * @param loading - 是否加载中
 */
export function HealthReportAbnormalSection({ abnormal, loading }: HealthReportAbnormalSectionProps) {
  if (loading) {
    return (
      <SectionCard title="异常指标" description="正在识别周期异常…">
        <div className="skeleton-block" />
      </SectionCard>
    );
  }

  if (!abnormal) {
    return (
      <SectionCard title="异常指标" description="周期内健康异常识别">
        <EmptyState title="暂无异常识别结果" description="请先加载报告后查看异常识别。" />
      </SectionCard>
    );
  }

  const hasAbnormal = abnormal.abnormalCount > 0 || abnormal.medication.isLow || (abnormal.weightChangeAlert?.isAlert ?? false);

  return (
    <SectionCard
      title="异常指标"
      description={`${abnormal.range.label}（${formatDateShort(abnormal.range.start)} - ${formatDateShort(abnormal.range.end)}）`}
    >
      {!hasAbnormal ? (
        <EmptyState
          title="本期未发现异常"
          description="当前周期内未识别到异常体检指标、用药低记录或体重异常变化。"
        />
      ) : (
        <div className="page-stack">
          {/* 异常概览卡片 */}
          <div className="health-report-abnormal-overview">
            <div className="health-report-abnormal-card">
              <span>异常体检指标</span>
              <strong style={{ color: abnormal.abnormalCount > 0 ? '#e5484d' : undefined }}>
                {abnormal.abnormalCount} 项
              </strong>
            </div>
            <div className="health-report-abnormal-card">
              <span>用药覆盖率</span>
              <strong style={{ color: abnormal.medication.isLow ? '#f59e0b' : '#27a644' }}>
                {(abnormal.medication.coverage * 100).toFixed(0)}%
              </strong>
              <span className="muted">
                {abnormal.medication.recordDays} / {abnormal.medication.totalDays} 天
              </span>
            </div>
            <div className="health-report-abnormal-card">
              <span>体重变化</span>
              {abnormal.weightChangeAlert ? (
                <>
                  <strong style={{ color: abnormal.weightChangeAlert.isAlert ? '#e5484d' : '#27a644' }}>
                    {abnormal.weightChangeAlert.change > 0 ? '+' : ''}
                    {abnormal.weightChangeAlert.change.toFixed(1)} kg
                  </strong>
                  <span className="muted">阈值 ±{abnormal.weightChangeAlert.threshold.toFixed(1)} kg</span>
                </>
              ) : (
                <strong>—</strong>
              )}
            </div>
          </div>

          {/* 异常体检记录列表 */}
          {abnormal.abnormalCheckupRecords.length > 0 ? (
            <div className="health-report-abnormal-list">
              <strong>异常体检记录明细</strong>
              <div className="health-report-abnormal-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>体检日期</th>
                      <th>分类</th>
                      <th>项目</th>
                      <th>结果</th>
                      <th>参考范围</th>
                      <th>状态</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abnormal.abnormalCheckupRecords.map((record) => {
                      const tag = describeCheckupStatus(record.status);
                      return (
                        <tr key={record.id}>
                          <td>{formatDateShort(record.testDate)}</td>
                          <td>{record.testType}</td>
                          <td>{record.testName}</td>
                          <td>
                            <strong>{record.value}</strong> {record.unit}
                          </td>
                          <td className="muted">{record.referenceRange || '-'}</td>
                          <td>
                            <Tag tone={tag.tone} size="sm">{tag.text}</Tag>
                          </td>
                          <td className="muted">{record.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* 用药低记录提示 */}
          {abnormal.medication.isLow ? (
            <div className="callout callout-warning">
              用药记录覆盖率偏低，本期仅记录 {abnormal.medication.recordDays} 天，建议保持每日用药记录习惯。
            </div>
          ) : null}

          {/* 体重异常变化提示 */}
          {abnormal.weightChangeAlert?.isAlert ? (
            <div className="callout callout-warning">
              体重变化达 {abnormal.weightChangeAlert.change > 0 ? '+' : ''}
              {abnormal.weightChangeAlert.change.toFixed(1)} kg，超过 ±{abnormal.weightChangeAlert.threshold.toFixed(1)} kg 阈值，请关注近期饮食与运动平衡。
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
