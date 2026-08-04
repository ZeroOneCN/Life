import dayjs from 'dayjs';

import { queryFinance, queryHealth, queryInvestment, queryLife } from './assistant-query.service';
import type { QueryFilters } from './assistant-query.service';
import { createShoppingRecord } from '../finance/shopping.service';
import { createSubscriptionRecord } from '../finance/subscription.service';
import { createStepRecord } from '../health/step.service';
import { createWeightRecord, createDietRecord as createDietRecordEntry } from '../health/fitness.service';
import { createMedicationRecord } from '../health/medication.service';
import { createTodoTask } from '../life/todo.service';
import { createScheduleEvent as createScheduleEventRecord } from '../life/schedule.service';

export type AssistantModule = 'finance' | 'health' | 'investment' | 'life';
export type AssistantTool =
  | 'query_finance'
  | 'query_health'
  | 'query_investment'
  | 'query_life'
  | 'create_shopping'
  | 'create_subscription'
  | 'create_step'
  | 'create_weight'
  | 'create_medication'
  | 'create_todo'
  | 'create_schedule_event'
  | 'create_diet_record';

/**
 * 处理助手工具调用，按工具名分发到对应的查询 / 写入函数。
 * @param tool 工具名称
 * @param userId 用户 ID
 * @param rawArgs 原始参数对象
 * @returns 工具执行结果
 */
export async function handleAssistantToolCall(
  tool: AssistantTool,
  userId: string,
  rawArgs: unknown,
): Promise<unknown> {
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  const filters: QueryFilters = {
    startDate: typeof args.startDate === 'string' ? args.startDate : undefined,
    endDate: typeof args.endDate === 'string' ? args.endDate : undefined,
    module: typeof args.module === 'string' ? args.module : undefined,
    limit: Number.isFinite(args.limit) ? Math.max(1, Math.min(20, Number(args.limit))) : undefined,
  };

  switch (tool) {
    case 'query_finance':
      return queryFinance(userId, filters);
    case 'query_health':
      return queryHealth(userId, filters);
    case 'query_investment':
      return queryInvestment(userId, filters);
    case 'query_life':
      return queryLife(userId, filters);
    case 'create_shopping':
      return createShopping(userId, args);
    case 'create_subscription':
      return createSubscription(userId, args);
    case 'create_step':
      return createStep(userId, args);
    case 'create_weight':
      return createWeight(userId, args);
    case 'create_medication':
      return createMedication(userId, args);
    case 'create_todo':
      return createTodo(userId, args);
    case 'create_schedule_event':
      return createScheduleEvent(userId, args);
    case 'create_diet_record':
      return createDietRecord(userId, args);
    default:
      return { error: `Unknown tool: ${tool}` };
  }
}

// ==================== 写入工具：create_* ====================

/**
 * 安全取字符串字段，失败返回默认值。
 * @param value 原始参数对象
 * @param field 字段名
 * @param defaultValue 默认值（缺省为空串）
 * @returns 字符串值
 */
function pickString(value: unknown, field: string, defaultValue = ''): string {
  if (typeof value !== 'object' || value === null) return defaultValue;
  const v = (value as Record<string, unknown>)[field];
  return typeof v === 'string' ? v : defaultValue;
}

/**
 * 安全取数字字段，失败返回默认值。
 * @param value 原始参数对象
 * @param field 字段名
 * @param defaultValue 默认值（缺省为 0）
 * @returns 数字值
 */
function pickNumber(value: unknown, field: string, defaultValue = 0): number {
  if (typeof value !== 'object' || value === null) return defaultValue;
  const v = (value as Record<string, unknown>)[field];
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * 安全取布尔字段，失败返回 false。
 * @param value 原始参数对象
 * @param field 字段名
 * @returns 布尔值
 */
function pickBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return Boolean((value as Record<string, unknown>)[field]);
}

/**
 * 安全取字符串数组字段，失败返回空数组。
 * @param value 原始参数对象
 * @param field 字段名
 * @returns 字符串数组
 */
