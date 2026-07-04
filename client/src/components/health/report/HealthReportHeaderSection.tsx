import dayjs from 'dayjs';

import { SectionCard } from '../../page';
import { PillTabs, Btn } from '../../ui';
import type { HealthReportPeriod } from '../../../types/healthReport';

interface HealthReportHeaderSectionProps {
  period: HealthReportPeriod;
  date: string;
  loading: boolean;
  onPeriodChange: (period: HealthReportPeriod) => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
}

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
 * 报告头部 Section：提供周期切换、日期选择与刷新入口。
 * @param period - 当前周期
 * @param date - 当前日期
 * @param loading - 是否加载中
 * @param onPeriodChange - 切换周期回调
 * @param onDateChange - 切换日期回调
 * @param onRefresh - 刷新回调
 */
export function HealthReportHeaderSection({
  period,
  date,
  loading,
  onPeriodChange,
  onDateChange,
  onRefresh,
}: HealthReportHeaderSectionProps) {
  const handlePeriodChange = (next: string) => {
    onPeriodChange(next as HealthReportPeriod);
  };

  /**
   * 根据周期返回 input 元素的类型与取值约束。
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

  return (
    <SectionCard
      title="健康报告"
      description={`当前周期：${describeRange(period, date)}`}
      action={
        <div className="health-report-header-actions">
          <PillTabs
            options={PERIOD_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={period}
            onChange={handlePeriodChange}
          />
          <input
            className="health-report-date-input"
            type={dateInputProps.type}
            value={dateInputProps.value}
            min={period === 'year' ? 2000 : undefined}
            max={period === 'year' ? dayjs().year() : undefined}
            onChange={(event) => {
              const value = event.target.value;
              if (period === 'week') onDateChange(value);
              else if (period === 'month') onDateChange(`${value}-01`);
              else onDateChange(`${value}-01-01`);
            }}
          />
          <Btn type="button" tone="secondary" onClick={onRefresh} disabled={loading}>
            {loading ? '加载中…' : '刷新报告'}
          </Btn>
        </div>
      }
    >
      <div className="health-report-header-meta">
        <span>报告覆盖步数 / 体重 / 运动 / 饮食 / 用药 / 体检六大维度，并提供同环比与 AI 建议。</span>
      </div>
    </SectionCard>
  );
}
