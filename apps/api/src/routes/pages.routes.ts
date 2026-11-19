import { Router } from 'express';
import {
  diffLines,
  diffStats,
  highlightSnippet,
  listQuerySchema,
  pageInputSchema,
  summaryFromContent,
  type Role,
} from '@atlas/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { isEditor, requireAuth, requireEditor } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeAudit } from '../lib/audit.js';
import { pageDetailInclude, pageListInclude, toPageDetail, toPageSummary } from '../lib/serialize.js';
import { latestVersion, syncTags, uniqueSlug } from '../lib/pages.js';

export const pagesRouter = Router();

interface Viewer {
  id: string;
  role: Role;
}

function viewerOf(req: import('express').Request): Viewer | undefined {
  return req.user ? { id: req.user.id, role: req.user.role } : undefined;
}

async function canViewPage(slug: string, viewer: Viewer | undefined) {
  const page = await prisma.page.findUnique({ where: { slug }, include: pageDetailInclude });
  if (!page) throw new ApiError(404, '条目不存在', 404);
  if (page.status === 'deleted') {
    throw new ApiError(404, '条目不存在', 404);
  }
  if (page.status !== 'published') {
    const allowed =
      viewer &&
      (viewer.role === 'editor' || viewer.role === 'admin' || page.authorId === viewer.id || page.pendingAuthorId === viewer.id);
    if (!allowed) throw new ApiError(404, '条目不存在', 404);
  }
  return page;
}

async function detailPayload(pageId: string) {
  const page = await prisma.page.findUnique({ where: { id: pageId }, include: pageDetailInclude });
  if (!page) throw new ApiError(404, '条目不存在', 404);
  const latest = await prisma.pageRevision.findFirst({
    where: { pageId },
    orderBy: { version: 'desc' },
    include: { editor: { select: { id: true, username: true } } },
  });
  return toPageDetail(page, latest?.editor ?? null);
}

pagesRouter.get(
  '/index',
  asyncHandler(async (_req, res) => {
    const pages = await prisma.page.findMany({
      where: { status: 'published' },
      select: { slug: true, title: true },
      orderBy: { title: 'asc' },
      take: 5000,
    });
    res.json({ code: 0, data: { pages }, message: 'ok' });
  }),
);

pagesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(422, parsed.error.issues[0]?.message ?? '查询参数有误', 422);
    }
    const query = parsed.data;
    const where: Prisma.PageWhereInput = { status: 'published' };
    if (query.category) {
      where.category = { OR: [{ id: query.category }, { slug: query.category }] };
    }
    if (query.tag) {
      where.tags = { some: { tag: { slug: query.tag } } };
    }
    const orderBy =
      query.sort === 'title'
        ? { title: 'asc' as const }
        : query.sort === 'views'
          ? { viewCount: 'desc' as const }
          : query.sort === 'created'
            ? { createdAt: 'desc' as const }
            : { updatedAt: 'desc' as const };

    const [total, items] = await Promise.all([
      prisma.page.count({ where }),
      prisma.page.findMany({
        where,
        include: pageListInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({
      code: 0,
      data: {
        items: items.map(toPageSummary),
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      message: 'ok',
    });
  }),
);

pagesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const page = await canViewPage(req.params.slug, viewerOf(req));
    if (page.status === 'published') {
      await prisma
        .$executeRaw`UPDATE "Page" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${page.id}`
        .catch(() => undefined);
    }
    res.json({ code: 0, data: { page: await detailPayload(page.id) }, message: 'ok' });
  }),
);

pagesRouter.post(
  '/',
  validate(pageInputSchema),
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const input = req.body as import('@atlas/shared').PageInput;
    const slug = await uniqueSlug(input.slug || input.title);
    const status = user.role === 'user' ? 'pending' : 'published';

    const created = await prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          slug,
          title: input.title,
          content: input.content,
          summary: input.summary?.trim() || summaryFromContent(input.content),
          categoryId: input.categoryId || null,
          authorId: user.id,
          status,
          isProtected: user.role === 'admin' ? Boolean(input.isProtected) : false,
        },
      });
      if (status === 'published') {
        await tx.pageRevision.create({
          data: {
            pageId: page.id,
            title: input.title,
            content: input.content,
            editSummary: input.editSummary || '创建条目',
            editorId: user.id,
            version: 1,
          },
        });
      }
      await syncTags(tx, page.id, input.tags ?? []);
      return page;
    });

    await writeAudit({
      actorId: user.id,
      action: 'page_create',
      targetType: 'page',
      targetId: created.id,
      ip: req.ip,
      detail: { slug, title: input.title, status },
    });

    res.status(201).json({
      code: 0,
      data: { page: await detailPayload(created.id), pending: status === 'pending' },
      message: status === 'pending' ? '已提交审核' : '条目已发布',
    });
  }),
);

