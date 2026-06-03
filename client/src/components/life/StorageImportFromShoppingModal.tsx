import { useEffect, useMemo, useState } from 'react';

import { Btn, DataTable, Field, Modal } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { shoppingApi } from '../../services/shoppingApi';
import { storageApi } from '../../services/storageApi';
import type { ShoppingRecord } from '../../types/shopping';
import type { StorageItemRecord } from '../../types/storage';

interface StorageImportFromShoppingModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  existingItems: StorageItemRecord[];
}

const PAGE_SIZE = 20;

export function StorageImportFromShoppingModal({
  open,
  onClose,
  onImported,
  showToast,
  existingItems,
}: StorageImportFromShoppingModalProps) {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<ShoppingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [hiddenImportedCount, setHiddenImportedCount] = useState(0);

  const importedShoppingRecordIds = useMemo(() => {
    return new Set(
      existingItems
        .filter((item) => item.source === 'shopping' && item.shoppingRecordId)
        .map((item) => item.shoppingRecordId),
    );
  }, [existingItems]);

  const loadRecords = async () => {
    try {
      const result = await shoppingApi.listRecords({
        page,
        page_size: PAGE_SIZE,
        keyword: keyword || undefined,
      });

      const availableRecords = result.items.filter((record) => !importedShoppingRecordIds.has(record.id));
      const importedRecordsCount = result.items.length - availableRecords.length;

      setRecords(result.items);
      setTotal(result.total);
      setHiddenImportedCount(importedRecordsCount);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '购物记录加载失败。'), 'error');
    }
  };

  useEffect(() => {
    if (open) {
      void loadRecords();
    }
  }, [open, page, keyword]);

  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [open, keyword]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const availableIds = records
      .filter((record) => !importedShoppingRecordIds.has(record.id))
      .map((record) => record.id);

    if (availableIds.length === 0) {
      return;
    }

    setSelectedIds((prev) => {
      const allSelected = availableIds.every((id) => prev.has(id));
      const next = new Set(prev);

      if (allSelected) {
        availableIds.forEach((id) => next.delete(id));
      } else {
        availableIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      showToast('请先选择要导入的购物记录。', 'error');
      return;
    }

    setImporting(true);
    const idsToImport = Array.from(selectedIds);

    try {
      const result = await storageApi.importFromShopping(idsToImport);

      if (result.importedCount > 0) {
        showToast(`✅ 成功导入 ${result.importedCount} 条记录${result.duplicateCount > 0 ? `，${result.duplicateCount} 条重复已跳过` : ''}`);
        onImported();
        onClose();
        setSelectedIds(new Set());
      } else {
        showToast('所选记录已全部导入过。', 'error');
      }
    } catch (error) {
      showToast(buildApiErrorMessage(error, '导入失败。'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedCount = selectedIds.size;
  const availableRecords = records.filter((r) => !importedShoppingRecordIds.has(r.id));
  const importedInPage = records.filter((r) => importedShoppingRecordIds.has(r.id)).length;
  const totalAmount = availableRecords.reduce((sum, r) => sum + r.price, 0);
  const selectedAmount = availableRecords
    .filter((r) => selectedIds.has(r.id))
    .reduce((sum, r) => sum + r.price, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={null}
      width={1100}
      footer={null}
    >
      <div className="shopping-import-modal">
        {/* Header */}
        <div className="shopping-import-header">
          <div className="shopping-import-header-left">
            <div className="shopping-import-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M9 2L6 6H3L5 22H19L21 6H18L15 2H9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 11V16M12 18H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h3 className="shopping-import-title">从购物记录导入</h3>
              <p className="shopping-import-subtitle">选择购物记录将其作为物品添加到存储管理，自动计算日均成本</p>
            </div>
          </div>

          <div className="shopping-import-stats">
            <div className="shopping-import-stat">
              <span className="shopping-import-stat-value">{availableRecords.length}</span>
              <span className="shopping-import-stat-label">可导入</span>
            </div>
            <div className="shopping-import-stat-divider" />
            <div className="shopping-import-stat">
              <span className="shopping-import-stat-value shopping-import-stat-success">{selectedCount}</span>
              <span className="shopping-import-stat-label">已选</span>
            </div>
            <div className="shopping-import-stat-divider" />
            <div className="shopping-import-stat">
              <span className="shopping-import-stat-value">¥{selectedAmount.toFixed(2)}</span>
              <span className="shopping-import-stat-label">选中金额</span>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="shopping-import-toolbar">
          <div className="shopping-import-search-wrapper">
            <svg className="shopping-import-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M20 20L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <Field
              className="shopping-import-search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索商品名称、平台、订单号..."
            />
          </div>

          <div className="shopping-import-actions">
            <Btn
              tone="ghost"
              onClick={handleSelectAll}
              disabled={availableRecords.length === 0}
              className="shopping-import-select-all-btn"
            >
              {records.filter((r) => !importedShoppingRecordIds.has(r.id)).every((r) => selectedIds.has(r.id))
                ? '取消全选'
                : '全选本页'}
            </Btn>
            <Btn
              tone="primary"
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
              className="shopping-import-confirm-btn"
            >
              {importing ? (
                <>
                  <span className="shopping-import-spinner" /> 导入中...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4V12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  确认导入 ({selectedCount})
                </>
              )}
            </Btn>
          </div>
        </div>

        {/* Hidden Records Notice */}
        {hiddenImportedCount > 0 && (
          <div className="shopping-import-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>已自动隐藏 {hiddenImportedCount} 条已导入的记录（避免重复）</span>
          </div>
        )}

        {/* Table */}
        <div className="shopping-import-table-wrapper">
          {(() => {
            const availableRecords = records.filter((record) => !importedShoppingRecordIds.has(record.id));
            const importedInPage = records.filter((record) => importedShoppingRecordIds.has(record.id));

            return availableRecords.length > 0 ? (
              <DataTable
                columns={[
                  {
                    key: 'select',
                    title: '',
                    width: 52,
                    render: (_, row) => (
                      <label className={`shopping-import-checkbox ${selectedIds.has(row.id) ? 'is-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                        />
                        <span className="shopping-import-checkbox-visual" />
                      </label>
                    ),
                  },
                  {
                    key: 'itemName',
                    title: '商品信息',
                    dataIndex: 'itemName',
                    width: 240,
                    render: (_, row) => (
                      <div className="shopping-import-item-info">
                        <strong>{row.itemName}</strong>
                        {row.spec && <span className="shopping-import-spec">{row.spec}</span>}
                      </div>
                    ),
                  },
                  {
                    key: 'platform',
                    title: '平台',
                    dataIndex: 'platform',
                    width: 100,
                    render: (_, row) => (
                      <span className="shopping-import-platform-tag">{row.platform}</span>
                    ),
                  },
                  {
                    key: 'price',
                    title: '金额',
                    width: 120,
                    render: (_, row) => (
                      <span className="shopping-import-price">¥{row.price.toFixed(2)}</span>
                    ),
                  },
                  { key: 'date', title: '购买日期', dataIndex: 'date', width: 120 },
                  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', width: 150 },
                ]}
                data={availableRecords}
                rowKey="id"
                className="shopping-import-table"
              />
            ) : (
              <div className="shopping-import-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M9 2L6 6H3L5 22H19L21 6H18L15 2H9Z" stroke="currentColor" strokeWidth="1.2" opacity="0.3"/>
                  <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.2" opacity="0.3"/>
                </svg>
                <p>{keyword
                  ? '没有找到可导入的购物记录'
                  : importedInPage.length > 0
                    ? `本页 ${importedInPage.length} 条记录已全部导入`
                    : '暂无购物记录'
                }</p>
              </div>
            );
          })()}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shopping-import-pagination">
              <button
                className="shopping-import-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                上一页
              </button>
              <span className="shopping-import-page-info">
                第 <strong>{page}</strong> / {totalPages} 页
              </span>
              <button
                className="shopping-import-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Footer Info */}
          <div className="shopping-import-footer">
            <div className="shopping-import-footer-info">
              <span>本页共 {records.filter((r) => !importedShoppingRecordIds.has(r.id)).length} 条可导入</span>
              {(() => {
                const importedInPage = records.filter((r) => importedShoppingRecordIds.has(r.id)).length;
                return importedInPage > 0 ? (
                  <>
                    <span className="shopping-import-footer-dot">•</span>
                    <span>已隐藏 {importedInPage} 条已导入</span>
                  </>
                ) : null;
              })()}
              <span className="shopping-import-footer-dot">•</span>
              <span>总金额 ¥{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
