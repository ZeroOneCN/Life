import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { ensureNotificationScenesForUser } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { FinanceBillReminderSettingEntity } from './entities/finance-bill-reminder-setting.entity';
import {
  getMonthBills,
  getUpcomingBills,
  getBillSummary,
  getUnifiedBillsInRange,
  type BillType,
} from './bill-aggregator.service';
import { appDataSource } from '../../db/data-source';
import { FinanceLoanBillEntity } from './entities/finance-loan-bill.entity';
import dayjs from 'dayjs';
import { startBillReminderScheduler } from './bill-reminder.scheduler';

const billSettingSchema = z.object({
  reminder_enabled: z.coerce.boolean().optional(),
  lead_days: z.coerce.number().int().min(1).max(30).optional(),
  enabled_types: z.string().optional(),
  reminder_time: z.string().optional(),
  notes: z.string().max(500).optional(),
});

function parseBillTypes(input: unknown): BillType[] | undefined {
  if (!input || typeof input !== 'string') return undefined;
  const items = input.split(',').filter(Boolean);
  const valid: BillType[] = [];
  for (const item of items) {
    if (item === 'loan' || item === 'subscription' || item === 'rent') {
      valid.push(item);
    }
  }
  return valid.length > 0 ? valid : undefined;
}

const DEFAULT_SETTINGS = {
  reminder_enabled: true,
  lead_days: 7,
  enabled_types: 'loan,subscription,rent',
  reminder_time: '09:00',
  notes: '',
};

/**
 * 创建账单提醒路由。
 *
 * 提供统一账单日历、账单列表、提醒设置、状态标记等 API。
 *
 * @returns Express Router 实例
 */
export function createBillRouter() {
  startBillReminderScheduler();
  const router = Router();
  const settingService = new BaseUserSettingService(FinanceBillReminderSettingEntity);

  /**
   * GET /api/finance/bill/summary
   * 获取指定月份的账单概览统计。
   */
  router.get(
    '/summary',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month || dayjs().format('YYYY-MM'));
      const summary = await getBillSummary(userId, month);
      res.json(successResponse(summary));
    }),
  );

  /**
   * GET /api/finance/bill/calendar
   * 获取指定月份的账单日历数据。
   */
  router.get(
    '/calendar',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month || dayjs().format('YYYY-MM'));
      const types = parseBillTypes(req.query.types);
      const bills = await getMonthBills(userId, month, types);
      res.json(successResponse(bills));
    }),
  );

  /**
   * GET /api/finance/bill/upcoming
   * 获取未来 N 天内即将到期的账单。
   */
  router.get(
    '/upcoming',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const days = z.coerce.number().int().min(1).max(90).parse(req.query.days ?? 7);
      const types = parseBillTypes(req.query.types);
      const bills = await getUpcomingBills(userId, days, types);
      res.json(successResponse(bills));
    }),
  );

  /**
   * GET /api/finance/bill/list
   * 按时间范围查询账单列表。
   */
  router.get(
    '/list',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const startDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.start_date);
      const endDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.end_date);
      const types = parseBillTypes(req.query.types);
      const bills = await getUnifiedBillsInRange(userId, startDate, endDate, types);
      res.json(successResponse(bills));
    }),
  );

  /**
   * GET /api/finance/bill/setting
   * 获取账单提醒设置。
   *
   * 若用户已开启 reminder_enabled，则顺带确保通知中心对应 scene 已启用，
   * 兼容历史用户在通知中心 scene 默认禁用状态下开启账单提醒的场景。
   */
  router.get(
    '/setting',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const setting = await settingService.getOrCreate(userId, DEFAULT_SETTINGS);

      if (setting.reminder_enabled) {
        await ensureNotificationScenesForUser(
          userId,
          [NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING, NOTIFICATION_SCENE_IDS.FINANCE_BILL_OVERDUE],
          { enableScenes: true },
        );
      }

      res.json(successResponse(setting));
    }),
  );

  /**
   * PUT /api/finance/bill/setting
   * 更新账单提醒设置。
   *
   * 当 reminder_enabled=true 时，联动启用通知中心的
   * finance.bill.upcoming 和 finance.bill.overdue 两个 scene，避免用户开启了账单提醒
   * 但通知中心 scene 仍处于默认禁用状态导致 scheduler 被 skip。
   */
  router.put(
    '/setting',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const payload = validateBody(billSettingSchema, req.body);
      const updated = await settingService.update(userId, payload, DEFAULT_SETTINGS);

      if (updated.reminder_enabled) {
        await ensureNotificationScenesForUser(
          userId,
          [NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING, NOTIFICATION_SCENE_IDS.FINANCE_BILL_OVERDUE],
          { enableScenes: true },
        );
      }

      res.json(successResponse(updated));
    }),
  );

  /**
   * POST /api/finance/bill/:type/:id/mark-paid
   * 标记账单为已付。
   *
   * 目前支持贷款账单（loan）的支付状态标记，
   * 订阅和房租为只读聚合数据，不支持直接标记。
   */
  router.post(
    '/:type/:id/mark-paid',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireAuthUser(req);
      const type = String(req.params.type);
      const id = String(req.params.id);

      if (type === 'loan') {
        const loanBillRepo = appDataSource.getRepository(FinanceLoanBillEntity);
        const bill = await loanBillRepo.findOne({ where: { id, user_id: userId } });
        if (!bill) {
          res.status(404).json({ code: 404, message: '账单不存在' });
          return;
        }
        bill.is_paid = true;
        bill.paid_at = dayjs().format('YYYY-MM-DD');
        await loanBillRepo.save(bill);
        res.json(successResponse({ success: true }));
        return;
      }

      res.status(400).json({ code: 400, message: '该账单类型不支持手动标记支付状态' });
    }),
  );

  return router;
}
