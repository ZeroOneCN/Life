import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FitnessDashboardSection } from '../../components/health/FitnessDashboardSection';
import { FitnessDietSection } from '../../components/health/FitnessDietSection';
import { FitnessExerciseSection } from '../../components/health/FitnessExerciseSection';
import { FitnessShoppingSection } from '../../components/health/FitnessShoppingSection';
import { FitnessWeightSection } from '../../components/health/FitnessWeightSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Modal, PillTabs, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { getAuthUserDisplayName, useAuthState } from '../../services/auth';
import { fitnessApi } from '../../services/fitnessApi';
import type {
  DietRecord,
  ExerciseRecord,
  FitnessInsight,
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
  activeUserId: '',
  dietFilterUserId: '',
  exerciseFilterUserId: '',
  shoppingFilterUserId: '',
  weightFilterUserId: '',
  dashboardUserId: '',
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

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

export default function FitnessPage() {
  const authState = useAuthState();
  const currentUserLabel = getAuthUserDisplayName(authState.session?.user, '当前登录用户');
  const [activeTab, setActiveTab] = usePageTab<FitnessTab>('diet', TAB_OPTIONS.map((item) => item.value), 'fitnessTab');
  const [dietRecords, setDietRecords] = useState<DietRecord[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([]);
  const [shoppingRecords, setShoppingRecords] = useState<FitnessShoppingRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [settings, setSettings] = useState<FitnessPageState['settings']>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<FitnessOverviewSummary>(EMPTY_OVERVIEW);
  const [insights, setInsights] = useState<FitnessInsight[]>([]);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [nextDiet, nextExercise, nextShopping, nextWeight, nextSummary, nextInsights, nextSettings] = await Promise.all([
      fitnessApi.listDietRecords({ page: 1, page_size: 100 }),
      fitnessApi.listExerciseRecords({ page: 1, page_size: 100 }),
      fitnessApi.listShoppingRecords({ page: 1, page_size: 100 }),
      fitnessApi.listWeightRecords({ page: 1, page_size: 100 }),
      fitnessApi.getSummary(),
      fitnessApi.getInsights(),
      fitnessApi.getSettings(),
    ]);

    setDietRecords(nextDiet.items);
    setExerciseRecords(nextExercise.items);
    setShoppingRecords(nextShopping.items);
    setWeightRecords(nextWeight.items);
    setOverview(nextSummary);
    setInsights(nextInsights);
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

  const updateSettings = useCallback(async (patch: Partial<FitnessPageState['settings']>) => {
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
  }, [reload, showToast]);

  const syncCollection = useCallback(async <T extends { id: string }>(
    previous: T[],
    next: T[],
    createItem: (item: T) => Promise<unknown>,
    updateItem: (item: T) => Promise<unknown>,
    deleteItem: (id: string) => Promise<unknown>,
    errorMessage: string,
  ) => {
    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => createItem(item)),
        ...updated.map((item) => updateItem(item)),
        ...deletedIds.map((id) => deleteItem(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, errorMessage), 'error');
      await reload();
    }
  }, [reload, showToast]);

  const topSummary = useMemo(() => ([
    { label: '今日摄入', value: `${overview.todayCaloriesIn.toFixed(0)} kcal` },
    { label: '今日消耗', value: `${overview.todayCaloriesOut.toFixed(0)} kcal` },
    { label: '今日净热量', value: `${overview.todayNetCalories.toFixed(0)} kcal` },
    { label: '最新体重', value: overview.latestWeightKg === null ? '-' : `${overview.latestWeightKg.toFixed(1)} kg`, helper: overview.bmi === null ? '暂无 BMI' : `BMI ${overview.bmi.toFixed(1)}` },
    { label: '本月采购', value: `¥${overview.monthShoppingAmount.toFixed(2)}` },
    { label: '跟踪天数', value: `${overview.trackedDays}` },
  ]), [overview]);

  return (
    <div className="page-stack">
      <PageHeader
        title="健身减脂"
        subtitle={loading ? '正在从后端加载饮食、运动、食材采购和体重记录。' : '健身页已切到后端唯一数据源，不再读取浏览器业务本地数据。'}
        actions={<Btn tone="primary" onClick={() => setInsightsOpen(true)}>查看健康建议</Btn>}
      />

      <StatGrid className="fitness-overview-grid" items={topSummary} />

      <SectionCard
        title="业务视图"
        description="饮食、运动、采购、体重和看板都直接基于后端记录工作。"
      >
        <PillTabs options={TAB_OPTIONS} value={activeTab} onChange={(value) => setActiveTab(value as FitnessTab)} />
      </SectionCard>

      {activeTab === 'diet' ? (
        <FitnessDietSection
          currentUserLabel={currentUserLabel}
          activeUserId={settings.activeUserId}
          filterUserId={settings.dietFilterUserId}
          records={dietRecords}
          onFilterUserIdChange={(value) => {
            void updateSettings({ dietFilterUserId: value });
          }}
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
      ) : null}

      {activeTab === 'exercise' ? (
        <FitnessExerciseSection
          currentUserLabel={currentUserLabel}
          activeUserId={settings.activeUserId}
          filterUserId={settings.exerciseFilterUserId}
          records={exerciseRecords}
          onFilterUserIdChange={(value) => {
            void updateSettings({ exerciseFilterUserId: value });
          }}
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
      ) : null}

      {activeTab === 'shopping' ? (
        <FitnessShoppingSection
          currentUserLabel={currentUserLabel}
          activeUserId={settings.activeUserId}
          filterUserId={settings.shoppingFilterUserId}
          records={shoppingRecords}
          onFilterUserIdChange={(value) => {
            void updateSettings({ shoppingFilterUserId: value });
          }}
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
      ) : null}

      {activeTab === 'weight' ? (
        <FitnessWeightSection
          currentUserLabel={currentUserLabel}
          activeUserId={settings.activeUserId}
          filterUserId={settings.weightFilterUserId}
          defaultHeightCm={settings.defaultHeightCm ?? 170}
          records={weightRecords}
          onFilterUserIdChange={(value) => {
            void updateSettings({ weightFilterUserId: value });
          }}
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
      ) : null}

      {activeTab === 'dashboard' ? (
        <FitnessDashboardSection
          userId={settings.dashboardUserId}
          defaultHeightCm={settings.defaultHeightCm ?? 170}
          dietRecords={dietRecords}
          exerciseRecords={exerciseRecords}
          shoppingRecords={shoppingRecords}
          weightRecords={weightRecords}
          onUserIdChange={(value) => {
            void updateSettings({ dashboardUserId: value });
          }}
        />
      ) : null}

      <Modal
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        title="健康建议"
        width={720}
        footer={<Btn tone="secondary" onClick={() => setInsightsOpen(false)}>关闭</Btn>}
      >
        <div className="page-stack">
          {insights.map((insight) => (
            <article key={insight.id} className="fitness-insight-card">
              <div className="fitness-insight-head">
                <strong>{insight.title}</strong>
              </div>
              <p>{insight.description}</p>
            </article>
          ))}
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
