import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { FinanceTravelBookEntity } from './entities/finance-travel-book.entity';
import { FinanceTravelExpenseRecordEntity } from './entities/finance-travel-expense-record.entity';
import { FinanceTravelImportBatchEntity } from './entities/finance-travel-import-batch.entity';
import { FinanceTravelPayChannelEntity } from './entities/finance-travel-pay-channel.entity';
import { FinanceTravelSettingEntity } from './entities/finance-travel-setting.entity';

/* 分类英文枚举 → 中文标签（与前端 CATEGORY_LABELS 保持一致） */
const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通',
  hotel: '住宿',
  food: '餐饮',
  ticket: '门票',
  shopping: '购物',
  other: '其他',
};

/* 中文旧值 → 英文枚举（兼容数据库中可能直接存中文的旧数据） */
const CATEGORY_CHINESE_TO_ENUM: Record<string, string> = {
  交通: 'transport',
  住宿: 'hotel',
  酒店: 'hotel',
  餐饮: 'food',
  美食: 'food',
  门票: 'ticket',
  购物: 'shopping',
  其他: 'other',
};

function normalizeTravelCategoryLabel(value: string): string {
  if (!value) return '其他';
  if (CATEGORY_LABELS[value]) return CATEGORY_LABELS[value];
  const enumValue = CATEGORY_CHINESE_TO_ENUM[value];
  if (enumValue && CATEGORY_LABELS[enumValue]) return CATEGORY_LABELS[enumValue];
  return value;
}

const bookSchema = z.object({
  userId: z.string().trim().optional(),
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
  startDate: z.string().min(1),
  endDate: z.string().optional().default(''),
  summary: z.string().optional().default(''),
});

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  bookId: z.string().trim().min(1),
  date: z.string().min(1),
  timeStart: z.string().trim().min(1),
  timeEnd: z.string().trim().min(1),
  category: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(255),
  amount: z.number().min(0),
  discountAmount: z.number().min(0).optional().default(0),
  discountNote: z.string().optional().default(''),
  vehicleInfo: z.string().optional().default(''),
  payChannel: z.string().trim().min(1).max(64),
  remark: z.string().optional().default(''),
});

const payChannelSchema = z.object({
  value: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(128),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional().default(''),
  activeBookId: z.string().optional().default(''),
  detailsBookId: z.string().optional().default(''),
  statsBookId: z.string().optional().default(''),
  reportBookId: z.string().optional().default(''),
  leaderboardUserId: z.string().optional().default(''),
  reportColumns: z.array(z.string()).optional().default([]),
});

