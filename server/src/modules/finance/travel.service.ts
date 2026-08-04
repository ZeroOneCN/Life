import dayjs from 'dayjs';

import { FinanceTravelExpenseRecordEntity } from './entities/finance-travel-expense-record.entity';
import { toNumber } from '../../shared/utils/number';

/** 旅行记录响应 DTO */
export interface TravelRecordDto {
  id: string;
  userId: string;
  bookId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  durationMinutes: number;
  category: string;
  title: string;
  amount: number;
  discountAmount: number;
  discountNote: string;
  vehicleInfo: string;
  payChannel: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

/** 旅行汇总结果 */
export interface TravelSummary {
  totalCount: number;
  totalAmount: number;
  totalSaved: number;
  totalPaidAmount: number;
  topCategoryName: string;
  topPayChannelName: string;
}

/**
 * 计算旅行记录净额（amount - discount_amount，净额为负时回退到原金额）。
 * 与 assistant.tools.ts 旧实现保持一致：net > 0 ? net : amount。
 * @param record 旅行支出记录
 * @returns 净额
 */
export function computeTravelNetAmount(record: FinanceTravelExpenseRecordEntity): number {
  const amount = toNumber(record.amount);
  const discount = toNumber(record.discount_amount);
  const net = amount - discount;
  return net > 0 ? net : amount;
}

/**
 * 计算旅行记录总净额（所有记录净额求和）。
 * @param records 旅行支出记录列表
 * @returns 总净额（保留 2 位小数）
 */
export function sumTravelNetAmount(records: FinanceTravelExpenseRecordEntity[]): number {
  const total = records.reduce((sum, row) => sum + computeTravelNetAmount(row), 0);
  return Number(total.toFixed(2));
}

/**
 * 构建旅行汇总（与 travel.router.ts buildSummary 口径一致，但 totalPaidAmount 使用净额计算）。
 * @param records 旅行支出记录列表
 * @param payChannels 支付渠道映射（可选）
 * @returns 汇总结果
 */
export function buildTravelSummary(
  records: FinanceTravelExpenseRecordEntity[],
  payChannels: Array<{ value: string; label: string }> = [],
): TravelSummary {
  const totalAmount = records.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const totalSaved = records.reduce((sum, item) => sum + toNumber(item.discount_amount), 0);
  const paidAmount = sumTravelNetAmount(records);

  const channelLabelMap = new Map<string, string>(
    payChannels.map((channel) => [channel.value.trim().toUpperCase(), channel.label]),
  );
  const resolvePayChannelLabel = (value: string) => {
    const normalized = value.trim().toUpperCase();
    return channelLabelMap.get(normalized) ?? value;
  };

  const categoryBreakdown = new Map<string, { totalAmount: number; count: number }>();
  const channelBreakdown = new Map<string, { totalAmount: number; count: number }>();

  records.forEach((item) => {
    const categoryKey = item.category || 'other';
    const category = categoryBreakdown.get(categoryKey) ?? { totalAmount: 0, count: 0 };
    category.totalAmount += toNumber(item.amount);
    category.count += 1;
    categoryBreakdown.set(categoryKey, category);

    const channelKey = resolvePayChannelLabel(item.pay_channel);
    const channel = channelBreakdown.get(channelKey) ?? { totalAmount: 0, count: 0 };
    channel.totalAmount += toNumber(item.amount);
    channel.count += 1;
    channelBreakdown.set(channelKey, channel);
  });

  return {
    totalCount: records.length,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalSaved: Number(totalSaved.toFixed(2)),
    totalPaidAmount: Number(paidAmount.toFixed(2)),
    topCategoryName: Array.from(categoryBreakdown.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount)[0]?.[0] ?? '暂无',
    topPayChannelName: Array.from(channelBreakdown.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount)[0]?.[0] ?? '暂无',
  };
}

/**
 * 将旅行支出记录实体转为前端响应对象。
 * @param entity 旅行支出记录实体
 * @returns 前端响应 DTO
 */
export function mapTravelRecord(entity: FinanceTravelExpenseRecordEntity): TravelRecordDto {
  return {
    id: entity.id,
    userId: entity.user_id,
    bookId: entity.book_id,
    date: dayjs(entity.date).format('YYYY-MM-DD'),
    timeStart: entity.time_start ?? '',
    timeEnd: entity.time_end ?? '',
    durationMinutes: Number(entity.duration_minutes) || 0,
    category: entity.category,
    title: entity.title,
    amount: Number(entity.amount),
    discountAmount: Number(entity.discount_amount),
    discountNote: entity.discount_note ?? '',
    vehicleInfo: entity.vehicle_info ?? '',
    payChannel: entity.pay_channel,
    remark: entity.remark ?? '',
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}
