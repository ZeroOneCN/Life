import { Router } from 'express';
import { In } from 'typeorm';
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
import { FinanceRentUtilityBillEntity } from './entities/finance-rent-utility-bill.entity';

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

/** 月度水电燃气账单校验规则 */
const utilityBillSchema = z.object({
  recordId: z.string().trim().min(1),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  electricityFee: z.number().min(0).optional().default(0),
  waterFee: z.number().min(0).optional().default(0),
  gasFee: z.number().min(0).optional().default(0),
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

/**
 * 根据住房记录和关联的月度账单计算派生指标
 * @param entity 住房记录实体
 * @param utilityBills 该记录关联的月度水电燃气账单列表
 */
function calculateRentMetrics(entity: FinanceRentRecordEntity, utilityBills: FinanceRentUtilityBillEntity[] = []) {
  const start = dayjs(entity.move_in_date).startOf('day');
  const end = entity.move_out_date ? dayjs(entity.move_out_date).startOf('day') : dayjs().startOf('day');
  const safeEnd = end.isBefore(start) ? start : end;
  const stayDays = Math.max(1, safeEnd.diff(start, 'day') + 1);

  // 从月度账单汇总水电燃气费用
  const electricityTotal = utilityBills.reduce((sum, b) => sum + Number(b.electricity_fee), 0);
  const waterTotal = utilityBills.reduce((sum, b) => sum + Number(b.water_fee), 0);
  const gasTotal = utilityBills.reduce((sum, b) => sum + Number(b.gas_fee), 0);

  const totalCost = Number((
    Number(entity.rent)
    + electricityTotal
    + waterTotal
    + gasTotal
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

/** 将月度账单实体映射为响应 DTO */
function mapUtilityBill(entity: FinanceRentUtilityBillEntity) {
  return {
    id: entity.id,
    recordId: entity.record_id,
    yearMonth: entity.year_month,
    electricityFee: Number(entity.electricity_fee),
    waterFee: Number(entity.water_fee),
    gasFee: Number(entity.gas_fee),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 将住房记录实体映射为响应 DTO，水电燃气费用从关联的月度账单汇总
 * @param entity 住房记录实体
 * @param utilityBills 该记录关联的月度账单列表
 */
function mapRecord(entity: FinanceRentRecordEntity, utilityBills: FinanceRentUtilityBillEntity[] = []) {
  // 从月度账单汇总水电燃气费用
  const electricityTotal = utilityBills.reduce((sum, b) => sum + Number(b.electricity_fee), 0);
  const waterTotal = utilityBills.reduce((sum, b) => sum + Number(b.water_fee), 0);
  const gasTotal = utilityBills.reduce((sum, b) => sum + Number(b.gas_fee), 0);

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
    electricityFee: electricityTotal,
    waterFee: waterTotal,
    gasFee: gasTotal,
    agencyFee: Number(entity.agency_fee),
    cleaningFee: Number(entity.cleaning_fee),
    laundryFee: Number(entity.laundry_fee),
    serviceFee: Number(entity.service_fee),
    orientation: entity.orientation ?? '',
    notes: entity.notes,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
    ...calculateRentMetrics(entity, utilityBills),
  };
}

function buildOverview(
  records: FinanceRentRecordEntity[],
  channels: FinanceRentChannelEntity[],
  allBillsByRecordId: Map<string, FinanceRentUtilityBillEntity[]>,
) {
  const metrics = records.map((record) => calculateRentMetrics(record, allBillsByRecordId.get(record.id) || []));
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
    const billRepo = appDataSource.getRepository(FinanceRentUtilityBillEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { move_in_date: 'DESC', updated_at: 'DESC' },
    });

    // 批量查询关联的月度账单，按 record_id 分组
    const allBills = items.length
      ? await billRepo.find({ where: { user_id: userId, record_id: In(items.map((r) => r.id)) } })
      : [];
    const billsByRecordId = new Map<string, FinanceRentUtilityBillEntity[]>();
    allBills.forEach((bill) => {
      const list = billsByRecordId.get(bill.record_id) || [];
      list.push(bill);
      billsByRecordId.set(bill.record_id, list);
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
    response.json(successResponse(buildListData(
      paged.map((record) => mapRecord(record, billsByRecordId.get(record.id) || [])),
      page,
      pageSize,
      filtered.length,
    )));
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
    const [records, channels, allBills] = await Promise.all([
      appDataSource.getRepository(FinanceRentRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceRentChannelEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceRentUtilityBillEntity).find({ where: { user_id: userId } }),
    ]);

    // 按 record_id 分组账单
    const billsByRecordId = new Map<string, FinanceRentUtilityBillEntity[]>();
    allBills.forEach((bill) => {
      const list = billsByRecordId.get(bill.record_id) || [];
      list.push(bill);
      billsByRecordId.set(bill.record_id, list);
    });

    response.json(successResponse(buildOverview(records, channels, billsByRecordId)));
  }));

  router.get('/cost-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [records, allBills] = await Promise.all([
      appDataSource.getRepository(FinanceRentRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceRentUtilityBillEntity).find({ where: { user_id: userId } }),
    ]);

    // 按 record_id 分组账单
    const billsByRecordId = new Map<string, FinanceRentUtilityBillEntity[]>();
    allBills.forEach((bill) => {
      const list = billsByRecordId.get(bill.record_id) || [];
      list.push(bill);
      billsByRecordId.set(bill.record_id, list);
    });

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
      const recordBills = billsByRecordId.get(item.id) || [];
      totals.rent += Number(item.rent);
      totals.electricityFee += recordBills.reduce((sum, b) => sum + Number(b.electricity_fee), 0);
      totals.waterFee += recordBills.reduce((sum, b) => sum + Number(b.water_fee), 0);
      totals.gasFee += recordBills.reduce((sum, b) => sum + Number(b.gas_fee), 0);
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

  // ==================== 月度水电燃气账单 CRUD ====================

  /**
   * 查询月度账单列表
   * 支持按 recordId 筛选，不传则返回当前用户全部账单
   */
  router.get('/utility-bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.query.recordId ?? '').trim();
    const billRepo = appDataSource.getRepository(FinanceRentUtilityBillEntity);
    const whereOptions: Record<string, unknown> = { user_id: userId };
    if (recordId) {
      whereOptions.record_id = recordId;
    }
    const items = await billRepo.find({
      where: whereOptions,
      order: { year_month: 'DESC' },
    });

    response.json(successResponse(items.map(mapUtilityBill)));
  }));

  /**
   * 新增月度账单
   * 同一记录同一月份不允许重复
   */
  router.post('/utility-bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(utilityBillSchema, request.body);
    const billRepo = appDataSource.getRepository(FinanceRentUtilityBillEntity);
    const recordRepo = appDataSource.getRepository(FinanceRentRecordEntity);

    // 校验关联的住房记录存在且属于当前用户
    const record = await recordRepo.findOne({ where: { id: payload.recordId, user_id: userId } });
    if (!record) {
      throw new AppError('rent_record_not_found', 404, 404);
    }

    // 校验同一个月不重复
    const existing = await billRepo.findOne({
      where: { user_id: userId, record_id: payload.recordId, year_month: payload.yearMonth },
    });
    if (existing) {
      throw new AppError('utility_bill_duplicate_month', 409, 409);
    }

    const item = await billRepo.save(billRepo.create({
      user_id: userId,
      record_id: payload.recordId,
      year_month: payload.yearMonth,
      electricity_fee: payload.electricityFee,
      water_fee: payload.waterFee,
      gas_fee: payload.gasFee,
    }));

    response.json(successResponse(mapUtilityBill(item), 'create_utility_bill_success'));
  }));

  /**
   * 更新月度账单
   */
  router.patch('/utility-bills/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billId = String(request.params.id ?? '');
    const payload = validateBody(utilityBillSchema.partial(), request.body);
    const billRepo = appDataSource.getRepository(FinanceRentUtilityBillEntity);
    const current = await billRepo.findOne({
      where: { id: billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('utility_bill_not_found', 404, 404);
    }

    // 如果修改了年月，需校验新月份不重复
    if (payload.yearMonth && payload.yearMonth !== current.year_month) {
      const existing = await billRepo.findOne({
        where: { user_id: userId, record_id: current.record_id, year_month: payload.yearMonth },
      });
      if (existing) {
        throw new AppError('utility_bill_duplicate_month', 409, 409);
      }
    }

    const next = await billRepo.save({
      ...current,
      year_month: payload.yearMonth ?? current.year_month,
      electricity_fee: payload.electricityFee ?? current.electricity_fee,
      water_fee: payload.waterFee ?? current.water_fee,
      gas_fee: payload.gasFee ?? current.gas_fee,
    });

    response.json(successResponse(mapUtilityBill(next), 'update_utility_bill_success'));
  }));

  /**
   * 删除月度账单
   */
  router.delete('/utility-bills/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billId = String(request.params.id ?? '');
    const billRepo = appDataSource.getRepository(FinanceRentUtilityBillEntity);
    const current = await billRepo.findOne({
      where: { id: billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('utility_bill_not_found', 404, 404);
    }

    await billRepo.remove(current);
    response.json(successResponse({ ok: true }, 'delete_utility_bill_success'));
  }));

  return router;
}
