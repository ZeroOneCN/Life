import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { ensureNotificationScenesForUser, sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { LifeCardRecordEntity } from './entities/life-card-record.entity';
import { LifeCardBillRecordEntity } from './entities/life-card-bill-record.entity';
import { LifeCardRechargeRecordEntity } from './entities/life-card-recharge-record.entity';
import { LifeCardSettingEntity } from './entities/life-card-setting.entity';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { toNumber, round2 } from '../../shared/utils/number';

const SCHEDULER_KEY = '__cardDeductionScheduler__';

const settingService = new BaseUserSettingService(LifeCardSettingEntity);

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每小时扫描一次（扣账日可能跨月）
  setInterval(() => {
    void runDeductionTick();
  }, 60 * 60 * 1000).unref?.();

  // 启动后延后 150 秒跑第一次，错开其他 scheduler（bill: 90s, schedule: 120s）
  setTimeout(() => {
    void runDeductionTick();
  }, 150_000).unref?.();
}

/**
 * 生成本月自动扣账幂等 marker（YYYYMM，如 202608）。
 * 避免过长字符串挤占 varchar 空间（历史曾遇到 marker 长度 > varchar 声明导致事务回滚）。
 */
function buildDeductionMarker(month: string): string {
  // month = YYYY-MM → YYYYMM
  return month.replace('-', '');
}

/**
 * 处理单张号卡的自动扣账：
 * 1. 生成 YYYYMM 幂等 marker，若本月已扣账则跳过（status=ALREADY）
 * 2. 在账单记录表中创建本月账单记录（monthly_fee=actual_fee）
 * 3. 扣减卡片 balance
 * 4. 创建一条负向充值记录（备注"自动扣账"）
 * 5. 发送通知
 * @param userId 用户 ID
 * @param card  号卡记录
 * @param month 账单月份（YYYY-MM）
 * @returns 执行结果与状态
 */
