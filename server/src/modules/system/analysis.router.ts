import { Router } from 'express';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { InvestmentForexTradeRecordEntity } from '../investment/entities/investment-forex-trade-record.entity';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

function buildPrompt(stats: {
  total_trades: number;
  total_pnl: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_commission: number;
  buy_count: number;
  sell_count: number;
  by_instrument: Array<{
    instrument: string;
    cnt: number;
    total_pnl: number;
    win_rate: number;
  }>;
  start_date: string;
  end_date: string;
}) {
  return `你是一个专业的外汇（黄金/白银）交易分析师。请根据以下交易数据，给出多维度分析报告。

## 交易数据（${stats.start_date} 至 ${stats.end_date}）

- 总交易笔数：${stats.total_trades}
- 总净盈亏：$${stats.total_pnl.toFixed(2)}
- 盈利笔数：${stats.win_count} / 亏损笔数：${stats.loss_count}
- 胜率：${(stats.win_rate * 100).toFixed(1)}%
- 盈亏比：${stats.profit_loss_ratio.toFixed(2)}
- 总手续费：$${Math.abs(stats.total_commission).toFixed(2)}
- 做多笔数：${stats.buy_count} / 做空笔数：${stats.sell_count}

${stats.by_instrument.map((item) => (
  `### ${item.instrument}
  - 交易笔数：${item.cnt}
  - 总盈亏：$${item.total_pnl.toFixed(2)}
  - 胜率：${(item.win_rate * 100).toFixed(1)}%`
)).join('\n\n')}

## 分析要求

请用中文输出以下分析，使用 Markdown 格式：

### 1. 整体表现评估
概述这段时间的整体交易表现，判断是否处于盈利周期。

### 2. 风险与问题
指出胜率、盈亏比、手续费占比、方向偏好等方面存在的风险信号。如有连续亏损或过度交易，请明确指出。

### 3. 品种对比
比较黄金(XAUUSD)和白银(XAGUSD)的表现差异，哪个品种更适合当前策略。

### 4. 改进建议
给出 2-3 条具体可操作的改进建议，聚焦在执行纪律、仓位管理和入场筛选上。

请直接输出分析报告，不要输出任何开场白或客套话。`;
}

export function createAnalysisRouter() {
  const router = Router();

  router.post('/analyze', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { start_date, end_date } = request.body || {};

    if (!start_date || !end_date) {
      response.status(400).json({ message: '缺少 start_date 或 end_date 参数' });
      return;
    }

    const start = dayjs(String(start_date)).startOf('day');
    const end = dayjs(String(end_date)).endOf('day');

    if (!start.isValid() || !end.isValid()) {
      response.status(400).json({ message: '日期格式无效' });
      return;
    }

    const trades = await appDataSource.getRepository(InvestmentForexTradeRecordEntity).find({
      where: { user_id: userId },
    });

    const scopedTrades = trades.filter((item) => {
      if (!item.trade_date) return false;
      const d = dayjs(item.trade_date);
      return d.isValid() && !d.isBefore(start, 'day') && !d.isAfter(end, 'day');
    });

    if (!scopedTrades.length) {
      response.json(successResponse({
        stats: null,
        conclusion: '该时间范围内没有交易记录，无法进行分析。',
      }));
      return;
    }

    const wins = scopedTrades.filter((t) => Number(t.pnl) > 0);
    const losses = scopedTrades.filter((t) => Number(t.pnl) < 0);
    const totalPnl = scopedTrades.reduce((sum, t) => sum + Number(t.pnl) + Number(t.commission), 0);
    const totalCommission = scopedTrades.reduce((sum, t) => sum + Number(t.commission), 0);
    const winRate = scopedTrades.length > 0 ? wins.length / scopedTrades.length : 0;
    const positiveSum = wins.reduce((sum, t) => sum + Number(t.pnl), 0);
    const negativeSum = Math.abs(losses.reduce((sum, t) => sum + Number(t.pnl), 0));
    const profitLossRatio = negativeSum > 0 ? (positiveSum / wins.length) / (negativeSum / losses.length) : positiveSum > 0 ? Infinity : 0;

    const byInstrument = ['XAUUSD', 'XAGUSD'].map((instrument) => {
      const items = scopedTrades.filter((t) => t.instrument === instrument);
      const itemWins = items.filter((t) => Number(t.pnl) > 0);
      return {
        instrument,
        cnt: items.length,
        total_pnl: Number(items.reduce((sum, t) => sum + Number(t.pnl) + Number(t.commission), 0).toFixed(2)),
        win_rate: items.length > 0 ? itemWins.length / items.length : 0,
      };
    }).filter((item) => item.cnt > 0);

    const stats = {
      total_trades: scopedTrades.length,
      total_pnl: Number(totalPnl.toFixed(2)),
      win_count: wins.length,
      loss_count: losses.length,
      win_rate: winRate,
      profit_loss_ratio: Number((Number.isFinite(profitLossRatio) ? profitLossRatio : 0).toFixed(2)),
      total_commission: Number(totalCommission.toFixed(2)),
      buy_count: scopedTrades.filter((t) => t.order_type === 'buy').length,
      sell_count: scopedTrades.filter((t) => t.order_type === 'sell').length,
      by_instrument: byInstrument,
      start_date: start.format('YYYY/MM/DD'),
      end_date: end.format('YYYY/MM/DD'),
    };

    // If no DeepSeek API key, return stats only
    if (!DEEPSEEK_API_KEY) {
      response.json(successResponse({
        stats,
        conclusion: '## 未配置 AI 分析\n\n请在服务端 `.env` 文件中设置 `DEEPSEEK_API_KEY` 以启用 AI 智能分析。\n\n以下为统计摘要，你可以基于这些数据进行人工分析。',
      }));
      return;
    }

    try {
      const deepseekResponse = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'user', content: buildPrompt(stats) },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!deepseekResponse.ok) {
        const errorText = await deepseekResponse.text();
        console.error('[DeepSeek] API error:', deepseekResponse.status, errorText);
        response.json(successResponse({
          stats,
          conclusion: `## AI 分析调用失败\n\nDeepSeek API 返回错误 (${deepseekResponse.status})。请检查 API Key 和网络连接。\n\n以下为统计摘要：`,
        }));
        return;
      }

      const data = await deepseekResponse.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const conclusion = data.choices?.[0]?.message?.content || '## 分析结果为空\n\nAI 未返回有效分析内容，请稍后重试。';

      response.json(successResponse({ stats, conclusion }));
    } catch (error) {
      console.error('[DeepSeek] Request failed:', error);
      response.json(successResponse({
        stats,
        conclusion: `## AI 分析请求失败\n\n无法连接到 DeepSeek API：${String(error)}\n\n以下为统计摘要：`,
      }));
    }
  }));

  return router;
}
