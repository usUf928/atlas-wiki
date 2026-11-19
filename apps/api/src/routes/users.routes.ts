import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError, asyncHandler } from '../lib/errors.js';

export const usersRouter = Router();

usersRouter.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        avatarSeed: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!user || user.status !== 'active') throw new ApiError(404, '用户不存在', 404);

    const [pages, revisions, pageCount, revisionCount, commentCount] = await Promise.all([
      prisma.page.findMany({
        where: { authorId: user.id, status: 'published' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: true } },
        },
      }),
      prisma.pageRevision.findMany({
        where: { editorId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { page: { select: { slug: true, title: true, status: true } } },
      }),
      prisma.page.count({ where: { authorId: user.id, status: 'published' } }),
      prisma.pageRevision.count({ where: { editorId: user.id } }),
      prisma.comment.count({ where: { userId: user.id, status: 'visible' } }),
    ]);

    res.json({
      code: 0,
      data: {
        user,
        stats: { pages: pageCount, revisions: revisionCount, comments: commentCount },
        pages: pages.map((page) => ({
          id: page.id,
          slug: page.slug,
          title: page.title,
          summary: page.summary,
          updatedAt: page.updatedAt,
          category: page.category,
          tags: page.tags.map((item) => item.tag),
        })),
        revisions: revisions
          .filter((revision) => revision.page.status !== 'deleted')
          .map((revision) => ({
            id: revision.id,
            version: revision.version,
            editSummary: revision.editSummary,
            createdAt: revision.createdAt,
            page: revision.page,
          })),
      },
      message: 'ok',
    });
  }),
);

export const usersAdminRouter = Router();
