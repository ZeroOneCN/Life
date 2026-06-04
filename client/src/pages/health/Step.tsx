import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { StepEntryForm } from '../../components/health/StepEntryForm';
import { StepRecordsSection } from '../../components/health/StepRecordsSection';
import { StepTrendSection } from '../../components/health/StepTrendSection';
import { PageHeader, StatGrid } from '../../components/page';
import { Btn, Modal, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { getAuthUserDisplayName, useAuthState } from '../../services/auth';
import { stepApi } from '../../services/stepApi';
import {
  buildStepRecordTime,
  getNextStepHour,
  getTodayEndDateTime,
  inferStepHourFromRecordTime,
} from '../../services/stepRecords';
import type {
  StepHour,
  StepMonthCompareSummary,
  StepPageState,
  StepRecord,
  StepRecordDraft,
} from '../../types/health';

const EMPTY_SETTINGS: StepPageState['settings'] = {
  strideLength: 0.7,
  activeUserId: '',
  statsUserId: '',
  recordsUserId: '',
};

const EMPTY_COMPARE: StepMonthCompareSummary = {
  currentLabel: '',
  previousLabel: '',
  currentSteps: 0,
  previousSteps: 0,
  currentDistanceKm: 0,
  previousDistanceKm: 0,
  changePercentage: null,
  trend: 'none',
};

/** 获取快速录入的记录时间 */
function getQuickRecordTime(hour: StepHour, previousDay = false) {
  const base = previousDay ? dayjs().subtract(1, 'day') : dayjs();
  const seed = base.format('YYYY-MM-DDTHH:mm');

  if (hour === null) {
    return buildStepRecordTime(seed, null, 59);
  }

  return buildStepRecordTime(seed, hour, 0);
}

export default function StepPage() {
  const authState = useAuthState();
  const currentUserLabel = getAuthUserDisplayName(authState.session?.user, '当前登录用户');
  const [settings, setSettings] = useState<StepPageState['settings']>(EMPTY_SETTINGS);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    todaySteps: 0,
    todayDistanceKm: 0,
    currentMonthSteps: 0,
    currentMonthDistanceKm: 0,
    strideLength: 0.7,
  });
  const [compareSummary, setCompareSummary] = useState<StepMonthCompareSummary>(EMPTY_COMPARE);
  const [stepsInput, setStepsInput] = useState('');
  const [selectedHour, setSelectedHour] = useState<StepHour>(null);
  const [recordTime, setRecordTime] = useState(getTodayEndDateTime());
  const [pendingDuplicate, setPendingDuplicate] = useState<{ existing: StepRecord; draft: StepRecordDraft } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const stepsInputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast: showToastUnstable } = useToastState();

  /** 用 ref 稳定 showToast 引用，避免因引用变化导致 useEffect 无限循环 */
  const showToastRef = useRef(showToastUnstable);
  showToastRef.current = showToastUnstable;
  const showToast = useCallback((...args: Parameters<typeof showToastUnstable>) => {
    showToastRef.current(...args);
  }, []);

  /**
   * 加载页面核心数据（设置、摘要、环比）。
   * 不再一次性加载全部 records，改为各子组件按需请求后端分页 API。
   */
  const reload = useCallback(async () => {
    const nextSettings = await stepApi.getSettings();
    const statsUserId = nextSettings.statsUserId || nextSettings.activeUserId || '';

    const [nextSummary, nextCompare] = await Promise.all([
      stepApi.getSummary({ userId: statsUserId }),
      stepApi.getMonthCompare({ userId: statsUserId }),
    ]);

    setSummary(nextSummary);
    setCompareSummary(nextCompare);
    setSettings({
      ...EMPTY_SETTINGS,
      ...nextSettings,
    });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
      } catch (error) {
        if (!cancelled) {
          showToast(buildApiErrorMessage(error, '步数页面加载失败。'), 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reload, showToast]);

  const focusStepsInput = () => {
    window.setTimeout(() => {
      stepsInputRef.current?.focus();
      stepsInputRef.current?.select();
    }, 0);
  };

  const updateSettings = useCallback(async (patch: Partial<StepPageState['settings']>) => {
    try {
      const next = await stepApi.updateSettings(patch);
      setSettings((current) => ({
        ...current,
        ...next,
      }));
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '步数设置保存失败。'), 'error');
    }
  }, [reload, showToast]);

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

  const persistCreate = useCallback(async (draft: StepRecordDraft) => {
    try {
      await stepApi.createRecord(draft);
      await reload();
      resetEntryState(draft.hour);
      showToast('步数记录已保存。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '步数记录保存失败。'), 'error');
    }
  }, [reload, showToast]);

  const handleCreateRecord = () => {
    const steps = Number(stepsInput);

    if (!settings.activeUserId.trim()) {
      showToast('请先填写录入用户。', 'error');
      return;
    }

    if (!Number.isFinite(steps) || steps < 0) {
      showToast('请输入有效的步数。', 'error');
      return;
    }

    if (!dayjs(recordTime).isValid()) {
      showToast('请选择有效的记录时间。', 'error');
      return;
    }

    const draft: StepRecordDraft = {
      userId: settings.activeUserId,
      steps,
      hour: selectedHour,
      recordTime,
    };

    // 直接提交，后端已有重复检测（409），无需前端全量加载来做重复判断
    void persistCreate(draft);
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="运动步数"
        subtitle={loading ? '正在加载步数数据...' : '记录每日步数，统计运动趋势和健康目标。'}
      />

      <StatGrid
        items={[
          {
            label: '当前录入用户',
            value: currentUserLabel,
            helper: '新增步数记录默认写入当前登录用户的步数档案。',
          },
          {
            label: '本月累计',
            value: summary.currentMonthSteps.toLocaleString(),
            helper: `${summary.currentMonthDistanceKm.toFixed(2)} 公里`,
          },
          {
            label: '今日步数',
            value: summary.todaySteps.toLocaleString(),
            helper: `${summary.todayDistanceKm.toFixed(2)} 公里`,
          },
          {
            label: '环比变化',
            value: compareSummary.changePercentage === null ? '-' : `${compareSummary.changePercentage}%`,
            helper: compareSummary.currentLabel && compareSummary.previousLabel
              ? `${compareSummary.currentLabel} 对比 ${compareSummary.previousLabel}`
              : '等待历史记录形成对比',
          },
        ]}
      />

      <StepEntryForm
        currentUserLabel={currentUserLabel}
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
        showToast={showToast}
      />

      <StepTrendSection
        reloadKey={reloadKey}
        userId={settings.statsUserId}
        strideLength={settings.strideLength}
        onUserIdChange={(value) => {
          void updateSettings({ statsUserId: value });
        }}
        onStrideLengthChange={(value) => {
          void updateSettings({ strideLength: value });
        }}
        showToast={showToast}
      />

      <StepRecordsSection
        reloadKey={reloadKey}
        filterUserId={settings.recordsUserId}
        strideLength={settings.strideLength}
        onFilterUserIdChange={(value) => {
          void updateSettings({ recordsUserId: value });
        }}
        onUpdateRecord={(id, draft) => {
          void (async () => {
            try {
              await stepApi.updateRecord(id, draft);
              await reload();
              showToast('记录已更新。');
            } catch (error) {
              showToast(buildApiErrorMessage(error, '步数记录更新失败。'), 'error');
            }
          })();
        }}
        onDeleteRecord={(id) => {
          void (async () => {
            try {
              await stepApi.deleteRecord(id);
              await reload();
              showToast('记录已删除。');
            } catch (error) {
              showToast(buildApiErrorMessage(error, '步数记录删除失败。'), 'error');
            }
          })();
        }}
        onDeleteRecords={(ids) => {
          void (async () => {
            try {
              await Promise.all(ids.map((id) => stepApi.deleteRecord(id)));
              await reload();
              showToast('批量删除已完成。');
            } catch (error) {
              showToast(buildApiErrorMessage(error, '批量删除失败。'), 'error');
            }
          })();
        }}
        showToast={showToast}
      />

      <Modal
        open={Boolean(pendingDuplicate)}
        onClose={() => setPendingDuplicate(null)}
        title="发现重复时间段记录"
        width={520}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setPendingDuplicate(null)}>取消</Btn>
            <Btn
              tone="primary"
              onClick={() => {
                const draft = pendingDuplicate?.draft;
                setPendingDuplicate(null);
                if (draft) {
                  void persistCreate(draft);
                }
              }}
            >
              继续保存
            </Btn>
          </>
        )}
      >
        <p className="subtle-text">
          当前用户在同一天的同一时间段已经有记录。若继续保存，后端会再新增一条记录，请先确认是否符合你的录入意图。
        </p>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
