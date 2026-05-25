import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { successResponse } from '../../shared/http/response';
import { asyncHandler } from '../../shared/http/async-handler';
import { validateBody } from '../../shared/http/validation';
import { requireJwtAuth, type AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { AppError } from '../../shared/errors/app-error';
import { SystemUserAccountEntity } from './entities/system-user-account.entity';
import { SystemUserProfileEntity } from './entities/system-user-profile.entity';
import { SystemAuthSessionEntity } from './entities/system-auth-session.entity';

const registerSchema = z.object({
  username: z.string().trim().min(3).max(64),
  email: z.string().trim().email().max(128),
  password: z.string().min(8).max(128),
  nickname: z.string().trim().min(1).max(64).optional(),
});

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function createAccessToken(userId: string, username: string) {
  return jwt.sign(
    {
      sub: userId,
      username,
      type: 'access',
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

function createRefreshToken(userId: string, username: string, sessionToken: string) {
  return jwt.sign(
    {
      sub: userId,
      username,
      sessionToken,
      type: 'refresh',
    },
    env.JWT_SECRET,
    {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function createAuthRouter() {
  const router = Router();

  router.post('/register', asyncHandler(async (request, response) => {
    const payload = validateBody(registerSchema, request.body);
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const profileRepo = appDataSource.getRepository(SystemUserProfileEntity);

    const existing = await accountRepo.findOne({
      where: [
        { username: payload.username },
        { email: payload.email },
      ],
    });

    if (existing) {
      throw new AppError('account_already_exists', 409, 409);
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const account = await accountRepo.save(accountRepo.create({
      username: payload.username,
      email: payload.email,
      password_hash: passwordHash,
      is_active: true,
    }));

    await profileRepo.save(profileRepo.create({
      id: account.id,
      user_id: account.id,
      nickname: payload.nickname ?? payload.username,
      avatar_url: '',
      timezone: 'Asia/Shanghai',
      preferences_json: null,
    }));

    response.json(successResponse({
      id: account.id,
      username: account.username,
      email: account.email,
    }, 'register_success'));
  }));

  router.post('/login', asyncHandler(async (request, response) => {
    const payload = validateBody(loginSchema, request.body);
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const profileRepo = appDataSource.getRepository(SystemUserProfileEntity);
    const sessionRepo = appDataSource.getRepository(SystemAuthSessionEntity);

    const account = await accountRepo.findOne({
      where: {
        username: payload.username,
      },
    });

    if (!account || !account.is_active) {
      throw new AppError('invalid_credentials', 401, 401);
    }

    const matched = await bcrypt.compare(payload.password, account.password_hash);
    if (!matched) {
      throw new AppError('invalid_credentials', 401, 401);
    }

    const sessionToken = uuidv4();
    const accessToken = createAccessToken(account.id, account.username);
    const refreshToken = createRefreshToken(account.id, account.username, sessionToken);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await sessionRepo.save(sessionRepo.create({
      user_id: account.id,
      session_token: sessionToken,
      refresh_token_hash: refreshTokenHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      device_name: request.header('user-agent') ?? null,
      ip_address: request.ip ?? null,
      revoked: false,
    }));

    const profile = await profileRepo.findOne({
      where: {
        user_id: account.id,
      },
    });

    response.json(successResponse({
      accessToken,
      refreshToken,
      user: {
        id: account.id,
        username: account.username,
        email: account.email,
        nickname: profile?.nickname ?? account.username,
        timezone: profile?.timezone ?? 'Asia/Shanghai',
      },
    }, 'login_success'));
  }));

  router.post('/refresh', asyncHandler(async (request, response) => {
    const payload = validateBody(refreshSchema, request.body);
    const decoded = jwt.verify(payload.refreshToken, env.JWT_SECRET) as {
      sub: string;
      username: string;
      sessionToken: string;
      type: 'refresh';
    };

    if (decoded.type !== 'refresh') {
      throw new AppError('invalid_refresh_token', 401, 401);
    }

    const sessionRepo = appDataSource.getRepository(SystemAuthSessionEntity);
    const session = await sessionRepo.findOne({
      where: {
        session_token: decoded.sessionToken,
        user_id: decoded.sub,
        revoked: false,
      },
    });

    if (!session) {
      throw new AppError('invalid_refresh_token', 401, 401);
    }

    const matched = await bcrypt.compare(payload.refreshToken, session.refresh_token_hash);
    if (!matched) {
      throw new AppError('invalid_refresh_token', 401, 401);
    }

    const accessToken = createAccessToken(decoded.sub, decoded.username);
    response.json(successResponse({
      accessToken,
    }, 'refresh_success'));
  }));

  router.post('/logout', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new AppError('unauthorized', 401, 401);
    }

    const sessionRepo = appDataSource.getRepository(SystemAuthSessionEntity);
    await sessionRepo.update({
      user_id: userId,
      revoked: false,
    }, {
      revoked: true,
    });

    response.json(successResponse({ ok: true }, 'logout_success'));
  }));

  router.get('/me', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new AppError('unauthorized', 401, 401);
    }

    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const profileRepo = appDataSource.getRepository(SystemUserProfileEntity);
    const account = await accountRepo.findOneByOrFail({
      id: userId,
    });
    const profile = await profileRepo.findOne({
      where: {
        user_id: userId,
      },
    });

    response.json(successResponse({
      id: account.id,
      username: account.username,
      email: account.email,
      nickname: profile?.nickname ?? account.username,
      avatarUrl: profile?.avatar_url ?? '',
      timezone: profile?.timezone ?? 'Asia/Shanghai',
    }));
  }));

  return router;
}
