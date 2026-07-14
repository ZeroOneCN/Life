import { EmptyState, SectionCard } from '../../page';
import type { SleepRecord } from '../../../types/sleep';

interface SleepRecordsSectionProps {
  records: SleepRecord[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (record: SleepRecord) => void;
  onDelete: (record: SleepRecord) => void;
}

/**
 * 格式化分钟为 "Xh Ym"。
 * @param minutes - 分钟数
 * @returns 格式化字符串
 */
function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h}h ${m}m`;
}

/**
 * 睡眠记录列表 Section：展示历史睡眠记录，支持分页、编辑、删除。
 * @param records - 记录列表
 * @param total - 总记录数
 * @param loading - 是否加载中
 * @param page - 当前页
 * @param pageSize - 每页条数
 * @param onPageChange - 翻页回调
 * @param onEdit - 编辑回调
 * @param onDelete - 删除回调
 */
export function SleepRecordsSection({
  records,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
}: SleepRecordsSectionProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SectionCard
      title="睡眠记录"
      description={`共 ${total} 条记录`}
    >
      {loading ? (
        <div className="skeleton-block" />
      ) : records.length === 0 ? (
        <EmptyState title="暂无睡眠记录" description="录入第一条睡眠记录吧。" />
      ) : (
        <>
          <div className="sleep-records-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>类型</th>
                  <th>就寝</th>
                  <th>起床</th>
                  <th>时长</th>
                  <th>质量</th>
                  <th>备注</th>
                  <th style={{ width: 80, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>
                      <span className={record.isNap ? '' : ''}>
                        {record.isNap ? '午睡' : '夜间'}
                      </span>
                    </td>
                    <td>{record.bedtime.slice(11)}</td>
                    <td>{record.wakeTime.slice(11)}</td>
                    <td>{formatDuration(record.durationMinutes)}</td>
                    <td>
                      {record.qualityScore !== null
                        ? '⭐'.repeat(record.qualityScore)
                        : <span className="muted">-</span>}
                    </td>
                    <td>
                      <span className="muted" style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {record.notes || '-'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => onEdit(record)}
                          title="编辑"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => onDelete(record)}
                          title="删除"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                上一页
              </button>
              <span className="muted">
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
