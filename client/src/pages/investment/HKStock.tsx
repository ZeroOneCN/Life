import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function HKStockPage() {
  return (
    <ModulePlaceholderPage
      title="港股市场"
      subtitle="保留投资模块入口，后续可加财报和持仓提醒。"
      stats={[
        { label: '观察标的', value: '14 只' },
        { label: '财报提醒', value: '待规划' },
        { label: '前端迁移', value: '已完成' },
      ]}
      bullets={[
        '财报窗口、除权除息和价格波动都可作为未来通知场景。',
        '通知中心已经提供统一发送骨架，可直接复用。',
        '当前优先完成前端 TypeScript 化和导航统一。',
      ]}
    />
  );
}
