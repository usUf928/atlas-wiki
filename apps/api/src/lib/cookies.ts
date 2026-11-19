import type { CookieOptions, Response } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

export const ACCESS_COOKIE = 'atlas_access';
export const REFRESH_COOKIE = 'atlas_refresh';
export const CSRF_COOKIE = 'atlas_csrf';

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    domain: env.cookieDomain,
    path: '/',
  };
}

export function signCsrfToken(): string {
  const raw = randomBytes(24).toString('hex');
  const signature = createHmac('sha256', env.csrfSecret).update(raw).digest('hex').slice(0, 32);
  return `${raw}.${signature}`;
}

export function verifyCsrfToken(token: string): boolean {
  const [raw, signature] = token.split('.');
  if (!raw || !signature) return false;
  const expected = createHmac('sha256', env.csrfSecret).update(raw).digest('hex').slice(0, 32);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function setCsrfCookie(res: Response): string {
  const token = signCsrfToken();
  res.cookie(CSRF_COOKIE, token, { ...baseCookie(), httpOnly: false, path: '/' });
  return token;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie(), maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie(),
    maxAge: env.refreshTtlMs,
    path: '/api/auth',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookie());
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: '/api/auth' });
}
