import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CardBillsSection } from '../../components/life/CardBillsSection';
import { CardCardsSection } from '../../components/life/CardCardsSection';
import { CardCarriersSection } from '../../components/life/CardCarriersSection';
import { CardSettingsSection } from '../../components/life/CardSettingsSection';
import { CardStatisticsSection } from '../../components/life/CardStatisticsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { hydrateNotificationCenterState } from '../../services/notificationCenter';
import { cardApi } from '../../services/cardApi';
import type {
  LifeCardBillRecord,
  LifeCardCarrier,
  LifeCardOverviewSummary,
  LifeCardPageState,
  LifeCardRechargeRecord,
  LifeCardRecord,
  CardTab,
} from '../../types/card';

const TAB_OPTIONS: Array<{ value: CardTab; label: string }> = [
  { value: 'cards', label: '号卡列表' },
  { value: 'bills', label: '账单管理' },
  { value: 'statistics', label: '统计分析' },
  { value: 'carriers', label: '运营商管理' },
  { value: 'settings', label: '提醒设置' },
];

const EMPTY_OVERVIEW: LifeCardOverviewSummary = {
  totalCards: 0,
  lowBalanceCount: 0,
  totalBalance: 0,
  monthlyFeeTotal: 0,
  carrierCount: 0,
  currentMonthBillCount: 0,
  currentMonthBillAmount: 0,
  totalRechargeAmount: 0,
};

