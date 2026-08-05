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
import {
  sendNotificationSceneLogs,
  syncNotificationScenesEnabled,
} from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';

const platformSchema = z.object({
  name: z.string().trim().min(1).max(128),
  billingDay: z.number().int().min(1).max(31),
  repaymentDay: z.number().int().min(1).max(31),
  creditLimit: z.number().min(0).optional().default(0),
});

const billSchema = z.object({
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
  billId: z.string().trim().optional().default(''),
  platformId: z.string().trim().min(1),
  platformName: z.string().trim().optional(),
  amount: z.number().min(0),
  interest: z.number().min(0).optional().default(0),
  repaymentDate: z.string().min(1),
  notes: z.string().optional().default(''),
});

const settingsSchema = z.object({
  repaymentReminderEnabled: z.boolean().optional().default(true),
  overdueReminderEnabled: z.boolean().optional().default(true),
  autoRepaymentOnMarkPaid: z.boolean().optional().default(true),
  notificationFrequency: z.enum(['daily', 'always']).optional().default('daily'),
  upcomingDays: z.number().int().min(0).max(30).optional().default(7),
});

const markPaidSchema = z.object({
  billId: z.string().trim().min(1),
});

/**
 * 部分还款请求体 schema。
 *
 * amount 为本次还款总金额，系统按"先利息后本金"顺序抵扣。
 * repaymentDate / notes 可选，缺省时使用今日和无备注。
 */
const partialRepaySchema = z.object({
  billId: z.string().trim().min(1),
  amount: z.number().min(0.01),
  repaymentDate: z.string().optional(),
  notes: z.string().optional().default(''),
});

const triggerReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const settingService = new BaseUserSettingService(FinanceLoanSettingEntity);

function getDefaultSettings() {
  return {
    repayment_reminder_enabled: true,
    overdue_reminder_enabled: true,
    auto_repayment_on_mark_paid: true,
    notification_frequency: 'daily',
    upcoming_days: 7,
  } satisfies Partial<FinanceLoanSettingEntity>;
}

function mapSettings(settings: FinanceLoanSettingEntity) {
  return {
    repaymentReminderEnabled: settings.repayment_reminder_enabled,
    overdueReminderEnabled: settings.overdue_reminder_enabled,
    autoRepaymentOnMarkPaid: settings.auto_repayment_on_mark_paid,
    notificationFrequency: settings.notification_frequency as 'daily' | 'always',
    upcomingDays: settings.upcoming_days,
  };
}

