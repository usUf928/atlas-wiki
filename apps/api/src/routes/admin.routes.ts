import { Router } from 'express';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  resetPasswordSchema,
  reviewSchema,
  roleUpdateSchema,
  settingsSchema,
  statusUpdateSchema,
  type AuditAction,
} from '@atlas/shared';
import { prisma } from '../db.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { requireAdmin, requireEditor } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeAudit } from '../lib/audit.js';
import { getSettings, saveSettings } from '../lib/settings.js';
import { hashPassword } from '../lib/password.js';
import { latestVersion } from '../lib/pages.js';

export const adminRouter = Router();

adminRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const [pageCount, userCount, pendingCount, commentCount, revisionCount, viewAgg, recentLogs] =
      await Promise.all([
        prisma.page.count({ where: { status: 'published' } }),
        prisma.user.count({ where: { status: 'active' } }),
        prisma.page.count({ where: { status: 'pending' } }),
        prisma.comment.count({ where: { status: 'visible' } }),
        prisma.pageRevision.count(),
        prisma.page.aggregate({ where: { status: 'published' }, _sum: { viewCount: true } }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { actor: { select: { username: true } } },
        }),
      ]);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);
    const revisions = await prisma.pageRevision.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const trend: { date: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const count = revisions.filter((item) => {
        const d = item.createdAt;
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return k === key;
      }).length;
      trend.push({ date: key, label: `${day.getMonth() + 1}/${day.getDate()}`, count });
    }

    res.json({
      code: 0,
      data: {
        counts: {
          pages: pageCount,
          users: userCount,
          pending: pendingCount,
          comments: commentCount,
          revisions: revisionCount,
          views: viewAgg._sum.viewCount ?? 0,
        },
        trend,
        recentLogs,
      },
      message: 'ok',
    });
  }),
);

adminRouter.get(
  '/review',
  asyncHandler(async (req, res) => {
    requireEditor(req);
    const pages = await prisma.page.findMany({
      where: { status: 'pending' },
      orderBy: { updatedAt: 'asc' },
      include: {
        author: { select: { id: true, username: true, avatarSeed: true } },
        pendingAuthor: { select: { id: true, username: true } },
        category: { select: { id: true, name: true } },
      },
    });
    res.json({
      code: 0,
      data: {
        items: pages.map((page) => ({
          id: page.id,
          slug: page.slug,
          title: page.pendingTitle ?? page.title,
          currentTitle: page.title,
          summary: page.pendingSummary ?? page.summary,
          content: page.pendingContent ?? page.content,
          isEdit: page.pendingContent !== null,
          editSummary: page.pendingEditSummary,
          updatedAt: page.updatedAt,
          author: page.author,
          pendingAuthor: page.pendingAuthor,
          category: page.category,
        })),
      },
      message: 'ok',
    });
  }),
);

adminRouter.post(
  '/review/:id',
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const user = requireEditor(req);
    const body = req.body as import('@atlas/shared').ReviewInput;
    const page = await prisma.page.findUnique({ where: { id: req.params.id } });
    if (!page || page.status !== 'pending') throw new ApiError(404, '待审条目不存在', 404);

    if (body.decision === 'approve') {
      const title = page.pendingTitle ?? page.title;
      const content = page.pendingContent ?? page.content;
      const summary = page.pendingSummary ?? page.summary;
      const version = (await latestVersion(page.id)) + 1;
      await prisma.$transaction(async (tx) => {
        await tx.page.update({
          where: { id: page.id },
          data: {
            title,
            content,
            summary,
            status: 'published',
            pendingTitle: null,
            pendingContent: null,
            pendingSummary: null,
            pendingEditSummary: null,
            pendingAuthorId: null,
          },
        });
        await tx.pageRevision.create({
          data: {
            pageId: page.id,
            title,
            content,
            editSummary: page.pendingEditSummary || '审核通过',
            editorId: user.id,
            version,
          },
        });
      });
      await writeAudit({
        actorId: user.id,
        action: 'review_approve',
        targetType: 'page',
        targetId: page.id,
        ip: req.ip,
        detail: { slug: page.slug, version, title },
      });
      res.json({ code: 0, data: { version }, message: '已通过审核并发布' });
      return;
    }

    const wasEdit = page.pendingContent !== null;
    await prisma.page.update({
      where: { id: page.id },
      data: wasEdit
        ? {
            status: 'published',
            pendingTitle: null,
            pendingContent: null,
            pendingSummary: null,
            pendingEditSummary: null,
            pendingAuthorId: null,
          }
        : { status: 'draft' },
    });
    await writeAudit({
      actorId: user.id,
      action: 'review_reject',
      targetType: 'page',
      targetId: page.id,
      ip: req.ip,
      detail: { slug: page.slug, reason: body.reason, wasEdit },
    });
    res.json({ code: 0, data: null, message: '已驳回' });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 20;
    const search = String(req.query.search ?? '').trim();
    const where = search
      ? { OR: [{ username: { contains: search } }, { email: { contains: search } }] }
      : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
          avatarSeed: true,
          createdAt: true,
          lastLoginAt: true,
          lastLoginIp: true,
          lockedUntil: true,
          _count: { select: { revisions: true, pages: true } },
        },
      }),
    ]);
    res.json({
      code: 0,
      data: { users, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      message: 'ok',
    });
  }),
);

