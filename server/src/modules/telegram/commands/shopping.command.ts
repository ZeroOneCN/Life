import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { FinanceShoppingRecordEntity } from '../../finance/entities/finance-shopping-record.entity';

/** 购物命令数据 */
interface ShoppingData {
  item: string;
  amount?: string;
  price?: number;
}

/**
 * 处理购物录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的购物数据
 * @returns 操作结果消息
 */
export async function handleShopping(userId: string, data: ShoppingData): Promise<string> {
  const repo = appDataSource.getRepository(FinanceShoppingRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    ledger_id: 'default',
    date: dayjs().format('YYYY-MM-DD'),
    platform: '手动录入',
    item_name: data.item,
    spec: data.amount ?? '',
    price: data.price ?? 0,
    unit_price: null,
    order_no: '',
    note: '',
  }));

  return `🛒 购物已记录：${data.item}${data.price ? ` ¥${data.price}` : ''}`;
}
