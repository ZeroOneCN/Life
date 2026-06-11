import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TravelBooksSection } from '../../components/finance/TravelBooksSection';
import { TravelDetailsSection } from '../../components/finance/TravelDetailsSection';
import { TravelLeaderboardSection } from '../../components/finance/TravelLeaderboardSection';
import { TravelReportSection } from '../../components/finance/TravelReportSection';
import { TravelStatsSection } from '../../components/finance/TravelStatsSection';
import { CurrencyConverter } from '../../components/finance/CurrencyConverter';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, SelectField, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { formatTravelAmount, TRAVEL_ALL_BOOKS } from '../../services/travel';
import { travelApi } from '../../services/travelApi';
import type {
  TravelBook,
  TravelExpenseRecord,
  TravelPageState,
  TravelPayChannel,
  TravelSummaryStats,
  TravelTab,
} from '../../types/travel';

const TAB_OPTIONS: Array<{ value: TravelTab; label: string }> = [
  { value: 'books', label: '行程账本' },
  { value: 'details', label: '行程明细' },
  { value: 'stats', label: '统计看板' },
  { value: 'leaderboard', label: '排行概览' },
  { value: 'report', label: '报告导出' },
];

const EMPTY_SETTINGS: TravelPageState['settings'] = {
  activeBookId: '',
  detailsBookId: TRAVEL_ALL_BOOKS,
  statsBookId: '',
  reportBookId: '',
  reportColumns: [],
};

