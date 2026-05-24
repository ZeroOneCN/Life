import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function MedicationPage() {
  return (
    <ModulePlaceholderPage
      title="日常用药"
      subtitle="用药记录页已切到统一前端架构，后续可扩展库存和服药提醒。"
      stats={[
        { label: '常备药品', value: '24 项' },
        { label: '提醒计划', value: '后续接入' },
        { label: '视觉体系', value: '已统一' },
      ]}
      bullets={[
        '未来可新增低库存、过期和服药时间提醒。',
        '当前版本先完成 TypeScript 迁移和 UI 治理。',
        '通知能力应继续统一复用通知中心而不是页面自建。',
      ]}
    />
  );
}
