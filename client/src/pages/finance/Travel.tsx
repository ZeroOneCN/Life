import { useEffect, useMemo } from 'react';

import { TravelBooksSection } from '../../components/finance/TravelBooksSection';
import { TravelDetailsSection } from '../../components/finance/TravelDetailsSection';
import { TravelLeaderboardSection } from '../../components/finance/TravelLeaderboardSection';
import { TravelReportSection } from '../../components/finance/TravelReportSection';
import { TravelStatsSection } from '../../components/finance/TravelStatsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Field, PillTabs, SelectField, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildInitialTravelState,
  buildTravelSummary,
  filterTravelBooksByUserId,
  filterTravelRecords,
  formatTravelAmount,
  normalizeTravelPageState,
} from '../../services/travel';
import type { TravelPageState, TravelTab } from '../../types/travel';

const STORAGE_KEY = 'lifeos_finance_travel_page';

const TAB_OPTIONS: Array<{ value: TravelTab; label: string }> = [
  { value: 'books', label: '行程账本' },
  { value: 'details', label: '行程明细' },
  { value: 'stats', label: '统计看板' },
  { value: 'leaderboard', label: '排行榜' },
  { value: 'report', label: '报告导出' },
];

export default function TravelPage() {
  const [data, setData] = useLocalStorageState<TravelPageState>(STORAGE_KEY, buildInitialTravelState);
  const [tab, setTab] = usePageTab<TravelTab>('books', TAB_OPTIONS.map((item) => item.value), 'travelTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeTravelPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const activeBooks = useMemo(
    () => filterTravelBooksByUserId(normalizedData.books, normalizedData.settings.activeUserId),
    [normalizedData.books, normalizedData.settings.activeUserId],
  );
  const activeBook = useMemo(
    () => activeBooks.find((book) => book.id === normalizedData.settings.activeBookId) ?? activeBooks[0] ?? null,
    [activeBooks, normalizedData.settings.activeBookId],
  );
  const activeBookRecords = useMemo(
    () => filterTravelRecords(
      normalizedData.records,
      normalizedData.settings.activeUserId,
      activeBook?.id ?? normalizedData.settings.activeBookId,
    ),
    [normalizedData.records, normalizedData.settings.activeUserId, normalizedData.settings.activeBookId, activeBook],
  );
  const activeSummary = useMemo(
    () => buildTravelSummary(activeBookRecords, normalizedData.payChannels),
    [activeBookRecords, normalizedData.payChannels],
  );

  const updateSettings = (patch: Partial<TravelPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  const handleActiveUserChange = (value: string) => {
    const nextUserId = value;
    const firstBook = filterTravelBooksByUserId(normalizedData.books, nextUserId)[0];
    const nextBookId = firstBook?.id ?? '';

    updateSettings({
      activeUserId: nextUserId,
      activeBookId: nextBookId,
      detailsBookId: nextBookId,
      statsBookId: nextBookId,
      reportBookId: nextBookId,
      leaderboardUserId: nextUserId,
    });
  };

  const handleActiveBookChange = (bookId: string) => {
    updateSettings({
      activeBookId: bookId,
      detailsBookId: bookId,
      statsBookId: bookId,
      reportBookId: bookId,
    });
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="旅行游玩"
        subtitle="把旧原型里的账本、明细、统计、排行、报告和导入能力，统一收进当前 LifeOS 的本地前端体系里。"
      />

      <SectionCard
        title="当前上下文"
        description="这里决定当前旅行页面默认归属的用户和账本，新增消费、统计看板和报告导出都会围绕这组上下文联动。"
      >
        <div className="travel-context-grid">
          <Field
            label="当前用户 ID"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => handleActiveUserChange(event.target.value)}
            placeholder="例如：user-001"
          />
          <SelectField
            label="当前行程账本"
            value={activeBook?.id ?? ''}
            onChange={(event) => handleActiveBookChange(event.target.value)}
          >
            {activeBooks.map((book) => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </SelectField>
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizedData.settings.activeUserId || '未设置',
            helper: '新建账本和新增消费默认都写入这个用户维度',
          },
          {
            label: '当前账本',
            value: activeBook?.name ?? '未选择账本',
            helper: activeBook ? `${activeBook.startDate}${activeBook.endDate ? ` - ${activeBook.endDate}` : ''}` : '先创建一个行程账本',
          },
          {
            label: '实付总花费',
            value: formatTravelAmount(activeSummary.totalPaidAmount),
          },
          {
            label: '总节省',
            value: formatTravelAmount(activeSummary.totalSaved),
          },
          {
            label: '记录数',
            value: `${activeSummary.totalCount}`,
          },
          {
            label: '最大分类',
            value: activeSummary.topCategoryName,
            helper: activeSummary.topPayChannelName ? `最大支付方式：${activeSummary.topPayChannelName}` : undefined,
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="行程账本、行程明细、统计、排行榜和报告导出共用一套本地数据模型与主题组件。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as TravelTab)} />
      </SectionCard>

      {tab === 'books' ? (
        <TravelBooksSection
          activeUserId={normalizedData.settings.activeUserId}
          activeBookId={activeBook?.id ?? ''}
          books={normalizedData.books}
          records={normalizedData.records}
          payChannels={normalizedData.payChannels}
          onActiveBookChange={handleActiveBookChange}
          onChangeBooks={(updater) => {
            setData((previous) => ({
              ...previous,
              books: updater(previous.books),
            }));
          }}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          onChangePayChannels={(updater) => {
            setData((previous) => ({
              ...previous,
              payChannels: updater(previous.payChannels),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'details' ? (
        <TravelDetailsSection
          activeUserId={normalizedData.settings.activeUserId}
          activeBookId={activeBook?.id ?? ''}
          detailsBookId={normalizedData.settings.detailsBookId}
          books={normalizedData.books}
          records={normalizedData.records}
          payChannels={normalizedData.payChannels}
          onDetailsBookIdChange={(bookId) => updateSettings({ detailsBookId: bookId })}
          onChangeBooks={(updater) => {
            setData((previous) => ({
              ...previous,
              books: updater(previous.books),
            }));
          }}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'stats' ? (
        <TravelStatsSection
          activeUserId={normalizedData.settings.activeUserId}
          statsBookId={normalizedData.settings.statsBookId}
          books={normalizedData.books}
          records={normalizedData.records}
          payChannels={normalizedData.payChannels}
          onStatsBookIdChange={(bookId) => updateSettings({ statsBookId: bookId })}
          onChangePayChannels={(updater) => {
            setData((previous) => ({
              ...previous,
              payChannels: updater(previous.payChannels),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'leaderboard' ? (
        <TravelLeaderboardSection
          userId={normalizedData.settings.leaderboardUserId}
          books={normalizedData.books}
          records={normalizedData.records}
          onUserIdChange={(value) => updateSettings({ leaderboardUserId: value })}
          onSelectBook={(bookId) => {
            handleActiveBookChange(bookId);
            setTab('details');
            showToast('已切换到对应账本，并打开行程明细。');
          }}
        />
      ) : null}

      {tab === 'report' ? (
        <TravelReportSection
          activeUserId={normalizedData.settings.activeUserId}
          reportBookId={normalizedData.settings.reportBookId}
          reportColumns={normalizedData.settings.reportColumns}
          books={normalizedData.books}
          records={normalizedData.records}
          payChannels={normalizedData.payChannels}
          onReportBookIdChange={(bookId) => updateSettings({ reportBookId: bookId })}
          onReportColumnsChange={(columns) => updateSettings({ reportColumns: columns })}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
