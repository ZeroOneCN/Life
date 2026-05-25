import type { AuthenticatedRequest } from './auth-middleware';
import { AppError } from '../errors/app-error';

export function requireAuthUser(request: AuthenticatedRequest) {
  if (!request.auth?.userId) {
    throw new AppError('unauthorized', 401, 401);
  }

  return request.auth.userId;
}
