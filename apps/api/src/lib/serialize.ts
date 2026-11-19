import type { Page, Category, Tag, PageTag, User } from '@prisma/client';

export const pageListInclude = {
  author: { select: { id: true, username: true, avatarSeed: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: true } },
} as const;

export const pageDetailInclude = {
  ...pageListInclude,
  pendingAuthor: { select: { id: true, username: true } },
  _count: { select: { revisions: true } },
} as const;

export type PageWithList = Page & {
  author: Pick<User, 'id' | 'username' | 'avatarSeed'> | null;
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
  tags: (PageTag & { tag: Tag })[];
};

export type PageWithDetail = PageWithList & {
  pendingAuthor: Pick<User, 'id' | 'username'> | null;
  _count: { revisions: number };
};

export function toPageSummary(page: PageWithList) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    status: page.status,
    updatedAt: page.updatedAt,
    createdAt: page.createdAt,
    viewCount: page.viewCount,
    isProtected: page.isProtected,
    author: page.author,
    category: page.category,
    tags: page.tags.map((item) => item.tag),
  };
}

export function toPageDetail(page: PageWithDetail, lastEditor: { id: string; username: string } | null) {
  return {
    ...toPageSummary(page),
    content: page.status === 'pending' && page.pendingContent ? page.content : page.content,
    pendingTitle: page.pendingTitle,
    pendingContent: page.pendingContent,
    pendingEditSummary: page.pendingEditSummary,
    pendingAuthor: page.pendingAuthor,
    revisionCount: page._count.revisions,
    lastEditor,
  };
}
