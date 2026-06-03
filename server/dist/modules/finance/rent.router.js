"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRentRouter = createRentRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const date_1 = require("../../shared/utils/date");
const app_error_1 = require("../../shared/errors/app-error");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const finance_rent_channel_entity_1 = require("./entities/finance-rent-channel.entity");
const finance_rent_record_entity_1 = require("./entities/finance-rent-record.entity");
const finance_rent_setting_entity_1 = require("./entities/finance-rent-setting.entity");
const recordSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    address: zod_1.z.string().trim().min(1).max(255),
    channelId: zod_1.z.string().trim().min(1),
    channelName: zod_1.z.string().trim().optional().default(''),
    moveInDate: zod_1.z.string().min(1),
    moveOutDate: zod_1.z.string().optional().default(''),
    rent: zod_1.z.number().min(0).optional().default(0),
    deposit: zod_1.z.number().min(0).optional().default(0),
    electricityFee: zod_1.z.number().min(0).optional().default(0),
    waterFee: zod_1.z.number().min(0).optional().default(0),
    gasFee: zod_1.z.number().min(0).optional().default(0),
    agencyFee: zod_1.z.number().min(0).optional().default(0),
    cleaningFee: zod_1.z.number().min(0).optional().default(0),
    laundryFee: zod_1.z.number().min(0).optional().default(0),
    serviceFee: zod_1.z.number().min(0).optional().default(0),
    notes: zod_1.z.string().optional().default(''),
});
const channelSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    name: zod_1.z.string().trim().min(1).max(128),
});
const settingsSchema = zod_1.z.object({
    activeUserId: zod_1.z.string().optional(),
    recordsUserId: zod_1.z.string().optional(),
    statisticsUserId: zod_1.z.string().optional(),
    editingRecordId: zod_1.z.string().optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(finance_rent_setting_entity_1.FinanceRentSettingEntity);
function mapChannel(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        name: entity.name,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function calculateRentMetrics(entity) {
    const start = (0, dayjs_1.default)(entity.move_in_date).startOf('day');
    const end = entity.move_out_date ? (0, dayjs_1.default)(entity.move_out_date).startOf('day') : (0, dayjs_1.default)().startOf('day');
    const safeEnd = end.isBefore(start) ? start : end;
    const stayDays = Math.max(1, safeEnd.diff(start, 'day') + 1);
    const totalCost = Number((Number(entity.rent)
        + Number(entity.electricity_fee)
        + Number(entity.water_fee)
        + Number(entity.gas_fee)
        + Number(entity.agency_fee)
        + Number(entity.cleaning_fee)
        + Number(entity.laundry_fee)
        + Number(entity.service_fee)).toFixed(2));
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
function mapRecord(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        address: entity.address,
        channelId: entity.channel_id,
        channelName: entity.channel_name,
        moveInDate: entity.move_in_date,
        moveOutDate: entity.move_out_date ?? '',
        rent: Number(entity.rent),
        deposit: Number(entity.deposit),
        electricityFee: Number(entity.electricity_fee),
        waterFee: Number(entity.water_fee),
        gasFee: Number(entity.gas_fee),
        agencyFee: Number(entity.agency_fee),
        cleaningFee: Number(entity.cleaning_fee),
        laundryFee: Number(entity.laundry_fee),
        serviceFee: Number(entity.service_fee),
        notes: entity.notes,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
        ...calculateRentMetrics(entity),
    };
}
function buildOverview(records, channels) {
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
function createRentRouter() {
    const router = (0, express_1.Router)();
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const channelId = String(request.query.channelId ?? 'all');
        const occupancy = String(request.query.occupancy ?? 'all');
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity);
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
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(paged.map(mapRecord), page, pageSize, filtered.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const userId = payload.userId ?? authUserId;
        const channelRepo = data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity);
        const recordRepo = data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity);
        const channel = await channelRepo.findOne({ where: { id: payload.channelId, user_id: userId } });
        const item = await recordRepo.save(recordRepo.create({
            user_id: userId,
            address: payload.address,
            channel_id: payload.channelId,
            channel_name: payload.channelName || channel?.name || '',
            move_in_date: (0, date_1.normalizeDate)(payload.moveInDate),
            move_out_date: payload.moveOutDate ? (0, date_1.normalizeDate)(payload.moveOutDate) : null,
            rent: payload.rent,
            deposit: payload.deposit,
            electricity_fee: payload.electricityFee,
            water_fee: payload.waterFee,
            gas_fee: payload.gasFee,
            agency_fee: payload.agencyFee,
            cleaning_fee: payload.cleaningFee,
            laundry_fee: payload.laundryFee,
            service_fee: payload.serviceFee,
            notes: payload.notes,
        }));
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_rent_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity);
        const channelRepo = data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: authUserId },
        });
        if (!current) {
            throw new app_error_1.AppError('rent_record_not_found', 404, 404);
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
            move_in_date: payload.moveInDate ? (0, date_1.normalizeDate)(payload.moveInDate) : current.move_in_date,
            move_out_date: payload.moveOutDate !== undefined ? (payload.moveOutDate ? (0, date_1.normalizeDate)(payload.moveOutDate) : null) : current.move_out_date,
            rent: payload.rent ?? current.rent,
            deposit: payload.deposit ?? current.deposit,
            electricity_fee: payload.electricityFee ?? current.electricity_fee,
            water_fee: payload.waterFee ?? current.water_fee,
            gas_fee: payload.gasFee ?? current.gas_fee,
            agency_fee: payload.agencyFee ?? current.agency_fee,
            cleaning_fee: payload.cleaningFee ?? current.cleaning_fee,
            laundry_fee: payload.laundryFee ?? current.laundry_fee,
            service_fee: payload.serviceFee ?? current.service_fee,
            notes: payload.notes ?? current.notes,
        });
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_rent_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('rent_record_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_rent_record_success'));
    }));
    router.get('/channels', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const repository = data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { name: 'ASC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapChannel))));
    }));
    router.post('/channels', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(channelSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            name: payload.name,
        }));
        response.json((0, response_1.successResponse)(mapChannel(item), 'create_rent_channel_success'));
    }));
    router.patch('/channels/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const channelId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(channelSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity);
        const current = await repository.findOne({
            where: { id: channelId, user_id: authUserId },
        });
        if (!current) {
            throw new app_error_1.AppError('rent_channel_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            name: payload.name ?? current.name,
        });
        response.json((0, response_1.successResponse)(mapChannel(next), 'update_rent_channel_success'));
    }));
    router.delete('/channels/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const channelId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity);
        const current = await repository.findOne({
            where: { id: channelId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('rent_channel_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_rent_channel_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [records, channels] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)(buildOverview(records, channels)));
    }));
    router.get('/cost-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const records = await data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity).find({ where: { user_id: userId } });
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
            const value = totals[key];
            return {
                key,
                label,
                value: Number(value.toFixed(2)),
                percentage: totalAmount > 0 ? Number(((value / totalAmount) * 100).toFixed(2)) : 0,
            };
        }).filter((item) => item.value > 0);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/channel-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [records, channels] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_rent_record_entity_1.FinanceRentRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_rent_channel_entity_1.FinanceRentChannelEntity).find({ where: { user_id: userId } }),
        ]);
        const items = channels.map((channel) => ({
            channelId: channel.id,
            channelName: channel.name,
            count: records.filter((record) => record.channel_id === channel.id).length,
        })).filter((item) => item.count > 0);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            active_user_id: userId,
            records_user_id: userId,
            statistics_user_id: userId,
            editing_record_id: null,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            statisticsUserId: settings.statistics_user_id ?? userId,
            editingRecordId: settings.editing_record_id ?? '',
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
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
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            statisticsUserId: settings.statistics_user_id ?? userId,
            editingRecordId: settings.editing_record_id ?? '',
        }, 'update_rent_settings_success'));
    }));
    return router;
}
