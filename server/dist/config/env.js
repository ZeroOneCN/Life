"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(3100),
    JWT_SECRET: zod_1.z.string().min(1).default('replace_me'),
    JWT_EXPIRES_IN: zod_1.z.string().min(1).default('7d'),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().min(1).default('30d'),
    DB_HOST: zod_1.z.string().min(1).default('127.0.0.1'),
    DB_PORT: zod_1.z.coerce.number().int().positive().default(3306),
    DB_USERNAME: zod_1.z.string().min(1).default('root'),
    DB_PASSWORD: zod_1.z.string().default('root'),
    DB_DATABASE: zod_1.z.string().min(1).default('lifeos'),
    DB_SYNCHRONIZE: zod_1.z.string().optional(),
    DB_AUTO_BOOTSTRAP: zod_1.z.string().optional(),
});
const parsedEnv = envSchema.parse(process.env);
const isProduction = parsedEnv.NODE_ENV === 'production';
exports.env = {
    ...parsedEnv,
    DB_SYNCHRONIZE: parsedEnv.DB_SYNCHRONIZE === undefined
        ? !isProduction
        : parsedEnv.DB_SYNCHRONIZE === 'true',
    DB_AUTO_BOOTSTRAP: parsedEnv.DB_AUTO_BOOTSTRAP === undefined
        ? !isProduction
        : parsedEnv.DB_AUTO_BOOTSTRAP === 'true',
};
