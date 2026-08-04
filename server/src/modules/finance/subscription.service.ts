import { appDataSource } from '../../db/data-source';
import { FinanceSubscriptionRecordEntity } from './entities/finance-subscription-record.entity';
import { AppError } from '../../shared/errors/app-error';

/** 订阅记录创建入参（与 assistant.tools.ts createSubscription 字段对齐） */
export interface CreateSubscriptionInput {
  serviceName: string;
  planName?: string;
  categoryId: string;
  categoryName?: string;
  startDate: string;
  endDate: string;
  billingCycle?: string;
  cyclePrice?: number;
  autoRenew?: boolean;
  notes?: string;
}

/**
 * 创建订阅记录（含必填校验、字段映射、repo.create + save）。
 * @param userId 用户 ID
 * @param input 创建入参
 * @returns 保存后的实体
 */
export async function createSubscriptionRecord(
  userId: string,
  input: CreateSubscriptionInput,
): Promise<FinanceSubscriptionRecordEntity> {
  if (!input.serviceName || !input.categoryId || !input.startDate || !input.endDate) {
    throw new AppError('缺少必填字段：serviceName/categoryId/startDate/endDate', 400, 400);
  }
  const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
  const item = await repository.save(repository.create({
    user_id: userId,
    service_name: input.serviceName,
    plan_name: input.planName ?? '',
    category_id: input.categoryId,
    category_name: input.categoryName ?? '',
    start_date: input.startDate,
    end_date: input.endDate,
    billing_cycle: input.billingCycle ?? 'monthly',
    cycle_price: input.cyclePrice ?? 0,
    auto_renew: input.autoRenew ?? false,
    notes: input.notes ?? '',
  }));
  return item;
}
