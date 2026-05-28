import { ZodType, z } from 'zod';

import { AppError } from '../errors/app-error';

export function validateBody<T>(schema: ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.log('[validateBody] Zod validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
    throw new AppError('invalid_request', 400, 400, parsed.error.flatten());
  }

  return parsed.data;
}

export function validateQuery<T extends z.ZodRawShape>(shape: T, query: unknown) {
  const parsed = z.object(shape).safeParse(query);
  if (!parsed.success) {
    throw new AppError('invalid_query', 400, 400, parsed.error.flatten());
  }

  return parsed.data;
}
