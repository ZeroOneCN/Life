import { useState } from 'react';

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
  const [activeTab, setActiveTab] = useState<PlanningTab>('budget');

  return (
    <div className="page-stack finance-merged-page">
      <PageHeader
        title="财务规划"
        subtitle="预算管理与储蓄目标，规划你的财务未来"
        actions={(
          <div style={{ width: 240 }}>
            <PillTabs
              options={TAB_OPTIONS}
              value={activeTab}
              onChange={(v) => setActiveTab(v as PlanningTab)}
            />
          </div>
        )}
      />

      <div className="merged-content">
        {activeTab === 'budget' ? <BudgetPage /> : null}
        {activeTab === 'goal' ? <GoalPage /> : null}
      </div>
    </div>
  );
}
