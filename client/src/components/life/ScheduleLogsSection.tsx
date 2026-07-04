import { useEffect, useState } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { SectionCard } from '../page';
import { Btn, Pagination, Tag } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { scheduleApi } from '../../services/scheduleApi';
import type { NotificationLogEntry } from '../../types/notifications';

interface ScheduleLogsSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  refreshToken?: number;
}

const PAGE_SIZE = 8;

/**
 * 日程通知日志组件：直接读取后端 `/api/life/schedule/logs`。
 */
export function ScheduleLogsSection({ showToast, refreshToken = 0 }: ScheduleLogsSectionProps) {
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);

  /**
   * 加载通知日志。
   */
  const loadLogs = async () => {
    try {
      const result = await scheduleApi.getLogs(page, PAGE_SIZE);
      setLogs(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '通知日志加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [page, refreshToken]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SectionCard
      title="通知日志"
      description="这里直接读取后端 `/api/life/schedule/logs`，不再依赖本地通知状态。"
      action={<Btn tone="secondary" onClick={() => void loadLogs()}>刷新</Btn>}
    >
      <div className="page-stack">
        <div className="schedule-list-meta">
          <div>
            <strong>日志摘要</strong>
            <span>当前共有 {total} 条日程提醒日志，本页显示 {logs.length} 条。</span>
          </div>
          <div className="schedule-filter-meta">
            <Tag tone="blue">场景 schedule.reminder</Tag>
            <Tag>第 {page} / {totalPages} 页</Tag>
          </div>
        </div>

        <NotificationLogTable logs={logs} />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </SectionCard>
  );
}
