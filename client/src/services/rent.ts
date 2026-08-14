import dayjs from 'dayjs';

import { CHART_CATEGORY_8, RENT_COST } from '../lib/chartPalette';
import type {
  RentChannel,
  RentChannelBreakdownPoint,
  RentChannelDraft,
  RentCostBreakdownPoint,
  RentDerivedMetrics,
  RentHousingRecord,
  RentHousingRecordDraft,
  RentMonthlyBreakdownItem,
  RentOverviewSummary,
  RentPageState,
  RentPayCycle,
  RentUtilityBill,
} from '../types/rent';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';

export const RENT_RECORD_PAGE_SIZE = 10;
export const RENT_ALL_CHANNELS = 'all';
export const RENT_CHANNEL_COLORS = CHART_CATEGORY_8;
export const RENT_COST_COLORS = RENT_COST;

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function normalizeTrimmedValue(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function toMoney(value: unknown, fallback = 0) {
  const normalized = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeDate(value: unknown, fallback = dayjs().format(DATE_FORMAT)) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return fallback;
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate: string) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function sortChannels(channels: RentChannel[]) {
  return [...channels].sort((left, right) => {
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function sortRecords(records: RentHousingRecord[]) {
  return [...records].sort((left, right) => {
    const leftEnded = Boolean(left.moveOutDate);
    const rightEnded = Boolean(right.moveOutDate);

    if (leftEnded !== rightEnded) {
      return leftEnded ? 1 : -1;
    }

    const startDiff = dayjs(right.moveInDate).valueOf() - dayjs(left.moveInDate).valueOf();
    if (startDiff !== 0) {
      return startDiff;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function normalizeChannel(record: Partial<RentChannel>): RentChannel {
  const createdAt = normalizeTimestamp(record.createdAt, dayjs().format(DATE_FORMAT));
  const updatedAt = normalizeTimestamp(record.updatedAt, dayjs(createdAt).format(DATE_FORMAT));

  return {
    id: record.id ?? buildId(),
    name: normalizeTrimmedValue(record.name, '未命名渠道'),
    createdAt,
    updatedAt,
  };
}

function normalizeRecord(
  record: Partial<RentHousingRecord>,
  channels: RentChannel[],
): RentHousingRecord {
  const moveInDate = normalizeDate(record.moveInDate);
  const moveOutDate = record.moveOutDate ? normalizeDate(record.moveOutDate, '') : '';
  const matchedChannel = channels.find((channel) => channel.id === record.channelId)
    ?? channels.find((channel) => channel.name === record.channelName);
  const createdAt = normalizeTimestamp(record.createdAt, moveInDate);
  const updatedAt = normalizeTimestamp(record.updatedAt, moveInDate);

  return {
    id: record.id ?? buildId(),
    address: normalizeTrimmedValue(record.address, '未命名住房'),
    addressShort: normalizeTrimmedValue(record.addressShort),
    channelId: normalizeTrimmedValue(record.channelId ?? matchedChannel?.id),
    channelName: normalizeTrimmedValue(record.channelName ?? matchedChannel?.name, '未分配渠道'),
    moveInDate,
    moveOutDate,
    rent: toMoney(record.rent, 0),
    deposit: toMoney(record.deposit, 0),
    electricityFee: toMoney(record.electricityFee, 0),
    waterFee: toMoney(record.waterFee, 0),
    gasFee: toMoney(record.gasFee, 0),
    agencyFee: toMoney(record.agencyFee, 0),
    cleaningFee: toMoney(record.cleaningFee, 0),
    laundryFee: toMoney(record.laundryFee, 0),
    serviceFee: toMoney(record.serviceFee, 0),
    orientation: normalizeTrimmedValue(record.orientation),
    notes: normalizeTrimmedValue(record.notes),
    payCycle: (['monthly', 'quarterly', 'yearly'].includes(record.payCycle as string) ? record.payCycle : 'monthly') as RentPayCycle,
    rentPerMonth: record.rentPerMonth != null && record.rentPerMonth > 0 ? Number(record.rentPerMonth) : null,
    createdAt,
    updatedAt,
  };
}

function createInitialChannels(): RentChannel[] {
  return [];
}

function createInitialRecords(_channels: RentChannel[]): RentHousingRecord[] {
  return [];
}

export function formatRentAmount(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function calculateRentDerivedMetrics(record: Pick<
  RentHousingRecord,
  | 'moveInDate'
  | 'moveOutDate'
  | 'rent'
  | 'electricityFee'
  | 'waterFee'
  | 'gasFee'
  | 'agencyFee'
  | 'cleaningFee'
  | 'laundryFee'
  | 'serviceFee'
  | 'payCycle'
  | 'rentPerMonth'
>): RentDerivedMetrics {
  const moveIn = dayjs(record.moveInDate);
  const moveOut = record.moveOutDate ? dayjs(record.moveOutDate) : dayjs();
  const safeMoveOut = moveOut.isBefore(moveIn, 'day') ? moveIn : moveOut;
  const stayDays = Math.max(1, safeMoveOut.startOf('day').diff(moveIn.startOf('day'), 'day') + 1);
  const totalCost = Number((
    record.rent
    + record.electricityFee
    + record.waterFee
    + record.gasFee
    + record.agencyFee
    + record.cleaningFee
    + record.laundryFee
    + record.serviceFee
  ).toFixed(2));
  const dailyCost = Number((totalCost / stayDays).toFixed(2));
  const occupancyStatus = record.moveOutDate ? 'ended' : 'active';

  /**
   * 计算"合同月租"（按支付周期换算，用于在住期间的折算月租展示）：
   * - 优先取实际月租金 rentPerMonth（用户录入，最能反映真实每月支出）
   * - 未录入时按支付周期换算：月付 = rent；季付 = rent / 3；年付 = rent / 12
   */
  const payCycle = record.payCycle ?? 'monthly';
  const contractMonthlyRent = record.rentPerMonth != null && record.rentPerMonth > 0
    ? Number(record.rentPerMonth)
    : (() => {
      if (payCycle === 'yearly') return Number(((record.rent || 0) / 12).toFixed(2));
      if (payCycle === 'quarterly') return Number(((record.rent || 0) / 3).toFixed(2));
      return Number(record.rent || 0);
    })();

  // 仍在住：折算月租取合同月租（避免按已住天数折算虚高）；已退租：按实际租期天数折算。
  const monthlyRent = occupancyStatus === 'active'
    ? Number(contractMonthlyRent.toFixed(2))
    : Number(((record.rent * 30) / stayDays).toFixed(2));
  const quarterlyRent = Number((monthlyRent * 3).toFixed(2));

  return {
    stayDays,
    totalCost,
    dailyCost,
    monthlyRent,
    quarterlyRent,
    occupancyStatus,
    payCycle,
    contractMonthlyRent,
  };
}

export function buildInitialRentState(): RentPageState {
  const channels = createInitialChannels();
  const records = createInitialRecords(channels);

  return {
    records,
    channels,
    settings: {
      editingRecordId: '',
    },
  };
}

export function normalizeRentPageState(state: RentPageState | null | undefined): RentPageState {
  const fallback = buildInitialRentState();
  const rawChannels = Array.isArray(state?.channels) ? state.channels : fallback.channels;
  const channels = sortChannels(rawChannels.map((channel) => normalizeChannel(channel)));
  const records = sortRecords((Array.isArray(state?.records) ? state.records : fallback.records).map((record) => normalizeRecord(record, channels)));

  return {
    records,
    channels,
    settings: {
      editingRecordId: normalizeTrimmedValue(state?.settings?.editingRecordId),
    },
  };
}

export function createRentRecord(channels: RentChannel[], records: RentHousingRecord[], draft: RentHousingRecordDraft) {
  const channel = channels.find((item) => item.id === draft.channelId);
  const moveInDate = normalizeDate(draft.moveInDate);
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRecords([
    {
      id: buildId(),
      address: draft.address.trim(),
      addressShort: draft.addressShort?.trim() ?? '',
      channelId: draft.channelId,
      channelName: channel?.name ?? '未分配渠道',
      moveInDate,
      moveOutDate: draft.moveOutDate ? normalizeDate(draft.moveOutDate, '') : '',
      rent: toMoney(draft.rent, 0),
      deposit: toMoney(draft.deposit, 0),
      electricityFee: toMoney(draft.electricityFee, 0),
      waterFee: toMoney(draft.waterFee, 0),
      gasFee: toMoney(draft.gasFee, 0),
      agencyFee: toMoney(draft.agencyFee, 0),
      cleaningFee: toMoney(draft.cleaningFee, 0),
      laundryFee: toMoney(draft.laundryFee, 0),
      serviceFee: toMoney(draft.serviceFee, 0),
      orientation: draft.orientation ?? '',
      notes: draft.notes?.trim() ?? '',
      payCycle: draft.payCycle ?? 'monthly',
      rentPerMonth: draft.rentPerMonth != null && draft.rentPerMonth > 0 ? Number(draft.rentPerMonth) : null,
      createdAt: now,
      updatedAt: now,
    },
    ...records,
  ]);
}

export function updateRentRecord(
  channels: RentChannel[],
  records: RentHousingRecord[],
  recordId: string,
  draft: RentHousingRecordDraft,
) {
  const channel = channels.find((item) => item.id === draft.channelId);

  return sortRecords(records.map((record) => {
    if (record.id !== recordId) {
      return record;
    }

    return {
      ...record,
      address: draft.address.trim(),
      addressShort: draft.addressShort?.trim() ?? '',
      channelId: draft.channelId,
      channelName: channel?.name ?? record.channelName,
      moveInDate: normalizeDate(draft.moveInDate),
      moveOutDate: draft.moveOutDate ? normalizeDate(draft.moveOutDate, '') : '',
      rent: toMoney(draft.rent, 0),
      deposit: toMoney(draft.deposit, 0),
      electricityFee: toMoney(draft.electricityFee, 0),
      waterFee: toMoney(draft.waterFee, 0),
      gasFee: toMoney(draft.gasFee, 0),
      agencyFee: toMoney(draft.agencyFee, 0),
      cleaningFee: toMoney(draft.cleaningFee, 0),
      laundryFee: toMoney(draft.laundryFee, 0),
      serviceFee: toMoney(draft.serviceFee, 0),
      orientation: draft.orientation ?? record.orientation,
      notes: draft.notes?.trim() ?? '',
      payCycle: draft.payCycle ?? record.payCycle,
      rentPerMonth: draft.rentPerMonth != null && draft.rentPerMonth > 0 ? Number(draft.rentPerMonth) : null,
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    };
  }));
}

export function deleteRentRecord(records: RentHousingRecord[], recordId: string) {
  return sortRecords(records.filter((record) => record.id !== recordId));
}

export function createRentChannel(channels: RentChannel[], draft: RentChannelDraft) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortChannels([
    ...channels,
    {
      id: buildId(),
      name: draft.name.trim(),
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export function updateRentChannel(channels: RentChannel[], channelId: string, draft: RentChannelDraft) {
  return sortChannels(channels.map((channel) => {
    if (channel.id !== channelId) {
      return channel;
    }

    return {
      ...channel,
      name: draft.name.trim(),
      updatedAt: dayjs().format(DATE_TIME_FORMAT),
    };
  }));
}

export function deleteRentChannel(channels: RentChannel[], channelId: string) {
  return sortChannels(channels.filter((channel) => channel.id !== channelId));
}

export function filterRentRecords(
  records: RentHousingRecord[],
  options?: {
    keyword?: string;
    channelId?: string;
    occupancy?: 'all' | 'active' | 'ended';
  },
) {
  const normalizedKeyword = options?.keyword?.trim().toLowerCase() ?? '';
  const channelId = options?.channelId ?? RENT_ALL_CHANNELS;
  const occupancy = options?.occupancy ?? 'all';

  return records
    .filter((record) => channelId === RENT_ALL_CHANNELS || record.channelId === channelId)
    .filter((record) => {
      const status = calculateRentDerivedMetrics(record).occupancyStatus;
      return occupancy === 'all' ? true : status === occupancy;
    })
    .filter((record) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [record.address, record.addressShort, record.channelName, record.notes]
        .some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
}

export function filterRentChannels(channels: RentChannel[]): RentChannel[] {
  return channels;
}

export function buildRentOverview(
  records: RentHousingRecord[],
  channels: RentChannel[],
): RentOverviewSummary {
  const scopedRecords = filterRentRecords(records);
  const scopedChannels = filterRentChannels(channels);
  const totals = scopedRecords.reduce((accumulator, record) => {
    const metrics = calculateRentDerivedMetrics(record);

    accumulator.totalRecords += 1;
    accumulator.totalStayDays += metrics.stayDays;
    accumulator.totalCost += metrics.totalCost;
    accumulator.totalDailyCost += metrics.dailyCost;
    accumulator.totalMonthlyCost += metrics.monthlyRent;
    accumulator.activeRecords += metrics.occupancyStatus === 'active' ? 1 : 0;
    accumulator.endedRecords += metrics.occupancyStatus === 'ended' ? 1 : 0;
    return accumulator;
  }, {
    totalRecords: 0,
    totalStayDays: 0,
    totalCost: 0,
    totalDailyCost: 0,
    totalMonthlyCost: 0,
    activeRecords: 0,
    endedRecords: 0,
  });

  return {
    totalRecords: totals.totalRecords,
    totalStayDays: totals.totalStayDays,
    totalCost: Number(totals.totalCost.toFixed(2)),
    avgDailyCost: totals.totalRecords ? Number((totals.totalDailyCost / totals.totalRecords).toFixed(2)) : 0,
    avgMonthlyCost: totals.totalRecords ? Number((totals.totalMonthlyCost / totals.totalRecords).toFixed(2)) : 0,
    activeRecords: totals.activeRecords,
    endedRecords: totals.endedRecords,
    totalChannels: scopedChannels.length,
  };
}

export function buildRentCostBreakdown(records: RentHousingRecord[]): RentCostBreakdownPoint[] {
  const scopedRecords = filterRentRecords(records);
  const totals = scopedRecords.reduce((accumulator, record) => {
    accumulator.rent += record.rent;
    accumulator.electricityFee += record.electricityFee;
    accumulator.waterFee += record.waterFee;
    accumulator.gasFee += record.gasFee;
    accumulator.agencyFee += record.agencyFee;
    accumulator.cleaningFee += record.cleaningFee;
    accumulator.laundryFee += record.laundryFee;
    accumulator.serviceFee += record.serviceFee;
    return accumulator;
  }, {
    rent: 0,
    electricityFee: 0,
    waterFee: 0,
    gasFee: 0,
    agencyFee: 0,
    cleaningFee: 0,
    laundryFee: 0,
    serviceFee: 0,
  });

  const totalAmount = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const items: Array<{ key: keyof typeof totals; label: string; color: string }> = [
    { key: 'rent', label: '房租', color: RENT_COST_COLORS.rent },
    { key: 'electricityFee', label: '电费', color: RENT_COST_COLORS.electricityFee },
    { key: 'waterFee', label: '水费', color: RENT_COST_COLORS.waterFee },
    { key: 'gasFee', label: '燃气费', color: RENT_COST_COLORS.gasFee },
    { key: 'agencyFee', label: '中介费', color: RENT_COST_COLORS.agencyFee },
    { key: 'cleaningFee', label: '保洁费', color: RENT_COST_COLORS.cleaningFee },
    { key: 'laundryFee', label: '洗衣费', color: RENT_COST_COLORS.laundryFee },
    { key: 'serviceFee', label: '服务费', color: RENT_COST_COLORS.serviceFee },
  ];

  return items
    .map((item) => ({
      key: item.key,
      label: item.label,
      value: Number(totals[item.key].toFixed(2)),
      percentage: totalAmount ? Number(((totals[item.key] / totalAmount) * 100).toFixed(2)) : 0,
      color: item.color,
    }))
    .filter((item) => item.value > 0);
}

export function buildRentChannelBreakdown(
  records: RentHousingRecord[],
  channels: RentChannel[],
): RentChannelBreakdownPoint[] {
  const scopedChannels = filterRentChannels(channels);
  const scopedRecords = filterRentRecords(records);

  return scopedChannels
    .map((channel, index) => ({
      channelId: channel.id,
      channelName: channel.name,
      count: scopedRecords.filter((record) => record.channelId === channel.id).length,
      color: RENT_CHANNEL_COLORS[index % RENT_CHANNEL_COLORS.length],
    }))
    .filter((item) => item.count > 0);
}

export function buildRentRecordSnapshot(record: RentHousingRecord) {
  const metrics = calculateRentDerivedMetrics(record);

  return {
    ...record,
    ...metrics,
  };
}

/**
 * 按自然月拆分入住期间的房租与总成本。
 *
 * 适用场景：
 * - 跨月租期（如 8-15 至 9-15），需要知道每个月分别承担多少房租，便于单独记账
 * - 未设置退租日期的在住记录，截止日按今天计算
 *
 * 拆分规则：
 * - 先算"日均房租" = 总房租 ÷ 总居住天数（以月租为周期的房租均摊到每一天）
 * - 再算"日均总成本" =（房租+水电+燃气+服务+保洁+洗衣）÷ 总居住天数
 *   （押金、中介费不参与月度摊销）
 * - 按每个自然月在住天数分别累加
 *
 * @param record 住房记录
 * @returns 每个自然月的拆分明细数组，按年月升序
 */
export function calculateRentMonthlyBreakdown(record: RentHousingRecord): RentMonthlyBreakdownItem[] {
  const moveIn = dayjs(record.moveInDate).startOf('day');
  const moveOut = record.moveOutDate ? dayjs(record.moveOutDate).startOf('day') : dayjs().startOf('day');
  const safeMoveOut = moveOut.isBefore(moveIn, 'day') ? moveIn : moveOut;
  const totalStayDays = Math.max(1, safeMoveOut.diff(moveIn, 'day') + 1);

  const totalRent = Number(record.rent || 0);
  const totalAmortized = totalRent
    + Number(record.electricityFee || 0)
    + Number(record.waterFee || 0)
    + Number(record.gasFee || 0)
    + Number(record.serviceFee || 0)
    + Number(record.cleaningFee || 0)
    + Number(record.laundryFee || 0);

  const dailyRent = totalRent / totalStayDays;
  const dailyTotalCost = totalAmortized / totalStayDays;

  const items: RentMonthlyBreakdownItem[] = [];

  // 从入住月开始，逐月遍历
  let cursor = moveIn.startOf('month');
  const endMonth = safeMoveOut.startOf('month');

  while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
    const monthStart = cursor.startOf('month');
    const monthEnd = cursor.endOf('month');

    // 本月在住区间与租期取交集
    const overlapStart = moveIn.isAfter(monthStart) ? moveIn : monthStart;
    const overlapEnd = safeMoveOut.isBefore(monthEnd) ? safeMoveOut : monthEnd;

    if (!overlapEnd.isBefore(overlapStart, 'day')) {
      const stayDays = overlapEnd.diff(overlapStart, 'day') + 1;
      const rentShare = Number((dailyRent * stayDays).toFixed(2));
      const totalCostShare = Number((dailyTotalCost * stayDays).toFixed(2));

      items.push({
        yearMonth: cursor.format('YYYY-MM'),
        stayDays,
        dateRangeLabel: `${overlapStart.format(DATE_FORMAT)} 至 ${overlapEnd.format(DATE_FORMAT)}`,
        rentShare,
        totalCostShare,
      });
    }

    cursor = cursor.add(1, 'month').startOf('month');
  }

  return items;
}

/**
 * 格式化年月为中文显示
 * @param yearMonth 格式 YYYY-MM
 * @returns 如 "2026年1月"
 */
export function formatYearMonth(yearMonth: string): string {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return yearMonth;
  const [y, m] = yearMonth.split('-');
  return `${y}年${Number(m)}月`;
}

/**
 * 计算单月账单小计金额（电费 + 水费 + 燃气费）
 * @param bill 月度账单
 * @returns 小计金额
 */
export function getUtilityBillTotal(bill: RentUtilityBill): number {
  return Number((bill.electricityFee + bill.waterFee + bill.gasFee).toFixed(2));
}

/**
 * 从账单列表汇总水电燃气费用
 * @param bills 账单列表
 * @returns 各项合计与总计
 */
export function summarizeUtilityBills(bills: RentUtilityBill[]): {
  electricityTotal: number;
  waterTotal: number;
  gasTotal: number;
  grandTotal: number;
} {
  const electricityTotal = bills.reduce((s, b) => s + b.electricityFee, 0);
  const waterTotal = bills.reduce((s, b) => s + b.waterFee, 0);
  const gasTotal = bills.reduce((s, b) => s + b.gasFee, 0);
  const grandTotal = Number((electricityTotal + waterTotal + gasTotal).toFixed(2));
  return { electricityTotal, waterTotal, gasTotal, grandTotal };
}

/**
 * 筛选指定住房记录的月度账单
 * @param bills 全部账单
 * @param recordId 住房记录 ID
 * @returns 该记录关联的账单列表
 */
export function filterBillsByRecordId(bills: RentUtilityBill[], recordId: string): RentUtilityBill[] {
  return bills.filter((b) => b.recordId === recordId);
}
