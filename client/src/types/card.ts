import type { NotificationSceneId } from './notifications';

export type CardTab = 'cards' | 'bills' | 'statistics' | 'carriers' | 'settings';

export interface LifeCardRecord {
  id: string;
  phoneNumber: string;
  carrierId: string;
  carrierName: string;
  location: string;
  balance: number;
  monthlyFee: number;
  billingDay: number;
  dataPlan: string;
  callMinutes: string;
  smsCount: string;
  activationDate: string;
  notes: string;
  lastBalanceReminderMarker?: string;
  lastBillingReminderMarker?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeCardDraft {
  phoneNumber: string;
  carrierId?: string;
  carrierName?: string;
  location?: string;
  balance?: number;
  monthlyFee?: number;
  billingDay?: number;
  dataPlan?: string;
  callMinutes?: string;
  smsCount?: string;
  activationDate?: string;
  notes?: string;
}

export interface LifeCardRechargeRecord {
  id: string;
  simId: string;
  phoneNumber: string;
  amount: number;
  rechargeDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeCardRechargeDraft {
  simId: string;
  amount: number;
  rechargeDate: string;
  note?: string;
}

export interface LifeCardBillRecord {
  id: string;
  simId: string;
  phoneNumber: string;
  carrierName: string;
  billingMonth: string;
  monthlyFee: number;
  actualFee: number;
  extraCharges: number;
  totalFee: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeCardBillDraft {
  simId: string;
  phoneNumber?: string;
  carrierName?: string;
  billingMonth: string;
  monthlyFee?: number;
  actualFee?: number;
  extraCharges?: number;
  totalFee?: number;
  note?: string;
}

export interface LifeCardCarrier {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeCardCarrierDraft {
  name: string;
  description?: string;
}

export interface LifeCardOverviewSummary {
  totalCards: number;
  lowBalanceCount: number;
  totalBalance: number;
  monthlyFeeTotal: number;
  carrierCount: number;
  currentMonthBillCount: number;
  currentMonthBillAmount: number;
  totalRechargeAmount: number;
}

export interface LifeCardMonthlyBillPoint {
  month: string;
  label: string;
  amount: number;
  count: number;
}

export interface LifeCardCarrierBreakdownPoint {
  carrierId: string;
  carrierName: string;
  cardCount: number;
  monthlyFee: number;
  totalBillAmount: number;
  color: string;
}

export interface LifeCardBalanceRangePoint {
  range: string;
  count: number;
  totalBalance: number;
  averageBalance: number;
}

export interface LifeCardRankingPoint {
  simId: string;
  phoneNumber: string;
  carrierName: string;
  billCount: number;
  totalBillAmount: number;
  totalRechargeAmount: number;
}

export interface LifeCardReminderItem {
  sceneId: NotificationSceneId;
  marker: string;
  cardId: string;
  phoneNumber: string;
  message: string;
}

export interface LifeCardImportResult {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  records: LifeCardBillRecord[];
}

export interface LifeCardPageState {
  cards: LifeCardRecord[];
  bills: LifeCardBillRecord[];
  recharges: LifeCardRechargeRecord[];
  carriers: LifeCardCarrier[];
  settings: {
    balanceLowEnabled: boolean;
    billingUpcomingEnabled: boolean;
    autoDeductionEnabled: boolean;
    balanceThreshold: number;
    notificationDaysBefore: number;
  };
}
