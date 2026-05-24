import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function FitnessPage() {
  return (
    <ModulePlaceholderPage
      title="健身减脂"
      subtitle="训练计划、饮食记录和目标趋势页已接入新的前端骨架。"
      stats={[
        { label: '训练周期', value: '12 周' },
        { label: '体重目标', value: '-5kg' },
        { label: '通知策略', value: '统一中心' },
      ]}
      bullets={[
        '后续可以把训练打卡提醒直接作为新的通知场景接入。',
        '当前页面保留一级信息架构与视觉语言的一致性。',
        '布局和组件已经统一到 TypeScript 基座。',
      ]}
    />
  );
}