adminRouter.patch(
  '/users/:id/role',
  validate(roleUpdateSchema),
  asyncHandler(async (req, res) => {
    const admin = requireAdmin(req);
    const body = req.body as { role: 'user' | 'editor' | 'admin' };
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, '用户不存在', 404);
    if (target.id === admin.id) throw new ApiError(400, '不能修改自己的角色', 400);
    if (target.role === 'admin' && body.role !== 'admin') {
      const admins = await prisma.user.count({ where: { role: 'admin', status: 'active' } });
      if (admins <= 1) throw new ApiError(400, '至少保留一名管理员', 400);
    }
    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: body.role },
      select: { id: true, username: true, role: true },
    });
    await writeAudit({
      actorId: admin.id,
      action: 'role_change',
      targetType: 'user',
      targetId: target.id,
      ip: req.ip,
      detail: { from: target.role, to: body.role, username: target.username },
    });
    res.json({ code: 0, data: { user: updated }, message: '角色已更新' });
  }),
);

adminRouter.patch(
  '/users/:id/status',
  validate(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    const admin = requireAdmin(req);
    const body = req.body as { status: 'active' | 'banned' };
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, '用户不存在', 404);
    if (target.id === admin.id) throw new ApiError(400, '不能封禁自己', 400);
    if (target.role === 'admin' && body.status === 'banned') {
      throw new ApiError(400, '不能封禁管理员账号', 400);
    }
    await prisma.user.update({ where: { id: target.id }, data: { status: body.status } });
    if (body.status === 'banned') {
      await prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await writeAudit({
      actorId: admin.id,
      action: body.status === 'banned' ? 'user_ban' : 'user_unban',
      targetType: 'user',
      targetId: target.id,
      ip: req.ip,
      detail: { username: target.username },
    });
    res.json({ code: 0, data: null, message: body.status === 'banned' ? '用户已封禁' : '用户已解封' });
  }),
);

adminRouter.post(
  '/users/:id/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const admin = requireAdmin(req);
    const body = req.body as { newPassword: string };
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new ApiError(404, '用户不存在', 404);
    const passwordHash = await hashPassword(body.newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await writeAudit({
      actorId: admin.id,
      action: 'password_reset',
      targetType: 'user',
      targetId: target.id,
      ip: req.ip,
      detail: { username: target.username },
    });
    res.json({ code: 0, data: null, message: '密码已重置，用户下次登录需修改' });
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 30;
    const action = String(req.query.action ?? '').trim();
    const where = action && (AUDIT_ACTIONS as readonly string[]).includes(action) ? { action } : {};
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, username: true } } },
      }),
    ]);
    res.json({
      code: 0,
      data: {
        logs: logs.map((log) => ({
          ...log,
          detail: log.detail ? (JSON.parse(log.detail) as Record<string, unknown>) : null,
          actionLabel: AUDIT_ACTION_LABELS[log.action as AuditAction] ?? log.action,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        actions: AUDIT_ACTIONS.map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] })),
      },
      message: 'ok',
    });
  }),
);

adminRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    res.json({ code: 0, data: { settings: await getSettings() }, message: 'ok' });
  }),
);

adminRouter.put(
  '/settings',
  validate(settingsSchema),
  asyncHandler(async (req, res) => {
    const admin = requireAdmin(req);
    const body = req.body as import('@atlas/shared').SiteSettings;
    const settings = await saveSettings(body);
    await writeAudit({
      actorId: admin.id,
      action: 'settings_update',
      targetType: 'settings',
      targetId: 'site',
      ip: req.ip,
      detail: { siteName: settings.siteName, allowRegistration: settings.allowRegistration },
    });
    res.json({ code: 0, data: { settings }, message: '站点设置已保存' });
  }),
);
