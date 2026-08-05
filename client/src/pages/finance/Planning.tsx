import { usePageTab } from '../../hooks/usePageTab';
import { PageHeader } from '../../components/page';
import { PillTabs } from '../../components/ui';
import BudgetPage from './Budget';
import GoalPage from './Goal';

type PlanningTab = 'budget' | 'goal';

const TAB_OPTIONS: Array<{ value: PlanningTab; label: string }> = [
  { value: 'budget', label: '预算管理' },
  { value: 'goal', label: '储蓄目标' },
];

export default function PlanningPage() {
  const [activeTab, setActiveTab] = usePageTab<PlanningTab>('budget', ['budget', 'goal'], 'planningTab');

  return (
    <div className="page-stack finance-merged-page">
      <PageHeader title="财务规划" subtitle="预算管理与储蓄目标，规划你的财务未来" />

      <div className="merged-content">
        <div className="merged-tabs-top">
          <PillTabs
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as PlanningTab)}
          />
        </div>
        {activeTab === 'budget' ? <BudgetPage embedded /> : null}
        {activeTab === 'goal' ? <GoalPage embedded /> : null}
      </div>
    </div>
  );
}
