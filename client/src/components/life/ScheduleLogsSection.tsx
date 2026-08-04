import { scheduleApi } from '../../services/scheduleApi';
import { NotificationLogsSection } from '../shared/NotificationLogsSection';

interface ScheduleLogsSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  refreshToken?: number;
}

/**
 * 获取日程通知日志：委托 scheduleApi.getLogs 读取后端 `/api/life/schedule/logs`。
 *
 * @param page 页码，从 1 开始。
 * @param pageSize 每页条数。
 * @returns Promise，解析为包含日志条目列表（items）与总数（total）的对象。
 */
async function fetchScheduleLogs(page: number, pageSize: number) {
  return scheduleApi.getLogs(page, pageSize);
}

/**
 * 日程通知日志组件：基于通用 NotificationLogsSection，绑定日程提醒日志接口。
 *
 * @param props 组件属性，包含 showToast 与可选的 refreshToken。
 * @returns React 元素，渲染日程提醒通知日志区段。
 */
export function ScheduleLogsSection({ showToast, refreshToken = 0 }: ScheduleLogsSectionProps) {
  return (
    <NotificationLogsSection
      title="通知日志"
      description="这里直接读取后端 `/api/life/schedule/logs`，不再依赖本地通知状态。"
      sceneLabel="日程提醒"
      sceneId="schedule.reminder"
      summaryText="当前共有 {total} 条{label}日志，本页显示 {count} 条。"
      fetchLogs={fetchScheduleLogs}
      showToast={showToast}
      refreshToken={refreshToken}
    />
  );
}
