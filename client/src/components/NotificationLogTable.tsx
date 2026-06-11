import { DataTable, Pagination, Tag } from './ui';
import type { NotificationLogEntry } from '../types/notifications';

export function NotificationLogTable({
  logs,
  page = 1,
  totalPages = 1,
  onPageChange,
}: {
  logs: NotificationLogEntry[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}) {
  return (
    <div className="page-stack">
      <DataTable
        data={logs}
        rowKey="id"
        emptyText="通知中心暂无发送记录"
        columns={[
          {
            key: 'createdAt',
            title: '时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value) => new Date(String(value)).toLocaleString(),
          },
          {
            key: 'title',
            title: '标题',
            dataIndex: 'title',
            width: 160,
          },
          {
            key: 'channel',
            title: '渠道',
            dataIndex: 'channel',
            width: 120,
            render: (value) => <Tag tone="blue">{String(value)}</Tag>,
          },
          {
            key: 'kind',
            title: '类型',
            dataIndex: 'kind',
            width: 96,
            render: (value) => <Tag tone="pink">{value === 'test' ? '测试' : '场景'}</Tag>,
          },
          {
            key: 'status',
            title: '结果',
            dataIndex: 'status',
            width: 96,
            render: (value) => (
              <Tag tone={value === 'success' ? 'green' : value === 'error' ? 'red' : 'orange'}>
                {value === 'success' ? '成功' : value === 'error' ? '失败' : '跳过'}
              </Tag>
            ),
          },
          {
            key: 'message',
            title: '说明',
            dataIndex: 'message',
            width: 320,
            render: (value) => <div className="notification-log-message">{String(value)}</div>,
          },
        ]}
      />
      {onPageChange ? <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} /> : null}
    </div>
  );
}
