import dayjs from 'dayjs';

/** 解析后的命令结构 */
export interface ParsedCommand {
  /** 命令类型 */
  type: 'step' | 'weight' | 'diet' | 'exercise' | 'medication' | 'shopping' | 'todo' | 'help' | 'unknown';
  /** 原始输入文本 */
  raw: string;
  /** 解析出的结构化数据 */
  data: Record<string, unknown>;
}

/**
 * 快捷指令格式：
 *   步 8234              → step { steps: 8234 }
 *   步 12000 全天         → step { steps: 12000, hour: null }
 *   重 72.4              → weight { weight: 72.4 }
 *   早 燕麦酸奶杯 320g    → diet { mealType: breakfast, foodName: 燕麦酸奶杯, amount: 320g }
 *   午 牛肉饭 460g        → diet { mealType: lunch, foodName: 牛肉饭, amount: 460g }
 *   晚 三文鱼            → diet { mealType: dinner, foodName: 三文鱼 }
 *   跑 35min 高强度       → exercise { name: 跑步, durationMin: 35, intensity: high }
 *   药 维C 早1晚1        → medication { name: 维C, schedule: 早1晚1 }
 *   买 鸡胸肉 1000g 32元  → shopping { item: 鸡胸肉, amount: 1000g, price: 32 }
 *   花 289 显示器支架     → shopping { item: 显示器支架, price: 289 }
 *   + 提交周报 明天18:00   → todo { action: add, text: 提交周报, due: 明天18:00 }
 *   - 买菜                → todo { action: done, text: 买菜 }
 */

// 步数：步 <数字> [全天]
const STEP_PATTERN = /^步\s+(\d+)\s*(全天)?$/i;

// 体重：重 <数字>
const WEIGHT_PATTERN = /^重\s+([\d.]+)\s*(kg)?$/i;

// 饮食：(早|午|晚) <食物名> [<数量>]
const DIET_PATTERN = /^(早|午|晚)\s+(.+?)(?:\s+(\d+(?:\.\d+)?\s*(g|克|ml|ml|份|个|碗)?))?$/i;

// 运动：<运动名> <时长> [强度]
const EXERCISE_PATTERN = /^(跑|走|骑|游|球|瑜伽|力量|健身|HIIT|普拉提)\s+(\d+)\s*(min|分钟)?\s*(低|中|高|轻|中|强)?$/i;

// 用药：药 <药名> <用法>
const MEDICATION_PATTERN = /^药\s+(.+?)\s*(.+)?$/i;

// 购物：(买|花) <商品> [<数量>] [<金额>元]
const SHOPPING_PATTERN = /^(买|花)\s+(.+?)(?:\s+(\d+(?:\.\d+)?\s*(g|kg|克|公斤|个|份))?\s*(\d+(?:\.\d+)?)?\s*元?)?$/i;

// 待办：(+|-) <内容> [时间]
const TODO_PATTERN = /^([+-])\s+(.+?)(?:\s+(明天|后天|今天|下周.*|\d{1,2}:\d{2}.*))?$/i;

/**
 * 解析用户发送的快捷指令文本
 * @param text - 用户原始输入
 * @returns 解析后的命令对象
 */
export function parseQuickCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  // 帮助
  if (trimmed === '/help' || trimmed === '/start' || trimmed === '帮助') {
    return { type: 'help', raw: trimmed, data: {} };
  }

  // 步数
  const stepMatch = trimmed.match(STEP_PATTERN);
  if (stepMatch) {
    return {
      type: 'step',
      raw: trimmed,
      data: {
        steps: Number(stepMatch[1]),
        hour: stepMatch[2] ? null : new Date().getHours(),
      },
    };
  }

  // 体重
  const weightMatch = trimmed.match(WEIGHT_PATTERN);
  if (weightMatch) {
    return {
      type: 'weight',
      raw: trimmed,
      data: { weight: Number(weightMatch[1]) },
    };
  }

  // 饮食
  const dietMatch = trimmed.match(DIET_PATTERN);
  if (dietMatch) {
    const mealMap: Record<string, string> = { 早: 'breakfast', 午: 'lunch', 晚: 'dinner' };
    return {
      type: 'diet',
      raw: trimmed,
      data: {
        mealType: mealMap[dietMatch[1]] ?? 'other',
        foodName: dietMatch[2].trim(),
        amount: dietMatch[3],
      },
    };
  }

  // 运动
  const exerciseMatch = trimmed.match(EXERCISE_PATTERN);
  if (exerciseMatch) {
    const intensityMap: Record<string, string> = { 低: 'low', 轻: 'low', 中: 'medium', 高: 'high', 强: 'high' };
    return {
      type: 'exercise',
      raw: trimmed,
      data: {
        exerciseType: exerciseMatch[1],
        durationMin: Number(exerciseMatch[2]),
        intensity: intensityMap[exerciseMatch[4]] ?? 'medium',
      },
    };
  }

  // 用药
  const medMatch = trimmed.match(MEDICATION_PATTERN);
  if (medMatch) {
    return {
      type: 'medication',
      raw: trimmed,
      data: { name: medMatch[1].trim(), schedule: medMatch[2]?.trim() ?? '' },
    };
  }

  // 购物
  const shopMatch = trimmed.match(SHOPPING_PATTERN);
  if (shopMatch) {
    return {
      type: 'shopping',
      raw: trimmed,
      data: {
        item: shopMatch[2].trim(),
        amount: shopMatch[3],
        price: shopMatch[5] ? Number(shopMatch[5]) : undefined,
      },
    };
  }

  // 待办
  const todoMatch = trimmed.match(TODO_PATTERN);
  if (todoMatch) {
    return {
      type: 'todo',
      raw: trimmed,
      data: {
        action: todoMatch[1] === '+' ? 'add' : 'done',
        text: todoMatch[2].trim(),
        due: todoMatch[3]?.trim(),
      },
    };
  }

  return { type: 'unknown', raw: trimmed, data: {} };
}