const EMPTY_SUMMARY: TravelSummaryStats = {
  totalCount: 0,
  totalAmount: 0,
  totalSaved: 0,
  totalPaidAmount: 0,
  topCategoryName: '暂无',
  topPayChannelName: '暂无',
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

function hydrateSettings(
  incoming: Partial<TravelPageState['settings']> | null | undefined,
  books: TravelBook[],
): TravelPageState['settings'] {
  const normalized = {
    ...EMPTY_SETTINGS,
    ...incoming,
  };
  const firstBookId = books[0]?.id ?? '';
  const hasBook = (value: string) => books.some((item) => item.id === value);
  const hasBookOrAll = (value: string) => value === TRAVEL_ALL_BOOKS || hasBook(value);
  const activeBookId = hasBook(normalized.activeBookId) ? normalized.activeBookId : firstBookId;

  return {
    ...normalized,
    activeBookId,
    detailsBookId: hasBookOrAll(normalized.detailsBookId) ? normalized.detailsBookId : (activeBookId || TRAVEL_ALL_BOOKS),
    statsBookId: hasBook(normalized.statsBookId) ? normalized.statsBookId : activeBookId,
    reportBookId: hasBook(normalized.reportBookId) ? normalized.reportBookId : activeBookId,
  };
}

export default function TravelPage() {
  const [tab, setTab] = usePageTab<TravelTab>('books', TAB_OPTIONS.map((item) => item.value), 'travelTab');
  const [books, setBooks] = useState<TravelBook[]>([]);
  const [records, setRecords] = useState<TravelExpenseRecord[]>([]);
  const [payChannels, setPayChannels] = useState<TravelPayChannel[]>([]);
  const [settings, setSettings] = useState<TravelPageState['settings']>(EMPTY_SETTINGS);
  const [summary, setSummary] = useState<TravelSummaryStats>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const tempBookIdsRef = useRef(new Map<string, Promise<string>>());
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [booksResponse, recordsResponse, payChannelsResponse, settingsResponse] = await Promise.all([
      travelApi.listBooks(),
      travelApi.listRecords({ page: 1, page_size: 1000 }),
      travelApi.listPayChannels(),
      travelApi.getSettings(),
    ]);

    const nextBooks = booksResponse.items;
    const nextSettings = hydrateSettings(settingsResponse, nextBooks);
    const nextSummary = await travelApi.getSummary(
      nextSettings.activeBookId ? { bookId: nextSettings.activeBookId } : undefined,
    );

    setBooks(nextBooks);
    setRecords(recordsResponse.items);
    setPayChannels(payChannelsResponse.items);
    setSettings(nextSettings);
    setSummary(nextSummary);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
      } catch (error) {
        if (!cancelled) {
          showToastRef.current(buildApiErrorMessage(error, '旅行页面加载失败。'), 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reload]);

  const updateSettings = useCallback(async (patch: Partial<TravelPageState['settings']>) => {
    try {
      const next = await travelApi.updateSettings(patch);
      const normalized = hydrateSettings(next, books);
      setSettings(normalized);
      const nextSummary = await travelApi.getSummary(
        normalized.activeBookId ? { bookId: normalized.activeBookId } : undefined,
      );
      setSummary(nextSummary);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '旅行设置保存失败。'), 'error');
    }
  }, [books, showToast]);

  const resolveBookId = useCallback(async (bookId: string) => {
    if (!bookId) {
      return bookId;
    }

    if (books.some((item) => item.id === bookId)) {
      return bookId;
    }

    const pending = tempBookIdsRef.current.get(bookId);
    if (pending) {
      return pending;
    }

    return bookId;
  }, [books]);

  const handleBooksChange = useCallback(async (updater: (items: TravelBook[]) => TravelBook[]) => {
    const previous = books;
    const next = updater(previous);
    setBooks(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => {
          const request = travelApi.createBook({
            name: item.name,
            description: item.description,
            startDate: item.startDate,
            endDate: item.endDate,
            summary: item.summary,
            status: item.status,
            currency: item.currency,
            budget: item.budget ?? undefined,
          }).then((createdItem) => createdItem.id);
          tempBookIdsRef.current.set(item.id, request);
          return request;
        }),
        ...updated.map((item) => travelApi.updateBook(item.id, {
          name: item.name,
          description: item.description,
          startDate: item.startDate,
          endDate: item.endDate,
          summary: item.summary,
          status: item.status,
          currency: item.currency,
          budget: item.budget ?? undefined,
        })),
        ...deletedIds.map((id) => travelApi.deleteBook(id)),
      ]);

      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '行程账本保存失败。'), 'error');
      await reload();
    }
  }, [books, reload, showToast]);

  const handleRecordsChange = useCallback(async (updater: (items: TravelExpenseRecord[]) => TravelExpenseRecord[]) => {
    const previous = records;
    const next = updater(previous);
    setRecords(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map(async (item) => travelApi.createRecord({
          bookId: await resolveBookId(item.bookId),
          date: item.date,
          timeStart: item.timeStart,
          timeEnd: item.timeEnd,
          category: item.category,
          title: item.title,
          amount: item.amount,
          discountAmount: item.discountAmount,
          discountNote: item.discountNote,
          vehicleInfo: item.vehicleInfo,
          payChannel: item.payChannel,
          remark: item.remark,
        })),
        ...updated.map(async (item) => travelApi.updateRecord(item.id, {
          bookId: await resolveBookId(item.bookId),
          date: item.date,
          timeStart: item.timeStart,
          timeEnd: item.timeEnd,
          category: item.category,
          title: item.title,
          amount: item.amount,
          discountAmount: item.discountAmount,
          discountNote: item.discountNote,
          vehicleInfo: item.vehicleInfo,
          payChannel: item.payChannel,
          remark: item.remark,
        })),
        ...deletedIds.map((id) => travelApi.deleteRecord(id)),
      ]);

      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '旅行明细保存失败。'), 'error');
      await reload();
    }
  }, [records, reload, resolveBookId, showToast]);

  const handlePayChannelsChange = useCallback(async (updater: (items: TravelPayChannel[]) => TravelPayChannel[]) => {
    const previous = payChannels;
    const next = updater(previous);
    setPayChannels(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => travelApi.createPayChannel({
          value: item.value,
          label: item.label,
        })),
        ...updated.map((item) => travelApi.updatePayChannel(item.id, {
          value: item.value,
          label: item.label,
        })),
        ...deletedIds.map((id) => travelApi.deletePayChannel(id)),
      ]);

      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '支付渠道保存失败。'), 'error');
      await reload();
    }
  }, [payChannels, reload, showToast]);

  const activeBook = useMemo(
    () => books.find((book) => book.id === settings.activeBookId) ?? books[0] ?? null,
    [books, settings.activeBookId],
  );

  const handleActiveBookChange = (bookId: string) => {
    void updateSettings({
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
        subtitle={loading ? '正在加载旅行数据...' : '记录出行行程、消费明细和行程规划。'}
      />

      <SectionCard
        title="当前上下文"
        description="当前登录用户与活跃账本由后端设置统一驱动，页面不再从浏览器本地业务存储读取。"
      >
        <div className="travel-context-grid">
          <SelectField
            label="当前行程账本"
            value={activeBook?.id ?? ''}
            onChange={(event) => handleActiveBookChange(event.target.value)}
          >
            {books.map((book) => (
              <option key={book.id} value={book.id}>{book.name}</option>
            ))}
          </SelectField>
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前账本',
            value: activeBook?.name ?? '未选择账本',
            helper: activeBook ? `${activeBook.startDate}${activeBook.endDate ? ` - ${activeBook.endDate}` : ''}` : '先创建一个账本再录入明细',
          },
          {
            label: '实付总额',
            value: formatTravelAmount(summary.totalPaidAmount),
          },
          {
            label: '累计优惠',
            value: formatTravelAmount(summary.totalSaved),
          },
          {
            label: '记录数',
            value: `${summary.totalCount}`,
          },
          {
            label: '最大分类',
            value: summary.topCategoryName || '暂无',
            helper: summary.topPayChannelName ? `主要支付方式：${summary.topPayChannelName}` : undefined,
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="账本、明细、统计、排行与报告共用同一套远程数据，不再保留页面级本地业务状态。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as TravelTab)} />
      </SectionCard>

      {tab === 'books' ? (
        <TravelBooksSection
          activeBookId={activeBook?.id ?? ''}
          books={books}
          records={records}
          payChannels={payChannels}
          onActiveBookChange={handleActiveBookChange}
          onChangeBooks={(updater) => {
            void handleBooksChange(updater);
          }}
          onChangeRecords={(updater) => {
            void handleRecordsChange(updater);
          }}
          onChangePayChannels={(updater) => {
            void handlePayChannelsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'details' ? (
        <TravelDetailsSection
          activeBookId={activeBook?.id ?? ''}
          detailsBookId={settings.detailsBookId}
          books={books}
          records={records}
          payChannels={payChannels}
          onDetailsBookIdChange={(bookId) => {
            void updateSettings({ detailsBookId: bookId });
          }}
          onChangeBooks={(updater) => {
            void handleBooksChange(updater);
          }}
          onChangeRecords={(updater) => {
            void handleRecordsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'stats' ? (
        <TravelStatsSection
          statsBookId={settings.statsBookId}
          books={books}
          records={records}
          payChannels={payChannels}
          onStatsBookIdChange={(bookId) => {
            void updateSettings({ statsBookId: bookId });
          }}
          onChangePayChannels={(updater) => {
            void handlePayChannelsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'leaderboard' ? (
        <TravelLeaderboardSection
          books={books}
          records={records}
          onSelectBook={(bookId) => {
            handleActiveBookChange(bookId);
            setTab('details');
            showToast('已切换到对应账本，并打开行程明细。');
          }}
        />
      ) : null}

      {tab === 'report' ? (
        <TravelReportSection
          reportBookId={settings.reportBookId}
          reportColumns={settings.reportColumns}
          books={books}
          records={records}
          payChannels={payChannels}
          onReportBookIdChange={(bookId) => {
            void updateSettings({ reportBookId: bookId });
          }}
          onReportColumnsChange={(columns) => {
            void updateSettings({ reportColumns: columns });
          }}
          showToast={showToast}
        />
      ) : null}

      <CurrencyConverter defaultFrom="USD" defaultTo="CNY" defaultAmount={100} />

      <Toast toast={toast} />
    </div>
  );
}
