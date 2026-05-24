import { useEffect, useMemo, useState } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { SectionCard } from '../page';
import { Btn, Pagination } from '../ui';
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
      description="这里聚合展示待办场景产生的提醒记录，完整日志和渠道测试仍可前往通知中心查看。"
      action={<Btn tone="secondary" onClick={() => showToast('通知日志已刷新。')}>刷新</Btn>}
    >
      <div className="page-stack">
        <NotificationLogTable logs={pageLogs} />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </SectionCard>
  );
}
