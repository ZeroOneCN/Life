import { useEffect, useMemo, useState } from 'react';

import { EmptyState, PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, DataTable, SelectField, Tag, useToastState, Toast } from '../../components/ui';
import { financeReportApi } from '../../services/financeReportApi';
import { buildApiErrorMessage } from '../../lib/api';
import type {
  FinanceMonthlyReport,
  FinanceYearlyReport,
  FinanceReportModuleKey,
} from '../../types/financeReport';

const MODULE_LABELS: Record<FinanceReportModuleKey, string> = {
  shopping: '购物',
  travel: '旅行',
  loan: '贷款',
  subscription: '订阅',
  rent: '房租',
};

const TONE_MAP: Record<FinanceReportModuleKey, 'red' | 'orange' | 'green' | 'blue' | 'default'> = {
  shopping: 'red',
  travel: 'orange',
  loan: 'blue',
  subscription: 'green',
  rent: 'default',
};

const channelLabels: Record<string, string> = {
  email: '邮件',
  wechatWork: '企业微信',
  dingTalk: '钉钉',
  feishu: '飞书',
  telegram: 'Telegram',
  webhook: 'Webhook',
};

const channelStatusLabels: Record<string, string> = {
  success: '成功',
  skipped: '已跳过',
  error: '失败',
};

function formatMonth(month: string) {
  const [year, monthIndex] = month.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }
  return `${year} 年 ${monthIndex} 月`;
}