pagesRouter.put(
  '/:slug',
  validate(pageInputSchema),
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const input = req.body as import('@atlas/shared').PageInput;
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    if (!page || page.status === 'deleted') throw new ApiError(404, '条目不存在', 404);
    if (!isEditor(user) && page.authorId !== user.id) {
      throw new ApiError(403, '只能编辑自己创建的条目', 403);
    }
    if (page.isProtected && !isEditor(user)) {
      throw new ApiError(403, '该条目已受保护，只有编辑者可以修改', 403);
    }

    if (!isEditor(user)) {
      if (page.status === 'draft') {
        await prisma.$transaction(async (tx) => {
          await tx.page.update({
            where: { id: page.id },
            data: {
              title: input.title,
              content: input.content,
              summary: input.summary?.trim() || summaryFromContent(input.content),
              categoryId: input.categoryId || null,
            },
          });
          await syncTags(tx, page.id, input.tags ?? []);
        });
        res.json({
          code: 0,
          data: { page: await detailPayload(page.id), pending: false },
          message: '草稿已保存',
        });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.page.update({
          where: { id: page.id },
          data: {
            status: 'pending',
            pendingTitle: input.title,
            pendingContent: input.content,
            pendingSummary: input.summary?.trim() || summaryFromContent(input.content),
            pendingEditSummary: input.editSummary || '内容更新',
            pendingAuthorId: user.id,
            categoryId: input.categoryId || null,
          },
        });
        await syncTags(tx, page.id, input.tags ?? []);
      });
      await writeAudit({
        actorId: user.id,
        action: 'page_update',
        targetType: 'page',
        targetId: page.id,
        ip: req.ip,
        detail: { slug: page.slug, pending: true, title: input.title },
      });
      res.json({
        code: 0,
        data: { page: await detailPayload(page.id), pending: true },
        message: '修改已提交审核',
      });
      return;
    }

    const version = (await latestVersion(page.id)) + 1;
    await prisma.$transaction(async (tx) => {
      await tx.page.update({
        where: { id: page.id },
        data: {
          title: input.title,
          content: input.content,
          summary: input.summary?.trim() || summaryFromContent(input.content),
          categoryId: input.categoryId || null,
          status: 'published',
          isProtected: input.isProtected ?? page.isProtected,
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
          title: input.title,
          content: input.content,
          editSummary: input.editSummary || '内容更新',
          editorId: user.id,
          version,
        },
      });
      await syncTags(tx, page.id, input.tags ?? []);
    });

    await writeAudit({
      actorId: user.id,
      action: 'page_update',
      targetType: 'page',
      targetId: page.id,
      ip: req.ip,
      detail: { slug: page.slug, version, title: input.title },
    });

    res.json({
      code: 0,
      data: { page: await detailPayload(page.id), pending: false },
      message: '条目已更新',
    });
  }),
);

pagesRouter.delete(
  '/:slug',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'admin') throw new ApiError(403, '权限不足', 403);
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    if (!page || page.status === 'deleted') throw new ApiError(404, '条目不存在', 404);
    await prisma.page.update({ where: { id: page.id }, data: { status: 'deleted' } });
    await writeAudit({
      actorId: req.user.id,
      action: 'page_delete',
      targetType: 'page',
      targetId: page.id,
      ip: req.ip,
      detail: { slug: page.slug, title: page.title },
    });
    res.json({ code: 0, data: null, message: '条目已删除' });
  }),
);

pagesRouter.get(
  '/:slug/revisions',
  asyncHandler(async (req, res) => {
    const page = await canViewPage(req.params.slug, viewerOf(req));
    const revisions = await prisma.pageRevision.findMany({
      where: { pageId: page.id },
      orderBy: { version: 'desc' },
      include: { editor: { select: { id: true, username: true, avatarSeed: true } } },
    });
    res.json({ code: 0, data: { revisions }, message: 'ok' });
  }),
);

