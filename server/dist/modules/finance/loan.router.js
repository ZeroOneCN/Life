"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoanRouter = createLoanRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const finance_loan_platform_entity_1 = require("./entities/finance-loan-platform.entity");
const finance_loan_bill_entity_1 = require("./entities/finance-loan-bill.entity");
const finance_loan_repayment_entity_1 = require("./entities/finance-loan-repayment.entity");
const finance_loan_setting_entity_1 = require("./entities/finance-loan-setting.entity");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const date_1 = require("../../shared/utils/date");
const app_error_1 = require("../../shared/errors/app-error");
const notification_1 = require("../../shared/domain/notification");
const platformSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(128),
    billingDay: zod_1.z.number().int().min(1).max(31),
    repaymentDay: zod_1.z.number().int().min(1).max(31),
    creditLimit: zod_1.z.number().min(0).optional().default(0),
});
const billSchema = zod_1.z.object({
    platformId: zod_1.z.string().trim().min(1),
    platformName: zod_1.z.string().trim().optional(),
    amount: zod_1.z.number().min(0),
    interest: zod_1.z.number().min(0).optional().default(0),
    billingMonth: zod_1.z.string().min(1),
    dueDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional().default(''),
    isPaid: zod_1.z.boolean().optional().default(false),
});
const repaymentSchema = zod_1.z.object({
    billId: zod_1.z.string().trim().optional().default(''),
    platformId: zod_1.z.string().trim().min(1),
    platformName: zod_1.z.string().trim().optional(),
    amount: zod_1.z.number().min(0),
    interest: zod_1.z.number().min(0).optional().default(0),
    repaymentDate: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional().default(''),
});
const settingsSchema = zod_1.z.object({
    repaymentReminderEnabled: zod_1.z.boolean().optional(),
    overdueReminderEnabled: zod_1.z.boolean().optional(),
    autoRepaymentOnMarkPaid: zod_1.z.boolean().optional(),
    notificationFrequency: zod_1.z.enum(['daily', 'always']).optional(),
    upcomingDays: zod_1.z.number().int().min(0).max(30).optional(),
});
const markPaidSchema = zod_1.z.object({
    billId: zod_1.z.string().trim().min(1),
});
const triggerReminderSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255).optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(finance_loan_setting_entity_1.FinanceLoanSettingEntity);
function getDefaultSettings() {
    return {
        repayment_reminder_enabled: true,
        overdue_reminder_enabled: true,
        auto_repayment_on_mark_paid: true,
        notification_frequency: 'daily',
        upcoming_days: 7,
    };
}
function mapSettings(settings) {
    return {
        repaymentReminderEnabled: settings.repayment_reminder_enabled,
        overdueReminderEnabled: settings.overdue_reminder_enabled,
        autoRepaymentOnMarkPaid: settings.auto_repayment_on_mark_paid,
        notificationFrequency: settings.notification_frequency,
        upcomingDays: settings.upcoming_days,
    };
}
function mapPlatform(entity) {
    return {
        id: entity.id,
        name: entity.name,
        billingDay: entity.billing_day,
        repaymentDay: entity.repayment_day,
        creditLimit: Number(entity.credit_limit),
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapBill(entity) {
    return {
        id: entity.id,
        platformId: entity.platform_id,
        platformName: entity.platform_name,
        amount: Number(entity.amount),
        interest: Number(entity.interest),
        billingMonth: entity.billing_month,
        dueDate: entity.due_date,
        notes: entity.notes,
        isPaid: entity.is_paid,
        paidAt: entity.paid_at ?? '',
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapRepayment(entity) {
    return {
        id: entity.id,
        billId: entity.bill_id ?? '',
        platformId: entity.platform_id,
        platformName: entity.platform_name,
        amount: Number(entity.amount),
        interest: Number(entity.interest),
        repaymentDate: entity.repayment_date,
        notes: entity.notes,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function getBillStatus(entity) {
    if (entity.is_paid) {
        return 'paid';
    }
    return (0, dayjs_1.default)(entity.due_date).isBefore((0, dayjs_1.default)(), 'day') ? 'overdue' : 'unpaid';
}
function buildOverview(bills, repayments) {
    return {
        totalDebt: Number(bills.reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
        totalPaid: Number(repayments.reduce((sum, repayment) => sum + Number(repayment.amount), 0).toFixed(2)),
        totalUnpaid: Number(bills.filter((bill) => !bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
        totalInterest: Number(bills.reduce((sum, bill) => sum + Number(bill.interest), 0).toFixed(2)),
        totalBillCount: bills.length,
        repaymentCount: repayments.length,
        upcomingCount: bills.filter((bill) => getBillStatus(bill) === 'unpaid').length,
        overdueCount: bills.filter((bill) => getBillStatus(bill) === 'overdue').length,
    };
}
function buildLoanReminderItems(bills, settings) {
    const today = (0, dayjs_1.default)().startOf('day');
    return bills
        .filter((bill) => !bill.is_paid)
        .flatMap((bill) => {
        const dueDate = (0, dayjs_1.default)(bill.due_date).startOf('day');
        const diff = dueDate.diff(today, 'day');
        const items = [];
        if (settings.repayment_reminder_enabled && diff >= 0 && diff <= settings.upcoming_days) {
            items.push({
                bill,
                sceneId: 'loan.repayment_upcoming',
                title: '贷款还款提醒',
                message: `${bill.platform_name} 的账单将于 ${bill.due_date} 到期，待还金额 ¥${Number(bill.amount).toFixed(2)}。`,
                severity: diff === 0 ? 'high' : 'medium',
            });
        }
        if (settings.overdue_reminder_enabled && diff < 0) {
            items.push({
                bill,
                sceneId: 'loan.repayment_overdue',
                title: '贷款逾期提醒',
                message: `${bill.platform_name} 的账单已逾期 ${Math.abs(diff)} 天，待还金额 ¥${Number(bill.amount).toFixed(2)}。`,
                severity: 'high',
            });
        }
        return items;
    });
}
async function triggerLoanReminderLogs(userId, bills, settings) {
    const items = buildLoanReminderItems(bills, settings);
    const logs = [];
    for (const item of items) {
        logs.push(...(await (0, notification_1.sendNotificationSceneLogs)({
            userId,
            sceneId: item.sceneId,
            title: item.title,
            message: item.message,
        })));
    }
    return {
        items,
        logs,
    };
}
function createLoanRouter() {
    const router = (0, express_1.Router)();
    router.get('/platforms', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const [items, total] = await repository.findAndCount({
            where: { user_id: userId },
            order: { name: 'ASC' },
            skip,
            take: pageSize,
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapPlatform), page, pageSize, total)));
    }));
    router.post('/platforms', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(platformSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            name: payload.name,
            billing_day: payload.billingDay,
            repayment_day: payload.repaymentDay,
            credit_limit: payload.creditLimit,
        }));
        response.json((0, response_1.successResponse)(mapPlatform(item), 'create_loan_platform_success'));
    }));
    router.patch('/platforms/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const platformId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(platformSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const current = await repository.findOne({
            where: { id: platformId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_platform_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            name: payload.name ?? current.name,
            billing_day: payload.billingDay ?? current.billing_day,
            repayment_day: payload.repaymentDay ?? current.repayment_day,
            credit_limit: payload.creditLimit ?? current.credit_limit,
        });
        response.json((0, response_1.successResponse)(mapPlatform(next), 'update_loan_platform_success'));
    }));
    router.delete('/platforms/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const platformId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const current = await repository.findOne({
            where: { id: platformId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_platform_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_loan_platform_success'));
    }));
    router.get('/bills', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const platformId = String(request.query.platformId ?? '').trim();
        const status = String(request.query.status ?? '').trim();
        const billingMonth = String(request.query.billingMonth ?? '').trim();
        const dueStartDate = String(request.query.dueStartDate ?? '').trim();
        const dueEndDate = String(request.query.dueEndDate ?? '').trim();
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const items = await repository.find({
            where: { user_id: userId },
            order: { due_date: 'ASC', updated_at: 'DESC' },
        });
        const filtered = items
            .filter((item) => !platformId || item.platform_id === platformId)
            .filter((item) => !status || getBillStatus(item) === status)
            .filter((item) => !billingMonth || item.billing_month === (0, date_1.normalizeMonth)(billingMonth))
            .filter((item) => !dueStartDate || !(0, dayjs_1.default)(item.due_date).isBefore(dueStartDate, 'day'))
            .filter((item) => !dueEndDate || !(0, dayjs_1.default)(item.due_date).isAfter(dueEndDate, 'day'))
            .filter((item) => !keyword || [item.platform_name, item.notes, item.billing_month].some((value) => value.toLowerCase().includes(keyword)));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapBill), page, pageSize, filtered.length)));
    }));
    router.post('/bills', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(billSchema, request.body);
        const platformRepo = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const platform = await platformRepo.findOne({
            where: { id: payload.platformId, user_id: userId },
        });
        const item = await billRepo.save(billRepo.create({
            user_id: userId,
            platform_id: payload.platformId,
            platform_name: payload.platformName ?? platform?.name ?? '',
            amount: payload.amount,
            interest: payload.interest,
            billing_month: (0, date_1.normalizeMonth)(payload.billingMonth),
            due_date: payload.dueDate
                ? (0, date_1.normalizeDate)(payload.dueDate)
                : (0, dayjs_1.default)(`${(0, date_1.normalizeMonth)(payload.billingMonth)}-01`).format('YYYY-MM-DD'),
            notes: payload.notes,
            is_paid: payload.isPaid,
            paid_at: payload.isPaid ? (0, dayjs_1.default)().format('YYYY-MM-DD') : null,
        }));
        response.json((0, response_1.successResponse)(mapBill(item), 'create_loan_bill_success'));
    }));
    router.patch('/bills/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const billId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(billSchema.partial(), request.body);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const platformRepo = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const current = await billRepo.findOne({
            where: { id: billId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_bill_not_found', 404, 404);
        }
        const platform = payload.platformId
            ? await platformRepo.findOne({ where: { id: payload.platformId, user_id: userId } })
            : null;
        const next = await billRepo.save({
            ...current,
            platform_id: payload.platformId ?? current.platform_id,
            platform_name: payload.platformName ?? platform?.name ?? current.platform_name,
            amount: payload.amount ?? current.amount,
            interest: payload.interest ?? current.interest,
            billing_month: payload.billingMonth ? (0, date_1.normalizeMonth)(payload.billingMonth) : current.billing_month,
            due_date: payload.dueDate ? (0, date_1.normalizeDate)(payload.dueDate) : current.due_date,
            notes: payload.notes ?? current.notes,
            is_paid: payload.isPaid ?? current.is_paid,
            paid_at: payload.isPaid === false ? null : current.paid_at,
        });
        response.json((0, response_1.successResponse)(mapBill(next), 'update_loan_bill_success'));
    }));
    router.delete('/bills/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const billId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const current = await repository.findOne({
            where: { id: billId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_bill_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_loan_bill_success'));
    }));
    router.get('/repayments', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const platformId = String(request.query.platformId ?? '').trim();
        const repaymentStartDate = String(request.query.repaymentStartDate ?? '').trim();
        const repaymentEndDate = String(request.query.repaymentEndDate ?? '').trim();
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const items = await repository.find({
            where: { user_id: userId },
            order: { repayment_date: 'DESC', updated_at: 'DESC' },
        });
        const filtered = items
            .filter((item) => !platformId || item.platform_id === platformId)
            .filter((item) => !repaymentStartDate || !(0, dayjs_1.default)(item.repayment_date).isBefore(repaymentStartDate, 'day'))
            .filter((item) => !repaymentEndDate || !(0, dayjs_1.default)(item.repayment_date).isAfter(repaymentEndDate, 'day'))
            .filter((item) => !keyword || [item.platform_name, item.notes, item.repayment_date].some((value) => value.toLowerCase().includes(keyword)));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapRepayment), page, pageSize, filtered.length)));
    }));
    router.post('/repayments', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(repaymentSchema, request.body);
        const platformRepo = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const repaymentRepo = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const bill = payload.billId ? await billRepo.findOne({ where: { id: payload.billId, user_id: userId } }) : null;
        const platform = await platformRepo.findOne({ where: { id: payload.platformId, user_id: userId } });
        const item = await repaymentRepo.save(repaymentRepo.create({
            user_id: userId,
            bill_id: payload.billId || null,
            platform_id: payload.platformId,
            platform_name: payload.platformName ?? bill?.platform_name ?? platform?.name ?? '',
            amount: payload.amount,
            interest: payload.interest,
            repayment_date: (0, date_1.normalizeDate)(payload.repaymentDate),
            notes: payload.notes,
        }));
        response.json((0, response_1.successResponse)(mapRepayment(item), 'create_loan_repayment_success'));
    }));
    router.patch('/repayments/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repaymentId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(repaymentSchema.partial(), request.body);
        const repaymentRepo = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const current = await repaymentRepo.findOne({
            where: { id: repaymentId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_repayment_not_found', 404, 404);
        }
        const next = await repaymentRepo.save({
            ...current,
            bill_id: payload.billId !== undefined ? (payload.billId || null) : current.bill_id,
            platform_id: payload.platformId ?? current.platform_id,
            platform_name: payload.platformName ?? current.platform_name,
            amount: payload.amount ?? current.amount,
            interest: payload.interest ?? current.interest,
            repayment_date: payload.repaymentDate ? (0, date_1.normalizeDate)(payload.repaymentDate) : current.repayment_date,
            notes: payload.notes ?? current.notes,
        });
        response.json((0, response_1.successResponse)(mapRepayment(next), 'update_loan_repayment_success'));
    }));
    router.delete('/repayments/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repaymentId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const current = await repository.findOne({
            where: { id: repaymentId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_repayment_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_loan_repayment_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const repaymentRepo = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const bills = await billRepo.find({ where: { user_id: userId } });
        const repayments = await repaymentRepo.find({ where: { user_id: userId } });
        response.json((0, response_1.successResponse)(buildOverview(bills, repayments)));
    }));
    router.get('/monthly-stats', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const month = String(request.query.month ?? (0, dayjs_1.default)().format('YYYY-MM'));
        const platformId = String(request.query.platformId ?? '').trim();
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const bills = await billRepo.find({ where: { user_id: userId } });
        const scoped = bills
            .filter((bill) => bill.billing_month === (0, date_1.normalizeMonth)(month))
            .filter((bill) => !platformId || bill.platform_id === platformId);
        response.json((0, response_1.successResponse)({
            month: (0, date_1.normalizeMonth)(month),
            totalBills: scoped.length,
            totalAmount: Number(scoped.reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
            totalInterest: Number(scoped.reduce((sum, bill) => sum + Number(bill.interest), 0).toFixed(2)),
            paidAmount: Number(scoped.filter((bill) => bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
            unpaidAmount: Number(scoped.filter((bill) => !bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
            overdueAmount: Number(scoped.filter((bill) => getBillStatus(bill) === 'overdue').reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
        }));
    }));
    router.get('/repayment-trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const startDate = String(request.query.startDate ?? (0, dayjs_1.default)().subtract(29, 'day').format('YYYY-MM-DD'));
        const endDate = String(request.query.endDate ?? (0, dayjs_1.default)().format('YYYY-MM-DD'));
        const platformId = String(request.query.platformId ?? '').trim();
        const repaymentRepo = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const repayments = await repaymentRepo.find({ where: { user_id: userId } });
        const scopedRepayments = repayments.filter((item) => !platformId || item.platform_id === platformId);
        const start = (0, dayjs_1.default)((0, date_1.normalizeDate)(startDate));
        const end = (0, dayjs_1.default)((0, date_1.normalizeDate)(endDate));
        const rangeStart = start.isAfter(end) ? end : start;
        const rangeEnd = start.isAfter(end) ? start : end;
        const days = Math.max(0, rangeEnd.diff(rangeStart, 'day'));
        const points = Array.from({ length: days + 1 }, (_, index) => {
            const currentDate = rangeStart.add(index, 'day');
            const matched = scopedRepayments.filter((item) => item.repayment_date === currentDate.format('YYYY-MM-DD'));
            return {
                date: currentDate.format('YYYY-MM-DD'),
                label: currentDate.format('MM-DD'),
                repaymentAmount: Number(matched.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)),
                interestAmount: Number(matched.reduce((sum, item) => sum + Number(item.interest), 0).toFixed(2)),
                count: matched.length,
            };
        });
        response.json((0, response_1.successResponse)(points));
    }));
    router.get('/platform-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const platformRepo = data_source_1.appDataSource.getRepository(finance_loan_platform_entity_1.FinanceLoanPlatformEntity);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const platforms = await platformRepo.find({ where: { user_id: userId } });
        const bills = await billRepo.find({ where: { user_id: userId } });
        const items = platforms.map((platform) => {
            const matched = bills.filter((bill) => bill.platform_id === platform.id);
            return {
                platformId: platform.id,
                platformName: platform.name,
                totalAmount: Number(matched.reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
                paidAmount: Number(matched.filter((bill) => bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
                unpaidAmount: Number(matched.filter((bill) => !bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
                totalInterest: Number(matched.reduce((sum, bill) => sum + Number(bill.interest), 0).toFixed(2)),
                billCount: matched.length,
            };
        }).filter((item) => item.billCount > 0);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, getDefaultSettings());
        response.json((0, response_1.successResponse)(mapSettings(settings)));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            repayment_reminder_enabled: payload.repaymentReminderEnabled,
            overdue_reminder_enabled: payload.overdueReminderEnabled,
            auto_repayment_on_mark_paid: payload.autoRepaymentOnMarkPaid,
            notification_frequency: payload.notificationFrequency,
            upcoming_days: payload.upcomingDays,
        }, getDefaultSettings());
        await (0, notification_1.syncNotificationScenesEnabled)(userId, [
            {
                sceneId: 'loan.repayment_upcoming',
                enabled: settings.repayment_reminder_enabled,
            },
            {
                sceneId: 'loan.repayment_overdue',
                enabled: settings.overdue_reminder_enabled,
            },
        ]);
        response.json((0, response_1.successResponse)(mapSettings(settings), 'update_loan_settings_success'));
    }));
    router.post('/actions/mark-bill-paid', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(markPaidSchema, request.body);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const repaymentRepo = data_source_1.appDataSource.getRepository(finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity);
        const settings = await settingService.getOrCreate(userId, getDefaultSettings());
        const current = await billRepo.findOne({
            where: { id: payload.billId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('loan_bill_not_found', 404, 404);
        }
        current.is_paid = true;
        current.paid_at = (0, dayjs_1.default)().format('YYYY-MM-DD');
        await billRepo.save(current);
        let createdRepayment = false;
        if (settings.auto_repayment_on_mark_paid) {
            const exists = await repaymentRepo.findOne({
                where: { bill_id: current.id, user_id: userId },
            });
            if (!exists) {
                await repaymentRepo.save(repaymentRepo.create({
                    user_id: userId,
                    bill_id: current.id,
                    platform_id: current.platform_id,
                    platform_name: current.platform_name,
                    amount: current.amount,
                    interest: current.interest,
                    repayment_date: current.paid_at,
                    notes: '标记账单已还时自动生成',
                }));
                createdRepayment = true;
            }
        }
        response.json((0, response_1.successResponse)({
            bill: mapBill(current),
            createdRepayment,
        }, 'mark_loan_bill_paid_success'));
    }));
    router.post('/actions/trigger-reminders', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(triggerReminderSchema, request.body);
        const billRepo = data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity);
        const settings = await settingService.getOrCreate(userId, getDefaultSettings());
        const bills = await billRepo.find({ where: { user_id: userId } });
        const result = await triggerLoanReminderLogs(userId, bills, settings);
        if (!result.logs.length) {
            result.logs.push(...(await (0, notification_1.sendNotificationSceneLogs)({
                userId,
                sceneId: 'loan.repayment_upcoming',
                title: payload.title ?? '贷款还款提醒',
                message: '已手动触发贷款还款提醒。',
            })), ...(await (0, notification_1.sendNotificationSceneLogs)({
                userId,
                sceneId: 'loan.repayment_overdue',
                title: payload.title ?? '贷款逾期提醒',
                message: '已手动触发贷款逾期提醒。',
            })));
        }
        response.json((0, response_1.successResponse)({
            items: result.items.map((item) => ({
                billId: item.bill.id,
                platformId: item.bill.platform_id,
                platformName: item.bill.platform_name,
                dueDate: item.bill.due_date,
                amount: Number(item.bill.amount),
                sceneId: item.sceneId,
                severity: item.severity,
                message: item.message,
            })),
            logs: result.logs,
        }, 'trigger_loan_reminders_success'));
    }));
    return router;
}
