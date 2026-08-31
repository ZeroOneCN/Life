import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;

import { HealthOverviewSection } from '../../components/health/dashboard/HealthOverviewSection';
import { HealthHeatmapSection } from '../../components/health/dashboard/HealthHeatmapSection';
import { HealthRadarSection } from '../../components/health/dashboard/HealthRadarSection';
import { HealthComparisonSection } from '../../components/health/dashboard/HealthComparisonSection';
import { PageHeader } from '../../components/page';
import { Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { healthDashboardApi } from '../../services/healthDashboardApi';
import type {
  HealthDashboardOverview,
  HealthRadarSummary,
  HealthStepHeatmapItem,
} from '../../types/healthDashboard';

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
  const loadHeatmap = useCallback(
    async (year: number) => {
      setHeatmapLoading(true);
      try {
        const data = await healthDashboardApi.getStepHeatmap(year);
        setHeatmapItems(data.items);
      } catch (error) {
        showToast(buildApiErrorMessage(error, '步数热力图加载失败。'), 'error');
      } finally {
        setHeatmapLoading(false);
      }
    },
    [showToast],
  );

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
    <div className="page-grid-wrapper">
      <Row gutter={[24, 20]}>
        <PageHeader title="健康概览" subtitle="综合展示健康指标、趋势与提醒" actions={null} />

        <Col span={24}>
          <HealthOverviewSection overview={overview} loading={overviewLoading} />
        </Col>

        <Col span={24}>
          <HealthHeatmapSection
            items={heatmapItems}
            year={heatmapYear}
            loading={heatmapLoading}
            onYearChange={setHeatmapYear}
          />
        </Col>

        <Col span={24}>
          <HealthRadarSection radar={radar} loading={radarLoading} />
        </Col>

        <Col span={24}>
          <HealthComparisonSection showToast={showToast} />
        </Col>

        <Col span={24}>
          <Toast toast={toast} />
        </Col>
      </Row>
    </div>
  );
}
