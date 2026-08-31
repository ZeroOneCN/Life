import { useEffect, useState } from 'react';

import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;
import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, Field, Pagination, Tag } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import {
  calculateStorageDailyCost,
  calculateStorageUsageDays,
  formatStorageMoney,
} from '../../services/storage';
import { storageApi } from '../../services/storageApi';
import type { StorageItemRecord } from '../../types/storage';

interface StorageArchiveSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

const PAGE_SIZE = 8;

export function StorageArchiveSection({ showToast, onChanged }: StorageArchiveSectionProps) {
  const [keyword, setKeyword] = useState('');
  const [purchaseStartDate, setPurchaseStartDate] = useState('');
  const [purchaseEndDate, setPurchaseEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StorageItemRecord[]>([]);
  const [total, setTotal] = useState(0);

  const loadArchive = async () => {
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: PAGE_SIZE,
        status: 'retired',
      };

      if (keyword) params.keyword = keyword;
      if (purchaseStartDate) params.purchaseStartDate = purchaseStartDate;
      if (purchaseEndDate) params.purchaseEndDate = purchaseEndDate;

      const result = await storageApi.list(params);
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '停用记录加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadArchive();
  }, [page, keyword, purchaseStartDate, purchaseEndDate]);

  useEffect(() => {
    setPage(1);
  }, [keyword, purchaseStartDate, purchaseEndDate]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = items.reduce(
    (result, item) => {
      result.totalPurchase += item.purchasePrice;
      result.totalDailyCost += calculateStorageDailyCost(item);
      return result;
    },
    {
      totalPurchase: 0,
      totalDailyCost: 0,
    },
  );

  return (
    <SectionCard
      title="停用记录"
      description="已结束使用的物品会在这里展示最终使用天数和最终日均成本，恢复和永久删除都走后端。"
    >
      <Row gutter={[12, 12]}>
        <Col span={6}>
          <div className="stat-card">
            <span className="stat-label">停用数量</span>
            <strong className="stat-value">{total} 条</strong>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card">
            <span className="stat-label">当前页购入金额</span>
            <strong className="stat-value">{formatStorageMoney(summary.totalPurchase)}</strong>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card">
            <span className="stat-label">当前页最终日均成本</span>
            <strong className="stat-value">{formatStorageMoney(summary.totalDailyCost)}</strong>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card">
            <span className="stat-label">停用状态</span>
            <strong className="stat-value">{total ? '已启用' : '暂无记录'}</strong>
          </div>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col span={8}>
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索物品名称或备注"
          />
        </Col>
        <Col span={8}>
          <DatePickerField
            label="购买开始"
            value={purchaseStartDate}
            onChange={setPurchaseStartDate}
            clearable
            popoverStrategy="floating"
          />
        </Col>
        <Col span={8}>
          <DatePickerField
            label="购买结束"
            value={purchaseEndDate}
            onChange={setPurchaseEndDate}
            clearable
            popoverStrategy="floating"
          />
        </Col>
      </Row>

      {items.length ? (
        <>
          <DataTable
            columns={[
              {
                key: 'itemName',
                title: '物品名称',
                dataIndex: 'itemName',
                width: 160,
                render: (_, row) => (
                  <div className="storage-item-name">
                    <strong>{row.itemName}</strong>
                    <span>{row.notes || '暂无备注'}</span>
                  </div>
                ),
              },
              { key: 'purchaseDate', title: '购买日期', dataIndex: 'purchaseDate', width: 116 },
              { key: 'endDate', title: '结束使用', dataIndex: 'endDate', width: 116 },
              {
                key: 'usageDays',
                title: '最终使用天数',
                width: 108,
                render: (_, row) => `${calculateStorageUsageDays(row)} 天`,
              },
              {
                key: 'dailyCost',
                title: '最终日均成本',
                width: 118,
                render: (_, row) => formatStorageMoney(calculateStorageDailyCost(row)),
              },
              {
                key: 'status',
                title: '状态',
                width: 92,
                render: () => <Tag tone="blue">已停用</Tag>,
              },
              {
                key: 'actions',
                title: '操作',
                width: 210,
                render: (_, row) => (
                  <div className="storage-table-actions">
                    <Btn
                      tone="secondary"
                      onClick={async () => {
                        try {
                          await storageApi.restore(row.id);
                          showToast('物品已恢复为使用中。');
                          onChanged();
                          await loadArchive();
                        } catch (error) {
                          showToast(buildApiErrorMessage(error, '恢复物品失败。'), 'error');
                        }
                      }}
                    >
                      恢复
                    </Btn>
                    <Btn
                      tone="danger"
                      onClick={async () => {
                        try {
                          await storageApi.delete(row.id);
                          showToast('停用物品已永久删除。');
                          onChanged();
                          await loadArchive();
                        } catch (error) {
                          showToast(buildApiErrorMessage(error, '永久删除失败。'), 'error');
                        }
                      }}
                    >
                      永久删除
                    </Btn>
                  </div>
                ),
              },
            ]}
            data={items}
            rowKey="id"
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          title="暂无停用物品"
          description="当某件物品结束使用后，把它停用到这里，就能固定最终持有天数和最终日均成本。"
          icon="📁"
        />
      )}
    </SectionCard>
  );
}
