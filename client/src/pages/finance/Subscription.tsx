import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function SubscriptionPage() {
  return (
    <ModulePlaceholderPage
      title="服务订阅"
      subtitle="订阅管理页保留结构位，后续可继续完善续费提醒。"
      stats={[
        { label: '订阅数量', value: '11 项' },
        { label: '续费提醒', value: '待接入' },
        { label: '统一发送', value: '已规划' },
      ]}
      bullets={[
        '续费、试用到期和异常涨价提醒都适合走通知中心。',
        '页面已完成 TypeScript 迁移与新设计系统接入。',
        '后续可以优先复用当前通知中心的数据模型。',
      ]}
    />
  );
}
