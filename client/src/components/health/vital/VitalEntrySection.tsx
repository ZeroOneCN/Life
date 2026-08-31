import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Grid } from '@arco-design/web-react';

import { SectionCard } from '../../page';

import { Btn, Tag } from '../../ui';
import type { VitalMetricInfo, VitalMetricKey, VitalStatus } from '../../../types/vital';

const Row = Grid.Row;
const Col = Grid.Col;

interface VitalEntrySectionProps {
  metrics: VitalMetricInfo[];
  loading: boolean;
  onSubmit: (payload: {
    metric: VitalMetricKey;
    value: number;
    recordTime: string;
    notes: string;
  }) => Promise<void>;
}

/**
 * 根据值与参考范围评估状态（前端预览用，与后端一致）。
 * @param value - 指标值
 * @param referenceRange - 参考范围
 * @returns 状态
 */
function previewStatus(value: number, referenceRange: string): VitalStatus {
  if (!value || !referenceRange) return 'unknown';
  const normalized = referenceRange.replace(/\s+/g, '');
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(?:-|~)(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const min = Number(match[1]);
    const max = Number(match[2]);
    return value >= min && value <= max ? 'normal' : 'abnormal';
  }
  return 'unknown';
}

/**
 * 体征录入 Section：快速录入心率、血压、血氧、血糖、体温等日常体征。
 * 支持指标选择、数值输入、时间选择和备注。
 * @param metrics - 可选指标列表
 * @param loading - 是否提交中
 * @param onSubmit - 提交回调
 */
export function VitalEntrySection({ metrics, loading, onSubmit }: VitalEntrySectionProps) {
  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey>('heart_rate');
  const [value, setValue] = useState<string>('');
  const [systolic, setSystolic] = useState<string>('');
  const [diastolic, setDiastolic] = useState<string>('');
  const [recordTime, setRecordTime] = useState<string>(dayjs().format('YYYY-MM-DDTHH:mm'));
  const [notes, setNotes] = useState<string>('');

  /**
   * 切换到体征页面时，如果时间字段为空，自动更新为当前时间。
   */
  useEffect(() => {
    if (!recordTime) {
      setRecordTime(dayjs().format('YYYY-MM-DDTHH:mm'));
    }
  }, [recordTime]);

  const currentMetric = metrics.find((m) => m.key === selectedMetric);
  const isBloodPressure = selectedMetric === 'systolic_bp' || selectedMetric === 'diastolic_bp';

  const handleSubmit = useCallback(async () => {
    if (isBloodPressure) {
      const sys = Number(systolic);
      const dia = Number(diastolic);
      if (!sys || !dia) return;
      const time = dayjs(recordTime).format('YYYY-MM-DD HH:mm');
      await onSubmit({
        metric: 'systolic_bp',
        value: sys,
        recordTime: time,
        notes,
      });
      await onSubmit({
        metric: 'diastolic_bp',
        value: dia,
        recordTime: time,
        notes,
      });
      setSystolic('');
      setDiastolic('');
    } else {
      const num = Number(value);
      if (!num) return;
      const time = dayjs(recordTime).format('YYYY-MM-DD HH:mm');
      await onSubmit({
        metric: selectedMetric,
        value: num,
        recordTime: time,
        notes,
      });
      setValue('');
    }
    setNotes('');
  }, [isBloodPressure, systolic, diastolic, value, recordTime, notes, selectedMetric, onSubmit]);

  /**
   * 根据当前输入与参考范围预览状态。
   */
  const previewedStatus = (() => {
    if (!currentMetric) return 'unknown' as VitalStatus;
    if (isBloodPressure) {
      if (!systolic || !diastolic) return 'unknown' as VitalStatus;
      const sysStatus = previewStatus(Number(systolic), currentMetric.referenceRange);
      return sysStatus;
    }
    if (!value) return 'unknown' as VitalStatus;
    return previewStatus(Number(value), currentMetric.referenceRange);
  })();

  const statusTone =
    previewedStatus === 'normal' ? 'green' : previewedStatus === 'abnormal' ? 'red' : 'default';
  const statusText =
    previewedStatus === 'normal' ? '正常' : previewedStatus === 'abnormal' ? '异常' : '待录入';

  return (
    <SectionCard title="体征录入" description="快速记录心率、血压、血氧、血糖、体温等日常体征">
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <div className="vital-entry-field">
            <label>指标类型</label>
            <div className="vital-entry-metric-tabs">
              {metrics.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  className={`vital-entry-metric-tab ${selectedMetric === metric.key ? 'active' : ''}`}
                  onClick={() => setSelectedMetric(metric.key as VitalMetricKey)}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        </Col>

        {isBloodPressure ? (
          <>
            <Col span={12}>
              <div className="vital-entry-field">
                <label>收缩压 (mmHg)</label>
                <input
                  type="number"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  placeholder="例如 120"
                  className="vital-entry-input"
                />
              </div>
            </Col>
            <Col span={12}>
              <div className="vital-entry-field">
                <label>舒张压 (mmHg)</label>
                <input
                  type="number"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  placeholder="例如 80"
                  className="vital-entry-input"
                />
              </div>
            </Col>
          </>
        ) : (
          <Col span={12}>
            <div className="vital-entry-field">
              <label>
                {currentMetric?.label} ({currentMetric?.unit})
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`请输入${currentMetric?.label ?? ''}值`}
                step="0.1"
                className="vital-entry-input"
              />
            </div>
          </Col>
        )}

        <Col span={8}>
          <div className="vital-entry-field">
            <label>记录时间</label>
            <input
              type="datetime-local"
              value={recordTime}
              onChange={(e) => setRecordTime(e.target.value)}
              className="vital-entry-input"
            />
          </div>
        </Col>

        <Col span={8}>
          <div className="vital-entry-field">
            <label>备注</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="可选，例如：运动后、空腹等"
              className="vital-entry-input"
            />
          </div>
        </Col>
      </Row>

      <div className="vital-entry-footer">
        <div className="vital-entry-reference">
          <span className="muted">
            参考范围：{currentMetric?.referenceRange ?? '-'} {currentMetric?.unit ?? ''}
          </span>
          <Tag tone={statusTone} size="sm">
            {statusText}
          </Tag>
        </div>
        <Btn type="button" tone="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? '保存中…' : '保存记录'}
        </Btn>
      </div>
    </SectionCard>
  );
}
