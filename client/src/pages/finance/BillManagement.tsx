import { usePageTab } from '../../hooks/usePageTab';
import { PageHeader } from '../../components/page';
import { PillTabs } from '../../components/ui';
import { useSearchParams } from 'react-router-dom';
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
  const [activeTab] = usePageTab<BillMgmtTab>('loan', ['loan', 'subscription', 'rent'], 'billMgmtTab');
  const [, setSearchParams] = useSearchParams();

  /**
   * 切换主 Tab 时清空各子页面的嵌套 Tab 参数（loanTab/rentTab/subscriptionTab），
   * 保证点击主 Tab 即可返回对应子页面默认视图。
   */
  const handleTabChange = (value: string) => {
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.delete('loanTab');
    nextParams.delete('rentTab');
    nextParams.delete('subscriptionTab');
    nextParams.set('billMgmtTab', value);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="page-stack finance-merged-page">
      <PageHeader
        title="账单管理"
        subtitle="统一管理贷款、订阅与房租账单"
        actions={(
          <PillTabs
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={handleTabChange}
          />
        )}
      />

      <div className="merged-content">
        {activeTab === 'loan' ? <LoanPage embedded /> : null}
        {activeTab === 'subscription' ? <SubscriptionPage embedded /> : null}
        {activeTab === 'rent' ? <RentPage embedded /> : null}
      </div>
    </div>
  );
}
