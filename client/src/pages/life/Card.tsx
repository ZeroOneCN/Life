import { useMemo } from 'react';

import { NotificationStatusCard } from '../../components/NotificationStatusCard';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { SettingSwitchCard } from '../../components/SettingSwitchCard';
import { Btn, DataTable, Field, PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { CardPageState } from '../../types/pages';

const STORAGE_KEY = 'lifeos_card_page';

const initialState: CardPageState = {
  cards: [
    { id: 'sim-1', phone: '18316426417', carrier: '中国移动', city: '上海', balance: 8.2, monthlyFee: 29, billingDay: 8, trafficPlan: '30GB/月' },
    { id: 'sim-2', phone: '13377632105', carrier: '中国电信', city: '北京', balance: 42.5, monthlyFee: 19, billingDay: 12, trafficPlan: '20GB/月' },
    { id: 'sim-3', phone: '15912345678', carrier: '中国联通', city: '深圳', balance: 5.9, monthlyFee: 39, billingDay: 23, trafficPlan: '100GB/月' },
  ],
  settings: {
    balanceLowEnabled: true,
    billingUpcomingEnabled: true,
    balanceThreshold: 10,
    notificationDaysBefore: 3,
  },
};

const tabOptions = [
  { value: 'cards', label: '号卡列表' },
  { value: 'settings', label: '提醒规则' },
] as const;

export default function CardPage() {
  const [data, setData] = useLocalStorageState<CardPageState>(STORAGE_KEY, initialState);
  const [tab, setTab] = usePageTab('cards', tabOptions.map((item) => item.value));
  const { toast, showToast } = useToastState();

  const lowBalanceCards = useMemo(
    () => data.cards.filter((card) => card.balance <= data.settings.balanceThreshold),
    [data.cards, data.settings.balanceThreshold],
  );

  const totalBalance = useMemo(
    () => data.cards.reduce((sum, card) => sum + card.balance, 0),
    [data.cards],
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="号卡管理"
        subtitle="通知渠道已迁入通知中心，这里保留业务规则和触发模拟。"
        actions={(
          <div className="inline-row">
            <Btn
              tone="secondary"
              onClick={() => {
                const result = enqueueSceneNotification('card.balance_low', {
                  message: `当前有 ${lowBalanceCards.length} 张号卡余额低于阈值。`,
                });
                showToast(result.some((item) => item.status === 'success') ? '低余额提醒已进入通知中心。' : '低余额提醒未发送，请检查通知中心渠道配置。', result.some((item) => item.status === 'success') ? 'success' : 'error');
              }}
            >
              模拟低余额提醒
            </Btn>
            <Btn
              tone="primary"
              onClick={() => {
                const result = enqueueSceneNotification('card.billing_upcoming', {
                  message: `共有 ${data.cards.length} 张号卡需要在账单日前 ${data.settings.notificationDaysBefore} 天提醒。`,
                });
                showToast(result.some((item) => item.status === 'success') ? '账单日前提醒已进入通知中心。' : '账单日前提醒未发送，请检查通知中心渠道配置。', result.some((item) => item.status === 'success') ? 'success' : 'error');
              }}
            >
              模拟账单日前提醒
            </Btn>
          </div>
        )}
      />

      <PillTabs
        options={tabOptions.map((item) => ({ value: item.value, label: item.label }))}
        value={tab}
        onChange={(value) => setTab(value as (typeof tabOptions)[number]['value'])}
      />

      {tab === 'cards' ? (
        <>
          <StatGrid
            items={[
              { label: '号卡数量', value: `${data.cards.length}` },
              { label: '低余额预警', value: `${lowBalanceCards.length}`, helper: `阈值 ¥${data.settings.balanceThreshold}` },
              { label: '总余额', value: `¥${totalBalance.toFixed(2)}` },
            ]}
          />
          <SectionCard title="号卡清单" description="重点关注低余额和临近账单日的号码。">
            <DataTable
              rowKey="id"
              data={data.cards}
              columns={[
                { key: 'phone', title: '号码', dataIndex: 'phone' },
                { key: 'carrier', title: '运营商', dataIndex: 'carrier' },
                { key: 'city', title: '归属地', dataIndex: 'city' },
                { key: 'trafficPlan', title: '套餐', dataIndex: 'trafficPlan' },
                {
                  key: 'balance',
                  title: '余额',
                  dataIndex: 'balance',
                  render: (value) => `¥${Number(value).toFixed(2)}`,
                },
                {
                  key: 'billingDay',
                  title: '账单日',
                  dataIndex: 'billingDay',
                  render: (value) => `${value} 日`,
                },
              ]}
            />
          </SectionCard>
        </>
      ) : null}

      {tab === 'settings' ? (
        <div className="page-stack">
          <SettingSwitchCard
            title="低余额提醒"
            description="当号卡余额低于阈值时，向通知中心发起统一发送。"
            checked={data.settings.balanceLowEnabled}
            onChange={(checked) => {
              setData((previous) => ({
                ...previous,
                settings: {
                  ...previous.settings,
                  balanceLowEnabled: checked,
                },
              }));
              updateSceneConfig('card.balance_low', { enabled: checked });
              showToast(`低余额提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={data.settings.balanceLowEnabled ? '已启用' : '已停用'}
            impact="提醒渠道绑定由通知中心统一管理，本页只维护触发规则。"
          >
            <div className="form-grid">
              <Field
                label="余额阈值"
                type="number"
                value={data.settings.balanceThreshold}
                onChange={(event) => {
                  setData((previous) => ({
                    ...previous,
                    settings: {
                      ...previous.settings,
                      balanceThreshold: Number(event.target.value),
                    },
                  }));
                }}
              />
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="card.balance_low"
            title="低余额提醒的通知中心状态"
            summary="查看该场景当前绑定了哪些渠道，以及渠道是否已经就绪。"
          />

          <SettingSwitchCard
            title="账单日前提醒"
            description="在账单日前若干天提示检查余额、套餐和扣费安排。"
            checked={data.settings.billingUpcomingEnabled}
            onChange={(checked) => {
              setData((previous) => ({
                ...previous,
                settings: {
                  ...previous.settings,
                  billingUpcomingEnabled: checked,
                },
              }));
              updateSceneConfig('card.billing_upcoming', { enabled: checked });
              showToast(`账单日前提醒已${checked ? '启用' : '停用'}。`);
            }}
            statusText={data.settings.billingUpcomingEnabled ? '已启用' : '已停用'}
            impact="开启后，账单日前提醒会统一走通知中心，不再由页面单独配置邮件或企业微信。"
          >
            <div className="form-grid">
              <Field
                label="提前提醒天数"
                type="number"
                value={data.settings.notificationDaysBefore}
                onChange={(event) => {
                  setData((previous) => ({
                    ...previous,
                    settings: {
                      ...previous.settings,
                      notificationDaysBefore: Number(event.target.value),
                    },
                  }));
                }}
              />
            </div>
          </SettingSwitchCard>

          <NotificationStatusCard
            sceneId="card.billing_upcoming"
            title="账单日前提醒的通知中心状态"
            summary="在通知中心调整邮件、企业微信和 Webhook 的绑定关系。"
          />
        </div>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
