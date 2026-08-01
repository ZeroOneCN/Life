import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { convertCurrency, getRates } from './exchange-rate.service';

const latestQuerySchema = z.object({
  base: z.string().trim().min(2).max(8).optional().default('USD'),
  symbols: z.string().trim().optional(),
});

const convertQuerySchema = z.object({
  from: z.string().trim().min(2).max(8).optional().default('USD'),
  to: z.string().trim().min(2).max(8).optional().default('CNY'),
  amount: z.coerce.number().min(0).max(1_000_000_000).optional().default(1),
});

export function createExchangeRateRouter() {
  const router = Router();

  router.get('/latest', asyncHandler(async (request, response) => {
    requireAuthUser(request);
    const { base, symbols } = latestQuerySchema.parse(request.query);
    const upperBase = base.toUpperCase();
    const result = await getRates(upperBase);

    let rates = result.rates;
    if (symbols) {
      const wanted = symbols
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      const filtered: Record<string, number> = {};
      wanted.forEach((currency) => {
        if (rates[currency] !== undefined) {
          filtered[currency] = rates[currency];
        }
      });
      rates = filtered;
    }

    response.json(successResponse({
      base: result.base,
      rates,
      source: result.source,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
    }));
  }));

  router.get('/convert', asyncHandler(async (request, response) => {
    requireAuthUser(request);
    const { from, to, amount } = convertQuerySchema.parse(request.query);

    const result = await convertCurrency(from, to, amount);
    if (!result) {
      response.status(400).json({ message: `无法换算 ${from.toUpperCase()} → ${to.toUpperCase()}` });
      return;
    }

    response.json(successResponse(result));
  }));

  return router;
}
