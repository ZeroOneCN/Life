import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { FinanceShoppingRecordEntity } from './entities/finance-shopping-record.entity';
import { normalizeDate } from '../../shared/utils/date';
import { toNumber } from '../../shared/utils/number';
import { AppError } from '../../shared/errors/app-error';

/** 购物记录创建入参（与 router zod schema 对齐） */
export interface CreateShoppingInput {
  ledgerId: string;
  date: string;
  platform: string;
  itemName: string;
  price: number;
  spec?: string;
  unitPrice?: number | null;
  orderNo?: string;
  note?: string;
}

/** 购物记录响应 DTO */
export interface ShoppingRecordDto {
  id: string;
  userId: string;
  ledgerId: string;
  date: string;
  platform: string;
  itemName: string;
  spec: string;
  price: number;
  unitPrice: number | null;
  orderNo: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 计算购物记录总金额（按 price 求和）。
 * @param records 购物记录列表
 * @returns 总金额（保留 2 位小数）
 */
export function sumShoppingAmount(records: FinanceShoppingRecordEntity[]): number {
  const total = records.reduce((sum, row) => sum + toNumber(row.price), 0);
  return Number(total.toFixed(2));
}

/**
 * 将购物记录实体转为前端响应对象。
 * @param entity 购物记录实体
 * @returns 前端响应 DTO
 */
export function mapShoppingRecord(entity: FinanceShoppingRecordEntity): ShoppingRecordDto {
  return {
    id: entity.id,
    userId: entity.user_id,
    ledgerId: entity.ledger_id,
    date: dayjs(entity.date).format('YYYY-MM-DD'),
    platform: entity.platform,
    itemName: entity.item_name,
    spec: entity.spec,
    price: Number(entity.price),
    unitPrice: entity.unit_price === null ? null : Number(entity.unit_price),
    orderNo: entity.order_no,
    note: entity.note,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 创建购物记录（含字段映射、normalizeDate、repo.create + save）。
 * @param userId 用户 ID
 * @param input 创建入参
 * @returns 保存后的实体
 */
export async function createShoppingRecord(
  userId: string,
  input: CreateShoppingInput,
): Promise<FinanceShoppingRecordEntity> {
  if (!input.ledgerId || !input.date || !input.platform || !input.itemName) {
    throw new AppError('缺少必填字段：ledgerId/date/platform/itemName', 400, 400);
  }
  if (!dayjs(input.date, 'YYYY-MM-DD', true).isValid() && !dayjs(input.date, 'YYYY/MM/DD', true).isValid()) {
    throw new AppError('date 格式无效，应为 YYYY-MM-DD', 400, 400);
  }
  const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
  const item = await repository.save(repository.create({
    user_id: userId,
    ledger_id: input.ledgerId,
    date: normalizeDate(input.date),
    platform: input.platform,
    item_name: input.itemName,
    spec: input.spec ?? '',
    price: input.price,
    unit_price: input.unitPrice ?? null,
    order_no: input.orderNo ?? '',
    note: input.note ?? '',
  }));
  return item;
}
