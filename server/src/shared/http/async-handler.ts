import type { NextFunction, Request, Response } from 'express';

import { env } from '../../config/env';

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch((error) => {
      if (env.NODE_ENV === 'development') {
        console.error('[asyncHandler] Unhandled error:', error);
      }
      next(error);
    });
  };
}
