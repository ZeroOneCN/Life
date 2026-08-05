import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { HealthReportSummarySection } from '../../components/health/report/HealthReportSummarySection';
import { HealthReportTrendSection } from '../../components/health/report/HealthReportTrendSection';
import { HealthReportAbnormalSection } from '../../components/health/report/HealthReportAbnormalSection';
import { HealthReportAISuggestionSection } from '../../components/health/report/HealthReportAISuggestionSection';
import { HealthReportExportButton } from '../../components/health/report/HealthReportExportButton';
import { PageHeader } from '../../components/page';
import { Btn, PillTabs, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { healthReportApi } from '../../services/healthReportApi';
import type { HealthReportPeriod } from '../../types/healthReport';

const PERIOD_OPTIONS = [
  { value: 'week', label: '周报' },
  { value: 'month', label: '月报' },
  { value: 'year', label: '年报' },
] as const;

/**
 * 根据周期与日期生成展示标签。
 * @param period - 周期类型
 * @param date - 日期字符串
 * @returns 中文展示标签
 */
function describeRange(period: HealthReportPeriod, date: string) {
  const base = dayjs(date);
  if (!base.isValid()) return '当前周期';
  if (period === 'week') {
    const start = base.startOf('week');
    const end = base.endOf('week');
    return `${start.format('YYYY年M月D日')} - ${end.format('M月D日')}`;
  }
  if (period === 'month') return base.format('YYYY年M月');
  return base.format('YYYY年');
}

/**
 * 健康报告页面：周期性汇总（周/月/年）+ AI 建议 + PDF 导出。
 *
 * 页面骨架：PageHeader（标题 + 周期切换 actions）+ 4 个数据 Section + PDF 导出按钮。
 */
export default function HealthReportPage() {
  const { toast, showToast } = useToastState();
  const reportRef = useRef<HTMLDivElement>(null);

  const [period, setPeriod] = useState<HealthReportPeriod>('month');
  const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const [summary, setSummary] = useState<import('../../types/healthReport').HealthReportSummary | null>(null);
  const [abnormal, setAbnormal] = useState<import('../../types/healthReport').HealthReportAbnormal | null>(null);
  const [suggestion, setSuggestion] = useState<import('../../types/healthReport').HealthReportAISuggestion | null>(null);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [abnormalLoading, setAbnormalLoading] = useState(true);
  const [aiGenerating, setAiGenerating] = useState(false);

  /**
   * 加载报告汇总与异常识别。
   */
  const loadReport = useCallback(async () => {
    setSummaryLoading(true);
    setAbnormalLoading(true);
    try {
      const [summaryData, abnormalData] = await Promise.all([
        healthReportApi.getSummary(period, date),
        healthReportApi.getAbnormal(period, date),
      ]);
      setSummary(summaryData);
      setAbnormal(abnormalData);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '健康报告加载失败。'), 'error');
    } finally {
      setSummaryLoading(false);
      setAbnormalLoading(false);
    }
  }, [period, date, showToast]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  /**
   * 触发 AI 建议生成。
   */
  const handleGenerateAISuggestion = useCallback(async () => {
    setAiGenerating(true);
    try {
      const data = await healthReportApi.generateAISuggestion(period, date);
      setSuggestion(data);
      showToast('AI 建议生成成功。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, 'AI 建议生成失败。'), 'error');
    } finally {
      setAiGenerating(false);
    }
  }, [period, date, showToast]);

  /**
   * 切换周期时重置日期与 AI 建议缓存。
   */
  const handlePeriodChange = (next: HealthReportPeriod) => {
    setPeriod(next);
    setDate(dayjs().format('YYYY-MM-DD'));
    setSuggestion(null);
  };

  const handleDateChange = (next: string) => {
    setDate(next);
    setSuggestion(null);
  };

  const handleRefresh = () => {
    void loadReport();
  };

  /**
   * 根据周期返回日期输入控件的类型与取值约束。
   */
  const dateInputProps = (() => {
    if (period === 'week') {
      return { type: 'date' as const, value: date };
    }
    if (period === 'month') {
      return { type: 'month' as const, value: date.length >= 7 ? date.slice(0, 7) : date };
    }
    return { type: 'number' as const, value: date.length >= 4 ? date.slice(0, 4) : String(dayjs().year()) };
  })();

  const exportFileName = `健康报告-${period === 'year' ? dayjs(date).format('YYYY') : period === 'month' ? dayjs(date).format('YYYY-MM') : dayjs(date).format('YYYY-MM-DD')}`;
  const canExport = !!summary && !summaryLoading;

  return (
    <div className="page-stack">
      <PageHeader
        title="健康报告"
        subtitle="汇总周期健康数据，生成可视化报告"
        actions={(
          <PillTabs
            options={PERIOD_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={period}
            onChange={(value) => handlePeriodChange(value as HealthReportPeriod)}
          />
        )}
      />

      <div className="health-report-actions-bar">
        <input
          className="health-report-date-input"
          type={dateInputProps.type}
          value={dateInputProps.value}
          min={period === 'year' ? 2000 : undefined}
          max={period === 'year' ? dayjs().year() : undefined}
          onChange={(event) => {
            const value = event.target.value;
            if (period === 'week') handleDateChange(value);
            else if (period === 'month') handleDateChange(`${value}-01`);
            else handleDateChange(`${value}-01-01`);
          }}
          aria-label="选择周期日期"
        />
        <Btn type="button" tone="secondary" onClick={handleRefresh} disabled={summaryLoading}>
          {summaryLoading ? '加载中…' : '刷新报告'}
        </Btn>
        <div className="health-report-actions-spacer" />
        <HealthReportExportButton
          targetRef={reportRef}
          fileName={exportFileName}
          disabled={!canExport}
          showToast={showToast}
        />
      </div>
      <div ref={reportRef} className="page-stack">
        <HealthReportSummarySection
          current={summary?.current ?? null}
          previous={summary?.previous ?? null}
          changes={summary?.changes ?? null}
          loading={summaryLoading}
        />

        <HealthReportTrendSection
          current={summary?.current ?? null}
          previous={summary?.previous ?? null}
          loading={summaryLoading}
        />

        <HealthReportAbnormalSection
          abnormal={abnormal}
          loading={abnormalLoading}
        />

        <HealthReportAISuggestionSection
          suggestion={suggestion}
          loading={false}
          generating={aiGenerating}
          onGenerate={handleGenerateAISuggestion}
        />
      </div>

      <Toast toast={toast} />
    </div>
  );
}
