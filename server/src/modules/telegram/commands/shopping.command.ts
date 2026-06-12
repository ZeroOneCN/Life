import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { FinanceShoppingRecordEntity } from '../../finance/entities/finance-shopping-record.entity';

/**
 * 处理购物录入命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的购物数据
 * @returns 操作结果消息
 */
export async function handleShopping(userId: string, data: Record<string, unknown>): Promise<string> {
  const item = String(data.item ?? '').trim();

  if (!item) {
    return '❌ 商品名不能为空。格式：买 牛奶 28元';
  }

  const price = data.price != null ? Number(data.price) : 0;

  const repo = appDataSource.getRepository(FinanceShoppingRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    ledger_id: 'default',
    date: dayjs().format('YYYY-MM-DD'),
    platform: '手动录入',
    item_name: item,
    spec: String(data.amount ?? ''),
    price,
    unit_price: null,
    order_no: '',
    note: '',
  }));

  return `🛒 购物已记录：${item}${price ? ` ¥${price}` : ''}`;
}
