import { useEffect, useMemo } from 'react';

import { CardBillsSection } from '../../components/life/CardBillsSection';
import { CardCardsSection } from '../../components/life/CardCardsSection';
import { CardCarriersSection } from '../../components/life/CardCarriersSection';
import { CardSettingsSection } from '../../components/life/CardSettingsSection';
import { CardStatisticsSection } from '../../components/life/CardStatisticsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildInitialCardState,
  buildLifeCardDueNotifications,
  buildLifeCardOverview,
  normalizeCardPageState,
  triggerLifeCardNotifications,
} from '../../services/card';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { CardTab, LifeCardPageState } from '../../types/card';

const STORAGE_KEY = 'lifeos_life_card_page';

const TAB_OPTIONS: Array<{ value: CardTab; label: string }> = [
  { value: 'cards', label: '号卡列表' },
  { value: 'bills', label: '账单管理' },
  { value: 'statistics', label: '统计分析' },
  { value: 'carriers', label: '运营商管理' },
  { value: 'settings', label: '提醒设置' },
];

export default function CardPage() {
  const [data, setData] = useLocalStorageState<LifeCardPageState>(STORAGE_KEY, buildInitialCardState);
  const [tab, setTab] = usePageTab<CardTab>('cards', TAB_OPTIONS.map((item) => item.value), 'cardTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeCardPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);
    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  useEffect(() => {
    void updateSceneConfig('card.balance_low', { enabled: normalizedData.settings.balanceLowEnabled });
    void updateSceneConfig('card.billing_upcoming', { enabled: normalizedData.settings.billingUpcomingEnabled });
  }, [normalizedData.settings.balanceLowEnabled, normalizedData.settings.billingUpcomingEnabled]);

  useEffect(() => {
    const dueNotifications = buildLifeCardDueNotifications(normalizedData.cards, normalizedData.settings);
    if (!dueNotifications.length) {
      return;
    }

    void Promise.all(
      dueNotifications.map((item) => enqueueSceneNotification(item.sceneId, { message: item.message })),
    ).then(() => {
      setData((previous) => ({
        ...previous,
        cards: triggerLifeCardNotifications(previous.cards, dueNotifications),
      }));
    });
  }, [normalizedData.cards, normalizedData.settings, setData]);

  const overview = useMemo(
    () => buildLifeCardOverview(
      normalizedData.cards,
      normalizedData.bills,
      normalizedData.recharges,
      normalizedData.settings,
    ),
    [normalizedData.bills, normalizedData.cards, normalizedData.recharges, normalizedData.settings],
  );

  const updateSettings = (patch: Partial<LifeCardPageState['settings']>) => {
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
        title="号卡中心"
        subtitle="把号卡资料、充值、账单、运营商和提醒规则统一收进当前 LifeOS 的正式生活模块里，提醒场景继续由通知中心统一接管。"
        actions={(
          <div className="inline-row">
            <Tag tone="blue">低余额 {overview.lowBalanceCount} 张</Tag>
            <Tag tone="default">本月账单 {overview.currentMonthBillCount} 条</Tag>
          </div>
        )}
      />

      <StatGrid
        className="card-overview-grid"
        items={[
          { label: '总号卡数', value: `${overview.totalCards} 张` },
          { label: '低余额数', value: `${overview.lowBalanceCount} 张` },
          { label: '总余额', value: `¥${overview.totalBalance.toFixed(2)}` },
          { label: '月租合计', value: `¥${overview.monthlyFeeTotal.toFixed(2)}` },
          { label: '运营商数', value: `${overview.carrierCount}` },
          { label: '本月账单数', value: `${overview.currentMonthBillCount}` },
          { label: '本月账单金额', value: `¥${overview.currentMonthBillAmount.toFixed(2)}` },
          { label: '累计充值额', value: `¥${overview.totalRechargeAmount.toFixed(2)}` },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="号卡列表、账单、统计、运营商和提醒设置共用同一套本地状态模型，并与通知中心联动。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as CardTab)} />
      </SectionCard>

      {tab === 'cards' ? (
        <CardCardsSection
          cards={normalizedData.cards}
          carriers={normalizedData.carriers}
          settings={normalizedData.settings}
          onChangeCards={(updater) => {
            setData((previous) => ({
              ...previous,
              cards: updater(previous.cards),
            }));
          }}
          onRecharge={(updater) => {
            setData((previous) => {
              const next = updater({
                cards: previous.cards,
                recharges: previous.recharges,
              });

              return {
                ...previous,
                cards: next.cards,
                recharges: next.recharges,
              };
            });
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'bills' ? (
        <CardBillsSection
          cards={normalizedData.cards}
          bills={normalizedData.bills}
          onChangeBills={(updater) => {
            setData((previous) => ({
              ...previous,
              bills: updater(previous.bills),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'statistics' ? (
        <CardStatisticsSection
          cards={normalizedData.cards}
          bills={normalizedData.bills}
          recharges={normalizedData.recharges}
          settings={normalizedData.settings}
        />
      ) : null}

      {tab === 'carriers' ? (
        <CardCarriersSection
          carriers={normalizedData.carriers}
          cards={normalizedData.cards}
          bills={normalizedData.bills}
          onChangeCarriers={(updater) => {
            setData((previous) => ({
              ...previous,
              carriers: updater(previous.carriers),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <CardSettingsSection
          cards={normalizedData.cards}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
