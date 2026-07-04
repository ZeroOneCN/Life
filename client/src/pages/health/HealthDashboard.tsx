import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { HealthOverviewSection } from '../../components/health/dashboard/HealthOverviewSection';
import { HealthHeatmapSection } from '../../components/health/dashboard/HealthHeatmapSection';
import { HealthRadarSection } from '../../components/health/dashboard/HealthRadarSection';
import { HealthComparisonSection } from '../../components/health/dashboard/HealthComparisonSection';
import { PageHeader } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { healthDashboardApi } from '../../services/healthDashboardApi';
import type {
  HealthDashboardOverview,
  HealthRadarSummary,
  HealthStepHeatmapItem,
} from '../../types/healthDashboard';

const HealthReportPage = lazy(() => import('./HealthReport'));

/**
 * 健康概览页面：跨子模块综合展示健康数据。
 * 包含四个 Section：
 * 1. 综合概览卡片
 * 2. 步数热力图
 * 3. 综合健康度雷达图
 * 4. 数据对比柱状图
 */
export default function HealthDashboardPage() {
  const { toast, showToast } = useToastState();

  const [overview, setOverview] = useState<HealthDashboardOverview | null>(null);
  const [heatmapItems, setHeatmapItems] = useState<HealthStepHeatmapItem[]>([]);
  const [heatmapYear, setHeatmapYear] = useState<number>(dayjs().year());
  const [radar, setRadar] = useState<HealthRadarSummary | null>(null);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [radarLoading, setRadarLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'report'>('overview');

  /**
   * 加载综合概览数据。
   */
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await healthDashboardApi.getOverview();
      setOverview(data);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '健康概览加载失败。'), 'error');
    } finally {
      setOverviewLoading(false);
    }
  }, [showToast]);

  /**
   * 加载步数热力图数据。
   * @param year - 年份
   */
  const loadHeatmap = useCallback(async (year: number) => {
    setHeatmapLoading(true);
    try {
      const data = await healthDashboardApi.getStepHeatmap(year);
      setHeatmapItems(data.items);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '步数热力图加载失败。'), 'error');
    } finally {
      setHeatmapLoading(false);
    }
  }, [showToast]);

  /**
   * 加载雷达图数据。
   */
  const loadRadar = useCallback(async () => {
    setRadarLoading(true);
    try {
      const data = await healthDashboardApi.getRadar();
      setRadar(data);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '综合健康度加载失败。'), 'error');
    } finally {
      setRadarLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadOverview();
    void loadRadar();
  }, [loadOverview, loadRadar]);

  useEffect(() => {
    void loadHeatmap(heatmapYear);
  }, [heatmapYear, loadHeatmap]);

  return (
    <div className="page-stack">
      <PageHeader
        title="健康概览"
        subtitle="实时健康数据概览与周期报告"
        actions={
          <div className="merged-page-tabs">
            <PillTabs
              options={[
                { value: 'overview', label: '本期概览' },
                { value: 'report', label: '周期报告' },
              ]}
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'overview' | 'report')}
            />
          </div>
        }
      />

      {activeTab === 'overview' ? (
        <>
          <HealthOverviewSection overview={overview} loading={overviewLoading} />

          <HealthHeatmapSection
            items={heatmapItems}
            year={heatmapYear}
            loading={heatmapLoading}
            onYearChange={setHeatmapYear}
          />

          <HealthRadarSection radar={radar} loading={radarLoading} />

          <HealthComparisonSection showToast={showToast} />
        </>
      ) : (
        <Suspense fallback={<div className="skeleton-block" />}>
          <HealthReportPage />
        </Suspense>
      )}

      <Toast toast={toast} />
    </div>
  );
}
