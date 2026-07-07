import { useRef, useState } from 'react';

import { PageHeader } from '../../components/page';
import { Btn, PillTabs } from '../../components/ui';
import ShoppingPage from './Shopping';
import TravelPage from './Travel';

type ExpenseTab = 'shopping' | 'travel';

const TAB_OPTIONS: Array<{ value: ExpenseTab; label: string }> = [
  { value: 'shopping', label: '网上购物' },
  { value: 'travel', label: '旅行游玩' },
];

export default function ExpensePage() {
  const [activeTab, setActiveTab] = useState<ExpenseTab>('shopping');
  const shoppingRef = useRef<{ openImportModal: () => void }>(null);

  const handleImportExcel = () => {
    shoppingRef.current?.openImportModal();
  };

  return (
    <div className="page-stack finance-merged-page">
      <PageHeader
        title="消费记录"
        subtitle="购物消费与旅行支出统一管理"
        actions={(
          <>
            {activeTab === 'shopping' && (
              <Btn tone="secondary" onClick={handleImportExcel}>导入 Excel</Btn>
            )}
            <PillTabs
              options={TAB_OPTIONS}
              value={activeTab}
              onChange={(v) => setActiveTab(v as ExpenseTab)}
            />
          </>
        )}
      />

      <div className="merged-content">
        {activeTab === 'shopping' ? <ShoppingPage ref={shoppingRef} hideHeader /> : null}
        {activeTab === 'travel' ? <TravelPage /> : null}
      </div>
    </div>
  );
}