function pickStringArray(value: unknown, field: string): string[] {
  if (typeof value !== 'object' || value === null) return [];
  const v = (value as Record<string, unknown>)[field];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * 创建购物记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（ledgerId/date/platform/itemName/price 必填）
 * @returns 创建结果（含 id 和写入字段摘要）
 */
async function createShopping(userId: string, args: Record<string, unknown>) {
  try {
    const saved = await createShoppingRecord(userId, {
      ledgerId: pickString(args, 'ledgerId'),
      date: pickString(args, 'date'),
      platform: pickString(args, 'platform'),
      itemName: pickString(args, 'itemName'),
      price: pickNumber(args, 'price'),
      spec: pickString(args, 'spec') || undefined,
      unitPrice: args.unitPrice !== undefined ? pickNumber(args, 'unitPrice') : null,
      orderNo: pickString(args, 'orderNo') || undefined,
      note: pickString(args, 'note') || undefined,
    });
    return { id: saved.id, message: `已创建购物记录：${saved.item_name} ¥${saved.price}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建购物记录失败' };
  }
}

/**
 * 创建订阅记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（serviceName/categoryId/startDate/endDate/billingCycle/cyclePrice 必填）
 * @returns 创建结果
 */
async function createSubscription(userId: string, args: Record<string, unknown>) {
  const serviceName = pickString(args, 'serviceName');
  const categoryId = pickString(args, 'categoryId');
  const startDate = pickString(args, 'startDate');
  const endDate = pickString(args, 'endDate');
  const billingCycle = pickString(args, 'billingCycle', 'monthly');
  const cyclePrice = pickNumber(args, 'cyclePrice');
  if (!serviceName || !categoryId || !startDate || !endDate) {
    return { error: '缺少必填字段：serviceName/categoryId/startDate/endDate' };
  }
  try {
    const saved = await createSubscriptionRecord(userId, {
      serviceName,
      planName: pickString(args, 'planName'),
      categoryId,
      categoryName: pickString(args, 'categoryName'),
      startDate,
      endDate,
      billingCycle,
      cyclePrice,
      autoRenew: pickBoolean(args, 'autoRenew'),
      notes: pickString(args, 'notes'),
    });
    return { id: saved.id, message: `已创建订阅：${serviceName} ¥${cyclePrice}/${billingCycle}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建订阅记录失败' };
  }
}

/**
 * 创建步数记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（steps/recordTime 必填）
 * @returns 创建结果
 */
async function createStep(userId: string, args: Record<string, unknown>) {
  const steps = pickNumber(args, 'steps');
  const recordTime = pickString(args, 'recordTime');
  if (!steps || !recordTime) {
    return { error: '缺少必填字段：steps/recordTime' };
  }
  try {
    const saved = await createStepRecord(userId, {
      steps,
      recordTime,
      hour: args.hour === undefined || args.hour === null ? null : pickNumber(args, 'hour'),
    });
    return { id: saved.id, message: `已记录步数：${saved.steps} 步（${dayjs(saved.record_time).format('YYYY-MM-DD HH:mm')}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建步数记录失败' };
  }
}

/**
 * 创建体重记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（date/weight 必填，其余身体成分指标可选）
 * @returns 创建结果
 */
async function createWeight(userId: string, args: Record<string, unknown>) {
  const date = pickString(args, 'date');
  const weight = pickNumber(args, 'weight');
  if (!date || !weight) {
    return { error: '缺少必填字段：date/weight' };
  }
  try {
    const saved = await createWeightRecord(userId, {
      date,
      weight,
      height: args.height !== undefined && args.height !== null ? pickNumber(args, 'height') : undefined,
      bodyFat: args.bodyFat !== undefined && args.bodyFat !== null ? pickNumber(args, 'bodyFat') : undefined,
      visceralFat: args.visceralFat !== undefined && args.visceralFat !== null ? pickNumber(args, 'visceralFat') : undefined,
      fatMass: args.fatMass !== undefined && args.fatMass !== null ? pickNumber(args, 'fatMass') : undefined,
      muscleRate: args.muscleRate !== undefined && args.muscleRate !== null ? pickNumber(args, 'muscleRate') : undefined,
      muscleMass: args.muscleMass !== undefined && args.muscleMass !== null ? pickNumber(args, 'muscleMass') : undefined,
      bodyWaterRate: args.bodyWaterRate !== undefined && args.bodyWaterRate !== null ? pickNumber(args, 'bodyWaterRate') : undefined,
      bodyWaterMass: args.bodyWaterMass !== undefined && args.bodyWaterMass !== null ? pickNumber(args, 'bodyWaterMass') : undefined,
      proteinRate: args.proteinRate !== undefined && args.proteinRate !== null ? pickNumber(args, 'proteinRate') : undefined,
      proteinMass: args.proteinMass !== undefined && args.proteinMass !== null ? pickNumber(args, 'proteinMass') : undefined,
      boneRate: args.boneRate !== undefined && args.boneRate !== null ? pickNumber(args, 'boneRate') : undefined,
      boneMass: args.boneMass !== undefined && args.boneMass !== null ? pickNumber(args, 'boneMass') : undefined,
      skeletalMuscleRate: args.skeletalMuscleRate !== undefined && args.skeletalMuscleRate !== null ? pickNumber(args, 'skeletalMuscleRate') : undefined,
      skeletalMuscleMass: args.skeletalMuscleMass !== undefined && args.skeletalMuscleMass !== null ? pickNumber(args, 'skeletalMuscleMass') : undefined,
      subcutaneousFatRate: args.subcutaneousFatRate !== undefined && args.subcutaneousFatRate !== null ? pickNumber(args, 'subcutaneousFatRate') : undefined,
      subcutaneousFatMass: args.subcutaneousFatMass !== undefined && args.subcutaneousFatMass !== null ? pickNumber(args, 'subcutaneousFatMass') : undefined,
    });
    return { id: saved.id, message: `已记录体重：${saved.weight} kg（${saved.date}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建体重记录失败' };
  }
}

/**
 * 创建用药记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（date/medicineName 必填，breakfast/lunch/dinner 可选）
 * @returns 创建结果
 */
async function createMedication(userId: string, args: Record<string, unknown>) {
  const date = pickString(args, 'date');
  const medicineName = pickString(args, 'medicineName');
  if (!date || !medicineName) {
    return { error: '缺少必填字段：date/medicineName' };
  }
  try {
    const saved = await createMedicationRecord(userId, {
      date,
      medicineName,
      breakfast: pickNumber(args, 'breakfast'),
      lunch: pickNumber(args, 'lunch'),
      dinner: pickNumber(args, 'dinner'),
    });
    return { id: saved.id, message: `已记录用药：${medicineName}（${date}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建用药记录失败' };
  }
}

/**
 * 创建待办任务。
 * @param userId - 用户 ID
 * @param args - 工具参数（title 必填，其余可选）
 * @returns 创建结果
 */
async function createTodo(userId: string, args: Record<string, unknown>) {
  const title = pickString(args, 'title');
  if (!title) {
    return { error: '缺少必填字段：title' };
  }
  try {
    const saved = await createTodoTask(userId, {
      title,
      descriptionMarkdown: pickString(args, 'descriptionMarkdown') || undefined,
      dueDate: pickString(args, 'dueDate') || undefined,
      priority: (pickString(args, 'priority', 'medium') as 'high' | 'medium' | 'low') || undefined,
      tags: pickStringArray(args, 'tags').length ? pickStringArray(args, 'tags') : undefined,
      isDaily: pickBoolean(args, 'isDaily') || undefined,
      recurrenceType: (pickString(args, 'recurrenceType', 'none') as 'none' | 'daily' | 'weekly' | 'monthly') || undefined,
      recurrenceConfig: null,
    });
    return { id: saved.id, message: `已创建待办：${saved.title}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建待办任务失败' };
  }
}

/**
 * 创建日程事件。
 * @param userId - 用户 ID
 * @param args - 工具参数（title/startAt 必填，其余可选）
 * @returns 创建结果
 */
async function createScheduleEvent(userId: string, args: Record<string, unknown>) {
  const title = pickString(args, 'title');
  const startAt = pickString(args, 'startAt');
  if (!title || !startAt) {
    return { error: '缺少必填字段：title/startAt' };
  }
  try {
    const endAtRaw = pickString(args, 'endAt');
    const recurrenceType = pickString(args, 'recurrenceType', 'none') as 'none' | 'daily' | 'weekly' | 'monthly';
    const saved = await createScheduleEventRecord(userId, {
      title,
      startAt,
      endAt: endAtRaw || null,
      isAllDay: pickBoolean(args, 'isAllDay'),
      descriptionMarkdown: pickString(args, 'descriptionMarkdown'),
      location: pickString(args, 'location') || null,
      color: pickString(args, 'color') || null,
      recurrenceType,
      recurrenceEndDate: pickString(args, 'recurrenceEndDate') || null,
      reminderMinutes: args.reminderMinutes !== undefined && args.reminderMinutes !== null
        ? pickNumber(args, 'reminderMinutes')
        : null,
    });
    return { id: saved.id, message: `已创建日程：${saved.title}（${dayjs(saved.start_at).format('YYYY-MM-DD HH:mm')}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建日程事件失败' };
  }
}

/**
 * 创建饮食记录。
 * @param userId - 用户 ID
 * @param args - 工具参数（date/mealType/foodName/grams 必填，其余可选）
 * @returns 创建结果
 */
async function createDietRecord(userId: string, args: Record<string, unknown>) {
  const date = pickString(args, 'date');
  const mealType = pickString(args, 'mealType');
  const foodName = pickString(args, 'foodName');
  const grams = pickNumber(args, 'grams', -1);
  if (!date || !mealType || !foodName || grams < 0) {
    return { error: '缺少必填字段：date/mealType/foodName/grams' };
  }
  try {
    const saved = await createDietRecordEntry(userId, {
      date,
      mealType,
      foodName,
      grams,
      calories: pickNumber(args, 'calories'),
      protein: pickNumber(args, 'protein'),
      carbs: pickNumber(args, 'carbs'),
      fat: pickNumber(args, 'fat'),
    });
    return { id: saved.id, message: `已记录饮食：${foodName} ${grams}g（${date} ${mealType}）` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '创建饮食记录失败' };
  }
}

export const ASSISTANT_TOOLS: Array<{
  type: 'function';
  function: {
    name: AssistantTool;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: 'function',
    function: {
      name: 'query_finance',
      description: '查询用户在购物、旅行、贷款、订阅、房租模块的财务数据，返回指定时间范围内的金额、笔数、近期条目。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD，可省略' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD，可省略' },
          module: { type: 'string', enum: ['shopping', 'travel', 'loan', 'subscription', 'rent'], description: '指定模块' },
          limit: { type: 'integer', description: '返回的近期记录条数（默认 5）' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_health',
      description: '查询用户健康数据：步数 / 体重 / 运动 / 用药。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
          module: { type: 'string', enum: ['step', 'weight', 'exercise', 'medication'], description: '类型' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_investment',
      description: '查询用户外汇交易记录 / 资金流水。',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: '起始日期 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_life',
      description: '查询用户生活数据：待办、物品追踪、号卡、日程。',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', enum: ['todo', 'storage', 'card', 'schedule'], description: '指定模块' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_shopping',
      description: '创建一条购物记录。需先通过 query_finance 或其他方式获取有效的 ledgerId（账本 ID）。',
      parameters: {
        type: 'object',
        properties: {
          ledgerId: { type: 'string', description: '账本 ID（必填）' },
          date: { type: 'string', description: '购买日期 YYYY-MM-DD（必填）' },
          platform: { type: 'string', description: '购买平台，如「淘宝」「京东」（必填）' },
          itemName: { type: 'string', description: '商品名称（必填）' },
          price: { type: 'number', description: '商品价格（元，必填）' },
          spec: { type: 'string', description: '规格' },
          orderNo: { type: 'string', description: '订单号' },
          note: { type: 'string', description: '备注' },
        },
        required: ['ledgerId', 'date', 'platform', 'itemName', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_subscription',
      description: '创建一条订阅记录（如流媒体、会员服务）。',
      parameters: {
        type: 'object',
        properties: {
          serviceName: { type: 'string', description: '服务名称，如「Netflix」「Spotify」（必填）' },
          categoryId: { type: 'string', description: '分类 ID（必填）' },
          categoryName: { type: 'string', description: '分类名称' },
          planName: { type: 'string', description: '套餐名称' },
          startDate: { type: 'string', description: '开始日期 YYYY-MM-DD（必填）' },
          endDate: { type: 'string', description: '结束日期 YYYY-MM-DD（必填）' },
          billingCycle: { type: 'string', enum: ['monthly', 'quarterly', 'yearly', 'one_time'], description: '计费周期' },
          cyclePrice: { type: 'number', description: '周期价格（元）' },
          autoRenew: { type: 'boolean', description: '是否自动续费' },
          notes: { type: 'string', description: '备注' },
        },
        required: ['serviceName', 'categoryId', 'startDate', 'endDate', 'billingCycle', 'cyclePrice'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_step',
      description: '创建一条步数记录。同一日期同一小时不可重复。',
      parameters: {
        type: 'object',
        properties: {
          steps: { type: 'integer', description: '步数（必填，≥0）' },
          recordTime: { type: 'string', description: '记录时间，ISO 字符串或 YYYY-MM-DD HH:mm（必填）' },
          hour: { type: 'integer', description: '小时 0-23，可省略' },
        },
        required: ['steps', 'recordTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_weight',
      description: '创建一条体重记录（支持身体成分指标）。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD（必填）' },
          weight: { type: 'number', description: '体重 kg（必填）' },
          height: { type: 'number', description: '身高 cm' },
          bodyFat: { type: 'number', description: '体脂率 %' },
          visceralFat: { type: 'number', description: '内脏脂肪等级' },
          fatMass: { type: 'number', description: '脂肪量 kg' },
          muscleRate: { type: 'number', description: '肌肉率 %' },
          muscleMass: { type: 'number', description: '肌肉量 kg' },
        },
        required: ['date', 'weight'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_medication',
      description: '创建一条用药记录（三餐剂量可选）。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD（必填）' },
          medicineName: { type: 'string', description: '药品名称（必填）' },
          breakfast: { type: 'number', description: '早餐剂量' },
          lunch: { type: 'number', description: '午餐剂量' },
          dinner: { type: 'number', description: '晚餐剂量' },
        },
        required: ['date', 'medicineName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_todo',
      description: '创建一条待办任务。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题（必填）' },
          descriptionMarkdown: { type: 'string', description: '任务描述（Markdown）' },
          dueDate: { type: 'string', description: '截止日期 YYYY-MM-DD' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
          isDaily: { type: 'boolean', description: '是否每日重复' },
          recurrenceType: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'], description: '重复类型' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_schedule_event',
      description: '创建一条日程事件，支持全天/定时、地点、提醒、重复规则。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '事件标题（必填）' },
          startAt: { type: 'string', description: '开始时间 ISO 格式，如 2026-08-04T09:00:00（必填）' },
          endAt: { type: 'string', description: '结束时间 ISO 格式，可省略表示瞬时事件' },
          isAllDay: { type: 'boolean', description: '是否全天事件' },
          descriptionMarkdown: { type: 'string', description: '事件描述（Markdown）' },
          location: { type: 'string', description: '地点' },
          color: { type: 'string', description: '颜色标识（indigo/green/red 等）' },
          reminderMinutes: { type: 'integer', description: '提前提醒分钟数（如 15/30/60）' },
          recurrenceType: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly'], description: '重复类型' },
          recurrenceEndDate: { type: 'string', description: '重复结束日期 YYYY-MM-DD' },
        },
        required: ['title', 'startAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_diet_record',
      description: '创建一条饮食记录，含餐次、食物、克数和营养素。',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: '日期 YYYY-MM-DD（必填）' },
          mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'], description: '餐次（必填）' },
          foodName: { type: 'string', description: '食物名称（必填）' },
          grams: { type: 'number', description: '克数（必填）' },
          calories: { type: 'number', description: '热量 kcal' },
          protein: { type: 'number', description: '蛋白质 g' },
          carbs: { type: 'number', description: '碳水化合物 g' },
          fat: { type: 'number', description: '脂肪 g' },
        },
        required: ['date', 'mealType', 'foodName', 'grams'],
      },
    },
  },
];
