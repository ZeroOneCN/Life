import { useEffect, useState } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { SectionCard } from '../page';
import { Btn, Pagination, Tag } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { todoApi } from '../../services/todoApi';
import type { NotificationLogEntry } from '../../types/notifications';

interface TodoLogsSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  refreshToken?: number;
}

const PAGE_SIZE = 8;

export function TodoLogsSection({ showToast, refreshToken = 0 }: TodoLogsSectionProps) {
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);

  const loadLogs = async () => {
    try {
      const result = await todoApi.getLogs(page, PAGE_SIZE);
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
      description="这里直接读取后端 `/api/life/todo/logs`，不再依赖本地通知状态。"
      action={<Btn tone="secondary" onClick={() => void loadLogs()}>刷新</Btn>}
    >
      <div className="page-stack">
        <div className="todo-list-meta">
          <div>
            <strong>日志摘要</strong>
            <span>当前共有 {total} 条待办提醒日志，本页显示 {logs.length} 条。</span>
          </div>
          <div className="todo-filter-meta">
            <Tag tone="blue">场景 todo.reminder</Tag>
            <Tag>第 {page} / {totalPages} 页</Tag>
          </div>
        </div>

        <NotificationLogTable logs={logs} />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </SectionCard>
  );
}
