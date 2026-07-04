import { useEffect, useState } from 'react';

import { Btn, DataTable, DeleteModal, Field, Pagination, SelectField, Tag } from '../ui';
import { EmptyState, SectionCard } from '../page';
import { buildApiErrorMessage } from '../../lib/api';
import { scheduleApi } from '../../services/scheduleApi';
import type { ScheduleEventRecord, ScheduleRecurrenceType } from '../../types/schedule';

interface ScheduleTrashSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

const PAGE_SIZE = 10;

const RECURRENCE_LABELS: Record<ScheduleRecurrenceType, string> = {
  none: '不重复',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
};

/**
 * 日程回收站组件：已删除事件可恢复、永久删除或清空。
 */
export function ScheduleTrashSection({
  showToast,
  onChanged,
}: ScheduleTrashSectionProps) {
  const [keyword, setKeyword] = useState('');
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | ScheduleRecurrenceType>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ScheduleEventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ScheduleEventRecord | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  /**
   * 加载回收站列表。
   */
  const loadTrash = async () => {
    try {
      const result = await scheduleApi.list({
        page,
        page_size: PAGE_SIZE,
        keyword,
        status: 'all',
        trashed: true,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '回收站加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadTrash();
  }, [page, keyword, recurrenceFilter]);

  useEffect(() => {
    setPage(1);
  }, [keyword, recurrenceFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SectionCard
      title="回收站"
      description="已删除的日程会先进入回收站，恢复、永久删除和清空都走后端。"
      action={<Btn tone="danger" onClick={() => setClearConfirmOpen(true)}>清空回收站</Btn>}
    >
      <div className="page-stack">
        <div className="schedule-trash-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题、地点"
          />
          <SelectField
            label="重复类型"
            value={recurrenceFilter}
            onChange={(event) => setRecurrenceFilter(event.target.value as typeof recurrenceFilter)}
          >
            <option value="all">全部</option>
            <option value="none">不重复</option>
            <option value="daily">每日</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </SelectField>
        </div>

        {items.length ? (
          <>
            <DataTable
              data={items}
              rowKey="id"
              columns={[
                {
                  key: 'title',
                  title: '事件标题',
                  render: (_, row) => (
                    <div className="schedule-table-title">
                      <span className={`schedule-color-dot color-${row.color || 'indigo'}`} />
                      <div>
                        <strong>{row.title}</strong>
                        {row.location ? <span className="schedule-table-sub">{row.location}</span> : null}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'recurrence',
                  title: '重复',
                  render: (_, row) => (
                    row.recurrenceType === 'none'
                      ? <span className="subtle-text">-</span>
                      : <Tag tone="blue">{RECURRENCE_LABELS[row.recurrenceType]}</Tag>
                  ),
                },
                {
                  key: 'trashedAt',
                  title: '删除时间',
                  render: (_, row) => row.trashedAt || '-',
                },
                {
                  key: 'actions',
                  title: '操作',
                  align: 'right',
                  render: (_, row) => (
                    <div className="table-actions">
                      <Btn
                        tone="secondary"
                        onClick={async () => {
                          try {
                            await scheduleApi.restore(row.id);
                            showToast('日程已恢复。');
                            onChanged();
                            await loadTrash();
                          } catch (error) {
                            showToast(buildApiErrorMessage(error, '恢复日程失败。'), 'error');
                          }
                        }}
                      >
                        恢复
                      </Btn>
                      <Btn tone="danger" onClick={() => setPendingDelete(row)}>永久删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="回收站为空" description="目前没有已删除日程，删除后的日程会先留在这里。" />
        )}
      </div>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          void (async () => {
            if (!pendingDelete) {
              return;
            }
            try {
              await scheduleApi.deletePermanently(pendingDelete.id);
              setPendingDelete(null);
              showToast('日程已永久删除。');
              onChanged();
              await loadTrash();
            } catch (error) {
              showToast(buildApiErrorMessage(error, '永久删除失败。'), 'error');
            }
          })();
        }}
        title={pendingDelete ? `永久删除：${pendingDelete.title}` : '永久删除日程'}
      >
        永久删除后无法恢复，请确认是否继续。
      </DeleteModal>

      <DeleteModal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          void (async () => {
            try {
              await scheduleApi.clearTrash();
              setClearConfirmOpen(false);
              showToast('回收站已清空。');
              onChanged();
              await loadTrash();
            } catch (error) {
              showToast(buildApiErrorMessage(error, '清空回收站失败。'), 'error');
            }
          })();
        }}
        title="清空回收站"
      >
        这会永久删除所有已进入回收站的日程，操作不可恢复。
      </DeleteModal>
    </SectionCard>
  );
}
