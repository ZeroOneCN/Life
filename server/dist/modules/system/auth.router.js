"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const data_source_1 = require("../../db/data-source");
const response_1 = require("../../shared/http/response");
const async_handler_1 = require("../../shared/http/async-handler");
const validation_1 = require("../../shared/http/validation");
const auth_middleware_1 = require("../../shared/http/auth-middleware");
const app_error_1 = require("../../shared/errors/app-error");
const system_user_account_entity_1 = require("./entities/system-user-account.entity");
const system_user_profile_entity_1 = require("./entities/system-user-profile.entity");
const system_auth_session_entity_1 = require("./entities/system-auth-session.entity");
const system_health_1 = require("./system-health");
const provision_user_defaults_1 = require("./provision-user-defaults");
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(64),
    email: zod_1.z.string().trim().email().max(128),
    password: zod_1.z.string().min(8).max(128),
    nickname: zod_1.z.string().trim().min(1).max(64).optional(),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().trim().min(1),
    password: zod_1.z.string().min(1),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
const profileSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email().max(128),
    nickname: zod_1.z.string().trim().min(1).max(64),
    timezone: zod_1.z.string().trim().min(1).max(64),
    avatarUrl: zod_1.z.string().trim().max(512).optional().default(''),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8).max(128),
    confirmPassword: zod_1.z.string().min(1),
});
function createAccessToken(userId, username) {
    return jsonwebtoken_1.default.sign({
        sub: userId,
        username,
        type: 'access',
    }, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_EXPIRES_IN,
    });
}
function createRefreshToken(userId, username, sessionToken) {
    return jsonwebtoken_1.default.sign({
        sub: userId,
        username,
        sessionToken,
        type: 'refresh',
    }, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.REFRESH_TOKEN_EXPIRES_IN,
    });
}
function buildAuthUser(account, profile) {
    return {
        id: account.id,
        username: account.username,
        email: account.email,
        nickname: profile?.nickname ?? account.username,
        avatarUrl: profile?.avatar_url ?? '',
        timezone: profile?.timezone ?? 'Asia/Shanghai',
    };
}
function createAuthRouter() {
    const router = (0, express_1.Router)();
    router.post('/register', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const systemHealth = await (0, system_health_1.getSystemHealthSnapshot)();
        if (!systemHealth.databaseReady) {
            throw new app_error_1.AppError('database_not_ready', 503, 503, systemHealth);
        }
        if (systemHealth.hasUsers) {
            throw new app_error_1.AppError('registration_closed', 403, 403, systemHealth);
        }
        const payload = (0, validation_1.validateBody)(registerSchema, request.body);
        const accountRepo = data_source_1.appDataSource.getRepository(system_user_account_entity_1.SystemUserAccountEntity);
        const profileRepo = data_source_1.appDataSource.getRepository(system_user_profile_entity_1.SystemUserProfileEntity);
        const existing = await accountRepo.findOne({
            where: [
                { username: payload.username },
                { email: payload.email },
            ],
        });
        if (existing) {
            throw new app_error_1.AppError('account_already_exists', 409, 409);
        }
        const passwordHash = await bcrypt_1.default.hash(payload.password, 10);
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
        await (0, provision_user_defaults_1.provisionUserDefaults)({
            userId: account.id,
            email: account.email,
        });
        response.json((0, response_1.successResponse)({
            id: account.id,
            username: account.username,
            email: account.email,
        }, 'register_success'));
    }));
    router.post('/login', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const systemHealth = await (0, system_health_1.getSystemHealthSnapshot)();
        if (!systemHealth.databaseReady) {
            throw new app_error_1.AppError('database_not_ready', 503, 503, systemHealth);
        }
        if (!systemHealth.hasUsers) {
            throw new app_error_1.AppError('bootstrap_required', 409, 409, systemHealth);
        }
        const payload = (0, validation_1.validateBody)(loginSchema, request.body);
        const accountRepo = data_source_1.appDataSource.getRepository(system_user_account_entity_1.SystemUserAccountEntity);
        const profileRepo = data_source_1.appDataSource.getRepository(system_user_profile_entity_1.SystemUserProfileEntity);
        const sessionRepo = data_source_1.appDataSource.getRepository(system_auth_session_entity_1.SystemAuthSessionEntity);
        const account = await accountRepo.findOne({
            where: {
                username: payload.username,
            },
        });
        if (!account || !account.is_active) {
            throw new app_error_1.AppError('invalid_credentials', 401, 401);
        }
        const matched = await bcrypt_1.default.compare(payload.password, account.password_hash);
        if (!matched) {
            throw new app_error_1.AppError('invalid_credentials', 401, 401);
        }
        const sessionToken = (0, node_crypto_1.randomUUID)();
        const accessToken = createAccessToken(account.id, account.username);
        const refreshToken = createRefreshToken(account.id, account.username, sessionToken);
        const refreshTokenHash = await bcrypt_1.default.hash(refreshToken, 10);
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
        response.json((0, response_1.successResponse)({
            accessToken,
            refreshToken,
            user: buildAuthUser(account, profile),
        }, 'login_success'));
    }));
    router.post('/refresh', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const payload = (0, validation_1.validateBody)(refreshSchema, request.body);
        const decoded = jsonwebtoken_1.default.verify(payload.refreshToken, env_1.env.JWT_SECRET);
        if (decoded.type !== 'refresh') {
            throw new app_error_1.AppError('invalid_refresh_token', 401, 401);
        }
        const sessionRepo = data_source_1.appDataSource.getRepository(system_auth_session_entity_1.SystemAuthSessionEntity);
        const session = await sessionRepo.findOne({
            where: {
                session_token: decoded.sessionToken,
                user_id: decoded.sub,
                revoked: false,
            },
        });
        if (!session) {
            throw new app_error_1.AppError('invalid_refresh_token', 401, 401);
        }
        const matched = await bcrypt_1.default.compare(payload.refreshToken, session.refresh_token_hash);
        if (!matched) {
            throw new app_error_1.AppError('invalid_refresh_token', 401, 401);
        }
        const accessToken = createAccessToken(decoded.sub, decoded.username);
        response.json((0, response_1.successResponse)({
            accessToken,
        }, 'refresh_success'));
    }));
    router.post('/logout', auth_middleware_1.requireJwtAuth, (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = request.auth?.userId;
        if (!userId) {
            throw new app_error_1.AppError('unauthorized', 401, 401);
        }
        const sessionRepo = data_source_1.appDataSource.getRepository(system_auth_session_entity_1.SystemAuthSessionEntity);
        await sessionRepo.update({
            user_id: userId,
            revoked: false,
        }, {
            revoked: true,
        });
        response.json((0, response_1.successResponse)({ ok: true }, 'logout_success'));
    }));
    router.get('/me', auth_middleware_1.requireJwtAuth, (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = request.auth?.userId;
        if (!userId) {
            throw new app_error_1.AppError('unauthorized', 401, 401);
        }
        const accountRepo = data_source_1.appDataSource.getRepository(system_user_account_entity_1.SystemUserAccountEntity);
        const profileRepo = data_source_1.appDataSource.getRepository(system_user_profile_entity_1.SystemUserProfileEntity);
        const account = await accountRepo.findOneByOrFail({
            id: userId,
        });
        const profile = await profileRepo.findOne({
            where: {
                user_id: userId,
            },
        });
        response.json((0, response_1.successResponse)(buildAuthUser(account, profile)));
    }));
    router.patch('/profile', auth_middleware_1.requireJwtAuth, (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = request.auth?.userId;
        if (!userId) {
            throw new app_error_1.AppError('unauthorized', 401, 401);
        }
        const payload = (0, validation_1.validateBody)(profileSchema, request.body);
        const accountRepo = data_source_1.appDataSource.getRepository(system_user_account_entity_1.SystemUserAccountEntity);
        const profileRepo = data_source_1.appDataSource.getRepository(system_user_profile_entity_1.SystemUserProfileEntity);
        const account = await accountRepo.findOneByOrFail({
            id: userId,
        });
        const duplicateEmail = await accountRepo.findOne({
            where: {
                email: payload.email,
            },
        });
        if (duplicateEmail && duplicateEmail.id !== userId) {
            throw new app_error_1.AppError('account_already_exists', 409, 409, {
                fieldErrors: {
                    email: ['邮箱已被其他账号使用。'],
                },
            });
        }
        const currentProfile = await profileRepo.findOne({
            where: {
                user_id: userId,
            },
        });
        const nextAccount = await accountRepo.save({
            ...account,
            email: payload.email,
        });
        const nextProfile = await profileRepo.save(profileRepo.create({
            ...(currentProfile ?? {
                id: userId,
                user_id: userId,
                preferences_json: null,
            }),
            nickname: payload.nickname,
            timezone: payload.timezone,
            avatar_url: payload.avatarUrl || '',
        }));
        response.json((0, response_1.successResponse)(buildAuthUser(nextAccount, nextProfile), 'update_profile_success'));
    }));
    router.post('/change-password', auth_middleware_1.requireJwtAuth, (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = request.auth?.userId;
        if (!userId) {
            throw new app_error_1.AppError('unauthorized', 401, 401);
        }
        const payload = (0, validation_1.validateBody)(changePasswordSchema, request.body);
        if (payload.newPassword !== payload.confirmPassword) {
            throw new app_error_1.AppError('invalid_request', 400, 400, {
                fieldErrors: {
                    confirmPassword: ['两次输入的新密码不一致。'],
                },
            });
        }
        const accountRepo = data_source_1.appDataSource.getRepository(system_user_account_entity_1.SystemUserAccountEntity);
        const account = await accountRepo.findOneByOrFail({
            id: userId,
        });
        const passwordMatched = await bcrypt_1.default.compare(payload.currentPassword, account.password_hash);
        if (!passwordMatched) {
            throw new app_error_1.AppError('invalid_request', 400, 400, {
                fieldErrors: {
                    currentPassword: ['当前密码不正确。'],
                },
            });
        }
        const passwordHash = await bcrypt_1.default.hash(payload.newPassword, 10);
        await accountRepo.save({
            ...account,
            password_hash: passwordHash,
        });
        response.json((0, response_1.successResponse)({ ok: true }, 'change_password_success'));
    }));
    return router;
}
