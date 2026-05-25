import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { LifeCardRecordEntity } from './entities/life-card-record.entity';
import { LifeCardBillRecordEntity } from './entities/life-card-bill-record.entity';
import { LifeCardRechargeRecordEntity } from './entities/life-card-recharge-record.entity';
import { LifeCardCarrierEntity } from './entities/life-card-carrier.entity';
import { LifeCardSettingEntity } from './entities/life-card-setting.entity';
import { LifeCardBillImportBatchEntity } from './entities/life-card-bill-import-batch.entity';
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

const cardSchema = z.object({
  phoneNumber: z.string().trim().min(1).max(32),
  carrierId: z.string().trim().optional().default(''),
  carrierName: z.string().trim().optional().default(''),
  location: z.string().trim().optional().default(''),
  balance: z.number().min(0).optional().default(0),
  monthlyFee: z.number().min(0).optional().default(0),
  billingDay: z.number().int().min(1).max(31).optional().default(1),
  dataPlan: z.string().trim().optional().default(''),
  callMinutes: z.string().trim().optional().default(''),
  smsCount: z.string().trim().optional().default(''),
  activationDate: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const billSchema = z.object({
  simId: z.string().trim().min(1),
  phoneNumber: z.string().trim().optional(),
  carrierName: z.string().trim().optional(),
  billingMonth: z.string().min(1),
  monthlyFee: z.number().min(0).optional().default(0),
  actualFee: z.number().min(0).optional().default(0),
  extraCharges: z.number().min(0).optional().default(0),
  totalFee: z.number().min(0).optional().default(0),
  note: z.string().optional().default(''),
});

const rechargeSchema = z.object({
  simId: z.string().trim().min(1),
  amount: z.number().positive(),
  rechargeDate: z.string().min(1),
  note: z.string().optional().default(''),
});

const carrierSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
});

const settingsSchema = z.object({
  balanceLowEnabled: z.boolean().optional(),
  billingUpcomingEnabled: z.boolean().optional(),
  balanceThreshold: z.number().min(0).optional(),
  notificationDaysBefore: z.number().int().min(0).max(31).optional(),
});

const rechargeActionSchema = z.object({
  simId: z.string().trim().min(1),
  amount: z.number().positive(),
  rechargeDate: z.string().optional(),
  note: z.string().optional(),
});

const triggerReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const importBillRowSchema = z.object({
  phoneNumber: z.string().trim().optional(),
  billingMonth: z.string().optional(),
  monthlyFee: z.union([z.number(), z.string()]).optional(),
  actualFee: z.union([z.number(), z.string()]).optional(),
  extraCharges: z.union([z.number(), z.string()]).optional(),
  totalFee: z.union([z.number(), z.string()]).optional(),
  note: z.string().optional(),
});

const importBillsSchema = z.object({
  fileName: z.string().trim().optional().default('card-bills-import.json'),
  rows: z.array(importBillRowSchema).default([]),
});

const settingService = new BaseUserSettingService(LifeCardSettingEntity);

