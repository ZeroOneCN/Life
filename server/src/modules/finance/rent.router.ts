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
import { FinanceRentChannelEntity } from './entities/finance-rent-channel.entity';
import { FinanceRentRecordEntity } from './entities/finance-rent-record.entity';
import { FinanceRentSettingEntity } from './entities/finance-rent-setting.entity';

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  address: z.string().trim().min(1).max(255),
  channelId: z.string().trim().min(1),
  channelName: z.string().trim().optional().default(''),
  moveInDate: z.string().min(1),
  moveOutDate: z.string().optional().default(''),
  rent: z.number().min(0).optional().default(0),
  deposit: z.number().min(0).optional().default(0),
  electricityFee: z.number().min(0).optional().default(0),
  waterFee: z.number().min(0).optional().default(0),
  gasFee: z.number().min(0).optional().default(0),
  agencyFee: z.number().min(0).optional().default(0),
  cleaningFee: z.number().min(0).optional().default(0),
  laundryFee: z.number().min(0).optional().default(0),
  serviceFee: z.number().min(0).optional().default(0),
  orientation: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const channelSchema = z.object({
  userId: z.string().trim().optional(),
  name: z.string().trim().min(1).max(128),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional().default(''),
  recordsUserId: z.string().optional().default(''),
  statisticsUserId: z.string().optional().default(''),
  editingRecordId: z.string().optional().default(''),
});

const settingService = new BaseUserSettingService(FinanceRentSettingEntity);

function mapChannel(entity: FinanceRentChannelEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    name: entity.name,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function calculateRentMetrics(entity: FinanceRentRecordEntity) {
  const start = dayjs(entity.move_in_date).startOf('day');
  const end = entity.move_out_date ? dayjs(entity.move_out_date).startOf('day') : dayjs().startOf('day');
  const safeEnd = end.isBefore(start) ? start : end;
  const stayDays = Math.max(1, safeEnd.diff(start, 'day') + 1);
  const totalCost = Number((
    Number(entity.rent)
    + Number(entity.electricity_fee)
    + Number(entity.water_fee)
    + Number(entity.gas_fee)
    + Number(entity.agency_fee)
    + Number(entity.cleaning_fee)
    + Number(entity.laundry_fee)
    + Number(entity.service_fee)
  ).toFixed(2));
  const dailyCost = Number((totalCost / stayDays).toFixed(2));
  const monthlyRent = Number(((Number(entity.rent) * 30) / stayDays).toFixed(2));
  const quarterlyRent = Number((monthlyRent * 3).toFixed(2));

  return {
    stayDays,
    totalCost,
    dailyCost,
    monthlyRent,
    quarterlyRent,
    occupancyStatus: entity.move_out_date ? 'ended' : 'active',
  };
}

function mapRecord(entity: FinanceRentRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    address: entity.address,
    channelId: entity.channel_id,
    channelName: entity.channel_name,
    moveInDate: dayjs(entity.move_in_date).format('YYYY-MM-DD'),
    moveOutDate: entity.move_out_date ? dayjs(entity.move_out_date).format('YYYY-MM-DD') : '',
    rent: Number(entity.rent),
    deposit: Number(entity.deposit),
    electricityFee: Number(entity.electricity_fee),
    waterFee: Number(entity.water_fee),
    gasFee: Number(entity.gas_fee),
    agencyFee: Number(entity.agency_fee),
    cleaningFee: Number(entity.cleaning_fee),
    laundryFee: Number(entity.laundry_fee),
    serviceFee: Number(entity.service_fee),
    orientation: entity.orientation ?? '',
    notes: entity.notes,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
    ...calculateRentMetrics(entity),
  };
}

