import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function CryptoPage() {
  return (
    <ModulePlaceholderPage
      title="加密市场"
      subtitle="模块先保留结构位，待后续接入行情、仓位和风控提醒。"
      stats={[
        { label: '市场状态', value: '占位' },
        { label: '风险提示', value: '待接入' },
        { label: '通知方案', value: '统一中心' },
      ]}
      bullets={[
        '后续更适合增加高波动告警和仓位风险提醒。',
        '页面已经适配统一的 TS + UI 基础设施。',
        '本轮不扩写后端与真实行情接口。',
      ]}
    />
  );
}
