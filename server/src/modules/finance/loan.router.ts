import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { FinanceLoanPlatformEntity } from './entities/finance-loan-platform.entity';
import { FinanceLoanBillEntity } from './entities/finance-loan-bill.entity';
import { FinanceLoanRepaymentEntity } from './entities/finance-loan-repayment.entity';
import { FinanceLoanSettingEntity } from './entities/finance-loan-setting.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { normalizeDate, normalizeMonth } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';

const platformSchema = z.object({
  userId: z.string().trim().optional(),
  name: z.string().trim().min(1).max(128),
  billingDay: z.number().int().min(1).max(31),
  repaymentDay: z.number().int().min(1).max(31),
  creditLimit: z.number().min(0).optional().default(0),
});

const billSchema = z.object({
  userId: z.string().trim().optional(),
  platformId: z.string().trim().min(1),
  platformName: z.string().trim().optional(),
  amount: z.number().min(0),
  interest: z.number().min(0).optional().default(0),
  billingMonth: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional().default(''),
  isPaid: z.boolean().optional().default(false),
});

const repaymentSchema = z.object({
  userId: z.string().trim().optional(),
  billId: z.string().trim().optional().default(''),
  platformId: z.string().trim().min(1),
  platformName: z.string().trim().optional(),
  amount: z.number().min(0),
  interest: z.number().min(0).optional().default(0),
  repaymentDate: z.string().min(1),
  notes: z.string().optional().default(''),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional(),
  billsUserId: z.string().optional(),
  repaymentsUserId: z.string().optional(),
  statisticsUserId: z.string().optional(),
  repaymentReminderEnabled: z.boolean().optional(),
  overdueReminderEnabled: z.boolean().optional(),
  autoRepaymentOnMarkPaid: z.boolean().optional(),
  notificationFrequency: z.enum(['daily', 'always']).optional(),
  upcomingDays: z.number().int().min(0).max(30).optional(),
});

const markPaidSchema = z.object({
  billId: z.string().trim().min(1),
});

const triggerReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const settingService = new BaseUserSettingService(FinanceLoanSettingEntity);

