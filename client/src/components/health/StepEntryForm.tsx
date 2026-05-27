import type { Ref } from 'react';

import { DateTimePickerField } from '../date';
import { Btn, Field } from '../ui';
import { STEP_HOURS, getStepHourLabel } from '../../services/stepRecords';
import type { StepHour } from '../../types/health';
import { SectionCard } from '../page';

interface StepEntryFormProps {
  currentUserLabel: string;
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
    ? '适合补录当天总步数，重复提交时会提醒你是否覆盖原有记录。'
    : '保存成功后会自动尝试切到下一个小时，连续录入会更顺手。';
}

export function StepEntryForm({
  currentUserLabel,
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
    <SectionCard title="步数录入" description="支持按用户、全天或具体小时录入步数记录。">
      <div className="step-entry-panel">
        <div className="step-entry-meta">
          <div>
            <strong>{getEntryTitle(selectedHour)}</strong>
            <span>{getEntryDescription(selectedHour)}</span>
          </div>
        </div>

        <div className="form-grid">
          <Field
            label="当前录入用户"
            value={currentUserLabel}
            disabled
          />

          <label className="field">
            <span className="field-label">步数</span>
            <input
              ref={stepsInputRef}
              type="number"
              min="1"
              placeholder="输入本次步数"
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

          <DateTimePickerField
            label="记录时间"
            value={recordTime}
            onChange={onRecordTimeChange}
            clearable={false}
            hint="会和下方时间段联动，全天记录默认按 23:59 保存。"
          />
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
              全天
            </button>
          </div>
        </div>

        <div className="step-quick-actions">
          <span className="step-quick-actions-label">快捷时间点</span>
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
