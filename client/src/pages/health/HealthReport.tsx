import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { HealthReportHeaderSection } from '../../components/health/report/HealthReportHeaderSection';
import { HealthReportSummarySection } from '../../components/health/report/HealthReportSummarySection';
import { HealthReportTrendSection } from '../../components/health/report/HealthReportTrendSection';
import { HealthReportAbnormalSection } from '../../components/health/report/HealthReportAbnormalSection';
import { HealthReportAISuggestionSection } from '../../components/health/report/HealthReportAISuggestionSection';
import { HealthReportExportButton } from '../../components/health/report/HealthReportExportButton';
import { Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { healthReportApi } from '../../services/healthReportApi';
import type { HealthReportPeriod } from '../../types/healthReport';

/**
 * 健康报告页面：周期性汇总（周/月/年）+ AI 建议 + PDF 导出。
 *
 * 包含 6 个 Section：
 * 1. 报告头部（周期切换）
 * 2. 数据汇总卡片（6 维度 + 同环比）
 * 3. 趋势分析图表
 * 4. 异常指标展示
 * 5. AI 建议展示
 * 6. PDF 导出按钮
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

  const exportFileName = `健康报告-${period === 'year' ? dayjs(date).format('YYYY') : period === 'month' ? dayjs(date).format('YYYY-MM') : dayjs(date).format('YYYY-MM-DD')}`;
  const canExport = !!summary && !summaryLoading;

  return (
    <div className="page-stack">
      <div ref={reportRef} className="page-stack">
        <HealthReportHeaderSection
          period={period}
          date={date}
          loading={summaryLoading}
          onPeriodChange={handlePeriodChange}
          onDateChange={handleDateChange}
          onRefresh={handleRefresh}
        />

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
