import type { NextFunction, Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

export function mockJwtAuth(request: AuthenticatedRequest, _response: Response, next: NextFunction) {
  const header = request.header('x-user-id') || request.header('authorization');
  const userId = header?.replace(/^Bearer\s+/i, '').trim() || 'user-001';

  request.auth = {
    userId,
  };

  next();
}
