import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, verifyCsrfToken } from '../lib/cookies.js';
import { ApiError } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken) {
    return next(new ApiError(403, '安全校验失败，请刷新页面重试', 403));
  }
  if (cookieToken !== headerToken || !verifyCsrfToken(cookieToken)) {
    return next(new ApiError(403, '安全校验失败，请刷新页面重试', 403));
  }
  return next();
}
