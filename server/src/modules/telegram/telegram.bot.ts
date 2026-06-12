import { Bot, Context } from 'grammy';
import { env } from '../../config/env';
import { consumeBindCode, resolveUserIdByTelegram, touchActive } from './services/bind.service';
import { parseQuickCommand } from './services/parser.service';
import { parseWithAi } from './services/ai-parser.service';
import { handleStep } from './commands/step.command';
import { handleWeight } from './commands/weight.command';
import { handleDiet } from './commands/diet.command';
import { handleExercise } from './commands/exercise.command';
import { handleMedication } from './commands/medication.command';
import { handleShopping } from './commands/shopping.command';
import { handleTodo } from './commands/todo.command';
import { getHelpText } from './commands/help.command';

/** 命令处理器映射表 */
const commandHandlers: Record<string, (userId: string, data: Record<string, unknown>) => Promise<string>> = {
  step: handleStep,
  weight: handleWeight,
  diet: handleDiet,
  exercise: handleExercise,
  medication: handleMedication,
  shopping: handleShopping,
  todo: handleTodo,
};

/** Bot 菜单命令列表 */
const BOT_COMMANDS = [
  { command: 'start', description: '开始使用 LifeOS 快速录入' },
  { command: 'bind', description: '绑定账号 /bind <6位码>' },
  { command: 'help', description: '查看所有快捷指令' },
  { command: 'status', description: '查看绑定状态' },
  { command: 'steps', description: '记录步数：步 8234' },
  { command: 'weight', description: '记录体重：重 72.4' },
  { command: 'diet', description: '记录饮食：早 燕麦杯' },
  { command: 'exercise', description: '记录运动：跑 30min' },
  { command: 'meds', description: '记录用药：药 维C' },
  { command: 'shop', description: '记录购物：买 牛奶 28元' },
];

// 初始化 Bot 实例
if (!env.TELEGRAM_BOT_TOKEN) {
  console.warn('[TG Bot] 未配置 TELEGRAM_BOT_TOKEN，Bot 将跳过启动。');
}

/** 使用自定义 API 根地址时（自签名证书反代），跳过 TLS 验证 */
if (env.TELEGRAM_API_ROOT) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

/** 构建 grammy Bot 配置 */
const botConfig: ConstructorParameters<typeof Bot>[1] = {};
if (env.TELEGRAM_API_ROOT) {
  botConfig.client = {
    ...botConfig.client,
    apiRoot: env.TELEGRAM_API_ROOT,
  };
}

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN || '__placeholder__', botConfig);

// ─── 注册菜单命令 ──────────────────────────────────────────
async function registerCommands() {
  try {
    await bot.api.setMyCommands(BOT_COMMANDS);
    console.log('[TG Bot] 菜单命令已注册。');
  } catch (error) {
    console.error('[TG Bot] 注册菜单命令失败：', error);
  }
}

// ─── /start — 欢迎消息 ───────────────────────────────────────
bot.command('start', async (ctx: Context) => {
  await ctx.reply(
    '欢迎使用 LifeOS 快速录入！\n\n' +
    '使用前请先绑定账号：\n' +
    '1. 打开 LifeOS 网页版 → 设置 → Telegram 绑定\n' +
    '2. 复制 6 位绑定码\n' +
    '3. 发送 /bind <绑定码>\n\n' +
    '点击左下角 ⌨️ 按钮查看可用指令，或发送 /help。',
  );
});

