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
  RentOverviewSummary,
  RentPageState,
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
    createdAt,
    updatedAt,
  };
}

function createInitialChannels(): RentChannel[] {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortChannels([
    { id: 'rent-channel-ziroom', name: '自如', createdAt: now, updatedAt: now },
    { id: 'rent-channel-lianjia', name: '链家', createdAt: now, updatedAt: now },
    { id: 'rent-channel-landlord', name: '房东直租', createdAt: now, updatedAt: now },
    { id: 'rent-channel-beike', name: '贝壳', createdAt: now, updatedAt: now },
  ]);
}

function createInitialRecords(channels: RentChannel[]): RentHousingRecord[] {
  const channelMap = Object.fromEntries(channels.map((channel) => [channel.id, channel]));
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortRecords([
    {
      id: 'rent-record-1',
      address: '上海市浦东新区锦绣路 1888 弄 8 号 1202',
      channelId: 'rent-channel-ziroom',
      channelName: channelMap['rent-channel-ziroom']?.name ?? '自如',
      moveInDate: dayjs().subtract(95, 'day').format(DATE_FORMAT),
      moveOutDate: '',
      rent: 5200,
      deposit: 5200,
      electricityFee: 268,
      waterFee: 96,
      gasFee: 44,
      agencyFee: 0,
      cleaningFee: 80,
      laundryFee: 42,
      serviceFee: 180,
      notes: '地铁步行 8 分钟，物业相对稳定。',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rent-record-2',
      address: '杭州市西湖区古荆新村 23 幢 402',
      channelId: 'rent-channel-lianjia',
      channelName: channelMap['rent-channel-lianjia']?.name ?? '链家',
      moveInDate: dayjs().subtract(280, 'day').format(DATE_FORMAT),
      moveOutDate: dayjs().subtract(130, 'day').format(DATE_FORMAT),
      rent: 4100,
      deposit: 4100,
      electricityFee: 182,
      waterFee: 74,
      gasFee: 38,
      agencyFee: 1800,
      cleaningFee: 65,
      laundryFee: 36,
      serviceFee: 120,
      notes: '合租转整租前的过渡住房。',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rent-record-3',
      address: '深圳市南山区后海大道 99 号 3 栋 1706',
      channelId: 'rent-channel-beike',
      channelName: channelMap['rent-channel-beike']?.name ?? '贝壳',
      moveInDate: dayjs().subtract(44, 'day').format(DATE_FORMAT),
      moveOutDate: '',
      rent: 6800,
      deposit: 6800,
      electricityFee: 226,
      waterFee: 88,
      gasFee: 0,
      agencyFee: 2200,
      cleaningFee: 90,
      laundryFee: 0,
      serviceFee: 240,
      notes: '近办公室，当前仍在住。',
      createdAt: now,
      updatedAt: now,
    },
  ]);
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
  const monthlyRent = Number(((record.rent * 30) / stayDays).toFixed(2));
  const quarterlyRent = Number((monthlyRent * 3).toFixed(2));

  return {
    stayDays,
    totalCost,
    dailyCost,
    monthlyRent,
    quarterlyRent,
    occupancyStatus: record.moveOutDate ? 'ended' : 'active',
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

      return [record.address, record.channelName, record.notes]
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
