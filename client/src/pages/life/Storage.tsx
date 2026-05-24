import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function StoragePage() {
  return (
    <ModulePlaceholderPage
      title="物品归纳"
      subtitle="生活模块的归纳页已切到统一前端骨架，后续可增加库存提醒。"
      stats={[
        { label: '收纳分区', value: '18 个' },
        { label: '库存提醒', value: '待规划' },
        { label: '设计状态', value: '已统一' },
      ]}
      bullets={[
        '后续可以增加常用物资不足提醒。',
        '本轮优先完成整体信息架构与通知策略统一。',
        '页面已经具备后续扩展的 TypeScript 基础。',
      ]}
    />
  );
}
