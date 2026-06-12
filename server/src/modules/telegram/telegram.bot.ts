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
  step: (u, d) => handleStep(u, d as any),
  weight: (u, d) => handleWeight(u, d as any),
  diet: (u, d) => handleDiet(u, d as any),
  exercise: (u, d) => handleExercise(u, d as any),
  medication: (u, d) => handleMedication(u, d as any),
  shopping: (u, d) => handleShopping(u, d as any),
  todo: (u, d) => handleTodo(u, d as any),
};

// 初始化 Bot 实例（未配置 token 时使用占位符，启动时检查）
if (!env.TELEGRAM_BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set, bot will be disabled.');
} else {
  // eslint-disable-next-line no-console
  console.log('[Telegram] Token configured (%s...), preparing bot.', env.TELEGRAM_BOT_TOKEN.slice(0, 10));
}

/** 使用自定义 API 根地址时（自签名证书反代），跳过 TLS 验证 */
if (env.TELEGRAM_API_ROOT) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  // eslint-disable-next-line no-console
  console.log('[Telegram] NODE_TLS_REJECT_UNAUTHORIZED=0 (TLS verification skipped for custom API root)');
}

/** 构建 grammy Bot 配置 */
const botConfig: ConstructorParameters<typeof Bot>[1] = {};
if (env.TELEGRAM_API_ROOT) {
  botConfig.client = {
    ...botConfig.client,
    apiRoot: env.TELEGRAM_API_ROOT,
  };
  // eslint-disable-next-line no-console
  console.log('[Telegram] Using custom API root:', env.TELEGRAM_API_ROOT);
}

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN || '__placeholder__', botConfig);

// ─── /start — 欢迎消息 ───────────────────────────────────────
bot.command('start', async (ctx: Context) => {
  await ctx.reply(
    '欢迎使用 LifeOS 快速录入！\n\n' +
    '使用前请先绑定账号：\n' +
    '1. 打开 LifeOS 网页版 → 设置 → Telegram 绑定\n' +
    '2. 复制 6 位绑定码\n' +
    '3. 发送 /bind <绑定码>\n\n' +
    '发送 /help 查看所有可用指令。',
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
    // eslint-disable-next-line no-console
    console.log('[Telegram] /bind received from user', tgUser.id, 'code:', code);
    const result = await consumeBindCode(code, String(tgUser.id), String(ctx.chat?.id ?? '0'), tgUser.username);
    // eslint-disable-next-line no-console
    console.log('[Telegram] /bind result:', result);

    if (result.success) {
      await ctx.reply(`✅ ${result.message}\n现在可以直接发送数据了！发送 /help 查看指令。`);
    } else {
      await ctx.reply(`❌ ${result.message}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知错误';
    // eslint-disable-next-line no-console
    console.error('[Telegram] /bind error:', error);
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
        await ctx.reply(`❌ 录入失败：${msg}`);
      }
      return;
    }
  }

  // 2. 快捷指令未命中，尝试 AI 解析
  const aiResult = await parseWithAi(text);
  if (aiResult && aiResult.confidence > 0.7) {
    const handler = commandHandlers[aiResult.module];
    if (handler) {
      try {
        const reply = await handler(userId, aiResult.data);
        await ctx.reply(`🤖 AI 解析：${reply}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : '未知错误';
        await ctx.reply(`❌ AI 录入失败：${msg}`);
      }
      return;
    }
  }

  // 3. 都没命中，提示用户
  await ctx.reply(
    '❓ 无法识别的格式。发送 /help 查看支持的指令，\n' +
    '或直接用自然语言描述（如"今天跑了5公里"）。',
  );
});

// ─── 全局错误处理 ─────────────────────────────────────────────
bot.catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[Telegram] Bot error:', error);
});

/**
 * 启动 Bot 长轮询（在 index.ts bootstrap 中调用）
 * 未配置 TELEGRAM_BOT_TOKEN 时跳过启动
 */
export async function startTelegramBot(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[Telegram] startTelegramBot() called...');

  if (!env.TELEGRAM_BOT_TOKEN) {
    // eslint-disable-next-line no-console
    console.log('[Telegram] Bot disabled (no token configured).');
    return;
  }

  try {
    // eslint-disable-next-line no-console
    console.log('[Telegram] Starting bot polling (connecting to api.telegram.org)...');
    await bot.start({
      onStart: () => {
        // eslint-disable-next-line no-console
        console.log('[Telegram] ✅ Bot started successfully.');
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error('[Telegram] ❌ Bot failed to start:', msg);
    // eslint-disable-next-line no-console
    console.error('[Telegram]   Possible causes:');
    console.error('     1. Invalid TELEGRAM_BOT_TOKEN (check .env)');
    console.error('     2. Network cannot reach api.telegram.org (GFW/proxy issue)');
    console.error('     3. Bot was already started or token conflict');
    console.error('   Full error:', error);
  }
}

/**
 * 停止 Bot
 */
export async function stopTelegramBot(): Promise<void> {
  await bot.stop();
}
