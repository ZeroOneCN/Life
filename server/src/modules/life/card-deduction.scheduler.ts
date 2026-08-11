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
 * 处理单张号卡的自动扣账：
 * 1. 生成 YYYY-MM 幂等 marker，若本月已扣账则跳过
 * 2. 在账单记录表中创建本月账单记录（monthly_fee=actual_fee）
 * 3. 扣减卡片 balance
 * 4. 创建一条负向充值记录（备注"自动扣账"）
 * 5. 发送通知
 * @param userId 用户 ID
 * @param card  号卡记录
 * @param month 账单月份（YYYY-MM）
 * @returns 本次是否执行了扣账
 */
async function deductForCard(
  userId: string,
  card: LifeCardRecordEntity,
  month: string,
): Promise<boolean> {
  const marker = `${month}:auto-deducted`;
  if (card.last_auto_deduction_marker === marker) {
    return false;
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
      // 账单已存在但 marker 没更新，修正 marker 即可
      card.last_auto_deduction_marker = marker;
      await cardRepo.save(card);
      await queryRunner.commitTransaction();
      return false;
    }

    const monthlyFee = round2(card.monthly_fee);

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
    const savedBill = await billRepo.save(bill);

    // 3. 扣减卡片余额（若余额不足仍扣账，但发出通知提示）
    const newBalance = round2(toNumber(card.balance) - monthlyFee);
    card.balance = newBalance;
    card.last_auto_deduction_marker = marker;
    const updatedCard = await cardRepo.save(card);

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

    return true;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * 对单个用户执行号卡自动扣账检查。
 *
 * 检查逻辑：
 * 1. 所有 billing_day <= 今日日期 的卡，检查本月是否已自动扣账
 * 2. 若 billing_day 已过去但本月未扣账（可能因系统停机遗漏），进行追补扣账（但不跨月追补上月）
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
    const marker = `${thisMonth}:auto-deducted`;
    if (card.last_auto_deduction_marker === marker) {
      continue;
    }

    // 扣账日已到达（billing_day <= 今天）
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

/**
 * 手动触发号卡自动扣账（调试/补扣用途）。
 * @param userId 用户 ID
 * @returns 本次扣账成功的卡片数
 */
export async function triggerCardDeduction(userId: string): Promise<{ count: number; details: Array<{ phoneNumber: string; month: string; monthlyFee: number }> }> {
  await ensureNotificationScenesForUser(userId);

  const cardRepo = appDataSource.getRepository(LifeCardRecordEntity);
  const cards = await cardRepo.find({ where: { user_id: userId } });
  const thisMonth = dayjs().format('YYYY-MM');
  const details: Array<{ phoneNumber: string; month: string; monthlyFee: number }> = [];

  for (const card of cards) {
    try {
      const ok = await deductForCard(userId, card, thisMonth);
      if (ok) {
        details.push({
          phoneNumber: card.phone_number,
          month: thisMonth,
          monthlyFee: round2(card.monthly_fee),
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[card-deduction] manual trigger card ${card.phone_number} failed:`, error);
    }
  }

  return { count: details.length, details };
}

/**
 * 对外暴露的调度器启动入口（服务启动时调用）。
 */
export function startCardDeductionScheduler() {
  setupScheduler();
}
