import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function StepPage() {
  return (
    <ModulePlaceholderPage
      title="运动步数"
      subtitle="保留健康中心入口，后续可继续接入设备同步和目标提醒。"
      stats={[
        { label: '本周目标', value: '70,000', helper: '步数累计' },
        { label: '提醒状态', value: '待接入', helper: '可复用通知中心' },
        { label: '数据源', value: '本地 mock' },
      ]}
      bullets={[
        '页面已迁移到 TypeScript 与新布局体系。',
        '后续可增加健康目标通知场景并统一复用通知中心。',
        '当前优先保证导航、主题和视觉风格一致。',
      ]}
    />
  );
}