function formatCurrency(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatChange(change: number, percent: number) {
  const sign = change > 0 ? '+' : '';
  return `${sign}${formatCurrency(change)}（${sign}${(percent * 100).toFixed(1)}%）`;
}

export default function FinanceReportPage() {
  const { toast, showToast } = useToastState();
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [report, setReport] = useState<FinanceMonthlyReport | null>(null);
  const [yearReport, setYearReport] = useState<FinanceYearlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const today = new Date();
    for (let i = 0; i < 12; i += 1) {
      const cursor = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value, label: formatMonth(value) });
    }
    return options;
  }, []);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3, current - 4].map((value) => ({ value, label: `${value} 年` }));
  }, []);

  const loadMonthly = async (targetMonth: string) => {
    setLoading(true);
    try {
      const nextReport = await financeReportApi.getMonthly(targetMonth);
      setReport(nextReport);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '月度财务报告加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadYearly = async (targetYear: number) => {
    try {
      const next = await financeReportApi.getYearly(targetYear);
      setYearReport(next);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '年度财务报告加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadMonthly(month);
  }, [month]);

  useEffect(() => {
    void loadYearly(year);
  }, [year]);

  const handlePush = async () => {
    setPushing(true);
    try {
      const result = await financeReportApi.pushMonthly(month, `财务月报 · ${formatMonth(month)}`);
      const logs = result.logs ?? [];
      const successCount = logs.filter((item) => item.status === 'success').length;
      const skippedCount = logs.filter((item) => item.status === 'skipped').length;
      const errorCount = logs.filter((item) => item.status === 'error').length;
      const channelSummary = logs
        .map((item) => `${channelLabels[item.channel] ?? item.channel}:${channelStatusLabels[item.status]}`)
        .join(' / ');

      if (logs.length === 0) {
        showToast('月报已生成，但通知场景尚未配置渠道，请在通知中心 > 场景绑定添加渠道。', 'warning');
      } else if (successCount === 0) {
        showToast(`月报推送未真正下发：${channelSummary || '无渠道可用'}。请检查通知中心的渠道配置。`, 'error');
      } else {
        const detail = channelSummary ? `，渠道：${channelSummary}` : '';
        showToast(`月报已远程推送到 ${successCount} 个渠道（跳过 ${skippedCount} / 失败 ${errorCount}）${detail}`, 'success');
      }
    } catch (error) {
      showToast(buildApiErrorMessage(error, '月报推送失败。'), 'error');
    } finally {
      setPushing(false);
    }
  };

  const monthlyStats = useMemo(() => {
    if (!report) {
      return [] as Array<{ label: string; value: string; helper?: string; tone?: 'positive' | 'negative' | 'neutral' }>;
    }
    const momTone = report.monthOverMonthChange >= 0 ? 'negative' : 'positive';
    const yoyTone = report.yearOverYearChange >= 0 ? 'negative' : 'positive';
    return [
      { label: '总支出', value: formatCurrency(report.totalExpense) },
      { label: '环比上月', value: formatChange(report.monthOverMonthChange, report.monthOverMonthChangePercent), helper: `上月 ${formatCurrency(report.previousMonthExpense)}`, tone: momTone },
      { label: '同比去年', value: formatChange(report.yearOverYearChange, report.yearOverYearChangePercent), helper: `去年同月 ${formatCurrency(report.lastYearSameMonthExpense)}`, tone: yoyTone },
      { label: '覆盖模块', value: `${report.moduleBreakdown.filter((item) => item.count > 0).length} / 5`, helper: `${report.topExpenses.length} 笔 Top3 支出` },
    ];
  }, [report]);

  return (
    <div className="page-stack">
      <PageHeader
        title="财务月报 / 年报"
        subtitle="跨购物、旅行、贷款、订阅、房租 5 个模块自动汇总，按月生成支出、同环比与 Top 3 重点支出。"
        actions={(
          <>
            <Tag tone="blue">月度自动推送</Tag>
            <Tag tone="green">5 模块聚合</Tag>
          </>
        )}
      />

      <SectionCard
        title="月度报告"
        description="可选择历史月份即时查看，并一键推送到通知中心。"
        action={(
          <div className="inline-row">
            <SelectField
              label=""
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectField>
            <Btn tone="primary" onClick={handlePush} disabled={pushing || !report}>
              {pushing ? '推送中…' : '推送到通知中心'}
            </Btn>
          </div>
        )}
      >
        <StatGrid items={monthlyStats} />
        {loading ? (
          <EmptyState title="正在加载…" description="正在跨模块聚合数据。" icon="📊" />
        ) : report ? (
          <div className="finance-report-grid">
            <div className="finance-report-card card">
              <h4>模块占比</h4>
              <ul className="finance-report-module-list">
                {report.moduleBreakdown.map((item) => (
                  <li key={item.module}>
                    <div className="finance-report-module-head">
                      <Tag tone={TONE_MAP[item.module]}>{MODULE_LABELS[item.module]}</Tag>
                      <strong>{formatCurrency(item.amount)}</strong>
                    </div>
                    <div className="finance-report-bar">
                      <div
                        className="finance-report-bar-fill"
                        style={{ width: `${Math.min(100, item.percentage * 100)}%` }}
                      />
                    </div>
                    <div className="finance-report-module-meta">
                      <span>{formatPercent(item.percentage)}</span>
                      <span className="subtle-text">{item.count} 笔</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="finance-report-card card">
              <h4>分类 Top 12</h4>
              {report.categoryBreakdown.length ? (
                <DataTable
                  data={report.categoryBreakdown}
                  rowKey="category"
                  columns={[
                    {
                      key: 'category',
                      title: '分类',
                      render: (_, row) => row.category,
                    },
                    {
                      key: 'amount',
                      title: '金额',
                      align: 'right' as const,
                      render: (_, row) => formatCurrency(row.amount),
                    },
                    {
                      key: 'percentage',
                      title: '占比',
                      align: 'right' as const,
                      render: (_, row) => formatPercent(row.percentage),
                    },
                    {
                      key: 'count',
                      title: '笔数',
                      align: 'right' as const,
                      render: (_, row) => `${row.count}`,
                    },
                  ]}
                />
              ) : (
                <EmptyState title="本月暂无分类支出" description="录入财务数据后会自动汇总。" icon="📂" />
              )}
            </div>
            <div className="finance-report-card card">
              <h4>Top 3 支出</h4>
              {report.topExpenses.length ? (
                <ol className="finance-report-top-list">
                  {report.topExpenses.map((item, index) => (
                    <li key={`${item.module}-${item.date}-${index}`}>
                      <div className="finance-report-top-head">
                        <Tag tone={TONE_MAP[item.module]}>{MODULE_LABELS[item.module]}</Tag>
                        <strong>{formatCurrency(item.amount)}</strong>
                      </div>
                      <div className="finance-report-top-title">{item.title}</div>
                      <div className="finance-report-top-meta">
                        <span>{item.date}</span>
                        {item.category ? <span className="subtle-text">{item.category}</span> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="本月暂无 Top 3 支出" description="录入财务数据后会自动汇总。" icon="🏆" />
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="暂无数据" description="请先在财务各模块录入数据。" icon="📊" />
        )}
      </SectionCard>

      <SectionCard
        title="年度趋势"
        description="查看整年 12 个月的支出趋势，按月切换历史年份。"
        action={(
          <SelectField
            label=""
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {yearOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
        )}
      >
        {yearReport ? (
          <div className="finance-report-year">
            <StatGrid
              items={[
                { label: '年度总支出', value: formatCurrency(yearReport.yearTotal) },
                { label: '覆盖月份', value: `${yearReport.months.filter((item) => item.total > 0).length} / 12` },
                {
                  label: '月均支出',
                  value: formatCurrency(yearReport.yearTotal / 12),
                },
                {
                  label: '最高单月',
                  value: formatCurrency(Math.max(...yearReport.months.map((item) => item.total))),
                  helper: yearReport.months.length
                    ? yearReport.months.reduce((max, item) => (item.total > max.total ? item : max), yearReport.months[0]).month
                    : '',
                },
              ]}
            />
            <div className="finance-report-year-bars">
              {yearReport.months.map((item) => {
                const max = Math.max(1, ...yearReport.months.map((value) => value.total));
                const height = (item.total / max) * 100;
                return (
                  <div key={item.month} className="finance-report-year-bar">
                    <div className="finance-report-year-bar-track">
                      <div className="finance-report-year-bar-fill" style={{ height: `${height}%` }} />
                    </div>
                    <span className="finance-report-year-bar-value">{formatCurrency(item.total)}</span>
                    <span className="finance-report-year-bar-label">{item.month.split('-')[1]} 月</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="正在加载…" description="正在汇总年度数据。" icon="📈" />
        )}
      </SectionCard>

      <Toast toast={toast} />
    </div>
  );
}
