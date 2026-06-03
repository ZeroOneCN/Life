export type MedicationReminderTimeKey = 'breakfast' | 'lunch' | 'dinner';

export type MedicationTab = 'records' | 'purchases' | 'analysis' | 'summary';

export interface MedicationRecord {
  id: string;
  userId: string;
  date: string;
  medicineName: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationRecordDraft {
  userId: string;
  date: string;
  medicineName: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface MedicationPurchaseRecord {
  id: string;
  userId: string;
  purchaseDate: string;
  medicineName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  channel: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationPurchaseDraft {
  userId: string;
  purchaseDate: string;
  medicineName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice?: number;
  channel: string;
}

export interface MedicationDailySummary {
  id: string;
  userId: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationOverviewSummary {
  totalRecords: number;
  totalDosage: number;
  trackedDays: number;
  avgDailyDosage: number;
  activeMedicineCount: number;
  purchaseCount: number;
  totalPurchaseAmount: number;
  latestRecordDate: string | null;
  todayDosage: number;
}

export interface MedicationTrendPoint {
  date: string;
  label: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  total: number;
}

export interface MedicationRankingPoint {
  medicineName: string;
  totalDose: number;
  percentage: number;
}

export interface MedicationTimeOfDaySummary {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface MedicationStockInsight {
  medicineName: string;
  unit: string | null;
  purchasedQuantity: number;
  usedQuantity: number;
  remainingQuantity: number | null;
  threshold: number;
  status: 'ok' | 'low' | 'mixed_unit' | 'no_purchase';
  note?: string;
}

export interface MedicationPageState {
  records: MedicationRecord[];
  purchases: MedicationPurchaseRecord[];
  summaries: MedicationDailySummary[];
  settings: {
    activeUserId: string;
    recordsUserId: string;
    purchaseUserId: string;
    analysisUserId: string;
    summaryUserId: string;
    doseReminderEnabled: boolean;
    stockReminderEnabled: boolean;
    breakfastReminderTime: string;
    lunchReminderTime: string;
    dinnerReminderTime: string;
    defaultStockThreshold: number;
    medicineThresholds: Record<string, number>;
  };
}
