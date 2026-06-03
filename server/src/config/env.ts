import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3100),
  JWT_SECRET: z.string().min(1).default('replace_me'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1).default('30d'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USERNAME: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default('root'),
  DB_DATABASE: z.string().min(1).default('lifeos'),
  DB_SYNCHRONIZE: z.string().optional(),
  DB_AUTO_BOOTSTRAP: z.string().optional(),
  SMTP_HOST: z.string().min(1).default('smtp.example.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().min(1).default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().min(1).default('noreply@example.com'),
});

const parsedEnv = envSchema.parse(process.env);
const isProduction = parsedEnv.NODE_ENV === 'production';

export const env = {
  ...parsedEnv,
  DB_SYNCHRONIZE: parsedEnv.DB_SYNCHRONIZE === undefined
    ? !isProduction
    : parsedEnv.DB_SYNCHRONIZE === 'true',
  DB_AUTO_BOOTSTRAP: parsedEnv.DB_AUTO_BOOTSTRAP === undefined
    ? !isProduction
    : parsedEnv.DB_AUTO_BOOTSTRAP === 'true',
  SMTP_SECURE: parsedEnv.SMTP_SECURE === 'true',
};
