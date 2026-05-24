import { useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { StepEntryForm } from '../../components/health/StepEntryForm';
import { StepRecordsSection } from '../../components/health/StepRecordsSection';
import { StepTrendSection } from '../../components/health/StepTrendSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Modal, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import {
  buildInitialStepState,
  buildStepMonthCompare,
  buildStepRecordTime,
  createStepRecord,
  deleteStepRecord,
  deleteStepRecords,
  findDuplicateStepRecord,
  getNextStepHour,
  getTodayEndDateTime,
  inferStepHourFromRecordTime,
  updateStepRecord,
} from '../../services/stepRecords';
import type { StepHour, StepPageState, StepRecord, StepRecordDraft } from '../../types/health';

const STORAGE_KEY = 'lifeos_health_step_page';

function getQuickRecordTime(hour: StepHour, previousDay = false) {
  const base = previousDay ? dayjs().subtract(1, 'day') : dayjs();
  const seed = base.format('YYYY-MM-DDTHH:mm');

  if (hour === null) {
    return buildStepRecordTime(seed, null, 59);
  }

  return buildStepRecordTime(seed, hour, 0);
}

export default function StepPage() {
  const [data, setData] = useLocalStorageState<StepPageState>(STORAGE_KEY, buildInitialStepState);
  const [stepsInput, setStepsInput] = useState('');
  const [selectedHour, setSelectedHour] = useState<StepHour>(null);
  const [recordTime, setRecordTime] = useState(getTodayEndDateTime());
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    existing: StepRecord;
    draft: StepRecordDraft;
  } | null>(null);
  const { toast, showToast } = useToastState();
  const stepsInputRef = useRef<HTMLInputElement>(null);

  const compareSummary = useMemo(
    () => buildStepMonthCompare(data.records, data.settings.strideLength),
    [data.records, data.settings.strideLength],
  );

  const recentSevenDaySteps = useMemo(
    () => data.records
      .filter((record) => dayjs(record.recordTime).isAfter(dayjs().subtract(7, 'day')))
      .reduce((sum, record) => sum + record.steps, 0),
    [data.records],
  );

  const focusStepsInput = () => {
    window.setTimeout(() => {
      stepsInputRef.current?.focus();
      stepsInputRef.current?.select();
    }, 0);
  };

  const handleSelectHour = (hour: StepHour) => {
    setSelectedHour(hour);
    setRecordTime((previous) => buildStepRecordTime(previous || getTodayEndDateTime(), hour));
  };

  const handleRecordTimeChange = (value: string) => {
    setRecordTime(value);
    setSelectedHour(inferStepHourFromRecordTime(value));
  };

  const resetEntryState = (hour: StepHour) => {
    setStepsInput('');

    if (hour === null) {
      setSelectedHour(null);
      setRecordTime(getTodayEndDateTime());
      focusStepsInput();
      return;
    }

    const nextHour = getNextStepHour(hour);
    setSelectedHour(nextHour);
    setRecordTime((previous) => buildStepRecordTime(previous || getTodayEndDateTime(), nextHour));
    focusStepsInput();
  };

  const persistCreate = (draft: StepRecordDraft) => {
    setData((previous) => ({
      ...previous,
      records: createStepRecord(previous.records, draft),
    }));
    resetEntryState(draft.hour);
    showToast('步数记录已保存。');
  };

  const handleCreateRecord = () => {
    const steps = Number(stepsInput);

    if (!Number.isFinite(steps) || steps <= 0) {
      showToast('请输入有效的步数。', 'error');
      return;
    }

    if (!dayjs(recordTime).isValid()) {
      showToast('请选择有效的记录时间。', 'error');
      return;
    }

    const draft: StepRecordDraft = {
      steps,
      hour: selectedHour,
      recordTime,
    };

    const duplicate = findDuplicateStepRecord(data.records, draft);
    if (duplicate) {
      setPendingDuplicate({ existing: duplicate, draft });
      return;
    }

    persistCreate(draft);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="运动步数"
        subtitle="把参考原型重构进当前 LifeOS 体系，统一本地数据、Recharts 趋势和 TypeScript 页面状态。"
      />

      <StatGrid
        items={[
          {
            label: '本月累计',
            value: compareSummary.currentSteps.toLocaleString(),
            helper: `${compareSummary.currentLabel} · ${compareSummary.currentDistanceKm} 公里`,
          },
          {
            label: '近 7 天步数',
            value: recentSevenDaySteps.toLocaleString(),
            helper: '按最近七天记录自动汇总',
          },
          {
            label: '历史记录',
            value: `${data.records.length}`,
            helper: '支持编辑、排序和批量删除',
          },
          {
            label: '当前步幅',
            value: `${data.settings.strideLength} m`,
            helper: compareSummary.changePercentage === null
              ? '上月暂无可比数据'
              : `本月较上月 ${compareSummary.changePercentage > 0 ? '+' : ''}${compareSummary.changePercentage}%`,
          },
        ]}
      />

      <StepEntryForm
        stepsInput={stepsInput}
        selectedHour={selectedHour}
        recordTime={recordTime}
        stepsInputRef={stepsInputRef}
        onStepsInputChange={setStepsInput}
        onSelectHour={handleSelectHour}
        onRecordTimeChange={handleRecordTimeChange}
        onQuickTimeSelect={(hour, previousDay = false) => {
          setSelectedHour(hour);
          setRecordTime(getQuickRecordTime(hour, previousDay));
          focusStepsInput();
        }}
        onSubmit={handleCreateRecord}
      />

      <StepTrendSection
        records={data.records}
        strideLength={data.settings.strideLength}
        onStrideLengthChange={(value) => {
          setData((previous) => ({
            ...previous,
            settings: {
              ...previous.settings,
              strideLength: value,
            },
          }));
        }}
        showToast={showToast}
      />

      <StepRecordsSection
        records={data.records}
        strideLength={data.settings.strideLength}
        onUpdateRecord={(id, draft) => {
          setData((previous) => ({
            ...previous,
            records: updateStepRecord(previous.records, id, draft),
          }));
        }}
        onDeleteRecord={(id) => {
          setData((previous) => ({
            ...previous,
            records: deleteStepRecord(previous.records, id),
          }));
        }}
        onDeleteRecords={(ids) => {
          setData((previous) => ({
            ...previous,
            records: deleteStepRecords(previous.records, ids),
          }));
        }}
        showToast={showToast}
      />

      <Modal
        open={Boolean(pendingDuplicate)}
        onClose={() => setPendingDuplicate(null)}
        title="检测到同时间段已有记录"
        width={480}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setPendingDuplicate(null)}>取消</Btn>
            <Btn
              tone="primary"
              onClick={() => {
                if (!pendingDuplicate) {
                  return;
                }

                setData((previous) => ({
                  ...previous,
                  records: updateStepRecord(previous.records, pendingDuplicate.existing.id, pendingDuplicate.draft),
                }));
                setPendingDuplicate(null);
                resetEntryState(pendingDuplicate.draft.hour);
                showToast('已覆盖原有时间段记录。');
              }}
            >
              覆盖保存
            </Btn>
          </>
        )}
      >
        <SectionCard
          title="重复记录提醒"
          description="同一天的同一时间段只保留一条记录，确认后会用本次输入覆盖旧数据。"
        >
          <div className="step-duplicate-summary">
            <div className="status-metadata">
              <span>已有记录步数：{pendingDuplicate?.existing.steps.toLocaleString() ?? '-'}</span>
              <span>新输入步数：{pendingDuplicate?.draft.steps.toLocaleString() ?? '-'}</span>
            </div>
            <div className="callout callout-info">
              覆盖后，趋势统计、月对比和记录表格都会立即同步更新。
            </div>
          </div>
        </SectionCard>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
