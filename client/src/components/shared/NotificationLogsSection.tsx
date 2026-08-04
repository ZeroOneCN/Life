import { useEffect, useState } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { SectionCard } from '../page';
import { Btn, Pagination, Tag } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import type { NotificationLogEntry } from '../../types/notifications';

/**
 * 通用通知日志区段组件 Props。
 */
export interface NotificationLogsSectionProps {
  /** 区段标题，例如 "通知日志"。 */
  title: string;
  /** SectionCard 的描述文案。 */
  description: string;
  /** 场景可读标签，例如 "日程提醒" / "待办提醒"，用于摘要占位符替换。 */
  sceneLabel: string;
  /** 场景标识，例如 "schedule.reminder" / "todo.reminder"，用于场景 Tag 展示。 */
  sceneId: string;
  /** 摘要文案模板，支持 {total}、{label}、{count} 三个占位符替换。 */
  summaryText: string;
  /** 获取通知日志的函数，接收页码与每页条数，返回日志条目列表与总数。 */
  fetchLogs: (page: number, pageSize: number) => Promise<{
    items: NotificationLogEntry[];
    total: number;
  }>;
  /** Toast 提示回调，用于上报加载错误等信息。 */
  showToast: (message: string, type?: 'success' | 'error') => void;
  /** 刷新令牌，值变化时触发重新加载日志。 */
  refreshToken?: number;
}

/** 每页显示的日志条数。 */
const PAGE_SIZE = 8;

/**
 * 通用通知日志区段：封装分页加载、刷新、摘要展示与日志表格渲染，
 * 用于消除日程/待办通知日志区段之间的重复代码。
 *
 * @param props 组件属性，详见 NotificationLogsSectionProps。
 * @returns React 元素，渲染包含刷新按钮、日志摘要、场景 Tag、日志表格与分页的 SectionCard。
 */
export function NotificationLogsSection({
  title,
  description,
  sceneLabel,
  sceneId,
  summaryText,
  fetchLogs,
  showToast,
  refreshToken = 0,
}: NotificationLogsSectionProps) {
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);

  /**
   * 加载通知日志：调用 fetchLogs 获取当前页数据并更新 logs/total 状态，失败时通过 showToast 上报错误。
   *
   * @returns Promise<void>，无返回值。
   */
  const loadLogs = async () => {
    try {
      const result = await fetchLogs(page, PAGE_SIZE);
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

  /**
   * 渲染摘要文案：将模板中的 {total}、{label}、{count} 占位符替换为实际数值。
   *
   * @returns string，替换完成后的摘要文案。
   */
  const renderedSummary = summaryText
    .replace('{total}', String(total))
    .replace('{label}', sceneLabel)
    .replace('{count}', String(logs.length));

  return (
    <SectionCard
      title={title}
      description={description}
      action={<Btn tone="secondary" onClick={() => void loadLogs()}>刷新</Btn>}
    >
      <div className="page-stack">
        {/* 复用 schedule-list-meta 既有布局样式，保证日程/待办视觉一致 */}
        <div className="schedule-list-meta">
          <div>
            <strong>日志摘要</strong>
            <span>{renderedSummary}</span>
          </div>
          <div className="schedule-filter-meta">
            <Tag tone="blue">场景 {sceneId}</Tag>
            <Tag>第 {page} / {totalPages} 页</Tag>
          </div>
        </div>

        <NotificationLogTable logs={logs} />
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </SectionCard>
  );
}
