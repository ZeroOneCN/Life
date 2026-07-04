import dayjs from 'dayjs';

import { EmptyState, SectionCard } from '../../page';
import { Btn, FilterBar, FilterTag, Tag } from '../../ui';
import { EditIcon, DeleteIcon } from '../../ui';
import type { VitalRecord, VitalMetricInfo, VitalMetricKey } from '../../../types/vital';

interface VitalRecordsSectionProps {
  records: VitalRecord[];
  total: number;
  loading: boolean;
  metrics: VitalMetricInfo[];
  filterMetric: string;
  page: number;
  pageSize: number;
  onFilterChange: (metric: VitalMetricKey | 'all') => void;
  onPageChange: (page: number) => void;
  onEdit: (record: VitalRecord) => void;
  onDelete: (record: VitalRecord) => void;
}

const STATUS_TAGS: Record<string, { tone: string; text: string }> = {
  normal: { tone: 'green', text: '正常' },
  abnormal: { tone: 'red', text: '异常' },
  attention: { tone: 'orange', text: '关注' },
  unknown: { tone: 'default', text: '未评估' },
};

/**
 * 体征记录列表 Section：展示历史体征记录，支持按指标筛选和分页。
 * @param records - 记录列表
 * @param total - 总数
 * @param loading - 是否加载中
 * @param metrics - 可选指标列表
 * @param filterMetric - 当前筛选指标
 * @param page - 当前页
 * @param pageSize - 每页数量
 * @param onFilterChange - 筛选回调
 * @param onPageChange - 翻页回调
 * @param onEdit - 编辑回调
 * @param onDelete - 删除回调
 */
export function VitalRecordsSection({
  records,
  total,
  loading,
  metrics,
  filterMetric,
  page,
  pageSize,
  onFilterChange,
  onPageChange,
  onEdit,
  onDelete,
}: VitalRecordsSectionProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <SectionCard
      title="体征记录"
      description={`共 ${total} 条记录`}
    >
      <FilterBar>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <FilterTag
            label="全部指标"
            active={filterMetric === 'all'}
            onClick={() => onFilterChange('all')}
          />
          {metrics.map((m) => (
            <FilterTag
              key={m.key}
              label={m.label}
              active={filterMetric === m.key}
              onClick={() => onFilterChange(m.key as VitalMetricKey | 'all')}
            />
          ))}
        </div>
      </FilterBar>
      {loading ? (
        <div className="skeleton-block" />
      ) : records.length === 0 ? (
        <EmptyState title="暂无体征记录" description="录入第一条体征记录，开始追踪你的健康数据。" />
      ) : (
        <>
          <div className="vital-records-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>记录时间</th>
                  <th>指标</th>
                  <th>数值</th>
                  <th>参考范围</th>
                  <th>状态</th>
                  <th>备注</th>
                  <th style={{ width: 80, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const statusTag = STATUS_TAGS[record.status] ?? STATUS_TAGS.unknown;
                  return (
                    <tr key={record.id}>
                      <td>{dayjs(record.recordTime).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{record.metricLabel}</td>
                      <td>
                        <strong>{record.value}</strong> {record.unit}
                      </td>
                      <td className="muted">{record.referenceRange}</td>
                      <td>
                        <Tag tone={statusTag.tone as 'green' | 'red' | 'orange' | 'default'} size="sm">
                          {statusTag.text}
                        </Tag>
                      </td>
                      <td className="muted">{record.notes || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => onEdit(record)}
                            title="编辑"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => onDelete(record)}
                            title="删除"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <Btn type="button" tone="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                上一页
              </Btn>
              <span className="muted">
                第 {page} / {totalPages} 页
              </span>
              <Btn type="button" tone="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                下一页
              </Btn>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