pagesRouter.get(
  '/:slug/revisions/:version',
  asyncHandler(async (req, res) => {
    const version = Number(req.params.version);
    if (!Number.isInteger(version) || version < 1) throw new ApiError(400, '版本号无效', 400);
    const page = await canViewPage(req.params.slug, viewerOf(req));
    const revision = await prisma.pageRevision.findUnique({
      where: { pageId_version: { pageId: page.id, version } },
      include: { editor: { select: { id: true, username: true, avatarSeed: true } } },
    });
    if (!revision) throw new ApiError(404, '版本不存在', 404);
    res.json({ code: 0, data: { revision }, message: 'ok' });
  }),
);

pagesRouter.get(
  '/:slug/diff',
  asyncHandler(async (req, res) => {
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
      throw new ApiError(400, '对比版本无效', 400);
    }
    const page = await canViewPage(req.params.slug, viewerOf(req));
    const [left, right] = await Promise.all([
      prisma.pageRevision.findUnique({ where: { pageId_version: { pageId: page.id, version: from } } }),
      prisma.pageRevision.findUnique({ where: { pageId_version: { pageId: page.id, version: to } } }),
    ]);
    if (!left || !right) throw new ApiError(404, '版本不存在', 404);
    const lines = diffLines(left.content, right.content);
    res.json({
      code: 0,
      data: { from, to, lines, stats: diffStats(lines) },
      message: 'ok',
    });
  }),
);

pagesRouter.post(
  '/:slug/revert/:version',
  asyncHandler(async (req, res) => {
    const user = requireEditor(req);
    const version = Number(req.params.version);
    if (!Number.isInteger(version)) throw new ApiError(400, '版本号无效', 400);
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    if (!page || page.status === 'deleted') throw new ApiError(404, '条目不存在', 404);
    const target = await prisma.pageRevision.findUnique({
      where: { pageId_version: { pageId: page.id, version } },
    });
    if (!target) throw new ApiError(404, '版本不存在', 404);
    const nextVersion = (await latestVersion(page.id)) + 1;
    await prisma.$transaction(async (tx) => {
      await tx.page.update({
        where: { id: page.id },
        data: {
          title: target.title,
          content: target.content,
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
          title: target.title,
          content: target.content,
          editSummary: `回滚到版本 ${version}`,
          editorId: user.id,
          version: nextVersion,
        },
      });
    });
    await writeAudit({
      actorId: user.id,
      action: 'page_revert',
      targetType: 'page',
      targetId: page.id,
      ip: req.ip,
      detail: { slug: page.slug, fromVersion: version, newVersion: nextVersion },
    });
    res.json({
      code: 0,
      data: { page: await detailPayload(page.id), version: nextVersion },
      message: `已回滚到版本 ${version}`,
    });
  }),
);

pagesRouter.get(
  '/:slug/related',
  asyncHandler(async (req, res) => {
    const page = await canViewPage(req.params.slug, viewerOf(req));
    const tagIds = await prisma.pageTag.findMany({ where: { pageId: page.id }, select: { tagId: true } });
    const related = await prisma.page.findMany({
      where: {
        status: 'published',
        id: { not: page.id },
        OR: [
          ...(page.categoryId ? [{ categoryId: page.categoryId }] : []),
          ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds.map((item) => item.tagId) } } } }] : []),
        ],
      },
      include: pageListInclude,
      orderBy: { updatedAt: 'desc' },
      take: 4,
    });
    res.json({ code: 0, data: { pages: related.map(toPageSummary) }, message: 'ok' });
  }),
);

export const searchRouter = Router();

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
    if (q.length < 1) {
      res.json({ code: 0, data: { query: q, total: 0, hits: [] }, message: 'ok' });
      return;
    }
    const pages = await prisma.page.findMany({
      where: {
        status: 'published',
        OR: [{ title: { contains: q } }, { content: { contains: q } }, { summary: { contains: q } }],
      },
      include: pageListInclude,
      orderBy: { updatedAt: 'desc' },
      take: 120,
    });
    const hits = pages
      .map((page) => ({
        slug: page.slug,
        title: page.title,
        summary: page.summary,
        categoryName: page.category?.name ?? null,
        snippet: highlightSnippet(page.content, q),
        titleMatched: page.title.toLowerCase().includes(q.toLowerCase()),
        updatedAt: page.updatedAt,
        score:
          (page.title.toLowerCase().includes(q.toLowerCase()) ? 100 : 0) +
          (page.summary.toLowerCase().includes(q.toLowerCase()) ? 20 : 0) +
          (page.content.toLowerCase().split(q.toLowerCase()).length - 1) * 2,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, ...rest }) => rest);
    res.json({ code: 0, data: { query: q, total: hits.length, hits }, message: 'ok' });
  }),
);
