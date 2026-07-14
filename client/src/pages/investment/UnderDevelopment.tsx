import { SectionCard } from '../../components/page';

interface UnderDevelopmentProps {
  title: string;
  icon: string;
  description?: string;
}

export default function UnderDevelopment({ title, icon, description }: UnderDevelopmentProps) {
  return (
    <div className="under-development-page">
      <div className="dev-hero">
        <div className="dev-icon-wrapper">
          <span className="dev-icon">{icon}</span>
        </div>
        <h1 className="dev-title">{title}</h1>
        <p className="dev-subtitle">正在开发中，敬请期待</p>
        {description && <p className="dev-description">{description}</p>}
      </div>

      <div className="dev-features">
        <SectionCard title="即将上线功能">
          <div className="dev-feature-grid">
            <div className="dev-feature-card">
              <div className="feature-icon">📊</div>
              <div className="feature-title">行情数据</div>
              <div className="feature-desc">实时行情推送，多市场数据聚合</div>
            </div>
            <div className="dev-feature-card">
              <div className="feature-icon">💹</div>
              <div className="feature-title">交易记录</div>
              <div className="feature-desc">支持多平台交易记录同步与管理</div>
            </div>
            <div className="dev-feature-card">
              <div className="feature-icon">📈</div>
              <div className="feature-title">收益分析</div>
              <div className="feature-desc">详细的收益统计与可视化图表</div>
            </div>
            <div className="dev-feature-card">
              <div className="feature-icon">🔔</div>
              <div className="feature-title">智能提醒</div>
              <div className="feature-desc">价格预警、交易提醒等个性化通知</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="dev-timeline">
        <SectionCard title="开发进度">
          <div className="timeline-list">
            <div className="timeline-item completed">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-title">需求分析</div>
                <div className="timeline-desc">已完成功能需求梳理与技术方案设计</div>
              </div>
              <div className="timeline-status">✅</div>
            </div>
            <div className="timeline-item current">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-title">功能开发</div>
                <div className="timeline-desc">核心功能正在开发中</div>
              </div>
              <div className="timeline-status">⏳</div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-title">测试优化</div>
                <div className="timeline-desc">功能测试与性能优化</div>
              </div>
              <div className="timeline-status">🔲</div>
            </div>
            <div className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-title">正式上线</div>
                <div className="timeline-desc">功能正式开放使用</div>
              </div>
              <div className="timeline-status">🔲</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="dev-cta">
        <SectionCard title="期待您的反馈">
          <div className="cta-content">
            <div className="cta-icon">🌟</div>
            <div className="cta-text">
              <h3>期待您的反馈</h3>
              <p>如果您有任何功能建议或需求，欢迎随时联系我们</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}