async function triggerRuleBasedCardReminders(
  userId: string,
  cards: LifeCardRecordEntity[],
  settings: LifeCardSettingEntity,
) {
  const today = dayjs();
  const repository = appDataSource.getRepository(LifeCardRecordEntity);
  const logs = [];

  for (const card of cards) {
    if (settings.balance_low_enabled && Number(card.balance) <= Number(settings.balance_threshold)) {
      const marker = `${today.format('YYYY-MM-DD')}:balance:${Number(settings.balance_threshold).toFixed(2)}`;
      if (card.last_balance_reminder_marker !== marker) {
        logs.push(...(await sendNotificationSceneLogs({
          userId,
          sceneId: 'card.balance_low',
          title: '号卡低余额提醒',
          message: `${card.phone_number} 当前余额 ${Number(card.balance).toFixed(2)}，已低于阈值 ${Number(settings.balance_threshold).toFixed(2)}。`,
        })));
        card.last_balance_reminder_marker = marker;
      }
    }

    if (settings.billing_upcoming_enabled) {
      let billingDate = today.date(card.billing_day);
      if (billingDate.endOf('day').isBefore(today)) {
        billingDate = today.add(1, 'month').date(card.billing_day);
      }
      const diff = billingDate.startOf('day').diff(today.startOf('day'), 'day');
      if (diff >= 0 && diff <= settings.notification_days_before) {
        const marker = `${billingDate.format('YYYY-MM-DD')}:billing:${settings.notification_days_before}`;
        if (card.last_billing_reminder_marker !== marker) {
          logs.push(...(await sendNotificationSceneLogs({
            userId,
            sceneId: 'card.billing_upcoming',
            title: '号卡账单日前提醒',
            message: `${card.phone_number} 将在 ${billingDate.format('YYYY-MM-DD')} 进入账单日窗口，请检查余额和套餐。`,
          })));
          card.last_billing_reminder_marker = marker;
        }
      }
    }
  }

  if (cards.length) {
    await repository.save(cards);
  }

  return logs;
}

