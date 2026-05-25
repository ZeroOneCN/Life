import { useEffect, useMemo, useState } from 'react';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, Field, Pagination, Tag } from '../ui';
import {
  STORAGE_ARCHIVE_PAGE_SIZE,
  calculateStorageDailyCost,
  calculateStorageUsageDays,
  deleteStorageItemPermanently,
  filterStorageItems,
  formatStorageMoney,
  restoreStorageItem,
} from '../../services/storage';
import type { StorageItemRecord, StoragePageSettings } from '../../types/storage';

interface StorageArchiveSectionProps {
  items: StorageItemRecord[];
  settings: StoragePageSettings;
  onChangeItems: (updater: (items: StorageItemRecord[]) => StorageItemRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function StorageArchiveSection({
  items,
  settings,
  onChangeItems,
  showToast,
}: StorageArchiveSectionProps) {
  const archivedItems = items.filter((item) => item.status === 'archived');
  const [keyword, setKeyword] = useState('');
  const [purchaseStartDate, setPurchaseStartDate] = useState('');
  const [purchaseEndDate, setPurchaseEndDate] = useState('');
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(
    () => filterStorageItems(archivedItems, {
      keyword,
      status: 'archived',
      purchaseStartDate,
      purchaseEndDate,
    }),
    [archivedItems, keyword, purchaseEndDate, purchaseStartDate],
  );

  useEffect(() => {
    setPage(1);
  }, [keyword, purchaseStartDate, purchaseEndDate]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / STORAGE_ARCHIVE_PAGE_SIZE));
  const pageItems = useMemo(() => {
    const startIndex = (page - 1) * STORAGE_ARCHIVE_PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + STORAGE_ARCHIVE_PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => filteredItems.reduce((result, item) => {
    result.totalPurchase += item.purchasePrice;
    result.totalDailyCost += calculateStorageDailyCost(item);
    return result;
  }, {
    totalPurchase: 0,
    totalDailyCost: 0,
  }), [filteredItems]);

  const columns = [
    {
      key: 'itemName',
      title: '物品名称',
      dataIndex: 'itemName' as const,
      width: 160,
      render: (_: unknown, row: StorageItemRecord) => (
        <div className="storage-item-name">
          <strong>{row.itemName}</strong>
          <span>{row.notes || '暂无备注'}</span>
        </div>
      ),
    },
    {
      key: 'purchaseDate',
      title: '购买日期',
      dataIndex: 'purchaseDate' as const,
      width: 116,
    },
    {
      key: 'endDate',
      title: '结束使用',
      dataIndex: 'endDate' as const,
      width: 116,
    },
    {
      key: 'usageDays',
      title: '最终使用天数',
      width: 108,
      render: (_: unknown, row: StorageItemRecord) => `${calculateStorageUsageDays(row)} 天`,
    },
    {
      key: 'dailyCost',
      title: '最终日均成本',
      width: 118,
      render: (_: unknown, row: StorageItemRecord) => formatStorageMoney(calculateStorageDailyCost(row)),
    },
    {
      key: 'status',
      title: '状态',
      width: 92,
      render: () => <Tag tone="blue">已归档</Tag>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 210,
      render: (_: unknown, row: StorageItemRecord) => (
        <div className="storage-table-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              onChangeItems((current) => restoreStorageItem(current, row.id, settings));
              showToast('物品已恢复为使用中。');
            }}
          >
            恢复
          </Btn>
          <Btn
            tone="danger"
            onClick={() => {
              onChangeItems((current) => deleteStorageItemPermanently(current, row.id, settings));
              showToast('归档物品已永久删除。');
            }}
          >
            永久删除
          </Btn>
        </div>
      ),
    },
  ];

  return (
    <SectionCard
      title="归档记录"
      description="结束使用的物品会在这里保留最终摊销结果，方便回看哪些投入已经完成了它们的生命周期。"
    >
      <div className="page-stack">
        <StatGrid
          className="storage-list-summary-grid"
          items={[
            { label: '归档数量', value: `${filteredItems.length} 条` },
            { label: '归档购入金额', value: formatStorageMoney(summary.totalPurchase) },
            { label: '最终日均成本合计', value: formatStorageMoney(summary.totalDailyCost) },
            { label: '归档状态', value: archivedItems.length ? '已启用' : '暂无记录' },
          ]}
        />

        <div className="storage-filter-grid storage-filter-grid-archive">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索物品名称或备注"
          />
          <DatePickerField label="购买开始" value={purchaseStartDate} onChange={setPurchaseStartDate} clearable popoverStrategy="floating" />
          <DatePickerField label="购买结束" value={purchaseEndDate} onChange={setPurchaseEndDate} clearable popoverStrategy="floating" />
        </div>

        {filteredItems.length ? (
          <>
            <DataTable columns={columns} data={pageItems} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无归档物品"
            description="当某件物品结束使用后，把它归档到这里，就能固定最终持有天数和最终日均成本。"
          />
        )}
      </div>
    </SectionCard>
  );
}
