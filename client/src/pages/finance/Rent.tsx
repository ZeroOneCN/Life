import { ModulePlaceholderPage } from '../shared/ModulePlaceholderPage';

export default function RentPage() {
  return (
    <ModulePlaceholderPage
      title="房租水电"
      subtitle="租房与账单模块已切入新 UI 基建，后续适合加缴费提醒。"
      stats={[
        { label: '租住地址', value: '4 处' },
        { label: '账单提醒', value: '待接入' },
        { label: 'TS 迁移', value: '已完成' },
      ]}
      bullets={[
        '后续可以接入房租、水电、宽带等缴费提醒场景。',
        '新的通知中心适合承接房租模块的统一发送。',
        '当前优先保证一级菜单与视觉层统一。',
      ]}
    />
  );
}
