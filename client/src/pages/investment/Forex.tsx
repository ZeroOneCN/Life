import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function ForexPage() {
  return (
    <ModulePlaceholderPage
      title="外汇市场"
      subtitle="投资模块已迁到新的 TypeScript 骨架，后续可以继续补录策略工具。"
      stats={[
        { label: '交易对', value: '8 组' },
        { label: '行情提醒', value: '待接入' },
        { label: '页面状态', value: '已迁移' },
      ]}
      bullets={[
        '后续可以增加汇率波动、止盈止损和事件日历提醒。',
        '投资通知同样应通过通知中心统一抽象。',
        '当前版本重点在整体架构和体验一致性。',
      ]}
    />
  );
}
