import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { getSettings } from '../lib/settings.js';

export const siteRouter = Router();

siteRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [settings, pageCount, userCount] = await Promise.all([
      getSettings(),
      prisma.page.count({ where: { status: 'published' } }),
      prisma.user.count({ where: { status: 'active' } }),
    ]);
    res.json({
      code: 0,
      data: { settings, stats: { pages: pageCount, users: userCount } },
      message: 'ok',
    });
  }),
);

siteRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() }, message: 'ok' });
  }),
);

siteRouter.get(
  '/admin/ping',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    res.json({ code: 0, data: { pong: true }, message: 'ok' });
  }),
);
