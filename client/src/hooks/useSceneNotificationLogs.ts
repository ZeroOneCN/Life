import { useEffect, useState } from 'react';

import { getNotificationLogs } from '../services/notificationCenter';
import type { NotificationLogEntry } from '../types/notifications';

interface UseSceneNotificationLogsResult {
  /** 通知日志列表 */
  logs: NotificationLogEntry[];
  /** 是否正在加载 */
  loading: boolean;
  /** 重新拉取日志 */
  reload: () => void;
}

/**
 * 按场景 ID 拉取通知日志的自定义 Hook
 * 用于 SettingsSection 组件中展示最近的通知发送记录
 * @param sceneIds - 需要拉取日志的场景 ID 数组
 * @param deps - 额外的依赖项数组，当依赖变化时重新拉取
 * @param pageSize - 每页条数，默认 8
 * @returns 日志列表、加载状态和重新拉取函数
 */
export function useSceneNotificationLogs(
  sceneIds: string[],
  deps: unknown[] = [],
  pageSize = 8,
): UseSceneNotificationLogsResult {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const result = await getNotificationLogs({
          sceneIds,
          page: 1,
          pageSize,
        });
        if (!cancelled) {
          setLogs(result.items);
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchLogs();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken, pageSize, ...deps]);

  const reload = () => setRefreshToken((prev) => prev + 1);

  return { logs, loading, reload };
}