async function deductForCard(
  userId: string,
  card: LifeCardRecordEntity,
  month: string,
): Promise<{ ok: boolean; status: 'ALREADY' | 'BILL_EXISTS' | 'DEDUCTED' }> {
  const marker = buildDeductionMarker(month);
  if (card.last_auto_deduction_marker === marker) {
    return { ok: false, status: 'ALREADY' };
  }

  const today = dayjs().format('YYYY-MM-DD');
  const queryRunner = appDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const cardRepo = queryRunner.manager.getRepository(LifeCardRecordEntity);
    const billRepo = queryRunner.manager.getRepository(LifeCardBillRecordEntity);
    const rechargeRepo = queryRunner.manager.getRepository(LifeCardRechargeRecordEntity);

    // 1. 幂等检查：确认本月是否已有同名账单
    const existing = await billRepo.findOne({
      where: {
        user_id: userId,
        sim_id: card.id,
        billing_month: month,
      },
    });
    if (existing) {
      // 账单已存在但 marker 没更新，修正 marker 即可（避免后续重复进入事务）
      card.last_auto_deduction_marker = marker;
      await cardRepo.save(card);
      await queryRunner.commitTransaction();
      return { ok: false, status: 'BILL_EXISTS' };
    }

    const monthlyFee = round2(toNumber(card.monthly_fee));

    // 2. 创建本月账单记录
    const bill = billRepo.create({
      user_id: userId,
      sim_id: card.id,
      phone_number: card.phone_number,
      carrier_name: card.carrier_name,
      billing_month: month,
      monthly_fee: monthlyFee,
      actual_fee: monthlyFee,
      extra_charges: 0,
      total_fee: monthlyFee,
      note: `系统自动扣账（账单日 ${card.billing_day} 日）`,
    });
    await billRepo.save(bill);

    // 3. 扣减卡片余额（若余额不足仍扣账，但发出通知提示）
    const newBalance = round2(toNumber(card.balance) - monthlyFee);
    card.balance = newBalance;
    card.last_auto_deduction_marker = marker;
    await cardRepo.save(card);

    // 4. 创建一条充值记录（负值，表示扣减）
    const recharge = rechargeRepo.create({
      user_id: userId,
      sim_id: card.id,
      phone_number: card.phone_number,
      amount: -monthlyFee,
      recharge_date: today,
      note: `本月自动扣账（账单 ${month}）`,
    });
    await rechargeRepo.save(recharge);

    await queryRunner.commitTransaction();

    // 5. 发送通知
    if (newBalance < 0) {
      await sendNotificationSceneLogs({
        userId,
        sceneId: NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW,
        title: '号卡扣账结果：余额不足',
        message: `${card.phone_number} ${month} 账单已自动生成（金额 ${monthlyFee.toFixed(2)}），扣账后余额为 ${newBalance.toFixed(2)}，请尽快充值。`,
      });
    } else {
      await sendNotificationSceneLogs({
        userId,
        sceneId: NOTIFICATION_SCENE_IDS.CARD_BILLING_UPCOMING,
        title: '号卡自动扣账完成',
        message: `${card.phone_number} ${month} 账单已自动扣账（金额 ${monthlyFee.toFixed(2)}），当前余额 ${newBalance.toFixed(2)}。`,
      });
    }

    return { ok: true, status: 'DEDUCTED' };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * 对单个用户执行号卡自动扣账检查（每小时调度器走这条）。
 *
 * 检查逻辑：仅对 billing_day <= 今日日期的卡尝试扣账（避免提前扣）。
 * @param userId 用户 ID
 */
async function runDeductionForUser(userId: string) {
  await ensureNotificationScenesForUser(userId);

  const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
  const cards = await cardRepo.find({ where: { user_id: userId } });

  const today = dayjs();
  const todayDate = today.date();
  const thisMonth = today.format('YYYY-MM');

  for (const card of cards) {
    const marker = buildDeductionMarker(thisMonth);
    if (card.last_auto_deduction_marker === marker) {
      continue;
    }

    // 调度器：扣账日已到达（billing_day <= 今天）才扣
    if (card.billing_day <= todayDate) {
      try {
        await deductForCard(userId, card, thisMonth);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[card-deduction] card ${card.phone_number} deduct failed:`, error);
      }
    }
  }
}

/**
 * 号卡自动扣账调度入口。
 *
 * 每小时扫描所有活跃用户，到扣账日的卡自动生成账单并扣减余额。
 * 每月每张卡最多扣账一次（marker 幂等控制）。
 */
async function runDeductionTick() {
  if (env.NODE_ENV === 'test') {
    return;
  }

  const today = dayjs().format('YYYY-MM-DD');
  const flagKey = `${SCHEDULER_KEY}_${today}`;
  if ((globalThis as Record<string, unknown>)[flagKey]) {
    return;
  }
  (globalThis as Record<string, unknown>)[flagKey] = true;

  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const accounts = await accountRepo.find({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        await runDeductionForUser(account.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[card-deduction] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[card-deduction] tick failed:', error);
  }
}

export interface TriggerCardDeductionDetailItem {
  phoneNumber: string;
  monthlyFee: number;
  month: string;
}

export interface TriggerCardDeductionResult {
  totalCards: number;
  deducted: {
    count: number;
    details: TriggerCardDeductionDetailItem[];
  };
  skipped: {
    alreadyCount: number;
    billExistsCount: number;
    /** 调度器外手动触发时不会进入这里，但保留字段 */
    notArrivedCount: number;
    failedCount: number;
    failedDetails: Array<{ phoneNumber: string; reason: string }>;
  };
}

/**
 * 手动触发号卡自动扣账（调试/补扣用途）。
 *
 * 与调度器的关键差别：手动触发时 **无论 billing_day 是否已到，只要本月未扣就立即扣账**，
 * 允许用户提前处理本月账单。
 *
 * @param userId 用户 ID
 */
export async function triggerCardDeduction(userId: string): Promise<TriggerCardDeductionResult> {
  await ensureNotificationScenesForUser(userId);

  const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
  const cards = await cardRepo.find({ where: { user_id: userId } });
  const thisMonth = dayjs().format('YYYY-MM');

  const result: TriggerCardDeductionResult = {
    totalCards: cards.length,
    deducted: { count: 0, details: [] },
    skipped: {
      alreadyCount: 0,
      billExistsCount: 0,
      notArrivedCount: 0,
      failedCount: 0,
      failedDetails: [],
    },
  };

  for (const card of cards) {
    try {
      const status = await deductForCard(userId, card, thisMonth);
      if (status.ok && status.status === 'DEDUCTED') {
        result.deducted.count += 1;
        result.deducted.details.push({
          phoneNumber: card.phone_number,
          month: thisMonth,
          monthlyFee: round2(toNumber(card.monthly_fee)),
        });
      } else if (status.status === 'ALREADY') {
        result.skipped.alreadyCount += 1;
      } else if (status.status === 'BILL_EXISTS') {
        result.skipped.billExistsCount += 1;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[card-deduction] manual trigger card ${card.phone_number} failed:`, error);
      result.skipped.failedCount += 1;
      result.skipped.failedDetails.push({
        phoneNumber: card.phone_number,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * 对外暴露的调度器启动入口（服务启动时调用）。
 */
export function startCardDeductionScheduler() {
  setupScheduler();
}
