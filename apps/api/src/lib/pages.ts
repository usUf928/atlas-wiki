import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { slugify } from '@atlas/shared';

export async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 1;
  for (;;) {
    const existing = await prisma.page.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
}

export async function syncTags(tx: Prisma.TransactionClient, pageId: string, tags: string[]): Promise<void> {
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
  await tx.pageTag.deleteMany({ where: { pageId } });
  for (const name of normalized) {
    const tag = await tx.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) || `tag-${Date.now()}` },
    });
    await tx.pageTag.create({ data: { pageId, tagId: tag.id } });
  }
}

export async function latestVersion(pageId: string): Promise<number> {
  const latest = await prisma.pageRevision.findFirst({
    where: { pageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return latest?.version ?? 0;
}
