import { useEffect, useMemo, useRef, useState } from 'react';
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
  filterStepRecordsByUserId,
  findDuplicateStepRecord,
  getNextStepHour,
  getTodayEndDateTime,
  inferStepHourFromRecordTime,
  normalizeStepPageState,
  normalizeStepUserId,
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
  const normalizedData = useMemo(() => normalizeStepPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const activeUserRecords = useMemo(
    () => filterStepRecordsByUserId(normalizedData.records, normalizedData.settings.activeUserId),
    [normalizedData.records, normalizedData.settings.activeUserId],
  );

  const compareSummary = useMemo(
    () => buildStepMonthCompare(activeUserRecords, normalizedData.settings.strideLength),
    [activeUserRecords, normalizedData.settings.strideLength],
  );

  const recentSevenDaySteps = useMemo(
    () => activeUserRecords
      .filter((record) => dayjs(record.recordTime).isAfter(dayjs().subtract(7, 'day')))
      .reduce((sum, record) => sum + record.steps, 0),
    [activeUserRecords],
  );

  const focusStepsInput = () => {
    window.setTimeout(() => {
      stepsInputRef.current?.focus();
      stepsInputRef.current?.select();
    }, 0);
  };

  const updateSettings = (patch: Partial<StepPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
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
    const userId = normalizeStepUserId(normalizedData.settings.activeUserId);
    const steps = Number(stepsInput);

    if (!userId) {
      showToast('请输入用户 ID。', 'error');
      return;
    }

    if (!Number.isFinite(steps) || steps <= 0) {
      showToast('请输入有效的步数。', 'error');
      return;
    }

    if (!dayjs(recordTime).isValid()) {
      showToast('请选择有效的记录时间。', 'error');
      return;
    }

    const draft: StepRecordDraft = {
      userId,
      steps,
      hour: selectedHour,
      recordTime,
    };

    const duplicate = findDuplicateStepRecord(normalizedData.records, draft);
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
        subtitle="把原型页重构进当前 LifeOS 体系，并恢复用户 ID 维度的录入、统计和记录管理能力。"
      />

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizeStepUserId(normalizedData.settings.activeUserId) || '-',
            helper: '录入区按这个用户 ID 创建步数记录',
          },
          {
            label: '本月累计',
            value: compareSummary.currentSteps.toLocaleString(),
            helper: `${compareSummary.currentLabel} / ${compareSummary.currentDistanceKm} 公里`,
          },
          {
            label: '近 7 天步数',
            value: recentSevenDaySteps.toLocaleString(),
            helper: '按当前用户最近七天记录自动汇总',
          },
          {
            label: '当前用户记录数',
            value: `${activeUserRecords.length}`,
            helper: `当前步幅 ${normalizedData.settings.strideLength} m`,
          },
        ]}
      />

      <StepEntryForm
        userId={normalizedData.settings.activeUserId}
        stepsInput={stepsInput}
        selectedHour={selectedHour}
        recordTime={recordTime}
        stepsInputRef={stepsInputRef}
        onUserIdChange={(value) => updateSettings({ activeUserId: value })}
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
        records={normalizedData.records}
        userId={normalizedData.settings.statsUserId}
        strideLength={normalizedData.settings.strideLength}
        onUserIdChange={(value) => updateSettings({ statsUserId: value })}
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
        records={normalizedData.records}
        filterUserId={normalizedData.settings.recordsUserId}
        strideLength={normalizedData.settings.strideLength}
        onFilterUserIdChange={(value) => updateSettings({ recordsUserId: value })}
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
        title="检测到该用户在同一时间段已有记录"
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
          description="同一用户在同一天的同一时间段只保留一条记录，确认后会用本次输入覆盖旧数据。"
        >
          <div className="step-duplicate-summary">
            <div className="status-metadata">
              <span>用户 ID：{pendingDuplicate?.draft.userId ?? '-'}</span>
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
