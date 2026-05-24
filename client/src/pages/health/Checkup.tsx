import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function CheckupPage() {
  return (
    <ModulePlaceholderPage
      title="体检数据"
      subtitle="该模块先保留结构位，后续可接入指标趋势和复查提醒。"
      stats={[
        { label: '模块状态', value: '规划中' },
        { label: '提醒能力', value: '可扩展' },
        { label: '当前版本', value: 'TS 基线' },
      ]}
      bullets={[
        '适合未来增加年度体检、复查和指标异常场景。',
        '统一通知中心让后续提醒能力无需在本页重复建设。',
        '当前优先完成前端统一迁移和信息架构整理。',
      ]}
    />
  );
}
