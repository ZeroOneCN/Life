import { useMemo } from 'react';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, Field } from '../ui';
import {
  buildTravelLeaderboard,
  filterTravelBooksByUserId,
  formatTravelAmount,
} from '../../services/travel';
import type { TravelBook, TravelExpenseRecord } from '../../types/travel';

interface TravelLeaderboardSectionProps {
  userId: string;
  books: TravelBook[];
  records: TravelExpenseRecord[];
  onUserIdChange: (value: string) => void;
  onSelectBook: (bookId: string) => void;
}

export function TravelLeaderboardSection({
  userId,
  books,
  records,
  onUserIdChange,
  onSelectBook,
}: TravelLeaderboardSectionProps) {
  const rankedItems = useMemo(() => buildTravelLeaderboard(books, records, userId), [books, records, userId]);
  const scopedBookCount = useMemo(() => filterTravelBooksByUserId(books, userId).length, [books, userId]);
  const totals = useMemo(() => rankedItems.reduce((accumulator, item) => ({
    totalPaidAmount: accumulator.totalPaidAmount + item.totalPaidAmount,
    totalAmount: accumulator.totalAmount + item.totalAmount,
    totalSaved: accumulator.totalSaved + item.totalSaved,
    totalCount: accumulator.totalCount + item.totalCount,
  }), {
    totalPaidAmount: 0,
    totalAmount: 0,
    totalSaved: 0,
    totalCount: 0,
  }), [rankedItems]);

  const columns = useMemo(() => [
    {
      key: 'rank',
      title: '#',
      render: (_value: unknown, _row: (typeof rankedItems)[number], index: number) => index + 1,
    },
    { key: 'bookName', title: '行程账本', dataIndex: 'bookName' as const },
    {
      key: 'amount',
      title: '原价 / 实付 / 优惠',
      render: (_value: unknown, row: (typeof rankedItems)[number]) => (
        <div className="travel-amount-stack">
          <strong>{formatTravelAmount(row.totalPaidAmount)}</strong>
          <span>{formatTravelAmount(row.totalAmount)} / 优惠 {formatTravelAmount(row.totalSaved)}</span>
        </div>
      ),
    },
    {
      key: 'count',
      title: '记录数',
      render: (_value: unknown, row: (typeof rankedItems)[number]) => `${row.totalCount} 条`,
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: (typeof rankedItems)[number]) => (
        <Btn tone="primary" onClick={() => onSelectBook(row.bookId)}>切换到该账本</Btn>
      ),
    },
  ], [onSelectBook, rankedItems]);

  return (
    <SectionCard
      title="排行榜"
      description="按当前用户聚合全部行程账本的旅行支出表现，帮助识别哪次出行的花费更集中。"
    >
      <div className="page-stack">
        <Field
          label="排行用户 ID"
          value={userId}
          onChange={(event) => onUserIdChange(event.target.value)}
          placeholder="例如：user-001"
          hint="排行榜会按这个用户汇总全部行程账本。"
        />

        <StatGrid
          items={[
            { label: '账本数量', value: `${scopedBookCount}` },
            { label: '总记录数', value: `${totals.totalCount}` },
            { label: '总实付', value: formatTravelAmount(totals.totalPaidAmount) },
          ]}
        />

        {rankedItems.length ? (
          <DataTable rowKey="bookId" columns={columns} data={rankedItems} />
        ) : (
          <EmptyState
            title="暂无排行数据"
            description="先为这个用户创建行程账本并录入旅行消费，排行榜才会形成。"
          />
        )}
      </div>
    </SectionCard>
  );
}
