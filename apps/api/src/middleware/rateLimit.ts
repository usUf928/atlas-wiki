import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

function handler(_req: Request, res: Response): void {
  res.status(429).json({ code: 429, data: null, message: '操作过于频繁，请稍后再试' });
}

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

export const captchaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});
