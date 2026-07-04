import { apiGet, apiPost } from '../lib/api';
import type {
  HealthReportAbnormal,
  HealthReportPeriod,
  HealthReportAISuggestion,
  HealthReportSummary,
} from '../types/healthReport';

/**
 * 健康报告 API 封装
 *
 * 对应后端 /api/health/report 路由。
 */
export const healthReportApi = {
  /**
   * 获取周期健康报告汇总（步数 / 体重 / 运动 / 饮食 / 用药 / 体检 + 同环比）。
   * @param period - 周期类型
   * @param date - 日期字符串（YYYY-MM-DD）
   * @returns 报告汇总数据
   */
  getSummary(period: HealthReportPeriod, date?: string) {
    return apiGet<HealthReportSummary>(
      '/health/report/summary',
      undefined,
      { period, ...(date ? { date } : {}) },
    );
  },

  /**
   * 获取异常指标识别。
   * @param period - 周期类型
   * @param date - 日期字符串
   * @returns 异常识别结果
   */
  getAbnormal(period: HealthReportPeriod, date?: string) {
    return apiGet<HealthReportAbnormal>(
      '/health/report/abnormal',
      undefined,
      { period, ...(date ? { date } : {}) },
    );
  },

  /**
   * 生成 AI 健康建议。
   * @param period - 周期类型
   * @param date - 日期字符串
   * @returns AI 建议结果
   */
  generateAISuggestion(period: HealthReportPeriod, date?: string) {
    return apiPost<HealthReportAISuggestion>(
      '/health/report/ai-suggestion',
      { period, ...(date ? { date } : {}) },
    );
  },
};
