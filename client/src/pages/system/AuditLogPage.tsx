import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, DatePicker, Select } from '@arco-design/web-react';

import { PageHeader, SectionCard } from '../../components/page';
import { Btn, DataTable, Pagination, SearchInput, Tag, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { buildApiErrorMessage } from '../../lib/api';
import {
  actionColors,
  actionLabels,
  getAuditLogActions,
  getAuditLogEntityTypes,
  getAuditLogs,
  type AuditLogEntry,
} from '../../services/auditLog';
import dayjs from 'dayjs';

/**
 * 操作日志审计页面。
 * 提供操作日志的分页查询、筛选（操作类型/实体类型/关键字/日期范围）、详情查看。
 */
export default function AuditLogPage() {
  useBreadcrumbTail('操作日志');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityTypeOptions, setEntityTypeOptions] = useState<string[]>([]);
  const [detailModalLog, setDetailModalLog] = useState<AuditLogEntry | null>(null);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  /** 导出当前筛选结果为 CSV */
  const handleExport = useCallback(() => {
    if (logs.length === 0) {
      showToastRef.current('暂无数据可导出。', 'warning');
      return;
    }
    const headers = ['操作时间', '操作类型', '操作模块', '操作描述', '操作人', 'IP 地址'];
    const rows = logs.map((log) => [
      dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss'),
      actionLabels[log.action] ?? log.action,
      log.entity_type,
      `"${(log.description ?? '').replace(/"/g, '""')}"`,
      log.username,
      log.ip_address ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `操作日志_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToastRef.current('已导出 CSV 文件。', 'success');
  }, [logs]);

  /** 设置快捷日期范围 */
  const setQuickDate = useCallback((preset: 'today' | 'week' | 'month') => {
    const now = dayjs();
    switch (preset) {
      case 'today':
        setStartDate(now.format('YYYY-MM-DD'));
        setEndDate(now.format('YYYY-MM-DD'));
        break;
      case 'week':
        setStartDate(now.startOf('week').format('YYYY-MM-DD'));
        setEndDate(now.format('YYYY-MM-DD'));
        break;
      case 'month':
        setStartDate(now.startOf('month').format('YYYY-MM-DD'));
        setEndDate(now.format('YYYY-MM-DD'));
        break;
    }
  }, []);

  const fetchLogs = async (currentPage: number) => {
    setLoading(true);
    try {
      const result = await getAuditLogs({
        page: currentPage,
        page_size: pageSize,
        action: actionFilter || undefined,
        entity_type: entityTypeFilter || undefined,
        keyword: keyword || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setLogs(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      showToastRef.current(buildApiErrorMessage(error, '操作日志加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 初始化：加载筛选选项
  useEffect(() => {
    void Promise.all([
      getAuditLogActions().catch(() => [] as string[]),
      getAuditLogEntityTypes().catch(() => [] as string[]),
    ]).then(([actions, entityTypes]) => {
      setActionOptions(actions);
      setEntityTypeOptions(entityTypes);
    });
  }, []);

  // 筛选条件变化时重新查询
  useEffect(() => {
    setPage(1);
    void fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityTypeFilter, keyword, startDate, endDate]);

  // 页码变化时重新查询
  useEffect(() => {
    void fetchLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const columns = useMemo(() => [
    {
      key: 'created_at' as const,
      title: '操作时间',
      width: 160,
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      key: 'action' as const,
      title: '操作类型',
      width: 100,
      render: (value: string) => (
        <Tag tone={actionColors[value] ?? 'default'}>{actionLabels[value] ?? value}</Tag>
      ),
    },
    {
      key: 'entity_type' as const,
      title: '操作模块',
      width: 120,
    },
    {
      key: 'description' as const,
      title: '操作描述',
      render: (_: unknown, row: AuditLogEntry) => (
        <span
          title={row.description}
          style={{ cursor: 'pointer', color: 'var(--color-text-2)' }}
          onClick={() => setDetailModalLog(row)}
        >
          {row.description}
        </span>
      ),
    },
    { key: 'username' as const, title: '操作人', width: 100 },
    { key: 'ip_address' as const, title: 'IP 地址', width: 140 },
  ] as const, []);

  return (
    <div className="page-stack">
      <PageHeader
        title="操作日志"
        subtitle="审计追溯所有用户操作记录"
      />

      <SectionCard
        title="日志列表"
        description={`共 ${total} 条操作记录`}
      >
        <div className="audit-log-filters" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div style={{ width: 220 }}>
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索描述或操作人..."
            />
          </div>
          <Select
            placeholder="操作类型"
            value={actionFilter || undefined}
            onChange={(val) => setActionFilter(val as string ?? '')}
            allowClear
            style={{ width: 140 }}
          >
            {actionOptions.map((act) => (
              <Select.Option key={act} value={act}>
                {actionLabels[act] ?? act}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="操作模块"
            value={entityTypeFilter || undefined}
            onChange={(val) => setEntityTypeFilter(val as string ?? '')}
            allowClear
            style={{ width: 160 }}
          >
            {entityTypeOptions.map((et) => (
              <Select.Option key={et} value={et}>
                {et}
              </Select.Option>
            ))}
          </Select>
          <DatePicker
            placeholder="开始日期"
            value={startDate || undefined}
            onChange={(_, dateStr) => setStartDate(typeof dateStr === 'string' ? dateStr : '')}
            style={{ width: 140 }}
          />
          <DatePicker
            placeholder="结束日期"
            value={endDate || undefined}
            onChange={(_, dateStr) => setEndDate(typeof dateStr === 'string' ? dateStr : '')}
            style={{ width: 140 }}
          />
          <Button size="mini" onClick={() => setQuickDate('today')}>今天</Button>
          <Button size="mini" onClick={() => setQuickDate('week')}>本周</Button>
          <Button size="mini" onClick={() => setQuickDate('month')}>本月</Button>
          <div style={{ flex: 1 }} />
          <Btn tone="primary" onClick={handleExport} loading={loading}>
            导出 CSV
          </Btn>
        </div>

        <DataTable
          columns={columns as any}
          data={logs}
          rowKey="id"
          emptyText="暂无操作日志"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(next) => setPage(next)}
          />
        </div>
      </SectionCard>

      {/* 日志详情 Modal */}
      {detailModalLog && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setDetailModalLog(null)}
        >
          <div
            className="modal-panel"
            style={{ background: 'var(--color-bg-2)', borderRadius: 8, padding: 24, maxWidth: 640, width: '90%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>操作日志详情</h3>
              <button
                type="button"
                onClick={() => setDetailModalLog(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-text-3)' }}
              >
                ✕
              </button>
            </div>
            <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 16px' }}>
              <span style={{ color: 'var(--color-text-3)' }}>操作时间</span>
              <span>{dayjs(detailModalLog.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
              <span style={{ color: 'var(--color-text-3)' }}>操作类型</span>
              <span><Tag tone={actionColors[detailModalLog.action] ?? 'default'}>{actionLabels[detailModalLog.action] ?? detailModalLog.action}</Tag></span>
              <span style={{ color: 'var(--color-text-3)' }}>操作模块</span>
              <span>{detailModalLog.entity_type}</span>
              <span style={{ color: 'var(--color-text-3)' }}>操作描述</span>
              <span>{detailModalLog.description}</span>
              <span style={{ color: 'var(--color-text-3)' }}>操作人</span>
              <span>{detailModalLog.username}</span>
              <span style={{ color: 'var(--color-text-3)' }}>IP 地址</span>
              <span>{detailModalLog.ip_address ?? '-'}</span>
              <span style={{ color: 'var(--color-text-3)' }}>关联 ID</span>
              <span>{detailModalLog.entity_id ?? '-'}</span>
            </div>
            {detailModalLog.detail_json && Object.keys(detailModalLog.detail_json).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 8 }}>操作详情</div>
                <pre style={{
                  background: 'var(--color-fill-2)',
                  borderRadius: 4,
                  padding: 12,
                  fontSize: 12,
                  maxHeight: 300,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                }}>
                  {JSON.stringify(detailModalLog.detail_json, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}