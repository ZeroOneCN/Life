import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function USStockPage() {
  return (
    <ModulePlaceholderPage
      title="美股市场"
      subtitle="保留市场入口与视觉一致性，后续可以继续增加持仓工具。"
      stats={[
        { label: '观察列表', value: '23 只' },
        { label: '价格提醒', value: '待接入' },
        { label: '统一发送', value: '已规划' },
      ]}
      bullets={[
        '未来适合增加财报、价格区间和持仓风险提醒。',
        '本轮只做前端，暂不接真实行情或交易后端。',
        '页面已完成 TypeScript 迁移和信息架构归一。',
      ]}
    />
  );
}
