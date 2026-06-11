export type RentTab = 'records' | 'entry' | 'statistics' | 'channels';

export type RentOccupancyStatus = 'active' | 'ended';

export interface RentHousingRecord {
  id: string;
  userId: string;
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
  userId: string;
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
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentChannelDraft {
  userId: string;
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
    activeUserId: string;
    recordsUserId: string;
    statisticsUserId: string;
    editingRecordId: string;
  };
}
