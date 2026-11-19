import { Router } from 'express';
import { commentSchema } from '@atlas/shared';
import { prisma } from '../db.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const commentsRouter = Router();

interface CommentRow {
  id: string;
  content: string;
  status: string;
  createdAt: Date;
  parentId: string | null;
  user: { id: string; username: string; avatarSeed: string; role: string } | null;
}

interface CommentNode {
  id: string;
  content: string;
  status: 'visible' | 'deleted';
  createdAt: Date;
  user: { id: string; username: string; avatarSeed: string; role: string } | null;
  replies: CommentNode[];
}

function shape(row: CommentRow): CommentNode {
  const deleted = row.status === 'deleted';
  return {
    id: row.id,
    content: deleted ? '' : row.content,
    status: deleted ? ('deleted' as const) : ('visible' as const),
    createdAt: row.createdAt,
    user: row.user,
    replies: [] as CommentNode[],
  };
}

commentsRouter.get(
  '/pages/:slug/comments',
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug }, select: { id: true, status: true } });
    if (!page || page.status === 'deleted') throw new ApiError(404, '条目不存在', 404);
    const rows = await prisma.comment.findMany({
      where: { pageId: page.id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarSeed: true, role: true } } },
    });
    const roots = new Map<string, CommentNode>();
    const all = new Map<string, CommentNode>();
    for (const row of rows) {
      all.set(row.id, shape(row));
    }
    for (const row of rows) {
      const node = all.get(row.id);
      if (!node) continue;
      if (row.parentId && all.has(row.parentId)) {
        all.get(row.parentId)?.replies.push(node);
      } else if (!row.parentId) {
        roots.set(row.id, node);
      }
    }
    res.json({ code: 0, data: { comments: [...roots.values()] }, message: 'ok' });
  }),
);

commentsRouter.post(
  '/pages/:slug/comments',
  validate(commentSchema),
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const body = req.body as import('@atlas/shared').CommentInput;
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug }, select: { id: true, status: true } });
    if (!page || page.status !== 'published') throw new ApiError(404, '条目不存在', 404);
    if (body.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: body.parentId },
        select: { id: true, pageId: true, parentId: true, status: true },
      });
      if (!parent || parent.pageId !== page.id || parent.status === 'deleted') {
        throw new ApiError(400, '回复的评论不存在', 400);
      }
      if (parent.parentId) throw new ApiError(400, '仅支持一层嵌套回复', 400);
    }
    const created = await prisma.comment.create({
      data: {
        pageId: page.id,
        userId: user.id,
        parentId: body.parentId ?? null,
        content: body.content,
      },
      include: { user: { select: { id: true, username: true, avatarSeed: true, role: true } } },
    });
    res.status(201).json({ code: 0, data: { comment: shape(created) }, message: '评论已发布' });
  }),
);

commentsRouter.delete(
  '/comments/:id',
  asyncHandler(async (req, res) => {
    const user = requireRole(req, ['admin']);
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment || comment.status === 'deleted') throw new ApiError(404, '评论不存在', 404);
    await prisma.comment.update({ where: { id: comment.id }, data: { status: 'deleted' } });
    res.json({ code: 0, data: null, message: `评论已由 ${user.username} 删除` });
  }),
);
