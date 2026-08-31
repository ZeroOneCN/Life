import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;

import { FitnessDashboardSection } from '../../components/health/FitnessDashboardSection';
import { FitnessDietSection } from '../../components/health/FitnessDietSection';
import { FitnessExerciseSection } from '../../components/health/FitnessExerciseSection';
import { FitnessShoppingSection } from '../../components/health/FitnessShoppingSection';
import { FitnessWeightSection } from '../../components/health/FitnessWeightSection';
import { PageHeader, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { createSyncCollection } from '../../lib/collection';
import { fitnessApi } from '../../services/fitnessApi';
import type {
  DietRecord,
  ExerciseRecord,
  FitnessOverviewSummary,
  FitnessPageState,
  FitnessShoppingRecord,
  FitnessTab,
  WeightRecord,
} from '../../types/fitness';

const TAB_OPTIONS: Array<{ value: FitnessTab; label: string }> = [
  { value: 'diet', label: '饮食记录' },
  { value: 'exercise', label: '运动记录' },
  { value: 'shopping', label: '食材采购' },
  { value: 'weight', label: '体重记录' },
  { value: 'dashboard', label: '数据看板' },
];

const EMPTY_SETTINGS: FitnessPageState['settings'] = {
  defaultHeightCm: 170,
};

const EMPTY_OVERVIEW: FitnessOverviewSummary = {
  todayCaloriesIn: 0,
  todayCaloriesOut: 0,
  todayNetCalories: 0,
  latestWeightKg: null,
  bmi: null,
  weekAverageNetCalories: 0,
  monthShoppingAmount: 0,
  todayDietCost: 0,
  trackedDays: 0,
};

export default function FitnessPage() {
  const [innerTab, setInnerTab] = usePageTab<FitnessTab>(
    'diet',
    TAB_OPTIONS.map((item) => item.value),
    'fitnessTab',
  );
  const [dietRecords, setDietRecords] = useState<DietRecord[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([]);
  const [shoppingRecords, setShoppingRecords] = useState<FitnessShoppingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [settings, setSettings] = useState<FitnessPageState['settings']>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<FitnessOverviewSummary>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [nextDiet, nextExercise, nextShopping, nextWeight, nextSummary, nextSettings] =
      await Promise.all([
        fitnessApi.listDietRecords({ page: 1, page_size: 100 }),
        fitnessApi.listExerciseRecords({ page: 1, page_size: 100 }),
        fitnessApi.listShoppingRecords({ page: 1, page_size: 100 }),
        fitnessApi.listWeightRecords({ page: 1, page_size: 100 }),
        fitnessApi.getSummary(),
        fitnessApi.getSettings(),
      ]);

    setDietRecords(nextDiet.items);
    setExerciseRecords(nextExercise.items);
    setShoppingRecords(nextShopping.items);
    setWeightRecords(nextWeight.items);
    setOverview(nextSummary);
    setSettings({
      ...EMPTY_SETTINGS,
      ...nextSettings,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
      } catch (error) {
        if (!cancelled) {
          showToast(buildApiErrorMessage(error, '健身页加载失败。'), 'error');
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
  }, [reload]);

  const updateSettings = useCallback(
    async (patch: Partial<FitnessPageState['settings']>) => {
      try {
        const next = await fitnessApi.updateSettings(patch);
        setSettings((current) => ({
          ...current,
          ...next,
        }));
        await reload();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '健身设置保存失败。'), 'error');
      }
    },
    [reload, showToast],
  );

  const syncCollection = useMemo(
    () => createSyncCollection({ reload, showToast }),
    [reload, showToast],
  );

  const topSummary = useMemo(
    () => [
      {
        label: '今日净热量',
        value: `${overview.todayNetCalories.toFixed(0)} kcal`,
        helper: `摄入${overview.todayCaloriesIn.toFixed(0)} / 消耗${overview.todayCaloriesOut.toFixed(0)}`,
      },
      {
        label: '最新体重',
        value: overview.latestWeightKg === null ? '-' : `${overview.latestWeightKg.toFixed(2)} kg`,
        helper: overview.bmi === null ? '暂无 BMI' : `BMI ${overview.bmi.toFixed(1)}`,
      },
      {
        label: '跟踪天数',
        value: `${overview.trackedDays}`,
        helper: `本月采购 ¥${overview.monthShoppingAmount.toFixed(2)}`,
      },
      {
        label: '目标状态',
        value:
          overview.todayNetCalories < 0
            ? '消耗中'
            : overview.todayNetCalories > 0
              ? '盈余中'
              : '平衡',
      },
    ],
    [overview],
  );

  return (
    <div className="page-grid-wrapper">
      <Row gutter={[24, 20]}>
        <PageHeader
          title="运动健身"
          subtitle="记录饮食、运动与体重数据，追踪健康进展"
          actions={
            <PillTabs
              options={TAB_OPTIONS}
              value={innerTab}
              onChange={(value) => setInnerTab(value as FitnessTab)}
            />
          }
        />

        <Col span={24}>
          <StatGrid className="fitness-overview-grid" items={topSummary} />
        </Col>

        {innerTab === 'diet' ? (
          <Col span={24}>
            <FitnessDietSection
              records={dietRecords}
              onChangeRecords={(updater) => {
                const previous = dietRecords;
                const next = updater(previous);
                setDietRecords(next);
                void syncCollection(
                  previous,
                  next,
                  (item) => fitnessApi.createDietRecord(item),
                  (item) => fitnessApi.updateDietRecord(item.id, item),
                  (id) => fitnessApi.deleteDietRecord(id),
                  '饮食记录保存失败。',
                );
              }}
              showToast={showToast}
            />
          </Col>
        ) : null}

        {innerTab === 'exercise' ? (
          <Col span={24}>
            <FitnessExerciseSection
              records={exerciseRecords}
              onChangeRecords={(updater) => {
                const previous = exerciseRecords;
                const next = updater(previous);
                setExerciseRecords(next);
                void syncCollection(
                  previous,
                  next,
                  (item) => fitnessApi.createExerciseRecord(item),
                  (item) => fitnessApi.updateExerciseRecord(item.id, item),
                  (id) => fitnessApi.deleteExerciseRecord(id),
                  '运动记录保存失败。',
                );
              }}
              showToast={showToast}
            />
          </Col>
        ) : null}

        {innerTab === 'shopping' ? (
          <Col span={24}>
            <FitnessShoppingSection
              records={shoppingRecords}
              onChangeRecords={(updater) => {
                const previous = shoppingRecords;
                const next = updater(previous);
                setShoppingRecords(next);
                void syncCollection(
                  previous,
                  next,
                  (item) => fitnessApi.createShoppingRecord(item),
                  (item) => fitnessApi.updateShoppingRecord(item.id, item),
                  (id) => fitnessApi.deleteShoppingRecord(id),
                  '食材采购记录保存失败。',
                );
              }}
              showToast={showToast}
            />
          </Col>
        ) : null}

        {innerTab === 'weight' ? (
          <Col span={24}>
            <FitnessWeightSection
              defaultHeightCm={settings.defaultHeightCm ?? 170}
              records={weightRecords}
              onChangeRecords={(updater) => {
                const previous = weightRecords;
                const next = updater(previous);
                setWeightRecords(next);
                void syncCollection(
                  previous,
                  next,
                  (item) => fitnessApi.createWeightRecord(item),
                  (item) => fitnessApi.updateWeightRecord(item.id, item),
                  (id) => fitnessApi.deleteWeightRecord(id),
                  '体重记录保存失败。',
                );
              }}
              onDefaultHeightChange={(value) => {
                void updateSettings({ defaultHeightCm: value });
              }}
              showToast={showToast}
            />
          </Col>
        ) : null}

        {innerTab === 'dashboard' ? (
          <Col span={24}>
            <FitnessDashboardSection
              defaultHeightCm={settings.defaultHeightCm ?? 170}
              dietRecords={dietRecords}
              exerciseRecords={exerciseRecords}
              shoppingRecords={shoppingRecords}
              weightRecords={weightRecords}
            />
          </Col>
        ) : null}

        <Col span={24}>
          <Toast toast={toast} />
        </Col>
      </Row>
    </div>
  );
}
