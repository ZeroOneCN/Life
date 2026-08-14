export type RentTab = 'records' | 'entry' | 'statistics' | 'channels' | 'utilityBills';

export type RentOccupancyStatus = 'active' | 'ended';

/** 租金支付周期：月付 / 季付 / 年付 */
export type RentPayCycle = 'monthly' | 'quarterly' | 'yearly';

export interface RentHousingRecord {
  id: string;
  address: string;
  addressShort: string;
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
  /** 支付周期：monthly（月付）/ quarterly（季付）/ yearly（年付） */
  payCycle: RentPayCycle;
  /** 实际月租金（与支付周期对应），用于在住期间正确折算月租 */
  rentPerMonth: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentHousingRecordDraft {
  address: string;
  addressShort?: string;
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
  payCycle?: RentPayCycle;
  rentPerMonth?: number | null;
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
  /** 支付周期 */
  payCycle: RentPayCycle;
  /** 合同月租（按支付周期换算，在住时用于折算月租展示） */
  contractMonthlyRent: number;
}

/**
 * 单自然月成本拆分结果。
 *
 * 用于跨月租期（如 8-15 至 9-15）时，把入住期间房租按自然月拆开，
 * 方便用户单独记账。
 */
export interface RentMonthlyBreakdownItem {
  /** 自然月，格式 YYYY-MM */
  yearMonth: string;
  /** 当月实际入住天数 */
  stayDays: number;
  /** 当月在住时间段文字说明（含起止日） */
  dateRangeLabel: string;
  /** 当月房租拆分金额（仅分摊房租本身，不含水电费等杂费） */
  rentShare: number;
  /** 当月总成本分摊金额（房租+水电燃气+服务+保洁+洗衣，不含押金和中介费） */
  totalCostShare: number;
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
