import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../page';
import {
  buildLifeCardBalanceDistribution,
  buildLifeCardCarrierBreakdown,
  buildLifeCardMonthlyTrend,
  buildLifeCardOverview,
  buildLifeCardRanking,
  CARD_CHART_COLORS,
  formatLifeCardMoney,
} from '../../services/card';
import type { LifeCardPageState, LifeCardBillRecord, LifeCardRecord } from '../../types/card';

interface CardStatisticsSectionProps {
  cards: LifeCardRecord[];
  bills: LifeCardBillRecord[];
  recharges: LifeCardPageState['recharges'];
  settings: LifeCardPageState['settings'];
}

export function CardStatisticsSection({
  cards,
  bills,
  recharges,
  settings,
}: CardStatisticsSectionProps) {
  const overview = useMemo(
    () => buildLifeCardOverview(cards, bills, recharges, settings),
    [bills, cards, recharges, settings],
  );
  const monthlyTrend = useMemo(() => buildLifeCardMonthlyTrend(bills), [bills]);
  const carrierBreakdown = useMemo(() => buildLifeCardCarrierBreakdown(cards, bills), [bills, cards]);
  const balanceDistribution = useMemo(() => buildLifeCardBalanceDistribution(cards), [cards]);
  const ranking = useMemo(() => buildLifeCardRanking(cards, bills, recharges).slice(0, 8), [bills, cards, recharges]);
  const hasData = Boolean(cards.length || bills.length || recharges.length);

  return (
    <SectionCard
      title="统计分析"
      description="把号卡余额、账单扣费和充值历史统一拉通，快速看清支出结构与低余额分布。"
    >
      <div className="page-stack">
        <StatGrid
          className="card-overview-grid"
          items={[
            { label: '总号卡数', value: `${overview.totalCards} 张` },
            { label: '低余额数', value: `${overview.lowBalanceCount} 张`, helper: `阈值 ${formatLifeCardMoney(settings.balanceThreshold)}` },
            { label: '总余额', value: formatLifeCardMoney(overview.totalBalance) },
            { label: '月租合计', value: formatLifeCardMoney(overview.monthlyFeeTotal) },
            { label: '运营商数', value: `${overview.carrierCount}` },
            { label: '本月账单数', value: `${overview.currentMonthBillCount}` },
            { label: '本月账单金额', value: formatLifeCardMoney(overview.currentMonthBillAmount) },
            { label: '累计充值额', value: formatLifeCardMoney(overview.totalRechargeAmount) },
          ]}
        />

        {hasData ? (
          <div className="card-statistics-grid">
            <div className="card chart-card card-chart-card-wide">
              <div className="fitness-chart-header">
                <strong>近 12 个月账单趋势</strong>
                <span>按月份汇总总费用和账单条数，方便快速识别账单波动。</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                  <XAxis dataKey="label" stroke="var(--color-ink-subtle)" />
                  <YAxis stroke="var(--color-ink-subtle)" />
                  <Tooltip
                    formatter={(value, key) => (
                      key === 'amount' ? formatLifeCardMoney(Number(value ?? 0)) : `${Number(value ?? 0)} 条`
                    )}
                  />
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <div className="fitness-chart-header">
                <strong>运营商分布</strong>
                <span>按号卡数量与累计账单金额聚合，便于看清使用集中度。</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={carrierBreakdown}
                    dataKey="totalBillAmount"
                    nameKey="carrierName"
                    innerRadius={60}
                    outerRadius={98}
                    paddingAngle={3}
                  >
                    {carrierBreakdown.map((item, index) => (
                      <Cell key={item.carrierName} fill={item.color || CARD_CHART_COLORS[index % CARD_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatLifeCardMoney(Number(value ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="card-legend-list">
                {carrierBreakdown.map((item) => (
                  <div key={item.carrierName} className="card-legend-item">
                    <span className="card-legend-dot" style={{ background: item.color }} />
                    <span>{item.carrierName}</span>
                    <strong>{formatLifeCardMoney(item.totalBillAmount)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card chart-card">
              <div className="fitness-chart-header">
                <strong>余额区间分布</strong>
                <span>快速识别低余额号卡集中在哪个区间。</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={balanceDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                  <XAxis dataKey="range" stroke="var(--color-ink-subtle)" interval={0} angle={-18} textAnchor="end" height={72} />
                  <YAxis stroke="var(--color-ink-subtle)" />
                  <Tooltip formatter={(value) => `${Number(value ?? 0)} 张`} />
                  <Bar dataKey="count" fill="var(--color-primary-strong)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card">
              <div className="fitness-chart-header">
                <strong>号卡累计支出排行</strong>
                <span>按累计账单金额排序，帮助判断哪些号卡最值得重点优化。</span>
              </div>
              <div className="card-ranking-list">
                {ranking.map((item, index) => (
                  <div key={item.simId} className="card-ranking-item">
                    <span className="card-ranking-index">{index + 1}</span>
                    <div>
                      <strong>{item.phoneNumber}</strong>
                      <span>{item.carrierName} · {item.billCount} 条账单</span>
                    </div>
                    <strong>{formatLifeCardMoney(item.totalBillAmount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="暂无可分析的数据"
            description="可以先录入号卡、充值或账单记录，统计看板会自动开始联动刷新。"
          />
        )}
      </div>
    </SectionCard>
  );
}
