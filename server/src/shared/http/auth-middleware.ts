import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../errors/app-error';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    username?: string;
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

interface JwtPayload {
  sub: string;
  username?: string;
  type?: 'access' | 'refresh';
}

export function requireJwtAuth(request: AuthenticatedRequest, _response: Response, next: NextFunction) {
  const authorization = request.header('authorization');

  if (!authorization) {
    next(new AppError('unauthorized', 401, 401));
    return;
  }

  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    next(new AppError('unauthorized', 401, 401));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!payload?.sub) {
      next(new AppError('unauthorized', 401, 401));
      return;
    }

    request.auth = {
      userId: payload.sub,
      username: payload.username,
    };
    next();
  } catch {
    next(new AppError('unauthorized', 401, 401));
  }
}