function buildOverview(records: FinanceRentRecordEntity[], channels: FinanceRentChannelEntity[]) {
  const metrics = records.map(calculateRentMetrics);
  const totalStayDays = metrics.reduce((sum, item) => sum + item.stayDays, 0);
  const totalCost = metrics.reduce((sum, item) => sum + item.totalCost, 0);
  const totalDailyCost = metrics.reduce((sum, item) => sum + item.dailyCost, 0);
  const totalMonthlyRent = metrics.reduce((sum, item) => sum + item.monthlyRent, 0);

  return {
    totalRecords: records.length,
    totalStayDays,
    totalCost: Number(totalCost.toFixed(2)),
    avgDailyCost: records.length ? Number((totalDailyCost / records.length).toFixed(2)) : 0,
    avgMonthlyCost: records.length ? Number((totalMonthlyRent / records.length).toFixed(2)) : 0,
    activeRecords: metrics.filter((item) => item.occupancyStatus === 'active').length,
    endedRecords: metrics.filter((item) => item.occupancyStatus === 'ended').length,
    totalChannels: channels.length,
  };
}

export function createRentRouter() {
  const router = Router();

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
    const channelId = String(request.query.channelId ?? 'all');
    const occupancy = String(request.query.occupancy ?? 'all');
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceRentRecordEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { move_in_date: 'DESC', updated_at: 'DESC' },
    });

    const filtered = items
      .filter((item) => !keyword || [item.address, item.channel_name, item.notes].some((value) => value.toLowerCase().includes(keyword)))
      .filter((item) => channelId === 'all' || item.channel_id === channelId)
      .filter((item) => {
        if (occupancy === 'all') {
          return true;
        }
        return occupancy === calculateRentMetrics(item).occupancyStatus;
      });

    const paged = filtered.slice(skip, skip + pageSize);
    response.json(successResponse(buildListData(paged.map(mapRecord), page, pageSize, filtered.length)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const userId = payload.userId ?? authUserId;
    const channelRepo = appDataSource.getRepository(FinanceRentChannelEntity);
    const recordRepo = appDataSource.getRepository(FinanceRentRecordEntity);
    const channel = await channelRepo.findOne({ where: { id: payload.channelId, user_id: userId } });

    const item = await recordRepo.save(recordRepo.create({
      user_id: userId,
      address: payload.address,
      channel_id: payload.channelId,
      channel_name: payload.channelName || channel?.name || '',
      move_in_date: normalizeDate(payload.moveInDate),
      move_out_date: payload.moveOutDate ? normalizeDate(payload.moveOutDate) : null,
      rent: payload.rent,
      deposit: payload.deposit,
      electricity_fee: payload.electricityFee,
      water_fee: payload.waterFee,
      gas_fee: payload.gasFee,
      agency_fee: payload.agencyFee,
      cleaning_fee: payload.cleaningFee,
      laundry_fee: payload.laundryFee,
      service_fee: payload.serviceFee,
      orientation: payload.orientation,
      notes: payload.notes,
    }));

    response.json(successResponse(mapRecord(item), 'create_rent_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceRentRecordEntity);
    const channelRepo = appDataSource.getRepository(FinanceRentChannelEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: authUserId },
    });

    if (!current) {
      throw new AppError('rent_record_not_found', 404, 404);
    }

    const nextUserId = payload.userId ?? current.user_id;
    const channel = payload.channelId
      ? await channelRepo.findOne({ where: { id: payload.channelId, user_id: nextUserId } })
      : null;

    const next = await repository.save({
      ...current,
      user_id: nextUserId,
      address: payload.address ?? current.address,
      channel_id: payload.channelId ?? current.channel_id,
      channel_name: payload.channelName ?? channel?.name ?? current.channel_name,
      move_in_date: payload.moveInDate ? normalizeDate(payload.moveInDate) : current.move_in_date,
      move_out_date: payload.moveOutDate !== undefined ? (payload.moveOutDate ? normalizeDate(payload.moveOutDate) : null) : current.move_out_date,
      rent: payload.rent ?? current.rent,
      deposit: payload.deposit ?? current.deposit,
      electricity_fee: payload.electricityFee ?? current.electricity_fee,
      water_fee: payload.waterFee ?? current.water_fee,
      gas_fee: payload.gasFee ?? current.gas_fee,
      agency_fee: payload.agencyFee ?? current.agency_fee,
      cleaning_fee: payload.cleaningFee ?? current.cleaning_fee,
      laundry_fee: payload.laundryFee ?? current.laundry_fee,
      service_fee: payload.serviceFee ?? current.service_fee,
      orientation: payload.orientation ?? current.orientation,
      notes: payload.notes ?? current.notes,
    });

    response.json(successResponse(mapRecord(next), 'update_rent_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceRentRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('rent_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_rent_record_success'));
  }));

  router.get('/channels', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const repository = appDataSource.getRepository(FinanceRentChannelEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });

    response.json(successResponse(buildListData(items.map(mapChannel))));
  }));

  router.post('/channels', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(channelSchema, request.body);
    const repository = appDataSource.getRepository(FinanceRentChannelEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      name: payload.name,
    }));

    response.json(successResponse(mapChannel(item), 'create_rent_channel_success'));
  }));

  router.patch('/channels/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const channelId = String(request.params.id ?? '');
    const payload = validateBody(channelSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceRentChannelEntity);
    const current = await repository.findOne({
      where: { id: channelId, user_id: authUserId },
    });

    if (!current) {
      throw new AppError('rent_channel_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      name: payload.name ?? current.name,
    });

    response.json(successResponse(mapChannel(next), 'update_rent_channel_success'));
  }));

  router.delete('/channels/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const channelId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceRentChannelEntity);
    const current = await repository.findOne({
      where: { id: channelId, user_id: userId },
    });

    if (!current) {
      throw new AppError('rent_channel_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_rent_channel_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [records, channels] = await Promise.all([
      appDataSource.getRepository(FinanceRentRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceRentChannelEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse(buildOverview(records, channels)));
  }));

  router.get('/cost-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const records = await appDataSource.getRepository(FinanceRentRecordEntity).find({ where: { user_id: userId } });
    const totals = {
      rent: 0,
      electricityFee: 0,
      waterFee: 0,
      gasFee: 0,
      agencyFee: 0,
      cleaningFee: 0,
      laundryFee: 0,
      serviceFee: 0,
    };

    records.forEach((item) => {
      totals.rent += Number(item.rent);
      totals.electricityFee += Number(item.electricity_fee);
      totals.waterFee += Number(item.water_fee);
      totals.gasFee += Number(item.gas_fee);
      totals.agencyFee += Number(item.agency_fee);
      totals.cleaningFee += Number(item.cleaning_fee);
      totals.laundryFee += Number(item.laundry_fee);
      totals.serviceFee += Number(item.service_fee);
    });

    const totalAmount = Object.values(totals).reduce((sum, value) => sum + value, 0);
    const items = [
      ['rent', '房租'],
      ['electricityFee', '电费'],
      ['waterFee', '水费'],
      ['gasFee', '燃气费'],
      ['agencyFee', '中介费'],
      ['cleaningFee', '保洁费'],
      ['laundryFee', '洗衣费'],
      ['serviceFee', '服务费'],
    ].map(([key, label]) => {
      const value = totals[key as keyof typeof totals];
      return {
        key,
        label,
        value: Number(value.toFixed(2)),
        percentage: totalAmount > 0 ? Number(((value / totalAmount) * 100).toFixed(2)) : 0,
      };
    }).filter((item) => item.value > 0);

    response.json(successResponse(items));
  }));

  router.get('/channel-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [records, channels] = await Promise.all([
      appDataSource.getRepository(FinanceRentRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceRentChannelEntity).find({ where: { user_id: userId } }),
    ]);

    const items = channels.map((channel) => ({
      channelId: channel.id,
      channelName: channel.name,
      count: records.filter((record) => record.channel_id === channel.id).length,
    })).filter((item) => item.count > 0);

    response.json(successResponse(items));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      records_user_id: userId,
      statistics_user_id: userId,
      editing_record_id: null,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      recordsUserId: settings.records_user_id ?? userId,
      statisticsUserId: settings.statistics_user_id ?? userId,
      editingRecordId: settings.editing_record_id ?? '',
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      active_user_id: payload.activeUserId,
      records_user_id: payload.recordsUserId,
      statistics_user_id: payload.statisticsUserId,
      editing_record_id: payload.editingRecordId,
    }, {
      active_user_id: userId,
      records_user_id: userId,
      statistics_user_id: userId,
      editing_record_id: null,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      recordsUserId: settings.records_user_id ?? userId,
      statisticsUserId: settings.statistics_user_id ?? userId,
      editingRecordId: settings.editing_record_id ?? '',
    }, 'update_rent_settings_success'));
  }));

  return router;
}
