import { Grid } from '@arco-design/web-react';
import { EmptyState, SectionCard } from '../../page';
import { Btn, Tag } from '../../ui';
const Row = Grid.Row;
const Col = Grid.Col;
import type { HealthReportAISuggestion } from '../../../types/healthReport';

interface HealthReportAISuggestionSectionProps {
  suggestion: HealthReportAISuggestion | null;
  loading: boolean;
  generating: boolean;
  onGenerate: () => void;
}

const PRIORITY_TAGS = {
  high: { tone: 'red' as const, text: '高' },
  medium: { tone: 'orange' as const, text: '中' },
  low: { tone: 'green' as const, text: '低' },
};

const CATEGORY_LABELS: Record<string, string> = {
  step: '步数',
  exercise: '运动',
  diet: '饮食',
  weight: '体重',
  medication: '用药',
  checkup: '体检',
  sleep: '睡眠',
};

/**
 * AI 建议 Section：基于周期健康数据调用 DeepSeek 生成个性化建议。
 * @param suggestion - AI 建议结果
 * @param loading - 是否加载中
 * @param generating - 是否正在生成
 * @param onGenerate - 触发生成回调
 */
export function HealthReportAISuggestionSection({
  suggestion,
  loading,
  generating,
  onGenerate,
}: HealthReportAISuggestionSectionProps) {
  if (loading) {
    return (
      <SectionCard title="AI 健康建议" description="正在加载 AI 建议…">
        <div className="skeleton-block" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="AI 健康建议"
      description={
        suggestion
          ? `生成于 ${suggestion.generatedAt} · ${suggestion.label}`
          : '基于本期健康数据生成个性化建议'
      }
      action={
        <Btn type="button" tone="primary" onClick={onGenerate} disabled={generating}>
          {generating ? 'AI 生成中…' : suggestion ? '重新生成' : '生成 AI 建议'}
        </Btn>
      }
    >
      {!suggestion ? (
        <EmptyState
          title="尚未生成 AI 建议"
          description="点击右上角「生成 AI 建议」按钮，系统将基于本期数据调用 DeepSeek 生成个性化建议（每次调用会消耗 Token）。"
        />
      ) : (
        <div className="page-grid-wrapper">
          <Row gutter={[24, 20]}>
            <Col span={24}>
              <div className="health-report-ai-summary">
                <span className="health-report-ai-summary-label">本期总结</span>
                <strong>{suggestion.suggestion.summary}</strong>
              </div>
            </Col>

            {suggestion.suggestion.suggestions.length > 0 ? (
              <Col span={24}>
                <div className="health-report-ai-suggestions">
                  <strong>个性化建议</strong>
                  <div className="health-report-ai-suggestion-list">
                    {suggestion.suggestion.suggestions.map((item, index) => {
                      const tag = PRIORITY_TAGS[item.priority];
                      const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category;
                      return (
                        <div key={index} className="health-report-ai-suggestion-item">
                          <div className="health-report-ai-suggestion-header">
                            <Tag tone="default" size="sm">
                              {categoryLabel}
                            </Tag>
                            <Tag tone={tag.tone} size="sm">
                              {tag.text}
                            </Tag>
                          </div>
                          <strong className="health-report-ai-suggestion-title">
                            {item.title}
                          </strong>
                          <span className="health-report-ai-suggestion-detail">{item.detail}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Col>
            ) : null}

            {suggestion.suggestion.risks.length > 0 ? (
              <Col span={24}>
                <div className="health-report-ai-risks">
                  <strong>识别到的健康风险</strong>
                  <ul>
                    {suggestion.suggestion.risks.map((risk, index) => (
                      <li key={index}>{risk}</li>
                    ))}
                  </ul>
                </div>
              </Col>
            ) : null}
          </Row>
        </div>
      )}
    </SectionCard>
  );
}
