import { apiGet } from '../lib/api';
import type {
  HealthComparisonMetric,
  HealthComparisonPeriod,
  HealthComparisonResult,
  HealthDashboardOverview,
  HealthRadarSummary,
  HealthStepHeatmapResponse,
} from '../types/healthDashboard';

/**
 * 健康仪表盘 API 封装
 *
 * 对应后端 /api/health/dashboard 路由。
 */
export const healthDashboardApi = {
  /**
   * 获取综合概览（步数 / 体重 / 运动 / 用药 / 体检）。
   * @param params - 可选 userId（用于家庭共享场景）
   * @returns 综合概览数据
   */
  getOverview(params?: { userId?: string }) {
    return apiGet<HealthDashboardOverview>(
      '/health/dashboard/overview',
      undefined,
      params as Record<string, unknown> | undefined,
    );
  },

  /**
   * 获取步数日历热力图数据。
   * @param year - 年份（默认当前年）
   * @returns 热力图数据
   */
  getStepHeatmap(year?: number) {
    return apiGet<HealthStepHeatmapResponse>(
      '/health/dashboard/step-heatmap',
      undefined,
      year ? { year } : undefined,
    );
  },

  /**
   * 获取同比/环比对比数据。
   * @param metric - 指标类型
   * @param period - 周期（month / year）
   * @param date - 日期字符串（YYYY-MM 或 YYYY）
   * @returns 对比结果
   */
  getComparison(metric: HealthComparisonMetric, period: HealthComparisonPeriod, date?: string) {
    return apiGet<HealthComparisonResult>(
      '/health/dashboard/comparison',
      undefined,
      { metric, period, ...(date ? { date } : {}) },
    );
  },

  /**
   * 获取综合健康度雷达图数据。
   * @returns 雷达图数据（六维评分）
   */
  getRadar() {
    return apiGet<HealthRadarSummary>('/health/dashboard/radar');
  },
};