function mapPlatform(entity: FinanceLoanPlatformEntity) {
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

function mapBill(entity: FinanceLoanBillEntity) {
  const amount = Number(entity.amount);
  const interest = Number(entity.interest);
  const paidAmount = Number(entity.paid_amount ?? 0);
  const paidInterest = Number(entity.paid_interest ?? 0);
  return {
    id: entity.id,
    platformId: entity.platform_id,
    platformName: entity.platform_name,
    amount,
    interest,
    paidAmount,
    paidInterest,
    remainingAmount: Number(Math.max(0, amount - paidAmount).toFixed(2)),
    remainingInterest: Number(Math.max(0, interest - paidInterest).toFixed(2)),
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
    billId: entity.bill_id ?? '',
    platformId: entity.platform_id,
    platformName: entity.platform_name,
    amount: Number(entity.amount),
    interest: Number(entity.interest),
    repaymentDate: dayjs(entity.repayment_date).format('YYYY-MM-DD'),
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
  const toNum = (v: unknown) => Number(v) || 0;
  return {
    totalDebt: Number(bills.reduce((sum, bill) => sum + toNum(bill.amount), 0).toFixed(2)),
    totalPaid: Number(repayments.reduce((sum, repayment) => sum + toNum(repayment.amount), 0).toFixed(2)),
    // 待还金额 = 各账单剩余欠款（amount 已含利息，不再单独累加 interest）
    totalUnpaid: Number(
      bills
        .filter((bill) => !bill.is_paid)
        .reduce((sum, bill) => sum + Math.max(0, toNum(bill.amount) - toNum(bill.paid_amount)), 0)
        .toFixed(2),
    ),
    totalInterest: Number(bills.reduce((sum, bill) => sum + toNum(bill.interest), 0).toFixed(2)),
    totalBillCount: bills.length,
    repaymentCount: repayments.length,
    upcomingCount: bills.filter((bill) => getBillStatus(bill) === 'unpaid').length,
    overdueCount: bills.filter((bill) => getBillStatus(bill) === 'overdue').length,
  };
}

function buildLoanReminderItems(bills: FinanceLoanBillEntity[], settings: FinanceLoanSettingEntity) {
  const today = dayjs().startOf('day');

  return bills
    .filter((bill) => !bill.is_paid)
    .flatMap((bill) => {
      const dueDate = dayjs(bill.due_date).startOf('day');
      const diff = dueDate.diff(today, 'day');
      const items: Array<{
        bill: FinanceLoanBillEntity;
        sceneId: typeof NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING | typeof NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE;
        title: string;
        message: string;
        severity: 'high' | 'medium';
      }> = [];

      // 待还金额 = 剩余欠款（amount 已含利息，无需再加 interest）
      const remainingAmount = Math.max(0, Number(bill.amount) - Number(bill.paid_amount ?? 0));
      const remainingTotal = remainingAmount;

      // 通知逻辑：根据实际账单日期触发，仅覆盖三种场景：
      //   diff === 0  今日到期
      //   diff === 1  明日到期（提前1天）
      //   diff  < 0   已逾期
      // 不再使用 upcoming_days 提前多天汇总推送。
      if (settings.repayment_reminder_enabled && (diff === 0 || diff === 1)) {
        const isToday = diff === 0;
        items.push({
          bill,
          sceneId: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING,
          title: isToday ? '贷款今日到期提醒' : '贷款明日到期提醒',
          message: isToday
            ? `${bill.platform_name} 的账单今日到期，待还金额 ¥${remainingTotal.toFixed(2)}。`
            : `${bill.platform_name} 的账单将于明日（${bill.due_date}）到期，待还金额 ¥${remainingTotal.toFixed(2)}。`,
          severity: isToday ? 'high' : 'medium',
        });
      }

      if (settings.overdue_reminder_enabled && diff < 0) {
        items.push({
          bill,
          sceneId: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE,
          title: '贷款逾期提醒',
          message: `${bill.platform_name} 的账单已逾期 ${Math.abs(diff)} 天，待还金额 ¥${remainingTotal.toFixed(2)}。`,
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
      user_id: userId,
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
      where: { id: payload.platformId, user_id: userId },
    });

    const item = await billRepo.save(billRepo.create({
      user_id: userId,
      platform_id: payload.platformId,
      platform_name: payload.platformName ?? platform?.name ?? '',
      amount: payload.amount,
      interest: payload.interest,
      billing_month: normalizeMonth(payload.billingMonth),
      due_date: payload.dueDate
        ? normalizeDate(payload.dueDate)
        : dayjs(`${normalizeMonth(payload.billingMonth)}-01`).format('YYYY-MM-DD'),
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
    const bill = payload.billId ? await billRepo.findOne({ where: { id: payload.billId, user_id: userId } }) : null;
    const platform = await platformRepo.findOne({ where: { id: payload.platformId, user_id: userId } });

    const item = await repaymentRepo.save(repaymentRepo.create({
      user_id: userId,
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
    const platformId = String(request.query.platformId ?? '').trim();
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const bills = await billRepo.find({ where: { user_id: userId } });
    const scoped = bills
      .filter((bill) => bill.billing_month === normalizeMonth(month))
      .filter((bill) => !platformId || bill.platform_id === platformId);

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
    const platformId = String(request.query.platformId ?? '').trim();
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const repayments = await repaymentRepo.find({ where: { user_id: userId } });
    const scopedRepayments = repayments.filter((item) => !platformId || item.platform_id === platformId);
    const start = dayjs(normalizeDate(startDate));
    const end = dayjs(normalizeDate(endDate));
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
    const settings = await settingService.getOrCreate(userId, getDefaultSettings());
    response.json(successResponse(mapSettings(settings)));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      repayment_reminder_enabled: payload.repaymentReminderEnabled,
      overdue_reminder_enabled: payload.overdueReminderEnabled,
      auto_repayment_on_mark_paid: payload.autoRepaymentOnMarkPaid,
      notification_frequency: payload.notificationFrequency,
      upcoming_days: payload.upcomingDays,
    }, getDefaultSettings());

    await syncNotificationScenesEnabled(userId, [
      {
        sceneId: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING,
        enabled: settings.repayment_reminder_enabled,
      },
      {
        sceneId: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE,
        enabled: settings.overdue_reminder_enabled,
      },
    ]);

    response.json(successResponse(mapSettings(settings), 'update_loan_settings_success'));
  }));

  router.post('/actions/mark-bill-paid', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(markPaidSchema, request.body);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const settings = await settingService.getOrCreate(userId, getDefaultSettings());
    const current = await billRepo.findOne({
      where: { id: payload.billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_bill_not_found', 404, 404);
    }

    // 一次性结清：amount 已含利息，只需将剩余欠款全部标记为已还
    const remainingAmount = Math.max(0, Number(current.amount) - Number(current.paid_amount ?? 0));

    current.paid_amount = Number(current.amount);
    current.paid_interest = Number(current.interest);
    current.is_paid = true;
    current.paid_at = dayjs().format('YYYY-MM-DD');
    await billRepo.save(current);

    let createdRepayment = false;
    if (settings.auto_repayment_on_mark_paid) {
      // 仅当存在剩余金额时才生成还款记录（避免重复结清时产生空记录）
      if (remainingAmount > 0) {
        await repaymentRepo.save(repaymentRepo.create({
          user_id: userId,
          bill_id: current.id,
          platform_id: current.platform_id,
          platform_name: current.platform_name,
          amount: remainingAmount,
          interest: 0,
          repayment_date: current.paid_at,
          notes: '标记账单已还时自动生成（结清剩余）',
        }));
        createdRepayment = true;
      }
    }

    response.json(successResponse({
      bill: mapBill(current),
      createdRepayment,
    }, 'mark_loan_bill_paid_success'));
  }));

  /**
   * POST /api/finance/loan/actions/partial-repay
   * 部分还款。
   *
   * amount 字段即欠款总额（已含利息），还款金额全部抵扣欠款本金：
   * 1. 校验金额不超过剩余欠款（amount - paid_amount）
   * 2. 还款全额累加 paid_amount
   * 3. 若剩余欠款清零则 is_paid=true、paid_at=today
   * 4. 自动生成还款记录（interest 恒为 0，利息已含在欠款内）
   */
  router.post('/actions/partial-repay', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(partialRepaySchema, request.body);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const repaymentRepo = appDataSource.getRepository(FinanceLoanRepaymentEntity);
    const current = await billRepo.findOne({
      where: { id: payload.billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('loan_bill_not_found', 404, 404);
    }

    if (current.is_paid) {
      throw new AppError('loan_bill_already_paid', 400, 400, '该账单已结清，无需继续还款');
    }

    const totalAmount = Number(current.amount);
    const paidAmount = Number(current.paid_amount ?? 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    if (payload.amount > remainingAmount + 0.01) {
      throw new AppError(
        'loan_partial_repay_exceeds',
        400,
        400,
        `还款金额超过剩余待还金额 ¥${remainingAmount.toFixed(2)}`,
      );
    }

    // amount 已含利息：还款全部抵扣欠款，无需再为利息单独支付
    const applyToAmount = payload.amount;
    const newPaidAmount = Number((paidAmount + applyToAmount).toFixed(2));

    current.paid_amount = newPaidAmount;

    const fullyPaid = newPaidAmount >= totalAmount;
    if (fullyPaid) {
      current.is_paid = true;
      current.paid_at = dayjs().format('YYYY-MM-DD');
    }

    await billRepo.save(current);

    const repaymentDate = payload.repaymentDate
      ? normalizeDate(payload.repaymentDate)
      : dayjs().format('YYYY-MM-DD');

    const repayment = await repaymentRepo.save(repaymentRepo.create({
      user_id: userId,
      bill_id: current.id,
      platform_id: current.platform_id,
      platform_name: current.platform_name,
      amount: applyToAmount,
      interest: 0,
      repayment_date: repaymentDate,
      notes: payload.notes || `部分还款：本金 ¥${applyToAmount.toFixed(2)}`,
    }));

    response.json(successResponse({
      bill: mapBill(current),
      repayment: mapRepayment(repayment),
      breakdown: {
        applyToAmount: Number(applyToAmount.toFixed(2)),
        applyToInterest: 0,
        remainingAmount: Number(Math.max(0, totalAmount - newPaidAmount).toFixed(2)),
        remainingInterest: 0,
        fullyPaid,
      },
    }, 'partial_repay_success'));
  }));

  router.post('/actions/trigger-reminders', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerReminderSchema, request.body);
    const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const settings = await settingService.getOrCreate(userId, getDefaultSettings());
    const bills = await billRepo.find({ where: { user_id: userId } });
    const result = await triggerLoanReminderLogs(userId, bills, settings);

    if (!result.logs.length) {
      result.logs.push(
        ...(await sendNotificationSceneLogs({
          userId,
          sceneId: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING,
          title: payload.title ?? '贷款还款提醒',
          message: '已手动触发贷款还款提醒。',
        })),
        ...(await sendNotificationSceneLogs({
          userId,
          sceneId: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE,
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
