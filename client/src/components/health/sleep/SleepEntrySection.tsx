import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Grid } from '@arco-design/web-react';

import { SectionCard } from '../../page';

const Row = Grid.Row;
const Col = Grid.Col;

interface SleepEntrySectionProps {
  loading: boolean;
  onSubmit: (payload: {
    date: string;
    bedtime: string;
    wakeTime: string;
    qualityScore: number | null;
    isNap: boolean;
    notes: string;
  }) => void;
}

const QUALITY_OPTIONS = [
  { value: 1, label: '很差', emoji: '😫' },
  { value: 2, label: '较差', emoji: '😔' },
  { value: 3, label: '一般', emoji: '😐' },
  { value: 4, label: '较好', emoji: '😊' },
  { value: 5, label: '很好', emoji: '😴' },
];

/**
 * 睡眠录入 Section：快速录入昨晚睡眠情况。
 * 包含日期、就寝/起床时间、质量评分、是否午睡、备注等字段。
 * @param loading - 是否提交中
 * @param onSubmit - 提交回调
 */
export function SleepEntrySection({ loading, onSubmit }: SleepEntrySectionProps) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [bedtime, setBedtime] = useState(
    dayjs().subtract(1, 'day').hour(23).minute(0).format('YYYY-MM-DDTHH:mm'),
  );
  const [wakeTime, setWakeTime] = useState(dayjs().hour(7).minute(0).format('YYYY-MM-DDTHH:mm'));
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [isNap, setIsNap] = useState(false);
  const [notes, setNotes] = useState('');

  const durationLabel = useMemo(() => {
    const diff = dayjs(wakeTime).diff(dayjs(bedtime), 'minute');
    if (diff <= 0) return '时间无效';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h} 小时 ${m} 分`;
  }, [bedtime, wakeTime]);

  const handleSubmit = () => {
    onSubmit({
      date,
      bedtime: dayjs(bedtime).format('YYYY-MM-DD HH:mm'),
      wakeTime: dayjs(wakeTime).format('YYYY-MM-DD HH:mm'),
      qualityScore,
      isNap,
      notes,
    });
  };

  return (
    <SectionCard title="睡眠录入" description="记录昨晚睡眠情况，追踪睡眠质量">
      <Row gutter={[12, 12]}>
        <Col span={8}>
          <div className="vital-entry-field">
            <label>日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="vital-entry-input"
            />
          </div>
        </Col>
        <Col span={8}>
          <div className="vital-entry-field">
            <label>类型</label>
            <div className="vital-entry-metric-tabs">
              <button
                type="button"
                className={`vital-entry-metric-tab ${!isNap ? 'active' : ''}`}
                onClick={() => setIsNap(false)}
              >
                夜间睡眠
              </button>
              <button
                type="button"
                className={`vital-entry-metric-tab ${isNap ? 'active' : ''}`}
                onClick={() => setIsNap(true)}
              >
                午睡
              </button>
            </div>
          </div>
        </Col>
        <Col span={8}>
          <div className="vital-entry-field">
            <label>就寝时间</label>
            <input
              type="datetime-local"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className="vital-entry-input"
            />
          </div>
        </Col>
        <Col span={8}>
          <div className="vital-entry-field">
            <label>起床时间</label>
            <input
              type="datetime-local"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="vital-entry-input"
            />
          </div>
        </Col>
        <Col span={24}>
          <div className="vital-entry-field">
            <label>睡眠质量（可选）</label>
            <div className="vital-entry-metric-tabs">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  className={`vital-entry-metric-tab ${qualityScore === q.value ? 'active' : ''}`}
                  onClick={() => setQualityScore(qualityScore === q.value ? null : q.value)}
                >
                  {q.emoji} {q.label}
                </button>
              ))}
            </div>
          </div>
        </Col>
        <Col span={24}>
          <div className="vital-entry-field">
            <label>备注（可选）</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="如：入睡困难、半夜醒等"
              className="vital-entry-input"
            />
          </div>
        </Col>
      </Row>
      <div className="vital-entry-footer">
        <div className="vital-entry-reference">
          <span className="muted">预计时长：</span>
          <strong style={{ color: 'var(--color-primary)' }}>{durationLabel}</strong>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? '保存中…' : '保存记录'}
        </button>
      </div>
    </SectionCard>
  );
}
