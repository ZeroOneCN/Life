import { useEffect, useMemo, useState } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { SectionCard } from '../page';
import { Btn, Pagination, Tag } from '../ui';
import { TODO_LOG_PAGE_SIZE } from '../../services/todo';
import { useNotificationCenterState } from '../../services/notificationCenter';

interface TodoLogsSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function TodoLogsSection({ showToast }: TodoLogsSectionProps) {
  const notificationState = useNotificationCenterState();
  const [page, setPage] = useState(1);

  const logs = useMemo(
    () => notificationState.logs.filter((log) => log.sceneId === 'todo.reminder'),
    [notificationState.logs],
  );

  const totalPages = Math.max(1, Math.ceil(logs.length / TODO_LOG_PAGE_SIZE));
  const pageLogs = useMemo(() => {
    const startIndex = (page - 1) * TODO_LOG_PAGE_SIZE;
    return logs.slice(startIndex, startIndex + TODO_LOG_PAGE_SIZE);
  }, [logs, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <SectionCard
      title="通知日志"
      description="这里聚合展示待办提醒场景写入通知中心的记录，说明列收敛为更紧凑的摘要，方便快速扫读。"
      action={<Btn tone="secondary" onClick={() => showToast('通知日志已刷新。')}>刷新</Btn>}
    >
      <div className="page-stack">
        <div className="todo-list-meta">
          <div>
            <strong>日志摘要</strong>
            <span>当前共有 {logs.length} 条待办提醒日志，本页显示 {pageLogs.length} 条。</span>
          </div>
          <div className="todo-filter-meta">
            <Tag tone="blue">场景 todo.reminder</Tag>
            <Tag>第 {page} / {totalPages} 页</Tag>
          </div>
        </div>

        <NotificationLogTable logs={pageLogs} />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </SectionCard>
  );
}
