import { PageHeader, SectionCard, StatGrid } from '../components/page';
import { Tag } from '../components/ui';
import { useNotificationCenterState } from '../services/notificationCenter';

export default function Dashboard() {
  const notificationState = useNotificationCenterState();
  const enabledChannels = Object.values(notificationState.channels).filter((item) => item.enabled).length;
  const enabledScenes = Object.values(notificationState.scenes).filter((item) => item.enabled).length;

  return (
    <div className="page-stack">
      <PageHeader
        title="首页"
        subtitle="LifeOS 前端已切换到 TypeScript 基建，通知、主题与菜单结构统一收口。"
        actions={<Tag tone="green">系统在线</Tag>}
      />
      <StatGrid
        items={[
          { label: '通知渠道', value: `${enabledChannels}`, helper: '来自通知中心' },
          { label: '启用场景', value: `${enabledScenes}`, helper: '覆盖待办、号卡、借款' },
          { label: '统一日志', value: `${notificationState.logs.length}`, helper: '前端本地模拟发送记录' },
          { label: '技术栈', value: 'React + TS', helper: 'Vite 构建' },
        ]}
      />
      <div className="two-column-layout">
        <SectionCard
          title="本轮改造完成重点"
          description="聚焦前端架构治理、通知中心统一收口与开关感知体验。"
        >
          <div className="bullet-list">
            <div className="bullet-item"><span className="bullet-dot" />前端入口、路由、布局和共享组件已切换到 TypeScript。</div>
            <div className="bullet-item"><span className="bullet-dot" />通知中心新增为一级菜单，并统一三类渠道。</div>
            <div className="bullet-item"><span className="bullet-dot" />Todo、号卡、借款页面的通知逻辑统一从通知中心发送。</div>
            <div className="bullet-item"><span className="bullet-dot" />所有关键开关都补充了状态卡、影响范围和跳转入口。</div>
          </div>
        </SectionCard>
        <SectionCard
          title="下一步建议"
          description="后续如果开始写后端，可以直接把通知中心 mock adapter 换成真实接口。"
        >
          <div className="bullet-list">
            <div className="bullet-item"><span className="bullet-dot" />接入真实邮件服务、企业微信机器人和 Webhook 签名校验。</div>
            <div className="bullet-item"><span className="bullet-dot" />把本地日志升级为后端可检索的通知审计流。</div>
            <div className="bullet-item"><span className="bullet-dot" />为更多业务模块增加通知场景并复用当前配置中心。</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
