import { usePageTab } from '../../hooks/usePageTab';
import { PageHeader } from '../../components/page';
import { PillTabs } from '../../components/ui';
import LoanPage from './Loan';
import SubscriptionPage from './Subscription';
import RentPage from './Rent';

type BillMgmtTab = 'loan' | 'subscription' | 'rent';

const TAB_OPTIONS: Array<{ value: BillMgmtTab; label: string }> = [
  { value: 'loan', label: '贷款还款' },
  { value: 'subscription', label: '服务订阅' },
  { value: 'rent', label: '房租水电' },
];

export default function BillManagementPage() {
  const [activeTab, setActiveTab] = usePageTab<BillMgmtTab>('loan', ['loan', 'subscription', 'rent'], 'billMgmtTab');

  return (
    <div className="page-stack finance-merged-page">
      <PageHeader
        title="账单管理"
        subtitle="统一管理贷款、订阅与房租账单"
        actions={(
          <PillTabs
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as BillMgmtTab)}
          />
        )}
      />

      <div className="merged-content">
        {activeTab === 'loan' ? <LoanPage /> : null}
        {activeTab === 'subscription' ? <SubscriptionPage /> : null}
        {activeTab === 'rent' ? <RentPage /> : null}
      </div>
    </div>
  );
}
