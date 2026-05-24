import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function ShoppingPage() {
  return (
    <ModulePlaceholderPage
      title="网上购物"
      subtitle="消费记录模块已迁入新的 TS 基建，保留后续继续细化的空间。"
      stats={[
        { label: '订单样例', value: '128' },
        { label: '待补能力', value: '预算预警' },
        { label: '通知接入', value: '可扩展' },
      ]}
      bullets={[
        '后续可增加预算预警、发货签收和价格波动提醒。',
        '页面入口、布局和文案已经统一到新的设计系统。',
        '当前不再保留旧版分散逻辑，避免重复维护。',
      ]}
    />
  );
}
