import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function TravelPage() {
  return (
    <ModulePlaceholderPage
      title="旅行游玩"
      subtitle="路线规划和旅行预算页已接入新骨架，后续适合增加出发前提醒。"
      stats={[
        { label: '出行计划', value: '6 条' },
        { label: '预算跟踪', value: '启用中' },
        { label: '通知策略', value: '统一中心' },
      ]}
      bullets={[
        '适合未来增加出行前准备、证件检查和付款节点提醒。',
        '本轮优先完成统一前端架构与导航信息设计。',
        '后续提醒应通过通知中心，而不是旅行页单独配置。',
      ]}
    />
  );
}