const importRowSchema = z.object({
  userId: z.string().trim().optional(),
  bookId: z.string().trim().optional(),
  date: z.string().optional(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  category: z.string().optional(),
  title: z.string().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  discountAmount: z.union([z.number(), z.string()]).optional(),
  discountNote: z.string().optional(),
  vehicleInfo: z.string().optional(),
  payChannel: z.string().optional(),
  remark: z.string().optional(),
});

const importSchema = z.object({
  fileName: z.string().trim().optional().default('travel-import.json'),
  rows: z.array(importRowSchema).default([]),
});

const exportSchema = z.object({
  userId: z.string().trim().optional(),
  bookId: z.string().trim().min(1),
  format: z.enum(['json', 'html']).optional().default('json'),
});

const settingService = new BaseUserSettingService(FinanceTravelSettingEntity);

function toMoney(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeTime(value: unknown, fallback = '00:00') {
  const raw = String(value ?? '').trim();
  const matched = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!matched) {
    return fallback;
  }
  return `${String(Number(matched[1])).padStart(2, '0')}:${matched[2]}`;
}

function calculateDurationMinutes(timeStart: string, timeEnd: string) {
  const start = dayjs(`2020-01-01T${normalizeTime(timeStart)}`);
  let end = dayjs(`2020-01-01T${normalizeTime(timeEnd)}`);

  if (end.isBefore(start)) {
    end = end.add(1, 'day');
  }

  return Math.max(0, end.diff(start, 'minute'));
}

function mapBook(entity: FinanceTravelBookEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    name: entity.name,
    description: entity.description,
    startDate: dayjs(entity.start_date).format('YYYY-MM-DD'),
    endDate: entity.end_date ? dayjs(entity.end_date).format('YYYY-MM-DD') : '',
    summary: entity.summary,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapRecord(entity: FinanceTravelExpenseRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    bookId: entity.book_id,
    date: dayjs(entity.date).format('YYYY-MM-DD'),
    timeStart: entity.time_start,
    timeEnd: entity.time_end,
    durationMinutes: entity.duration_minutes,
    category: entity.category,
    title: entity.title,
    amount: Number(entity.amount),
    discountAmount: Number(entity.discount_amount),
    discountNote: entity.discount_note,
    vehicleInfo: entity.vehicle_info,
    payChannel: entity.pay_channel,
    remark: entity.remark,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapPayChannel(entity: FinanceTravelPayChannelEntity) {
  return {
    id: entity.id,
    value: entity.value,
    label: entity.label,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function buildRecordKey(item: {
  userId: string;
  bookId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  title: string;
  amount: number;
}) {
  return [
    item.userId.trim().toLowerCase(),
    item.bookId.trim().toLowerCase(),
    item.date,
    item.timeStart,
    item.timeEnd,
    item.title.trim().toLowerCase(),
    item.amount.toFixed(2),
  ].join('|');
}

function buildSummary(records: FinanceTravelExpenseRecordEntity[], payChannels: Array<{ value: string; label: string }> = []) {
  const totalAmount = records.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalSaved = records.reduce((sum, item) => sum + Number(item.discount_amount), 0);
  const paidAmount = totalAmount - totalSaved;
  const channelLabelMap = new Map<string, string>(
    payChannels.map((channel) => [channel.value.trim().toUpperCase(), channel.label]),
  );
  const resolvePayChannelLabel = (value: string) => {
    const normalized = value.trim().toUpperCase();
    return channelLabelMap.get(normalized) ?? value;
  };
  const categoryBreakdown = new Map<string, { totalAmount: number; savedAmount: number; count: number }>();
  const channelBreakdown = new Map<string, { totalAmount: number; savedAmount: number; count: number }>();

  records.forEach((item) => {
    const categoryKey = normalizeTravelCategoryLabel(item.category);
    const category = categoryBreakdown.get(categoryKey) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
    category.totalAmount += Number(item.amount);
    category.savedAmount += Number(item.discount_amount);
    category.count += 1;
    categoryBreakdown.set(categoryKey, category);

    const channelKey = resolvePayChannelLabel(item.pay_channel);
    const channel = channelBreakdown.get(channelKey) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
    channel.totalAmount += Number(item.amount);
    channel.savedAmount += Number(item.discount_amount);
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

export function createTravelRouter() {
  const router = Router();

  router.get('/books', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const repository = appDataSource.getRepository(FinanceTravelBookEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    });

    response.json(successResponse(buildListData(items.map(mapBook))));
  }));

  router.post('/books', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(bookSchema, request.body);
    const repository = appDataSource.getRepository(FinanceTravelBookEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      name: payload.name,
      description: payload.description,
      start_date: normalizeDate(payload.startDate),
      end_date: payload.endDate ? normalizeDate(payload.endDate) : null,
      summary: payload.summary,
    }));

    response.json(successResponse(mapBook(item), 'create_travel_book_success'));
  }));

  router.patch('/books/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const bookId = String(request.params.id ?? '');
    const payload = validateBody(bookSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceTravelBookEntity);
    const current = await repository.findOne({
      where: { id: bookId, user_id: userId },
    });

    if (!current) {
      throw new AppError('travel_book_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
      start_date: payload.startDate ? normalizeDate(payload.startDate) : current.start_date,
      end_date: payload.endDate !== undefined ? (payload.endDate ? normalizeDate(payload.endDate) : null) : current.end_date,
      summary: payload.summary ?? current.summary,
    });

    response.json(successResponse(mapBook(next), 'update_travel_book_success'));
  }));

  router.delete('/books/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const bookId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceTravelBookEntity);
    const current = await repository.findOne({
      where: { id: bookId, user_id: userId },
    });

    if (!current) {
      throw new AppError('travel_book_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_travel_book_success'));
  }));

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const bookId = String(request.query.bookId ?? 'all');
    const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { date: 'DESC', updated_at: 'DESC' },
    });

    const filtered = items
      .filter((item) => bookId === 'all' || item.book_id === bookId)
      .filter((item) => !keyword || [item.title, item.category, item.pay_channel, item.remark, item.vehicle_info].some((value) => value.toLowerCase().includes(keyword)));

    response.json(successResponse(buildListData(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const repository = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      book_id: payload.bookId,
      date: normalizeDate(payload.date),
      time_start: normalizeTime(payload.timeStart),
      time_end: normalizeTime(payload.timeEnd),
      duration_minutes: calculateDurationMinutes(payload.timeStart, payload.timeEnd),
      category: payload.category,
      title: payload.title,
      amount: payload.amount,
      discount_amount: payload.discountAmount,
      discount_note: payload.discountNote,
      vehicle_info: payload.vehicleInfo,
      pay_channel: payload.payChannel,
      remark: payload.remark,
    }));

    response.json(successResponse(mapRecord(item), 'create_travel_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('travel_record_not_found', 404, 404);
    }

    const nextTimeStart = payload.timeStart ? normalizeTime(payload.timeStart) : current.time_start;
    const nextTimeEnd = payload.timeEnd ? normalizeTime(payload.timeEnd) : current.time_end;
    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      book_id: payload.bookId ?? current.book_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      time_start: nextTimeStart,
      time_end: nextTimeEnd,
      duration_minutes: calculateDurationMinutes(nextTimeStart, nextTimeEnd),
      category: payload.category ?? current.category,
      title: payload.title ?? current.title,
      amount: payload.amount ?? current.amount,
      discount_amount: payload.discountAmount ?? current.discount_amount,
      discount_note: payload.discountNote ?? current.discount_note,
      vehicle_info: payload.vehicleInfo ?? current.vehicle_info,
      pay_channel: payload.payChannel ?? current.pay_channel,
      remark: payload.remark ?? current.remark,
    });

    response.json(successResponse(mapRecord(next), 'update_travel_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('travel_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_travel_record_success'));
  }));

  router.get('/pay-channels', asyncHandler(async (_request: AuthenticatedRequest, response) => {
    const repository = appDataSource.getRepository(FinanceTravelPayChannelEntity);
    const items = await repository.find({
      order: { label: 'ASC' },
    });
    response.json(successResponse(buildListData(items.map(mapPayChannel))));
  }));

  router.post('/pay-channels', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = validateBody(payChannelSchema, request.body);
    const repository = appDataSource.getRepository(FinanceTravelPayChannelEntity);
    const item = await repository.save(repository.create({
      value: payload.value.toUpperCase(),
      label: payload.label,
    }));

    response.json(successResponse(mapPayChannel(item), 'create_travel_pay_channel_success'));
  }));

  router.patch('/pay-channels/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const channelId = String(request.params.id ?? '');
    const payload = validateBody(payChannelSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceTravelPayChannelEntity);
    const current = await repository.findOne({ where: { id: channelId } });

    if (!current) {
      throw new AppError('travel_pay_channel_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      value: payload.value ? payload.value.toUpperCase() : current.value,
      label: payload.label ?? current.label,
    });

    response.json(successResponse(mapPayChannel(next), 'update_travel_pay_channel_success'));
  }));

  router.delete('/pay-channels/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const channelId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceTravelPayChannelEntity);
    const current = await repository.findOne({ where: { id: channelId } });

    if (!current) {
      throw new AppError('travel_pay_channel_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_travel_pay_channel_success'));
  }));

  router.get('/summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const bookId = String(request.query.bookId ?? 'all');
    const [records, payChannels] = await Promise.all([
      appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceTravelPayChannelEntity).find(),
    ]);
    const scopedRecords = records.filter((item) => bookId === 'all' || item.book_id === bookId);

    response.json(successResponse(buildSummary(scopedRecords, payChannels)));
  }));

  router.get('/daily-trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const bookId = String(request.query.bookId ?? 'all');
    const repository = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const records = (await repository.find({ where: { user_id: userId } }))
      .filter((item) => bookId === 'all' || item.book_id === bookId);
    const grouped = new Map<string, { totalAmount: number; savedAmount: number; count: number }>();

    records.forEach((item) => {
      const current = grouped.get(item.date) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
      current.totalAmount += Number(item.amount);
      current.savedAmount += Number(item.discount_amount);
      current.count += 1;
      grouped.set(item.date, current);
    });

    const items = Array.from(grouped.entries())
      .map(([date, value]) => ({
        date,
        label: dayjs(date).format('MM-DD'),
        totalAmount: Number(value.totalAmount.toFixed(2)),
        savedAmount: Number(value.savedAmount.toFixed(2)),
        paidAmount: Number((value.totalAmount - value.savedAmount).toFixed(2)),
        count: value.count,
      }))
      .sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf());

    response.json(successResponse(items));
  }));

  router.get('/category-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const bookId = String(request.query.bookId ?? 'all');
    const repository = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const records = (await repository.find({ where: { user_id: userId } }))
      .filter((item) => bookId === 'all' || item.book_id === bookId);
    const grouped = new Map<string, { totalAmount: number; savedAmount: number; count: number }>();

    records.forEach((item) => {
      const name = normalizeTravelCategoryLabel(item.category);
      const current = grouped.get(name) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
      current.totalAmount += Number(item.amount);
      current.savedAmount += Number(item.discount_amount);
      current.count += 1;
      grouped.set(name, current);
    });

    const items = Array.from(grouped.entries())
      .map(([name, value]) => ({
        name,
        count: value.count,
        totalAmount: Number(value.totalAmount.toFixed(2)),
        savedAmount: Number(value.savedAmount.toFixed(2)),
        paidAmount: Number((value.totalAmount - value.savedAmount).toFixed(2)),
      }))
      .sort((left, right) => right.paidAmount - left.paidAmount);

    response.json(successResponse(items));
  }));

  router.get('/pay-channel-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const bookId = String(request.query.bookId ?? 'all');
    const [records, payChannels] = await Promise.all([
      appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceTravelPayChannelEntity).find(),
    ]);
    const scopedRecords = records.filter((item) => bookId === 'all' || item.book_id === bookId);
    const channelLabelMap = new Map<string, string>(
      payChannels.map((channel) => [channel.value.trim().toUpperCase(), channel.label]),
    );
    const grouped = new Map<string, { totalAmount: number; savedAmount: number; count: number }>();

    scopedRecords.forEach((item) => {
      const name = channelLabelMap.get(item.pay_channel.trim().toUpperCase()) ?? item.pay_channel;
      const current = grouped.get(name) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
      current.totalAmount += Number(item.amount);
      current.savedAmount += Number(item.discount_amount);
      current.count += 1;
      grouped.set(name, current);
    });

    const items = Array.from(grouped.entries())
      .map(([name, value]) => ({
        name,
        count: value.count,
        totalAmount: Number(value.totalAmount.toFixed(2)),
        savedAmount: Number(value.savedAmount.toFixed(2)),
        paidAmount: Number((value.totalAmount - value.savedAmount).toFixed(2)),
      }))
      .sort((left, right) => right.paidAmount - left.paidAmount);

    response.json(successResponse(items));
  }));

  router.get('/leaderboard', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [books, records] = await Promise.all([
      appDataSource.getRepository(FinanceTravelBookEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId } }),
    ]);

    const items = books.map((book) => {
      const scoped = records.filter((item) => item.book_id === book.id);
      const totalAmount = scoped.reduce((sum, item) => sum + Number(item.amount), 0);
      const totalSaved = scoped.reduce((sum, item) => sum + Number(item.discount_amount), 0);
      return {
        bookId: book.id,
        bookName: book.name,
        totalCount: scoped.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalSaved: Number(totalSaved.toFixed(2)),
        totalPaidAmount: Number((totalAmount - totalSaved).toFixed(2)),
        updatedAt: book.updated_at.toISOString(),
      };
    }).sort((left, right) => right.totalPaidAmount - left.totalPaidAmount);

    response.json(successResponse(items));
  }));

  router.get('/report', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const bookId = String(request.query.bookId ?? '');
    const [book, records, payChannels] = await Promise.all([
      appDataSource.getRepository(FinanceTravelBookEntity).findOne({ where: { id: bookId, user_id: userId } }),
      appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId, book_id: bookId } }),
      appDataSource.getRepository(FinanceTravelPayChannelEntity).find(),
    ]);

    response.json(successResponse({
      book: book ? mapBook(book) : null,
      summary: buildSummary(records, payChannels),
      records: records.map(mapRecord),
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      payChannels: payChannels.map(mapPayChannel),
    }));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      active_book_id: null,
      details_book_id: null,
      stats_book_id: null,
      report_book_id: null,
      leaderboard_user_id: userId,
      report_columns_json: null,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      activeBookId: settings.active_book_id ?? '',
      detailsBookId: settings.details_book_id ?? '',
      statsBookId: settings.stats_book_id ?? '',
      reportBookId: settings.report_book_id ?? '',
      leaderboardUserId: settings.leaderboard_user_id ?? userId,
      reportColumns: settings.report_columns_json ?? [],
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      active_user_id: payload.activeUserId,
      active_book_id: payload.activeBookId,
      details_book_id: payload.detailsBookId,
      stats_book_id: payload.statsBookId,
      report_book_id: payload.reportBookId,
      leaderboard_user_id: payload.leaderboardUserId,
      report_columns_json: payload.reportColumns,
    }, {
      active_user_id: userId,
      active_book_id: null,
      details_book_id: null,
      stats_book_id: null,
      report_book_id: null,
      leaderboard_user_id: userId,
      report_columns_json: null,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      activeBookId: settings.active_book_id ?? '',
      detailsBookId: settings.details_book_id ?? '',
      statsBookId: settings.stats_book_id ?? '',
      reportBookId: settings.report_book_id ?? '',
      leaderboardUserId: settings.leaderboard_user_id ?? userId,
      reportColumns: settings.report_columns_json ?? [],
    }, 'update_travel_settings_success'));
  }));

  router.post('/actions/import', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(importSchema, request.body);
    const rows = payload.rows ?? [];
    const recordRepo = appDataSource.getRepository(FinanceTravelExpenseRecordEntity);
    const batchRepo = appDataSource.getRepository(FinanceTravelImportBatchEntity);
    const existing = await recordRepo.find({ where: { user_id: authUserId } });
    const seen = new Set(existing.map((item) => buildRecordKey({
      userId: item.user_id,
      bookId: item.book_id,
      date: item.date,
      timeStart: item.time_start,
      timeEnd: item.time_end,
      title: item.title,
      amount: Number(item.amount),
    })));

    let importedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const toSave: FinanceTravelExpenseRecordEntity[] = [];

    rows.forEach((row) => {
      const userId = row.userId ?? authUserId;
      const bookId = row.bookId ?? '';
      const date = row.date ? normalizeDate(row.date) : '';
      const title = row.title?.trim() ?? '';
      const category = row.category?.trim() ?? '';
      const payChannel = row.payChannel?.trim() ?? '';
      const amount = toMoney(row.amount, NaN);
      const timeStart = normalizeTime(row.timeStart, '');
      const timeEnd = normalizeTime(row.timeEnd, '');

      if (!bookId || !date || !title || !category || !payChannel || !timeStart || !timeEnd || !Number.isFinite(amount) || amount <= 0) {
        invalidCount += 1;
        return;
      }

      const key = buildRecordKey({
        userId,
        bookId,
        date,
        timeStart,
        timeEnd,
        title,
        amount,
      });

      if (seen.has(key)) {
        duplicateCount += 1;
        return;
      }

      seen.add(key);
      importedCount += 1;
      toSave.push(recordRepo.create({
        user_id: userId,
        book_id: bookId,
        date,
        time_start: timeStart,
        time_end: timeEnd,
        duration_minutes: calculateDurationMinutes(timeStart, timeEnd),
        category,
        title,
        amount,
        discount_amount: toMoney(row.discountAmount, 0),
        discount_note: row.discountNote ?? '',
        vehicle_info: row.vehicleInfo ?? '',
        pay_channel: payChannel,
        remark: row.remark ?? '',
      }));
    });

    if (toSave.length) {
      await recordRepo.save(toSave);
    }

    await batchRepo.save(batchRepo.create({
      user_id: authUserId,
      file_name: payload.fileName,
      total_rows: rows.length,
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      invalid_count: invalidCount,
      summary_json: {
        importedCount,
        duplicateCount,
        invalidCount,
      },
    }));

    response.json(successResponse({
      total_rows: rows.length,
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      invalid_count: invalidCount,
    }, 'import_travel_records_success'));
  }));

  router.post('/actions/export-report', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(exportSchema, request.body);
    const userId = payload.userId ?? authUserId;
    const [book, records, payChannels] = await Promise.all([
      appDataSource.getRepository(FinanceTravelBookEntity).findOne({ where: { id: payload.bookId, user_id: userId } }),
      appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId, book_id: payload.bookId } }),
      appDataSource.getRepository(FinanceTravelPayChannelEntity).find(),
    ]);

    const report = {
      book: book ? mapBook(book) : null,
      summary: buildSummary(records, payChannels),
      records: records.map(mapRecord),
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
    };

    if (payload.format === 'html') {
      const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>旅行报告</title></head><body><h1>${book?.name ?? '旅行报告'}</h1><pre>${JSON.stringify(report, null, 2)}</pre></body></html>`;
      response.json(successResponse({
        format: 'html',
        fileName: `${book?.name ?? 'travel-report'}.html`,
        content: html,
      }, 'export_travel_report_success'));
      return;
    }

    response.json(successResponse({
      format: 'json',
      fileName: `${book?.name ?? 'travel-report'}.json`,
      content: report,
    }, 'export_travel_report_success'));
  }));

  return router;
}
