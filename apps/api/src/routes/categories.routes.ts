import { Router } from 'express';
import { categoryInputSchema, slugify } from '@atlas/shared';
import { prisma } from '../db.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeAudit } from '../lib/audit.js';

export const categoriesRouter = Router();

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
}

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  pageCount: number;
  children: CategoryNode[];
}

function buildTree(rows: CategoryRow[], counts: Map<string, number>): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  for (const row of rows) {
    map.set(row.id, { ...row, pageCount: counts.get(row.id) ?? 0, children: [] });
  }
  const roots: CategoryNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRecursive = (nodes: CategoryNode[]): void => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-Hans-CN'));
    for (const node of nodes) sortRecursive(node.children);
  };
  sortRecursive(roots);
  return roots;
}

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const grouped = await prisma.page.groupBy({
      by: ['categoryId'],
      where: { status: 'published' },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const item of grouped) {
      if (item.categoryId) counts.set(item.categoryId, item._count._all);
    }
    res.json({ code: 0, data: { categories: buildTree(rows, counts) }, message: 'ok' });
  }),
);

categoriesRouter.post(
  '/',
  validate(categoryInputSchema),
  asyncHandler(async (req, res) => {
    const user = requireAdmin(req);
    const body = req.body as import('@atlas/shared').CategoryInput;
    const slug = body.slug?.trim() || slugify(body.name);
    const exists = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (exists) throw new ApiError(409, '该分类标识已存在', 409);
    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId }, select: { id: true } });
      if (!parent) throw new ApiError(400, '上级分类不存在', 400);
    }
    const created = await prisma.category.create({
      data: {
        name: body.name,
        slug,
        parentId: body.parentId ?? null,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    await writeAudit({
      actorId: user.id,
      action: 'category_create',
      targetType: 'category',
      targetId: created.id,
      ip: req.ip,
      detail: { name: created.name, slug: created.slug },
    });
    res.status(201).json({ code: 0, data: { category: created }, message: '分类已创建' });
  }),
);

categoriesRouter.put(
  '/:id',
  validate(categoryInputSchema),
  asyncHandler(async (req, res) => {
    const user = requireAdmin(req);
    const body = req.body as import('@atlas/shared').CategoryInput;
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) throw new ApiError(404, '分类不存在', 404);
    if (body.parentId) {
      if (body.parentId === category.id) throw new ApiError(400, '不能把分类挂到自己下面', 400);
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw new ApiError(400, '上级分类不存在', 400);
      let cursor: string | null = parent.parentId;
      const guard = new Set<string>([parent.id]);
      while (cursor) {
        if (cursor === category.id) throw new ApiError(400, '不能形成循环分类', 400);
        if (guard.has(cursor)) break;
        guard.add(cursor);
        const next: { parentId: string | null } | null = await prisma.category.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = next?.parentId ?? null;
      }
    }
    const slug = body.slug?.trim() || category.slug;
    if (slug !== category.slug) {
      const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
      if (clash) throw new ApiError(409, '该分类标识已存在', 409);
    }
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: {
        name: body.name,
        slug,
        parentId: body.parentId ?? null,
        sortOrder: body.sortOrder ?? category.sortOrder,
      },
    });
    await writeAudit({
      actorId: user.id,
      action: 'category_update',
      targetType: 'category',
      targetId: category.id,
      ip: req.ip,
      detail: { name: updated.name, slug: updated.slug },
    });
    res.json({ code: 0, data: { category: updated }, message: '分类已更新' });
  }),
);

categoriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAdmin(req);
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) throw new ApiError(404, '分类不存在', 404);
    await prisma.$transaction([
      prisma.page.updateMany({ where: { categoryId: category.id }, data: { categoryId: null } }),
      prisma.category.updateMany({ where: { parentId: category.id }, data: { parentId: category.parentId } }),
      prisma.category.delete({ where: { id: category.id } }),
    ]);
    await writeAudit({
      actorId: user.id,
      action: 'category_delete',
      targetType: 'category',
      targetId: category.id,
      ip: req.ip,
      detail: { name: category.name, slug: category.slug },
    });
    res.json({ code: 0, data: null, message: '分类已删除' });
  }),
);