function mapPlatform(entity: FinanceLoanPlatformEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    name: entity.name,
    billingDay: entity.billing_day,
    repaymentDay: entity.repayment_day,
    creditLimit: Number(entity.credit_limit),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapBill(entity: FinanceLoanBillEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
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

function mapRepayment(entity: FinanceLoanRepaymentEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
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

function getBillStatus(entity: FinanceLoanBillEntity) {
  if (entity.is_paid) {
    return 'paid';
  }
  return dayjs(entity.due_date).isBefore(dayjs(), 'day') ? 'overdue' : 'unpaid';
}

function buildOverview(bills: FinanceLoanBillEntity[], repayments: FinanceLoanRepaymentEntity[]) {
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

function buildLoanReminderItems(
  bills: FinanceLoanBillEntity[],
  settings: FinanceLoanSettingEntity,
) {
  const today = dayjs().startOf('day');

  return bills
    .filter((bill) => !bill.is_paid)
    .flatMap((bill) => {
      const dueDate = dayjs(bill.due_date).startOf('day');
      const diff = dueDate.diff(today, 'day');
      const items: Array<{
        bill: FinanceLoanBillEntity;
        sceneId: 'loan.repayment_upcoming' | 'loan.repayment_overdue';
        title: string;
        message: string;
        severity: 'high' | 'medium';
      }> = [];

      if (settings.repayment_reminder_enabled && diff >= 0 && diff <= settings.upcoming_days) {
        items.push({
          bill,
          sceneId: 'loan.repayment_upcoming',
          title: '贷款还款提醒',
          message: `${bill.platform_name} 账单将在 ${bill.due_date} 到期，待还金额 ${Number(bill.amount).toFixed(2)}。`,
          severity: diff === 0 ? 'high' : 'medium',
        });
      }

      if (settings.overdue_reminder_enabled && diff < 0) {
        items.push({
          bill,
          sceneId: 'loan.repayment_overdue',
          title: '贷款逾期提醒',
          message: `${bill.platform_name} 账单已逾期 ${Math.abs(diff)} 天，待还金额 ${Number(bill.amount).toFixed(2)}。`,
          severity: 'high',
        });
      }

      return items;
    });
}

async function triggerLoanReminderLogs(
  userId: string,
  bills: FinanceLoanBillEntity[],
  settings: FinanceLoanSettingEntity,
) {
  const items = buildLoanReminderItems(bills, settings);
  const logs = [];

  for (const item of items) {
    logs.push(...(await sendNotificationSceneLogs({
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

export function createLoanRouter() {
  const router = Router();

  router.get('/platforms', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { name: 'ASC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapPlatform), page, pageSize, total)));
  }));

  router.post('/platforms', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(platformSchema, request.body);
    const repository = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? userId,
      name: payload.name,
      billing_day: payload.billingDay,
      repayment_day: payload.repaymentDay,
      credit_limit: payload.creditLimit,
    }));

    response.json(successResponse(mapPlatform(item), 'create_loan_platform_success'));
  }));

  router.patch('/platforms/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const platformId = String(request.params.id ?? '');
    const payload = validateBody(platformSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const current = await repository.findOne({
      where: { id: platformId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_platform_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      name: payload.name ?? current.name,
      billing_day: payload.billingDay ?? current.billing_day,
      repayment_day: payload.repaymentDay ?? current.repayment_day,
      credit_limit: payload.creditLimit ?? current.credit_limit,
    });

    response.json(successResponse(mapPlatform(next), 'update_loan_platform_success'));
  }));

  router.delete('/platforms/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const platformId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const current = await repository.findOne({
      where: { id: platformId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_platform_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_loan_platform_success'));
  }));

  router.get('/bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceLoanBillEntity);
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
      .filter((item) => !billingMonth || item.billing_month === normalizeMonth(billingMonth))
      .filter((item) => !dueStartDate || !dayjs(item.due_date).isBefore(dueStartDate, 'day'))
      .filter((item) => !dueEndDate || !dayjs(item.due_date).isAfter(dueEndDate, 'day'))
      .filter((item) => !keyword || [item.platform_name, item.notes, item.billing_month].some((value) => value.toLowerCase().includes(keyword)));

    response.json(successResponse(buildListData(filtered.slice(skip, skip + pageSize).map(mapBill), page, pageSize, filtered.length)));
  }));

  router.post('/bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(billSchema, request.body);
    const platformRepo = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const platform = await platformRepo.findOne({
      where: { id: payload.platformId, user_id: payload.userId ?? userId },
    });

    const item = await billRepo.save(billRepo.create({
      user_id: payload.userId ?? userId,
      platform_id: payload.platformId,
      platform_name: payload.platformName ?? platform?.name ?? '',
      amount: payload.amount,
      interest: payload.interest,
      billing_month: normalizeMonth(payload.billingMonth),
      due_date: payload.dueDate ? normalizeDate(payload.dueDate) : dayjs(`${normalizeMonth(payload.billingMonth)}-01`).format('YYYY-MM-DD'),
      notes: payload.notes,
      is_paid: payload.isPaid,
      paid_at: payload.isPaid ? dayjs().format('YYYY-MM-DD') : null,
    }));

    response.json(successResponse(mapBill(item), 'create_loan_bill_success'));
  }));

  router.patch('/bills/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billId = String(request.params.id ?? '');
    const payload = validateBody(billSchema.partial(), request.body);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const platformRepo = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const current = await billRepo.findOne({
      where: { id: billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_bill_not_found', 404, 404);
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
      billing_month: payload.billingMonth ? normalizeMonth(payload.billingMonth) : current.billing_month,
      due_date: payload.dueDate ? normalizeDate(payload.dueDate) : current.due_date,
      notes: payload.notes ?? current.notes,
      is_paid: payload.isPaid ?? current.is_paid,
      paid_at: payload.isPaid === false ? null : current.paid_at,
    });

    response.json(successResponse(mapBill(next), 'update_loan_bill_success'));
  }));

  router.delete('/bills/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceLoanBillEntity);
    const current = await repository.findOne({
      where: { id: billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_bill_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_loan_bill_success'));
  }));

  router.get('/repayments', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceLoanRepaymentEntity);
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
      .filter((item) => !repaymentStartDate || !dayjs(item.repayment_date).isBefore(repaymentStartDate, 'day'))
      .filter((item) => !repaymentEndDate || !dayjs(item.repayment_date).isAfter(repaymentEndDate, 'day'))
      .filter((item) => !keyword || [item.platform_name, item.notes, item.repayment_date].some((value) => value.toLowerCase().includes(keyword)));

    response.json(successResponse(buildListData(filtered.slice(skip, skip + pageSize).map(mapRepayment), page, pageSize, filtered.length)));
  }));

  router.post('/repayments', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(repaymentSchema, request.body);
    const platformRepo = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const bill = payload.billId ? await billRepo.findOne({ where: { id: payload.billId, user_id: payload.userId ?? userId } }) : null;
    const platform = await platformRepo.findOne({ where: { id: payload.platformId, user_id: payload.userId ?? userId } });

    const item = await repaymentRepo.save(repaymentRepo.create({
      user_id: payload.userId ?? userId,
      bill_id: payload.billId || null,
      platform_id: payload.platformId,
      platform_name: payload.platformName ?? bill?.platform_name ?? platform?.name ?? '',
      amount: payload.amount,
      interest: payload.interest,
      repayment_date: normalizeDate(payload.repaymentDate),
      notes: payload.notes,
    }));

    response.json(successResponse(mapRepayment(item), 'create_loan_repayment_success'));
  }));

  router.patch('/repayments/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repaymentId = String(request.params.id ?? '');
    const payload = validateBody(repaymentSchema.partial(), request.body);
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const current = await repaymentRepo.findOne({
      where: { id: repaymentId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_repayment_not_found', 404, 404);
    }

    const next = await repaymentRepo.save({
      ...current,
      bill_id: payload.billId !== undefined ? (payload.billId || null) : current.bill_id,
      platform_id: payload.platformId ?? current.platform_id,
      platform_name: payload.platformName ?? current.platform_name,
      amount: payload.amount ?? current.amount,
      interest: payload.interest ?? current.interest,
      repayment_date: payload.repaymentDate ? normalizeDate(payload.repaymentDate) : current.repayment_date,
      notes: payload.notes ?? current.notes,
    });

    response.json(successResponse(mapRepayment(next), 'update_loan_repayment_success'));
  }));

  router.delete('/repayments/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repaymentId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const current = await repository.findOne({
      where: { id: repaymentId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_repayment_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_loan_repayment_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const bills = await billRepo.find({ where: { user_id: userId } });
    const repayments = await repaymentRepo.find({ where: { user_id: userId } });
    response.json(successResponse(buildOverview(bills, repayments)));
  }));

  router.get('/monthly-stats', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const month = String(request.query.month ?? dayjs().format('YYYY-MM'));
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const bills = await billRepo.find({ where: { user_id: userId } });
    const scoped = bills.filter((bill) => bill.billing_month === normalizeMonth(month));
    response.json(successResponse({
      month: normalizeMonth(month),
      totalBills: scoped.length,
      totalAmount: Number(scoped.reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
      totalInterest: Number(scoped.reduce((sum, bill) => sum + Number(bill.interest), 0).toFixed(2)),
      paidAmount: Number(scoped.filter((bill) => bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
      unpaidAmount: Number(scoped.filter((bill) => !bill.is_paid).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
      overdueAmount: Number(scoped.filter((bill) => getBillStatus(bill) === 'overdue').reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
    }));
  }));

  router.get('/repayment-trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const startDate = String(request.query.startDate ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
    const endDate = String(request.query.endDate ?? dayjs().format('YYYY-MM-DD'));
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const repayments = await repaymentRepo.find({ where: { user_id: userId } });
    const start = dayjs(normalizeDate(startDate));
    const end = dayjs(normalizeDate(endDate));
    const rangeStart = start.isAfter(end) ? end : start;
    const rangeEnd = start.isAfter(end) ? start : end;
    const days = Math.max(0, rangeEnd.diff(rangeStart, 'day'));
    const points = Array.from({ length: days + 1 }, (_, index) => {
      const currentDate = rangeStart.add(index, 'day');
      const matched = repayments.filter((item) => item.repayment_date === currentDate.format('YYYY-MM-DD'));
      return {
        date: currentDate.format('YYYY-MM-DD'),
        label: currentDate.format('MM-DD'),
        repaymentAmount: Number(matched.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)),
        interestAmount: Number(matched.reduce((sum, item) => sum + Number(item.interest), 0).toFixed(2)),
        count: matched.length,
      };
    });
    response.json(successResponse(points));
  }));

  router.get('/platform-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const platformRepo = appDataSource.getRepository(FinanceLoanPlatformEntity);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
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
    response.json(successResponse(items));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      bills_user_id: userId,
      repayments_user_id: userId,
      statistics_user_id: userId,
      repayment_reminder_enabled: true,
      overdue_reminder_enabled: true,
      auto_repayment_on_mark_paid: true,
      notification_frequency: 'daily',
      upcoming_days: 7,
    });
    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      billsUserId: settings.bills_user_id ?? userId,
      repaymentsUserId: settings.repayments_user_id ?? userId,
      statisticsUserId: settings.statistics_user_id ?? userId,
      repaymentReminderEnabled: settings.repayment_reminder_enabled,
      overdueReminderEnabled: settings.overdue_reminder_enabled,
      autoRepaymentOnMarkPaid: settings.auto_repayment_on_mark_paid,
      notificationFrequency: settings.notification_frequency,
      upcomingDays: settings.upcoming_days,
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      active_user_id: payload.activeUserId,
      bills_user_id: payload.billsUserId,
      repayments_user_id: payload.repaymentsUserId,
      statistics_user_id: payload.statisticsUserId,
      repayment_reminder_enabled: payload.repaymentReminderEnabled,
      overdue_reminder_enabled: payload.overdueReminderEnabled,
      auto_repayment_on_mark_paid: payload.autoRepaymentOnMarkPaid,
      notification_frequency: payload.notificationFrequency,
      upcoming_days: payload.upcomingDays,
    }, {
      active_user_id: userId,
      bills_user_id: userId,
      repayments_user_id: userId,
      statistics_user_id: userId,
      repayment_reminder_enabled: true,
      overdue_reminder_enabled: true,
      auto_repayment_on_mark_paid: true,
      notification_frequency: 'daily',
      upcoming_days: 7,
    });
    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      billsUserId: settings.bills_user_id ?? userId,
      repaymentsUserId: settings.repayments_user_id ?? userId,
      statisticsUserId: settings.statistics_user_id ?? userId,
      repaymentReminderEnabled: settings.repayment_reminder_enabled,
      overdueReminderEnabled: settings.overdue_reminder_enabled,
      autoRepaymentOnMarkPaid: settings.auto_repayment_on_mark_paid,
      notificationFrequency: settings.notification_frequency,
      upcomingDays: settings.upcoming_days,
    }, 'update_loan_settings_success'));
  }));

  router.post('/actions/mark-bill-paid', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(markPaidSchema, request.body);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      bills_user_id: userId,
      repayments_user_id: userId,
      statistics_user_id: userId,
      repayment_reminder_enabled: true,
      overdue_reminder_enabled: true,
      auto_repayment_on_mark_paid: true,
      notification_frequency: 'daily',
      upcoming_days: 7,
    });
    const current = await billRepo.findOne({
      where: { id: payload.billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_bill_not_found', 404, 404);
    }

    current.is_paid = true;
    current.paid_at = dayjs().format('YYYY-MM-DD');
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

    response.json(successResponse({
      bill: mapBill(current),
      createdRepayment,
    }, 'mark_loan_bill_paid_success'));
  }));

  router.post('/actions/trigger-reminders', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerReminderSchema, request.body);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      bills_user_id: userId,
      repayments_user_id: userId,
      statistics_user_id: userId,
      repayment_reminder_enabled: true,
      overdue_reminder_enabled: true,
      auto_repayment_on_mark_paid: true,
      notification_frequency: 'daily',
      upcoming_days: 7,
    });
    const bills = await billRepo.find({ where: { user_id: userId } });
    const result = await triggerLoanReminderLogs(userId, bills, settings);

    if (!result.logs.length) {
      result.logs.push(
        ...(await sendNotificationSceneLogs({
          userId,
          sceneId: 'loan.repayment_upcoming',
          title: payload.title ?? '贷款还款提醒',
          message: '已手动触发贷款还款提醒。',
        })),
        ...(await sendNotificationSceneLogs({
          userId,
          sceneId: 'loan.repayment_overdue',
          title: payload.title ?? '贷款逾期提醒',
          message: '已手动触发贷款逾期提醒。',
        })),
      );
    }

    response.json(successResponse({
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