// ─── /bind <code> — 绑定账号 ─────────────────────────────────
bot.command('bind', async (ctx: Context) => {
  const code = (ctx.message?.text ?? '').replace('/bind', '').trim();
  if (!code) {
    await ctx.reply('用法：/bind <6位绑定码>\n\n请在 LifeOS 网页版的设置页面获取绑定码。');
    return;
  }

  const tgUser = ctx.from;
  if (!tgUser) {
    await ctx.reply('无法识别你的 Telegram 身份。');
    return;
  }

  try {
    const result = await consumeBindCode(code, String(tgUser.id), String(ctx.chat?.id ?? '0'), tgUser.username);

    if (result.success) {
      await ctx.reply(`✅ ${result.message}\n现在可以直接发送数据了！发送 /help 查看指令。`);
    } else {
      await ctx.reply(`❌ ${result.message}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    console.error('[TG Bot] 绑定处理异常：', error);
    await ctx.reply(`❌ 绑定失败：${msg}\n请检查后端服务是否正常，或重新生成绑定码后再试。`);
  }
});

// ─── /help — 帮助文本 ────────────────────────────────────────
bot.command('help', async (ctx: Context) => {
  await ctx.reply(getHelpText(), { parse_mode: 'Markdown' });
});

// ─── /status — 绑定状态查询 ──────────────────────────────────
bot.command('status', async (ctx: Context) => {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const userId = await resolveUserIdByTelegram(String(tgUser.id));
  if (userId) {
    await ctx.reply('✅ 已绑定 LifeOS 账号。可以开始录入数据了！');
  } else {
    await ctx.reply('❌ 尚未绑定。请发送 /bind <绑定码> 进行绑定。');
  }
});

// ─── 文本消息处理（快捷指令 + AI fallback） ─────────────────
bot.on('message:text', async (ctx: Context) => {
  const tgUser = ctx.from;
  if (!tgUser) {
    await ctx.reply('无法识别身份。请先 /bind 绑定账号。');
    return;
  }

  const userId = await resolveUserIdByTelegram(String(tgUser.id));
  if (!userId) {
    await ctx.reply('未绑定账号。请先发送 /bind <绑定码>。\n或访问 LifeOS 网页版设置页面获取绑定码。');
    return;
  }

  // 更新活跃时间
  void touchActive(String(tgUser.id));

  const text = (ctx.message?.text ?? '').trim();

  // 1. 尝试快捷指令解析
  const parsed = parseQuickCommand(text);

  if (parsed.type === 'help') {
    await ctx.reply(getHelpText(), { parse_mode: 'Markdown' });
    return;
  }

  if (parsed.type !== 'unknown') {
    const handler = commandHandlers[parsed.type];
    if (handler) {
      try {
        const reply = await handler(userId, parsed.data);
        await ctx.reply(reply);
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误';
        console.error('[TG Bot] 指令处理异常：', error);
        await ctx.reply(`❌ 录入失败：${msg}`);
      }
      return;
    }
  }

  // 2. 快捷指令未命中，尝试 AI 解析
  try {
    const aiResult = await parseWithAi(text, userId);
    if (aiResult && aiResult.confidence > 0.7) {
      const handler = commandHandlers[aiResult.module];
      if (handler) {
        const reply = await handler(userId, aiResult.data);
        await ctx.reply(`🤖 AI 解析：${reply}`);
        return;
      }
      // AI 返回的 module 不在支持列表中
      await ctx.reply(
        '🤖 AI 已理解你的输入，但暂不支持该模块的自动录入。\n' +
        '请尝试用快捷指令格式，发送 /help 查看。',
      );
      return;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    console.error('[TG Bot] AI 解析异常：', error);
    await ctx.reply(`❌ AI 解析失败：${msg}，请改用快捷指令格式。`);
    return;
  }

  // 3. 都没命中，提示用户
  await ctx.reply(
    '❓ 无法识别的格式。点击左下角 ⌨️ 查看可用指令，\n' +
    '或直接用自然语言描述（如"今天跑了5公里"）。',
  );
});

// ─── 全局错误处理 ─────────────────────────────────────────────
bot.catch((error) => {
  console.error('[TG Bot] 未捕获异常：', error);
});

/**
 * 启动 Bot 长轮询（在 index.ts bootstrap 中调用）
 * 未配置 TELEGRAM_BOT_TOKEN 时跳过启动
 */
export async function startTelegramBot(): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log('[TG Bot] 跳过启动（未配置 Token）。');
    return;
  }

  try {
    // 注册菜单命令后启动长轮询
    await registerCommands();
    await bot.start({
      onStart: () => {
        console.log('[TG Bot] 启动成功。');
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[TG Bot] 启动失败：', msg);
    console.error('   可能原因：Token 无效 / 无法连接 Telegram API / 重复启动');
  }
}

/**
 * 停止 Bot
 */
export async function stopTelegramBot(): Promise<void> {
  await bot.stop();
}
