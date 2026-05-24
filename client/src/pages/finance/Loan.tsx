import { useMemo, useState } from 'react';

import { NotificationStatusCard } from '../../components/NotificationStatusCard';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { SettingSwitchCard } from '../../components/SettingSwitchCard';
import { Btn, DataTable, Field, PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { LoanPageState } from '../../types/pages';

const STORAGE_KEY = 'lifeos_loan_page';

const initialState: LoanPageState = {
  bills: [
    { id: 'loan-1', platform: '花呗', dueDate: '2026-05-26', amount: 1680, paid: false },
    { id: 'loan-2', platform: '借呗', dueDate: '2026-05-29', amount: 4200, paid: false },
    { id: 'loan-3', platform: '京东白条', dueDate: '2026-05-18', amount: 980, paid: false },
    { id: 'loan-4', platform: '微粒贷', dueDate: '2026-05-10', amount: 2500, paid: true },
  ],
  settings: {
    repaymentReminderEnabled: true,
    overdueReminderEnabled: true,
    autoRepaymentOnMarkPaid: true,
    notificationFrequency: 'daily',
    upcomingDays: 7,
  },
};

const tabOptions = [
  { value: 'overview', label: '概览' },
  { value: 'bills', label: '账单' },
  { value: 'settings', label: '设置' },
] as const;

export default function LoanPage() {
  const [data, setData] = useLocalStorageState<LoanPageState>(STORAGE_KEY, initialState);
  const [tab, setTab] = usePageTab('overview', tabOptions.map((item) => item.value));
  const { toast, showToast } = useToastState();
  const [editingDays, setEditingDays] = useState(String(data.settings.upcomingDays));

  const upcomingBills = useMemo(
    () => data.bills.filter((bill) => !bill.paid),
    [data.bills],
  );

  const overdueBills = useMemo(
    () => data.bills.filter((bill) => !bill.paid && new Date(bill.dueDate).getTime() < Date.now()),
    [data.bills],
  );

  const totalUnpaid = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <div className="page-stack">
      <PageHeader
        title="贷款还款"
        subtitle="提醒配置已收敛为通知中心发送，页面只保留业务规则、开关和账单操作。"
        actions={(
          <div className="inline-row">
            <Btn
              tone="secondary"
              onClick={() => {
                const result = enqueueSceneNotification('loan.repayment_upcoming', {
                  message: `当前有 ${upcomingBills.length} 笔待还账单，总额 ¥${totalUnpaid.toFixed(2)}。`,
                });
                showToast(result.some((item) => item.status === 'success') ? '还款提醒已进入通知中心。' : '还款提醒未发送，请检查通知中心渠道。', result.some((item) => item.status === 'success') ? 'success' : 'error');
              }}
            >
              模拟还款提醒
            </Btn>
            <Btn
              tone="primary"
              onClick={() => {
                const result = enqueueSceneNotification('loan.repayment_overdue', {
                  message: `当前有 ${overdueBills.length} 笔逾期账单，请尽快处理。`,
                });
                showToast(result.some((item) => item.status === 'success') ? '逾期提醒已进入通知中心。' : '逾期提醒未发送，请检查通知中心渠道。', result.some((item) => item.status === 'success') ? 'success' : 'error');
              }}
            >
              模拟逾期提醒
            </Btn>
          </div>
        )}
      />

      <PillTabs
        options={tabOptions.map((item) => ({ value: item.value, label: item.label }))}
        value={tab}
        onChange={(value) => setTab(value as (typeof tabOptions)[number]['value'])}
      />

      {tab === 'overview' ? (
        <>
          <StatGrid
            items={[
              { label: '待还账单', value: `${upcomingBills.length}` },
              { label: '逾期账单', value: `${overdueBills.length}`, helper: '会触发高优先级提醒' },
              { label: '待还总额', value: `¥${totalUnpaid.toFixed(2)}` },
            ]}
          />
          <SectionCard title="近期账单" description="可以在这里确认是否已还款，自动记账开关会直接影响标记行为。">
            <DataTable
              rowKey="id"
              data={data.bills}
              columns={[
                { key: 'platform', title: '平台', dataIndex: 'platform' },
                { key: 'dueDate', title: '到期日', dataIndex: 'dueDate' },
                {
                  key: 'amount',
                  title: '金额',
                  dataIndex: 'amount',
                  render: (value) => `¥${Number(value).toFixed(2)}`,
                },
                {
                  key: 'status',
                  title: '状态',
                  render: (_, row) => (
                    row.paid ? '已还款' : (new Date(String(row.dueDate)).getTime() < Date.now() ? '已逾期' : '待还款')
                  ),
                },
                {
                  key: 'actions',
                  title: '操作',
                  render: (_, row) => (
                    <Btn
                      tone="secondary"
                      disabled={Boolean(row.paid)}
                      onClick={() => {
                        setData((previous) => ({
                          ...previous,
                          bills: previous.bills.map((bill) => (
                            bill.id === row.id ? { ...bill, paid: true } : bill
                          )),
                        }));
                        showToast(data.settings.autoRepaymentOnMarkPaid ? '账单已标记为已还款，并按当前规则自动联动。' : '账单已标记为已还款。');
                      }}
                    >
                      标记已还
                    </Btn>
                  ),
                },
              ]}
            />
          </SectionCard>
        </>
      ) : null}

      {tab === 'bills' ? (
        <SectionCard title="账单规则" description="用统一规则梳理提醒频率和提前天数。">
          <div className="form-grid">
            <label className="field">
              <span className="field-label">提醒频率</span>
              <select
                value={data.settings.notificationFrequency}
                onChange={(event) => {
                  setData((previous) => ({
                    ...previous,
                    settings: {
                      ...previous.settings,
                      notificationFrequency: event.target.value as 'daily' | 'always',
                    },
                  }));
                }}
              >
                <option value="daily">每天一次</option>
                <option value="always">每次进入</option>
              </select>
            </label>
            <Field
              label="提前提醒天数"
              type="number"
              value={editingDays}
              onChange={(event) => {
                setEditingDays(event.target.value);
                setData((previous) => ({
                  ...previous,
                  settings: {
                    ...previous.settings,
                    upcomingDays: Number(event.target.value),
                  },
                }));
              }}
            />
          </div>
        </SectionCard>
      ) : null}

      {tab === 'settings' ? (
        <div className="page-stack">
          <SettingSwitchCard
            title="还款提醒"
            description="在还款日前按频率向通知中心发起统一提醒。"
            checked={data.settings.repaymentReminderEnabled}
            onChange={(checked) => {
              setData((previous) => ({
                ...previous,
                settings: {
                  ...previous.settings,
                  repaymentReminderEnabled: checked,
                },
              }));
              updateSceneConfig('loan.repayment_upcoming', { enabled: checked });
              showToast(`还款提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={data.settings.repaymentReminderEnabled ? '已启用' : '已停用'}
            impact="关闭后，业务页不再对临近账单发起提醒请求，但通知中心中的场景记录仍然保留。"
          >
            <div className="form-grid">
              <Field
                label="提前提醒天数"
                type="number"
                value={data.settings.upcomingDays}
                onChange={(event) => {
                  setData((previous) => ({
                    ...previous,
                    settings: {
                      ...previous.settings,
                      upcomingDays: Number(event.target.value),
                    },
                  }));
                }}
              />
              <label className="field">
                <span className="field-label">提醒频率</span>
                <select
                  value={data.settings.notificationFrequency}
                  onChange={(event) => {
                    setData((previous) => ({
                      ...previous,
                      settings: {
                        ...previous.settings,
                        notificationFrequency: event.target.value as 'daily' | 'always',
                      },
                    }));
                  }}
                >
                  <option value="daily">每天一次</option>
                  <option value="always">每次进入</option>
                </select>
              </label>
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="loan.repayment_upcoming"
            title="还款提醒的通知中心状态"
            summary="查看当前已绑定的渠道，以及通知中心是否能完成统一发送。"
          />

          <SettingSwitchCard
            title="逾期提醒"
            description="用于逾期账单的高优先级提醒。"
            checked={data.settings.overdueReminderEnabled}
            onChange={(checked) => {
              setData((previous) => ({
                ...previous,
                settings: {
                  ...previous.settings,
                  overdueReminderEnabled: checked,
                },
              }));
              updateSceneConfig('loan.repayment_overdue', { enabled: checked });
              showToast(`逾期提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={data.settings.overdueReminderEnabled ? '已启用' : '已停用'}
            impact="关闭后，逾期账单仍会在页面中显示，但不再向通知中心发起高优先级告警。"
          />

          <NotificationStatusCard
            sceneId="loan.repayment_overdue"
            title="逾期提醒的通知中心状态"
            summary="建议至少绑定一个高优先级渠道，例如企业微信或 Webhook。"
          />

          <SettingSwitchCard
            title="标记已还时自动联动"
            description="控制账单手动标记为已还时，是否同步执行自动记账动作。"
            checked={data.settings.autoRepaymentOnMarkPaid}
            onChange={(checked) => {
              setData((previous) => ({
                ...previous,
                settings: {
                  ...previous.settings,
                  autoRepaymentOnMarkPaid: checked,
                },
              }));
              showToast(`自动联动已${checked ? '启用' : '停用'}。`);
            }}
            statusText={data.settings.autoRepaymentOnMarkPaid ? '自动联动中' : '仅更新账单状态'}
            impact="这是业务联动开关，不会直接发送通知，但会影响标记账单后的系统行为，因此同样需要明显提示。"
          />
        </div>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
