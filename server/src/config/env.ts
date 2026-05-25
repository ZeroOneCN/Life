import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3100),
  JWT_SECRET: z.string().min(1).default('replace_me'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USERNAME: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default('root'),
  DB_DATABASE: z.string().min(1).default('lifeos'),
  DB_SYNCHRONIZE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export const env = envSchema.parse(process.env);
