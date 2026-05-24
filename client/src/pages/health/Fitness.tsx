import { useEffect, useMemo, useState } from 'react';

import { FitnessDashboardSection } from '../../components/health/FitnessDashboardSection';
import { FitnessDietSection } from '../../components/health/FitnessDietSection';
import { FitnessExerciseSection } from '../../components/health/FitnessExerciseSection';
import { FitnessShoppingSection } from '../../components/health/FitnessShoppingSection';
import { FitnessWeightSection } from '../../components/health/FitnessWeightSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Field, Modal, PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildFitnessInsights,
  buildFitnessOverviewSummary,
  buildInitialFitnessState,
  filterRecordsByUserId,
  normalizeFitnessPageState,
  normalizeFitnessUserId,
} from '../../services/fitness';
import type { FitnessPageState, FitnessTab } from '../../types/fitness';

const STORAGE_KEY = 'lifeos_health_fitness_page';
const TAB_OPTIONS: Array<{ value: FitnessTab; label: string }> = [
  { value: 'diet', label: '饮食记录' },
  { value: 'exercise', label: '运动记录' },
  { value: 'shopping', label: '食材采购' },
  { value: 'weight', label: '体重记录' },
  { value: 'dashboard', label: '数据看板' },
];

export default function FitnessPage() {
  const [data, setData] = useLocalStorageState<FitnessPageState>(STORAGE_KEY, buildInitialFitnessState);
  const [activeTab, setActiveTab] = usePageTab<FitnessTab>('diet', TAB_OPTIONS.map((item) => item.value), 'fitnessTab');
  const [insightsOpen, setInsightsOpen] = useState(false);
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeFitnessPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const activeDietRecords = useMemo(
    () => filterRecordsByUserId(normalizedData.dietRecords, normalizedData.settings.activeUserId),
    [normalizedData.dietRecords, normalizedData.settings.activeUserId],
  );
  const activeExerciseRecords = useMemo(
    () => filterRecordsByUserId(normalizedData.exerciseRecords, normalizedData.settings.activeUserId),
    [normalizedData.exerciseRecords, normalizedData.settings.activeUserId],
  );
  const activeShoppingRecords = useMemo(
    () => filterRecordsByUserId(normalizedData.shoppingRecords, normalizedData.settings.activeUserId),
    [normalizedData.settings.activeUserId, normalizedData.shoppingRecords],
  );
  const activeWeightRecords = useMemo(
    () => filterRecordsByUserId(normalizedData.weightRecords, normalizedData.settings.activeUserId),
    [normalizedData.settings.activeUserId, normalizedData.weightRecords],
  );

  const overview = useMemo(
    () => buildFitnessOverviewSummary(
      activeDietRecords,
      activeExerciseRecords,
      activeShoppingRecords,
      activeWeightRecords,
      normalizedData.settings.defaultHeightCm ?? 170,
    ),
    [
      activeDietRecords,
      activeExerciseRecords,
      activeShoppingRecords,
      activeWeightRecords,
      normalizedData.settings.defaultHeightCm,
    ],
  );

  const insights = useMemo(
    () => buildFitnessInsights(
      activeDietRecords,
      activeExerciseRecords,
      activeShoppingRecords,
      activeWeightRecords,
    ),
    [activeDietRecords, activeExerciseRecords, activeShoppingRecords, activeWeightRecords],
  );

  const updateSettings = (patch: Partial<FitnessPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="健身减脂"
        subtitle="将减脂原型页重构进当前 LifeOS 体系，统一管理饮食、运动、食材采购、体重和趋势看板。"
        actions={<Btn tone="primary" onClick={() => setInsightsOpen(true)}>查看健康建议</Btn>}
      />

      <SectionCard
        title="当前用户与默认设置"
        description="这里的当前用户会驱动四类新增记录，列表筛选和看板支持单独切换用户。"
        action={<Tag tone="blue">本地规则分析</Tag>}
      >
        <div className="form-grid">
          <Field
            label="当前用户 ID"
            placeholder="例如 user-001"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => updateSettings({ activeUserId: event.target.value })}
            hint="切换后，新增饮食、运动、采购和体重记录都会使用这个用户。"
          />
          <Field
            label="默认身高（cm）"
            type="number"
            min="1"
            value={String(normalizedData.settings.defaultHeightCm ?? 170)}
            onChange={(event) => updateSettings({ defaultHeightCm: Number(event.target.value) || 170 })}
            hint="体重记录新增表单会默认带出这个身高。"
          />
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizeFitnessUserId(normalizedData.settings.activeUserId) || '全部',
            helper: '顶部当前用户会影响本页四类新增记录',
          },
          {
            label: '今日摄入',
            value: `${overview.todayCaloriesIn.toFixed(0)} kcal`,
            helper: '按当前用户今日饮食记录汇总',
          },
          {
            label: '今日消耗',
            value: `${overview.todayCaloriesOut.toFixed(0)} kcal`,
            helper: '按当前用户今日运动记录汇总',
          },
          {
            label: '今日净热量',
            value: `${overview.todayNetCalories.toFixed(0)} kcal`,
            helper: `${overview.todayNetCalories > 0 ? '摄入大于消耗' : '消耗大于摄入'}`,
          },
          {
            label: '最新体重',
            value: overview.latestWeightKg === null ? '-' : `${overview.latestWeightKg.toFixed(1)} kg`,
            helper: overview.bmi === null ? '暂无 BMI' : `BMI ${overview.bmi.toFixed(1)}`,
          },
          {
            label: '本周净热量均值',
            value: `${overview.weekAverageNetCalories.toFixed(0)} kcal`,
            helper: '按近 7 天有记录的日期计算',
          },
          {
            label: '本月食材采购',
            value: `¥${overview.monthShoppingAmount.toFixed(2)}`,
            helper: '按当前用户本月采购记录汇总',
          },
          {
            label: '今日饮食成本',
            value: `¥${overview.todayDietCost.toFixed(2)}`,
            helper: '按饮食记录和采购单价推算',
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="在饮食、运动、采购、体重和看板之间切换，所有内容都基于当前系统的 TypeScript 与主题组件体系。"
      >
        <PillTabs options={TAB_OPTIONS} value={activeTab} onChange={(value) => setActiveTab(value as FitnessTab)} />
      </SectionCard>

      {activeTab === 'diet' ? (
        <FitnessDietSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.dietFilterUserId}
          records={normalizedData.dietRecords}
          onFilterUserIdChange={(value) => updateSettings({ dietFilterUserId: value })}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              dietRecords: updater(previous.dietRecords),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {activeTab === 'exercise' ? (
        <FitnessExerciseSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.exerciseFilterUserId}
          records={normalizedData.exerciseRecords}
          onFilterUserIdChange={(value) => updateSettings({ exerciseFilterUserId: value })}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              exerciseRecords: updater(previous.exerciseRecords),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {activeTab === 'shopping' ? (
        <FitnessShoppingSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.shoppingFilterUserId}
          records={normalizedData.shoppingRecords}
          onFilterUserIdChange={(value) => updateSettings({ shoppingFilterUserId: value })}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              shoppingRecords: updater(previous.shoppingRecords),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {activeTab === 'weight' ? (
        <FitnessWeightSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.weightFilterUserId}
          defaultHeightCm={normalizedData.settings.defaultHeightCm ?? 170}
          records={normalizedData.weightRecords}
          onFilterUserIdChange={(value) => updateSettings({ weightFilterUserId: value })}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              weightRecords: updater(previous.weightRecords),
            }));
          }}
          onDefaultHeightChange={(value) => updateSettings({ defaultHeightCm: value })}
          showToast={showToast}
        />
      ) : null}

      {activeTab === 'dashboard' ? (
        <FitnessDashboardSection
          userId={normalizedData.settings.dashboardUserId}
          defaultHeightCm={normalizedData.settings.defaultHeightCm ?? 170}
          dietRecords={normalizedData.dietRecords}
          exerciseRecords={normalizedData.exerciseRecords}
          shoppingRecords={normalizedData.shoppingRecords}
          weightRecords={normalizedData.weightRecords}
          onUserIdChange={(value) => updateSettings({ dashboardUserId: value })}
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
          <div className="callout callout-info">
            这是基于前端本地规则的结构化建议，不会调用任何后端 AI 接口。分析范围默认为当前用户近 7 天到近 30 天的记录变化。
          </div>

          <div className="fitness-insight-list">
            {insights.map((insight) => (
              <article key={insight.id} className="fitness-insight-card">
                <div className="fitness-insight-head">
                  <strong>{insight.title}</strong>
                  <Tag tone={insight.tone}>{insight.metric ?? '规则命中'}</Tag>
                </div>
                <p>{insight.description}</p>
              </article>
            ))}
          </div>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
