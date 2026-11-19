import { randomBytes } from 'node:crypto';
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';
import { seedCategories, seedPages } from './content.js';
import { slugify } from '@atlas/shared';

interface SeedUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'editor' | 'user';
  bio: string;
  mustChangePassword: boolean;
}

const users: SeedUser[] = [
  {
    username: 'admin',
    email: 'admin@atlas.local',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
    role: 'admin',
    bio: '站点管理员，负责权限、分类与审计。',
    mustChangePassword: true,
  },
  {
    username: 'editor',
    email: 'editor@atlas.local',
    password: process.env.SEED_EDITOR_PASSWORD ?? 'Editor@12345',
    role: 'editor',
    bio: '编辑者，关注基础设施与观测方法。',
    mustChangePassword: false,
  },
  {
    username: 'wanderer',
    email: 'wanderer@atlas.local',
    password: process.env.SEED_USER_PASSWORD ?? 'User@12345',
    role: 'user',
    bio: '注册用户，记录苔原与温室里的琐事。',
    mustChangePassword: false,
  },
];

async function seedUsers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const item of users) {
    const existing = await prisma.user.findUnique({ where: { username: item.username } });
    if (existing) {
      ids.set(item.username, existing.id);
      continue;
    }
    const created = await prisma.user.create({
      data: {
        username: item.username,
        email: item.email,
        passwordHash: await hashPassword(item.password),
        role: item.role,
        status: 'active',
        avatarSeed: randomBytes(6).toString('hex'),
        bio: item.bio,
        mustChangePassword: item.mustChangePassword,
        createdAt: new Date('2024-01-05T08:00:00.000Z'),
      },
    });
    ids.set(item.username, created.id);
  }
  return ids;
}

async function seedCategoryTree(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const item of seedCategories) {
    const parentId = item.parentSlug ? ids.get(item.parentSlug) ?? null : null;
    const category = await prisma.category.upsert({
      where: { slug: item.slug },
      update: { name: item.name, sortOrder: item.sortOrder, parentId },
      create: { name: item.name, slug: item.slug, sortOrder: item.sortOrder, parentId },
    });
    ids.set(item.slug, category.id);
  }
  return ids;
}

async function syncPageTags(pageId: string, tags: string[]): Promise<void> {
  await prisma.pageTag.deleteMany({ where: { pageId } });
  for (const name of tags) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
    await prisma.pageTag.create({ data: { pageId, tagId: tag.id } });
  }
}

async function seedContent(userIds: Map<string, string>, categoryIds: Map<string, string>): Promise<void> {
  for (const item of seedPages) {
    const exists = await prisma.page.findUnique({ where: { slug: item.slug }, select: { id: true } });
    if (exists) continue;

    const authorId = userIds.get(item.author);
    const categoryId = categoryIds.get(item.categorySlug);
    if (!authorId) throw new Error(`缺少作者 ${item.author}`);

    const page = await prisma.page.create({
      data: {
        slug: item.slug,
        title: item.title,
        content: item.content,
        summary: item.summary,
        categoryId: categoryId ?? null,
        authorId,
        status: item.status,
        isProtected: item.isProtected ?? false,
        viewCount: item.viewCount,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });

    const revisions = item.revisions ?? [
      {
        version: 1,
        editSummary: '创建条目',
        content: item.content,
      },
    ];

    for (const revision of revisions) {
      await prisma.pageRevision.create({
        data: {
          pageId: page.id,
          title: item.title,
          content: revision.content || item.content,
          editSummary: revision.editSummary,
          editorId: authorId,
          version: revision.version,
          createdAt: new Date(item.createdAt),
        },
      });
    }

    await syncPageTags(page.id, item.tags);
  }

  const fogPage = await prisma.page.findUnique({ where: { slug: 'fog-harbor-archive' } });
  const readingPage = await prisma.page.findUnique({ where: { slug: 'low-light-reading' } });
  const editorId = userIds.get('editor');
  const wandererId = userIds.get('wanderer');

  if (fogPage && wandererId && (await prisma.comment.count({ where: { pageId: fogPage.id } })) === 0) {
    const root = await prisma.comment.create({
      data: {
        pageId: fogPage.id,
        userId: wandererId,
        content: '缺测的 17 天里，有没有可能把附近灯塔的值班日志补进来做交叉验证？',
        createdAt: new Date('2024-11-03T10:12:00.000Z'),
      },
    });
    if (editorId) {
      await prisma.comment.create({
        data: {
          pageId: fogPage.id,
          userId: editorId,
          parentId: root.id,
          content: '试过，灯塔日志只记风力不记潮位。不过 1996 年之后的日志有气压，可以作为旁证。',
          createdAt: new Date('2024-11-03T15:40:00.000Z'),
        },
      });
    }
  }

  if (readingPage && editorId && (await prisma.comment.count({ where: { pageId: readingPage.id } })) === 0) {
    await prisma.comment.create({
      data: {
        pageId: readingPage.id,
        userId: editorId,
        content: '760px 在 1440 宽的屏幕上偏窄，但确实更容易读完。准备在自己的笔记站上试试。',
        createdAt: new Date('2024-10-22T09:05:00.000Z'),
      },
    });
  }
}

async function seedSettings(): Promise<void> {
  const defaults: Array<[string, string]> = [
    ['siteName', 'Atlas Wiki'],
    [
      'siteDescription',
      '一座低照度的中文知识档案馆，收录基础设施、设计系统与自然志的长期笔记。所有条目均为原创示例。',
    ],
    ['allowRegistration', 'true'],
    ['siteFooter', 'Atlas Wiki · 内容以 CC BY-SA 4.0 共享 · 自托管于暗色之上'],
  ];
  for (const [key, value] of defaults) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

async function main(): Promise<void> {
  const userIds = await seedUsers();
  const categoryIds = await seedCategoryTree();
  await seedContent(userIds, categoryIds);
  await seedSettings();

  const counts = {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    pages: await prisma.page.count(),
    revisions: await prisma.pageRevision.count(),
    comments: await prisma.comment.count(),
  };

  console.log('[seed] 完成', counts);
  console.log('[seed] 管理员 admin / Admin@12345（首次登录强制改密）');
  console.log('[seed] 编辑者 editor / Editor@12345');
  console.log('[seed] 注册用户 wanderer / User@12345');
}

main()
  .catch((error) => {
    console.error('[seed] 失败', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
