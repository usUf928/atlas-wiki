import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')] });

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

export const env = {
  nodeEnv,
  isProd,
  port: num(process.env.PORT, 4000),
  appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me_please_32chars',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret_change_me_please_32chars',
  csrfSecret: process.env.CSRF_SECRET ?? 'dev_csrf_secret_change_me',
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: bool(process.env.COOKIE_SECURE, isProd),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxUploadBytes: num(process.env.MAX_UPLOAD_BYTES, 2 * 1024 * 1024),
};

if (isProd) {
  const weak = [env.accessSecret, env.refreshSecret, env.csrfSecret].some((secret) => secret.length < 32);
  if (weak) {
    throw new Error('生产环境必须为 JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / CSRF_SECRET 提供至少 32 位随机串');
  }
}
