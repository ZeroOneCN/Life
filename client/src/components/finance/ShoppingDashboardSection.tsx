import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Field, SelectField, Tag } from '../ui';
import {
  SHOPPING_ALL_LEDGERS,
  buildShoppingLedgerSummary,
  buildShoppingMonthlyTrend,
  buildShoppingOverview,
  buildShoppingPlatformBreakdown,
  formatShoppingAmount,
  normalizeShoppingUserId,
} from '../../services/shopping';
import type { ShoppingCurrencyMode, ShoppingLedger, ShoppingPlatform, ShoppingRecord } from '../../types/shopping';

interface ShoppingDashboardSectionProps {
  userId: string;
  ledgerId: string;
  records: ShoppingRecord[];
  ledgers: ShoppingLedger[];
  platforms: ShoppingPlatform[];
  currencyMode: ShoppingCurrencyMode;
  usdtRate: number;
  onUserIdChange: (value: string) => void;
  onLedgerIdChange: (value: string) => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="fitness-chart-card">
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

export function ShoppingDashboardSection({
  userId,
  ledgerId,
  records,
  ledgers,
  platforms,
  currencyMode,
  usdtRate,
  onUserIdChange,
  onLedgerIdChange,
}: ShoppingDashboardSectionProps) {
  const overview = useMemo(
    () => buildShoppingOverview(records, userId, ledgerId),
    [records, userId, ledgerId],
  );
  const monthlyTrend = useMemo(
    () => buildShoppingMonthlyTrend(records, userId, ledgerId),
    [records, userId, ledgerId],
  );
  const platformBreakdown = useMemo(
    () => buildShoppingPlatformBreakdown(records, userId, ledgerId, platforms),
    [records, userId, ledgerId, platforms],
  );
  const ledgerSummary = useMemo(
    () => buildShoppingLedgerSummary(records, ledgers, userId),
    [records, ledgers, userId],
  );

  const hasTrendData = monthlyTrend.some((item) => item.amount > 0);
  const hasPlatformData = platformBreakdown.length > 0;
  const hasLedgerData = ledgerSummary.some((item) => item.amount > 0);

  return (
    <SectionCard
      title="统计看板"
      description="按用户与账本汇总最近 12 个月消费趋势、平台结构和账本沉淀，金额展示可跟随货币视图切换。"
      action={<Tag tone="green">{currencyMode === 'USDT' ? `汇率 1 USDT = ¥${usdtRate.toFixed(2)}` : '本币统计'}</Tag>}
    >
      <div className="page-stack">
        <div className="shopping-filter-grid shopping-filter-grid-dashboard">
          <Field
            label="看板用户 ID"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
            hint="趋势、分布和账本摘要都会按这里的用户维度刷新。"
          />
          <SelectField
            label="看板账本"
            value={ledgerId}
            onChange={(event) => onLedgerIdChange(event.target.value)}
          >
            <option value={SHOPPING_ALL_LEDGERS}>全部账本</option>
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
            ))}
          </SelectField>
        </div>

        <StatGrid
          items={[
            { label: '当前用户', value: normalizeShoppingUserId(userId) || '全部用户', helper: '影响看板统计口径' },
            {
              label: '当前账本',
              value: ledgerId === SHOPPING_ALL_LEDGERS ? '全部账本' : (ledgers.find((ledger) => ledger.id === ledgerId)?.name ?? '未知账本'),
              helper: '趋势与平台结构会按该账本过滤',
            },
            { label: '本月订单数', value: `${overview.currentMonthOrders}`, helper: '按自然月累计' },
            { label: '本月消费额', value: formatShoppingAmount(overview.currentMonthAmount, currencyMode, usdtRate) },
            { label: '累计消费额', value: formatShoppingAmount(overview.totalAmount, currencyMode, usdtRate), helper: `共 ${overview.totalOrders} 笔订单` },
            { label: '活跃平台数', value: `${overview.activePlatformCount}`, helper: `覆盖 ${overview.trackedMonths} 个有记录月份` },
          ]}
        />

        <div className="shopping-dashboard-grid">
          <ChartCard title="近 12 个月消费趋势" description="按月份查看消费金额变化，适合观察大促和集中采购阶段。">
            {hasTrendData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name, item) => {
                        if (name === '金额') {
                          return [formatShoppingAmount(Number(value ?? 0), currencyMode, usdtRate), '金额'];
                        }

                        return [String(item?.payload?.orderCount ?? 0), '订单数'];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="金额"
                      stroke="var(--color-primary)"
                      strokeWidth={2.8}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无趋势数据" description="先补充几个月的购物记录，趋势图才会形成可读变化。" />
            )}
          </ChartCard>

          <ChartCard title="平台消费分布" description="按平台查看累计金额结构，方便辨认主要消费渠道。">
            {hasPlatformData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={92}
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {platformBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [formatShoppingAmount(Number(value ?? 0), currencyMode, usdtRate), '累计金额']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无平台结构" description="当前用户或账本下还没有足够的购物记录来绘制平台分布。" />
            )}
          </ChartCard>

          <ChartCard title="平台消费排行" description="按累计金额从高到低展示主要消费平台。">
            {hasPlatformData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={platformBreakdown.slice(0, 6)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [formatShoppingAmount(Number(value ?? 0), currencyMode, usdtRate), '累计金额']}
                    />
                    <Bar dataKey="amount" radius={[0, 8, 8, 0]}>
                      {platformBreakdown.slice(0, 6).map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无平台排行" description="平台排行会在形成多条购物记录后自动出现。" />
            )}
          </ChartCard>

          <ChartCard title="账本消费摘要" description="按当前用户聚合全部账本，帮助你判断哪个阶段的购物支出更集中。">
            {hasLedgerData ? (
              <div className="shopping-ledger-summary-list">
                {ledgerSummary.map((item) => (
                  <article key={item.ledgerId} className="shopping-ledger-summary-item">
                    <div className="shopping-ledger-summary-head">
                      <strong>{item.ledgerName}</strong>
                      {item.isActive ? <Tag tone="green">当前活跃</Tag> : null}
                    </div>
                    <span className="subtle-text">
                      {item.startDate}
                      {item.endDate ? ` - ${item.endDate}` : ' - 进行中'}
                    </span>
                    <div className="shopping-ledger-summary-metrics">
                      <span>{formatShoppingAmount(item.amount, currencyMode, usdtRate)}</span>
                      <span>{item.count} 笔订单</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无账本沉淀" description="当前用户还没有形成可用于账本摘要的消费记录。" />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
