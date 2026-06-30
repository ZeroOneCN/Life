export type RentTab = 'records' | 'entry' | 'statistics' | 'channels' | 'utilityBills';

export type RentOccupancyStatus = 'active' | 'ended';

export interface RentHousingRecord {
  id: string;
  address: string;
  channelId: string;
  channelName: string;
  moveInDate: string;
  moveOutDate: string;
  rent: number;
  deposit: number;
  electricityFee: number;
  waterFee: number;
  gasFee: number;
  agencyFee: number;
  cleaningFee: number;
  laundryFee: number;
  serviceFee: number;
  orientation: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentHousingRecordDraft {
  address: string;
  channelId: string;
  moveInDate: string;
  moveOutDate?: string;
  rent?: number;
  deposit?: number;
  electricityFee?: number;
  waterFee?: number;
  gasFee?: number;
  agencyFee?: number;
  cleaningFee?: number;
  laundryFee?: number;
  serviceFee?: number;
  orientation?: string;
  notes?: string;
}

export interface RentChannel {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentChannelDraft {
  name: string;
}

export interface RentDerivedMetrics {
  stayDays: number;
  totalCost: number;
  dailyCost: number;
  monthlyRent: number;
  quarterlyRent: number;
  occupancyStatus: RentOccupancyStatus;
}

export interface RentOverviewSummary {
  totalRecords: number;
  totalStayDays: number;
  totalCost: number;
  avgDailyCost: number;
  avgMonthlyCost: number;
  activeRecords: number;
  endedRecords: number;
  totalChannels: number;
}

export interface RentCostBreakdownPoint {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface RentChannelBreakdownPoint {
  channelId: string;
  channelName: string;
  count: number;
  color: string;
}

export interface RentPageState {
  records: RentHousingRecord[];
  channels: RentChannel[];
  settings: {
    editingRecordId: string;
  };
}

/** 月度水电燃气账单 */
export interface RentUtilityBill {
  id: string;
  recordId: string;
  yearMonth: string;      // 格式 YYYY-MM
  electricityFee: number;
  waterFee: number;
  gasFee: number;
  createdAt: string;
  updatedAt: string;
}

/** 月度账单录入草稿 */
export interface RentUtilityBillDraft {
  recordId: string;
  yearMonth: string;
  electricityFee?: number;
  waterFee?: number;
  gasFee?: number;
}
