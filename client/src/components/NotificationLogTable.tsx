import { DataTable, Tag } from './ui';
import type { NotificationLogEntry } from '../types/notifications';

export function NotificationLogTable({ logs }: { logs: NotificationLogEntry[] }) {
  return (
    <DataTable
      data={logs}
      rowKey="id"
      emptyText="通知中心尚无发送记录"
      columns={[
        {
          key: 'createdAt',
          title: '时间',
          dataIndex: 'createdAt',
          render: (value) => new Date(String(value)).toLocaleString(),
        },
        {
          key: 'title',
          title: '标题',
          dataIndex: 'title',
        },
        {
          key: 'channel',
          title: '渠道',
          dataIndex: 'channel',
          render: (value) => <Tag tone="blue">{String(value)}</Tag>,
        },
        {
          key: 'kind',
          title: '类型',
          dataIndex: 'kind',
          render: (value) => <Tag tone="default">{value === 'test' ? '测试' : '场景'}</Tag>,
        },
        {
          key: 'status',
          title: '结果',
          dataIndex: 'status',
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
        },
      ]}
    />
  );
}
