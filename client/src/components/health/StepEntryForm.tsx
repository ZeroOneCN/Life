import type { Ref } from 'react';

import { Btn } from '../ui';
import { STEP_HOURS, getStepHourLabel } from '../../services/stepRecords';
import type { StepHour } from '../../types/health';
import { SectionCard } from '../page';

interface StepEntryFormProps {
  stepsInput: string;
  selectedHour: StepHour;
  recordTime: string;
  stepsInputRef: Ref<HTMLInputElement>;
  onStepsInputChange: (value: string) => void;
  onSelectHour: (hour: StepHour) => void;
  onRecordTimeChange: (value: string) => void;
  onQuickTimeSelect: (hour: StepHour, previousDay?: boolean) => void;
  onSubmit: () => void;
}

function getEntryTitle(hour: StepHour) {
  return hour === null ? '当前记录：全天累计' : `当前记录：${getStepHourLabel(hour)} 时间段`;
}

function getEntryDescription(hour: StepHour) {
  return hour === null
    ? '适合补录当天总步数，重复提交会提醒是否覆盖。'
    : '添加成功后会自动尝试切到下一个小时，连续录入更顺手。';
}

export function StepEntryForm({
  stepsInput,
  selectedHour,
  recordTime,
  stepsInputRef,
  onStepsInputChange,
  onSelectHour,
  onRecordTimeChange,
  onQuickTimeSelect,
  onSubmit,
}: StepEntryFormProps) {
  return (
    <SectionCard title="步数录入" description="按全天或具体时间段记录今天的步数变化。">
      <div className="step-entry-panel">
        <div className="step-entry-meta">
          <div>
            <strong>{getEntryTitle(selectedHour)}</strong>
            <span>{getEntryDescription(selectedHour)}</span>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field-label">步数</span>
            <input
              ref={stepsInputRef}
              type="number"
              min="1"
              placeholder="输入步数"
              value={stepsInput}
              onChange={(event) => onStepsInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
          </label>

          <label className="field">
            <span className="field-label">记录时间</span>
            <div className="field-control field-control-date">
              <input
                className="input-date-themed"
                type="datetime-local"
                value={recordTime}
                onChange={(event) => onRecordTimeChange(event.target.value)}
              />
              <span className="field-control-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 2v3M17 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </label>
        </div>

        <div className="field">
          <span className="field-label">时间段</span>
          <div className="step-hour-buttons">
            {STEP_HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                className={`step-hour-button ${selectedHour === hour ? 'is-active' : ''}`}
                onClick={() => onSelectHour(hour)}
              >
                {hour}
              </button>
            ))}
            <button
              type="button"
              className={`step-hour-button ${selectedHour === null ? 'is-active' : ''}`}
              onClick={() => onSelectHour(null)}
            >
              全
            </button>
          </div>
        </div>

        <div className="step-quick-actions">
          <span className="step-quick-actions-label">快速选择时间点</span>
          <div className="step-quick-actions-list">
            {[7, 8, 9, 12, 18, 23].map((hour) => (
              <Btn
                key={hour}
                tone="secondary"
                className="step-quick-button"
                onClick={() => onQuickTimeSelect(hour as Exclude<StepHour, null>)}
              >
                {hour}:00
              </Btn>
            ))}
            <Btn
              tone="secondary"
              className="step-quick-button"
              onClick={() => onQuickTimeSelect(null, true)}
            >
              昨天 23:59
            </Btn>
          </div>
        </div>

        <div className="step-entry-actions">
          <Btn tone="primary" onClick={onSubmit}>保存本次记录</Btn>
          <span className="subtle-text">保存成功后，焦点会自动回到步数输入框。</span>
        </div>
      </div>
    </SectionCard>
  );
}