const EMPTY_SETTINGS: LifeCardPageState['settings'] = {
  balanceLowEnabled: true,
  billingUpcomingEnabled: true,
  autoDeductionEnabled: false,
  balanceThreshold: 10,
  notificationDaysBefore: 3,
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

export default function CardPage() {
  const [tab, setTab] = usePageTab<CardTab>('cards', TAB_OPTIONS.map((item) => item.value), 'cardTab');
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [cards, setCards] = useState<LifeCardRecord[]>([]);
  const [bills, setBills] = useState<LifeCardBillRecord[]>([]);
  const [recharges, setRecharges] = useState<LifeCardRechargeRecord[]>([]);
  const [carriers, setCarriers] = useState<LifeCardCarrier[]>([]);
  const [overview, setOverview] = useState<LifeCardOverviewSummary>(EMPTY_OVERVIEW);
  const [settings, setSettings] = useState<LifeCardPageState['settings']>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const reload = useCallback(async () => {
    const [
      nextCards,
      nextBills,
      nextRecharges,
      nextCarriers,
      nextOverview,
      nextSettings,
    ] = await Promise.all([
      cardApi.listCards({ page: 1, page_size: 1000 }),
      cardApi.listBills({ page: 1, page_size: 1000 }),
      cardApi.listRecharges({ page: 1, page_size: 1000 }),
      cardApi.listCarriers(),
      cardApi.getOverview(),
      cardApi.getSettings(),
    ]);

    setCards(nextCards.items);
    setBills(nextBills.items);
    setRecharges(nextRecharges.items);
    setCarriers(nextCarriers.items);
    setOverview(nextOverview);
    setSettings(nextSettings);
  }, []);

  const refreshPage = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const mounted = { current: true };

    const load = async () => {
      setLoading(true);
      try {
        await reload();
        await hydrateNotificationCenterState();
      } catch (error) {
        if (mounted.current && !cancelled) {
          showToastRef.current(buildApiErrorMessage(error, '号卡中心加载失败。'), 'error');
        }
      } finally {
        if (mounted.current && !cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [reload, refreshToken]);

  const updateSettings = useCallback(async (patch: Partial<LifeCardPageState['settings']>) => {
    try {
      const cleanPatch = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== null && v !== undefined),
      );
      if (Object.keys(cleanPatch).length === 0) {
        return;
      }
      const next = await cardApi.updateSettings(cleanPatch);
      setSettings(next);
      await hydrateNotificationCenterState();
      showToast('号卡提醒设置已更新。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '号卡提醒设置更新失败。'), 'error');
    }
  }, [showToast]);

  const handleCardsChange = useCallback(async (updater: (records: LifeCardRecord[]) => LifeCardRecord[]) => {
    const previous = cards;
    const next = updater(previous);
    setCards(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => cardApi.createCard({
          phoneNumber: item.phoneNumber,
          carrierId: item.carrierId,
          carrierName: item.carrierName,
          location: item.location,
          balance: item.balance,
          monthlyFee: item.monthlyFee,
          billingDay: item.billingDay,
          dataPlan: item.dataPlan,
          callMinutes: item.callMinutes,
          smsCount: item.smsCount,
          activationDate: item.activationDate,
          notes: item.notes,
        })),
        ...updated.map((item) => cardApi.updateCard(item.id, {
          phoneNumber: item.phoneNumber,
          carrierId: item.carrierId,
          carrierName: item.carrierName,
          location: item.location,
          balance: item.balance,
          monthlyFee: item.monthlyFee,
          billingDay: item.billingDay,
          dataPlan: item.dataPlan,
          callMinutes: item.callMinutes,
          smsCount: item.smsCount,
          activationDate: item.activationDate,
          notes: item.notes,
        })),
        ...deletedIds.map((id) => cardApi.deleteCard(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '号卡保存失败。'), 'error');
      await reload();
    }
  }, [cards, reload, showToast]);

  const handleRechargeChange = useCallback(async (updater: (current: { cards: LifeCardRecord[]; recharges: LifeCardRechargeRecord[] }) => { cards: LifeCardRecord[]; recharges: LifeCardRechargeRecord[] }) => {
    const previous = { cards, recharges };
    const next = updater(previous);
    setCards(next.cards);
    setRecharges(next.recharges);

    try {
      const addedRecharge = next.recharges.find((item) => !previous.recharges.some((record) => record.id === item.id));
      if (addedRecharge) {
        await cardApi.recharge({
          simId: addedRecharge.simId,
          amount: addedRecharge.amount,
          rechargeDate: addedRecharge.rechargeDate,
          note: addedRecharge.note,
        });
      }
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '充值保存失败。'), 'error');
      await reload();
    }
  }, [cards, recharges, reload, showToast]);

  const handleBillsChange = useCallback(async (updater: (records: LifeCardBillRecord[]) => LifeCardBillRecord[]) => {
    const previous = bills;
    const next = updater(previous);
    setBills(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => cardApi.createBill({
          simId: item.simId,
          phoneNumber: item.phoneNumber,
          carrierName: item.carrierName,
          billingMonth: item.billingMonth,
          monthlyFee: item.monthlyFee,
          actualFee: item.actualFee,
          extraCharges: item.extraCharges,
          totalFee: item.totalFee,
          note: item.note,
        })),
        ...updated.map((item) => cardApi.updateBill(item.id, {
          simId: item.simId,
          phoneNumber: item.phoneNumber,
          carrierName: item.carrierName,
          billingMonth: item.billingMonth,
          monthlyFee: item.monthlyFee,
          actualFee: item.actualFee,
          extraCharges: item.extraCharges,
          totalFee: item.totalFee,
          note: item.note,
        })),
        ...deletedIds.map((id) => cardApi.deleteBill(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '账单保存失败。'), 'error');
      await reload();
    }
  }, [bills, reload, showToast]);

  const handleCarriersChange = useCallback(async (updater: (records: LifeCardCarrier[]) => LifeCardCarrier[]) => {
    const previous = carriers;
    const next = updater(previous);
    setCarriers(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => cardApi.createCarrier({
          name: item.name,
          description: item.description,
        })),
        ...updated.map((item) => cardApi.updateCarrier(item.id, {
          name: item.name,
          description: item.description,
        })),
        ...deletedIds.map((id) => cardApi.deleteCarrier(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '运营商保存失败。'), 'error');
      await reload();
    }
  }, [carriers, reload, showToast]);

  const overviewCards = useMemo(() => ([
    { label: '总号卡数', value: `${overview.totalCards} 张` },
    { label: '低余额数', value: `${overview.lowBalanceCount} 张` },
    { label: '总余额', value: `¥${overview.totalBalance.toFixed(2)}` },
    { label: '月租合计', value: `¥${overview.monthlyFeeTotal.toFixed(2)}` },
    { label: '运营商数', value: `${overview.carrierCount}` },
    { label: '本月账单数', value: `${overview.currentMonthBillCount}` },
    { label: '本月账单金额', value: `¥${overview.currentMonthBillAmount.toFixed(2)}` },
    { label: '累计充值额', value: `¥${overview.totalRechargeAmount.toFixed(2)}` },
  ]), [overview]);

  return (
    <div className="page-stack">
      <PageHeader
        title="号卡中心"
        subtitle={loading ? '正在加载号卡数据...' : '管理银行卡、手机号等号卡的账单和到期提醒。'}
        actions={(
          <div className="inline-row">
            <Tag tone="blue">低余额 {overview.lowBalanceCount} 张</Tag>
            <Tag tone="default">本月账单 {overview.currentMonthBillCount} 张</Tag>
          </div>
        )}
      />

      <StatGrid className="card-overview-grid" items={overviewCards} />

      <SectionCard
        title="业务视图"
        description="号卡列表、账单、统计、运营商和提醒设置共用同一套后端数据模型，并与通知中心联动。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as CardTab)} />
      </SectionCard>

      {tab === 'cards' ? (
        <CardCardsSection
          cards={cards}
          carriers={carriers}
          settings={settings}
          onChangeCards={(updater) => {
            void handleCardsChange(updater);
          }}
          onRecharge={(updater) => {
            void handleRechargeChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'bills' ? (
        <CardBillsSection
          cards={cards}
          bills={bills}
          onChangeBills={(updater) => {
            void handleBillsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'statistics' ? (
        <CardStatisticsSection
          cards={cards}
          bills={bills}
          recharges={recharges}
          settings={settings}
        />
      ) : null}

      {tab === 'carriers' ? (
        <CardCarriersSection
          carriers={carriers}
          cards={cards}
          bills={bills}
          onChangeCarriers={(updater) => {
            void handleCarriersChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <CardSettingsSection
          cards={cards}
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