function mapCard(entity: LifeCardRecordEntity) {
  return {
    id: entity.id,
    phoneNumber: entity.phone_number,
    carrierId: entity.carrier_id,
    carrierName: entity.carrier_name,
    location: entity.location,
    balance: Number(entity.balance),
    monthlyFee: Number(entity.monthly_fee),
    billingDay: entity.billing_day,
    dataPlan: entity.data_plan,
    callMinutes: entity.call_minutes,
    smsCount: entity.sms_count,
    activationDate: entity.activation_date,
    notes: entity.notes,
    lastBalanceReminderMarker: entity.last_balance_reminder_marker ?? '',
    lastBillingReminderMarker: entity.last_billing_reminder_marker ?? '',
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapBill(entity: LifeCardBillRecordEntity) {
  return {
    id: entity.id,
    simId: entity.sim_id,
    phoneNumber: entity.phone_number,
    carrierName: entity.carrier_name,
    billingMonth: entity.billing_month,
    monthlyFee: Number(entity.monthly_fee),
    actualFee: Number(entity.actual_fee),
    extraCharges: Number(entity.extra_charges),
    totalFee: Number(entity.total_fee),
    note: entity.note,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapRecharge(entity: LifeCardRechargeRecordEntity) {
  return {
    id: entity.id,
    simId: entity.sim_id,
    phoneNumber: entity.phone_number,
    amount: Number(entity.amount),
    rechargeDate: entity.recharge_date,
    note: entity.note,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapCarrier(entity: LifeCardCarrierEntity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function buildOverview(cards: LifeCardRecordEntity[], bills: LifeCardBillRecordEntity[], recharges: LifeCardRechargeRecordEntity[], settings: LifeCardSettingEntity) {
  const currentMonth = dayjs().format('YYYY-MM');
  return {
    totalCards: cards.length,
    lowBalanceCount: cards.filter((card) => Number(card.balance) <= Number(settings.balance_threshold)).length,
    totalBalance: Number(cards.reduce((sum, card) => sum + Number(card.balance), 0).toFixed(2)),
    monthlyFeeTotal: Number(cards.reduce((sum, card) => sum + Number(card.monthly_fee), 0).toFixed(2)),
    carrierCount: new Set(cards.map((card) => card.carrier_name)).size,
    currentMonthBillCount: bills.filter((bill) => bill.billing_month === currentMonth).length,
    currentMonthBillAmount: Number(bills.filter((bill) => bill.billing_month === currentMonth).reduce((sum, bill) => sum + Number(bill.total_fee), 0).toFixed(2)),
    totalRechargeAmount: Number(recharges.reduce((sum, recharge) => sum + Number(recharge.amount), 0).toFixed(2)),
  };
}

function buildMonthlyTrend(bills: LifeCardBillRecordEntity[]) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = dayjs().subtract(11 - index, 'month').format('YYYY-MM');
    const monthBills = bills.filter((bill) => bill.billing_month === month);
    return {
      month,
      label: dayjs(`${month}-01`).format('MM月'),
      amount: Number(monthBills.reduce((sum, bill) => sum + Number(bill.total_fee), 0).toFixed(2)),
      count: monthBills.length,
    };
  });
}

function buildCarrierBreakdown(cards: LifeCardRecordEntity[], bills: LifeCardBillRecordEntity[]) {
  const grouped = new Map<string, {
    carrierId: string;
    carrierName: string;
    cardCount: number;
    monthlyFee: number;
    totalBillAmount: number;
  }>();

  cards.forEach((card) => {
    const key = card.carrier_id || card.carrier_name;
    const current = grouped.get(key) ?? {
      carrierId: card.carrier_id,
      carrierName: card.carrier_name,
      cardCount: 0,
      monthlyFee: 0,
      totalBillAmount: 0,
    };
    current.cardCount += 1;
    current.monthlyFee += Number(card.monthly_fee);
    grouped.set(key, current);
  });

  bills.forEach((bill) => {
    const current = Array.from(grouped.values()).find((item) => item.carrierName === bill.carrier_name);
    if (current) {
      current.totalBillAmount += Number(bill.total_fee);
    }
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    monthlyFee: Number(item.monthlyFee.toFixed(2)),
    totalBillAmount: Number(item.totalBillAmount.toFixed(2)),
  })).sort((left, right) => right.totalBillAmount - left.totalBillAmount);
}

function buildRanking(cards: LifeCardRecordEntity[], bills: LifeCardBillRecordEntity[], recharges: LifeCardRechargeRecordEntity[]) {
  return cards.map((card) => {
    const cardBills = bills.filter((bill) => bill.sim_id === card.id || bill.phone_number === card.phone_number);
    const cardRecharges = recharges.filter((item) => item.sim_id === card.id || item.phone_number === card.phone_number);
    return {
      simId: card.id,
      phoneNumber: card.phone_number,
      carrierName: card.carrier_name,
      billCount: cardBills.length,
      totalBillAmount: Number(cardBills.reduce((sum, bill) => sum + Number(bill.total_fee), 0).toFixed(2)),
      totalRechargeAmount: Number(cardRecharges.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)),
    };
  }).sort((left, right) => right.totalBillAmount - left.totalBillAmount);
}

export function createCardRouter() {
  const router = Router();

  router.get('/cards', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(LifeCardRecordEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapCard), page, pageSize, total)));
  }));

  router.post('/cards', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(cardSchema, request.body);
    const repository = appDataSource.getRepository(LifeCardRecordEntity);

    const item = await repository.save(repository.create({
      user_id: userId,
      phone_number: payload.phoneNumber,
      carrier_id: payload.carrierId,
      carrier_name: payload.carrierName,
      location: payload.location,
      balance: payload.balance,
      monthly_fee: payload.monthlyFee,
      billing_day: payload.billingDay,
      data_plan: payload.dataPlan,
      call_minutes: payload.callMinutes,
      sms_count: payload.smsCount,
      activation_date: payload.activationDate ? normalizeDate(payload.activationDate) : dayjs().format('YYYY-MM-DD'),
      notes: payload.notes,
      last_balance_reminder_marker: null,
      last_billing_reminder_marker: null,
    }));

    const settings = await settingService.getOrCreate(userId, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });
    await triggerRuleBasedCardReminders(userId, [item], settings);

    response.json(successResponse(mapCard(item), 'create_life_card_success'));
  }));

  router.patch('/cards/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const cardId = String(request.params.id ?? '');
    const payload = validateBody(cardSchema.partial(), request.body);
    const repository = appDataSource.getRepository(LifeCardRecordEntity);
    const current = await repository.findOne({
      where: { id: cardId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      phone_number: payload.phoneNumber ?? current.phone_number,
      carrier_id: payload.carrierId ?? current.carrier_id,
      carrier_name: payload.carrierName ?? current.carrier_name,
      location: payload.location ?? current.location,
      balance: payload.balance ?? current.balance,
      monthly_fee: payload.monthlyFee ?? current.monthly_fee,
      billing_day: payload.billingDay ?? current.billing_day,
      data_plan: payload.dataPlan ?? current.data_plan,
      call_minutes: payload.callMinutes ?? current.call_minutes,
      sms_count: payload.smsCount ?? current.sms_count,
      activation_date: payload.activationDate ? normalizeDate(payload.activationDate) : current.activation_date,
      notes: payload.notes ?? current.notes,
    });

    const settings = await settingService.getOrCreate(userId, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });
    await triggerRuleBasedCardReminders(userId, [next], settings);

    response.json(successResponse(mapCard(next), 'update_life_card_success'));
  }));

  router.delete('/cards/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const cardId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(LifeCardRecordEntity);
    const current = await repository.findOne({
      where: { id: cardId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_life_card_success'));
  }));

  router.get('/bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(LifeCardBillRecordEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { billing_month: 'DESC', updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapBill), page, pageSize, total)));
  }));

  router.post('/bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(billSchema, request.body);
    const repository = appDataSource.getRepository(LifeCardBillRecordEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      sim_id: payload.simId,
      phone_number: payload.phoneNumber ?? '',
      carrier_name: payload.carrierName ?? '',
      billing_month: normalizeMonth(payload.billingMonth),
      monthly_fee: payload.monthlyFee,
      actual_fee: payload.actualFee,
      extra_charges: payload.extraCharges,
      total_fee: payload.totalFee || Number(((payload.actualFee ?? 0) + (payload.extraCharges ?? 0)).toFixed(2)),
      note: payload.note,
    }));

    response.json(successResponse(mapBill(item), 'create_life_card_bill_success'));
  }));

  router.patch('/bills/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billId = String(request.params.id ?? '');
    const payload = validateBody(billSchema.partial(), request.body);
    const repository = appDataSource.getRepository(LifeCardBillRecordEntity);
    const current = await repository.findOne({
      where: { id: billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_bill_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      sim_id: payload.simId ?? current.sim_id,
      phone_number: payload.phoneNumber ?? current.phone_number,
      carrier_name: payload.carrierName ?? current.carrier_name,
      billing_month: payload.billingMonth ? normalizeMonth(payload.billingMonth) : current.billing_month,
      monthly_fee: payload.monthlyFee ?? current.monthly_fee,
      actual_fee: payload.actualFee ?? current.actual_fee,
      extra_charges: payload.extraCharges ?? current.extra_charges,
      total_fee: payload.totalFee ?? current.total_fee,
      note: payload.note ?? current.note,
    });

    response.json(successResponse(mapBill(next), 'update_life_card_bill_success'));
  }));

  router.delete('/bills/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const billId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(LifeCardBillRecordEntity);
    const current = await repository.findOne({
      where: { id: billId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_bill_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_life_card_bill_success'));
  }));

  router.get('/recharges', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(LifeCardRechargeRecordEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { recharge_date: 'DESC', updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapRecharge), page, pageSize, total)));
  }));

  router.post('/recharges', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(rechargeSchema, request.body);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const rechargeRepo = appDataSource.getRepository(LifeCardRechargeRecordEntity);
    const card = await cardRepo.findOne({
      where: { id: payload.simId, user_id: userId },
    });

    if (!card) {
      throw new AppError('life_card_not_found', 404, 404);
    }

    card.balance = Number((Number(card.balance) + payload.amount).toFixed(2));
    await cardRepo.save(card);

    const item = await rechargeRepo.save(rechargeRepo.create({
      user_id: userId,
      sim_id: card.id,
      phone_number: card.phone_number,
      amount: payload.amount,
      recharge_date: normalizeDate(payload.rechargeDate),
      note: payload.note,
    }));

    const settings = await settingService.getOrCreate(userId, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });
    await triggerRuleBasedCardReminders(userId, [card], settings);

    response.json(successResponse(mapRecharge(item), 'create_life_card_recharge_success'));
  }));

  router.delete('/recharges/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const rechargeId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(LifeCardRechargeRecordEntity);
    const current = await repository.findOne({
      where: { id: rechargeId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_recharge_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_life_card_recharge_success'));
  }));

  router.get('/carriers', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(LifeCardCarrierEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });

    response.json(successResponse(buildListData(items.map(mapCarrier))));
  }));

  router.post('/carriers', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(carrierSchema, request.body);
    const repository = appDataSource.getRepository(LifeCardCarrierEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      name: payload.name,
      description: payload.description,
    }));

    response.json(successResponse(mapCarrier(item), 'create_life_card_carrier_success'));
  }));

  router.patch('/carriers/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const carrierId = String(request.params.id ?? '');
    const payload = validateBody(carrierSchema.partial(), request.body);
    const repository = appDataSource.getRepository(LifeCardCarrierEntity);
    const current = await repository.findOne({
      where: { id: carrierId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_carrier_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
    });

    response.json(successResponse(mapCarrier(next), 'update_life_card_carrier_success'));
  }));

  router.delete('/carriers/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const carrierId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(LifeCardCarrierEntity);
    const current = await repository.findOne({
      where: { id: carrierId, user_id: userId },
    });

    if (!current) {
      throw new AppError('life_card_carrier_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_life_card_carrier_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const billRepo = appDataSource.getRepository(LifeCardBillRecordEntity);
    const rechargeRepo = appDataSource.getRepository(LifeCardRechargeRecordEntity);
    const cards = await cardRepo.find({ where: { user_id: userId } });
    const bills = await billRepo.find({ where: { user_id: userId } });
    const recharges = await rechargeRepo.find({ where: { user_id: userId } });
    const settings = await settingService.getOrCreate(userId, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });

    response.json(successResponse(buildOverview(cards, bills, recharges, settings)));
  }));

  router.get('/monthly-trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(LifeCardBillRecordEntity);
    const bills = await repository.find({ where: { user_id: userId } });
    response.json(successResponse(buildMonthlyTrend(bills)));
  }));

  router.get('/carrier-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const billRepo = appDataSource.getRepository(LifeCardBillRecordEntity);
    const cards = await cardRepo.find({ where: { user_id: userId } });
    const bills = await billRepo.find({ where: { user_id: userId } });
    response.json(successResponse(buildCarrierBreakdown(cards, bills)));
  }));

  router.get('/ranking', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const billRepo = appDataSource.getRepository(LifeCardBillRecordEntity);
    const rechargeRepo = appDataSource.getRepository(LifeCardRechargeRecordEntity);
    const cards = await cardRepo.find({ where: { user_id: userId } });
    const bills = await billRepo.find({ where: { user_id: userId } });
    const recharges = await rechargeRepo.find({ where: { user_id: userId } });
    response.json(successResponse(buildRanking(cards, bills, recharges)));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });

    response.json(successResponse({
      balanceLowEnabled: settings.balance_low_enabled,
      billingUpcomingEnabled: settings.billing_upcoming_enabled,
      balanceThreshold: Number(settings.balance_threshold),
      notificationDaysBefore: settings.notification_days_before,
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      balance_low_enabled: payload.balanceLowEnabled,
      billing_upcoming_enabled: payload.billingUpcomingEnabled,
      balance_threshold: payload.balanceThreshold,
      notification_days_before: payload.notificationDaysBefore,
    }, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });

    response.json(successResponse({
      balanceLowEnabled: settings.balance_low_enabled,
      billingUpcomingEnabled: settings.billing_upcoming_enabled,
      balanceThreshold: Number(settings.balance_threshold),
      notificationDaysBefore: settings.notification_days_before,
    }, 'update_life_card_settings_success'));
  }));

  router.post('/actions/recharge', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(rechargeActionSchema, request.body);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const rechargeRepo = appDataSource.getRepository(LifeCardRechargeRecordEntity);
    const card = await cardRepo.findOne({
      where: { id: payload.simId, user_id: userId },
    });

    if (!card) {
      throw new AppError('life_card_not_found', 404, 404);
    }

    card.balance = Number((Number(card.balance) + payload.amount).toFixed(2));
    await cardRepo.save(card);

    const recharge = await rechargeRepo.save(rechargeRepo.create({
      user_id: userId,
      sim_id: card.id,
      phone_number: card.phone_number,
      amount: payload.amount,
      recharge_date: normalizeDate(payload.rechargeDate),
      note: payload.note ?? '',
    }));

    const settings = await settingService.getOrCreate(userId, {
      balance_low_enabled: true,
      billing_upcoming_enabled: true,
      balance_threshold: 10,
      notification_days_before: 3,
    });
    await triggerRuleBasedCardReminders(userId, [card], settings);

    response.json(successResponse(mapRecharge(recharge), 'recharge_life_card_success'));
  }));

  router.post('/actions/import-bills', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(importBillsSchema, request.body);
    const rows = payload.rows ?? [];
    const billRepo = appDataSource.getRepository(LifeCardBillRecordEntity);
    const batchRepo = appDataSource.getRepository(LifeCardBillImportBatchEntity);
    const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
    const [existingBills, cards] = await Promise.all([
      billRepo.find({ where: { user_id: userId } }),
      cardRepo.find({ where: { user_id: userId } }),
    ]);
    const seen = new Set(existingBills.map((item) => [
      item.phone_number,
      item.billing_month,
      Number(item.total_fee).toFixed(2),
      item.note.trim().toLowerCase(),
    ].join('|')));

    let importedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const toSave: LifeCardBillRecordEntity[] = [];

    rows.forEach((row) => {
      const phoneNumber = row.phoneNumber?.trim() ?? '';
      const billingMonth = row.billingMonth ? normalizeMonth(row.billingMonth) : '';
      const totalFee = Number.isFinite(Number(row.totalFee))
        ? Number(Number(row.totalFee).toFixed(2))
        : Number((((Number(row.actualFee) || 0) + (Number(row.extraCharges) || 0))).toFixed(2));

      if (!phoneNumber || !billingMonth || !Number.isFinite(totalFee) || totalFee < 0) {
        invalidCount += 1;
        return;
      }

      const card = cards.find((item) => item.phone_number === phoneNumber);
      if (!card) {
        invalidCount += 1;
        return;
      }

      const note = row.note ?? '';
      const key = [phoneNumber, billingMonth, totalFee.toFixed(2), note.trim().toLowerCase()].join('|');
      if (seen.has(key)) {
        duplicateCount += 1;
        return;
      }

      seen.add(key);
      importedCount += 1;
      toSave.push(billRepo.create({
        user_id: userId,
        sim_id: card.id,
        phone_number: phoneNumber,
        carrier_name: card.carrier_name,
        billing_month: billingMonth,
        monthly_fee: Number(Number(row.monthlyFee ?? card.monthly_fee).toFixed(2)),
        actual_fee: Number.isFinite(Number(row.actualFee)) ? Number(Number(row.actualFee).toFixed(2)) : 0,
        extra_charges: Number.isFinite(Number(row.extraCharges)) ? Number(Number(row.extraCharges).toFixed(2)) : 0,
        total_fee: totalFee,
        note,
      }));
    });

    if (toSave.length) {
      await billRepo.save(toSave);
    }

    await batchRepo.save(batchRepo.create({
      user_id: userId,
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
    }, 'import_life_card_bills_success'));
  }));

  router.post('/actions/trigger-reminders', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerReminderSchema, request.body);
    const logs = [
      ...(await sendNotificationSceneLogs({
        userId,
        sceneId: 'card.balance_low',
        title: payload.title ?? '号卡低余额提醒',
        message: '已手动触发号卡低余额提醒。',
      })),
      ...(await sendNotificationSceneLogs({
        userId,
        sceneId: 'card.billing_upcoming',
        title: payload.title ?? '号卡账单日前提醒',
        message: '已手动触发号卡账单日前提醒。',
      })),
    ];

    response.json(successResponse(logs, 'trigger_life_card_reminders_success'));
  }));

  return router;
}
