import { z } from 'zod';

export const ROLES = ['visitor', 'user', 'editor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUS = ['active', 'banned'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const PAGE_STATUS = ['draft', 'pending', 'published', 'deleted'] as const;
export type PageStatus = (typeof PAGE_STATUS)[number];

export const AUDIT_ACTIONS = [
  'login',
  'register',
  'logout',
  'role_change',
  'user_ban',
  'user_unban',
  'password_reset',
  'page_create',
  'page_update',
  'page_delete',
  'page_revert',
  'review_approve',
  'review_reject',
  'category_create',
  'category_update',
  'category_delete',
  'settings_update',
  'upload',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  login: '登录',
  register: '注册',
  logout: '退出登录',
  role_change: '修改角色',
  user_ban: '封禁用户',
  user_unban: '解封用户',
  password_reset: '重置密码',
  page_create: '创建条目',
  page_update: '编辑条目',
  page_delete: '删除条目',
  page_revert: '回滚版本',
  review_approve: '审核通过',
  review_reject: '审核驳回',
  category_create: '新建分类',
  category_update: '修改分类',
  category_delete: '删除分类',
  settings_update: '修改站点设置',
  upload: '上传文件',
};

export const ROLE_LABELS: Record<Role, string> = {
  visitor: '游客',
  user: '注册用户',
  editor: '编辑者',
  admin: '管理员',
};

export const PAGE_STATUS_LABELS: Record<PageStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  published: '已发布',
  deleted: '已删除',
};

export const usernameSchema = z
  .string()
  .trim()
  .min(4, '用户名至少 4 位')
  .max(20, '用户名最多 20 位')
  .regex(/^[A-Za-z0-9_]+$/, '仅支持字母、数字与下划线');

export const emailSchema = z.string().trim().toLowerCase().email('邮箱格式不正确').max(120);

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(72, '密码最多 72 位')
  .regex(/[a-z]/, '需包含小写字母')
  .regex(/[A-Z]/, '需包含大写字母')
  .regex(/[0-9]/, '需包含数字');

export const captchaAnswerSchema = z
  .string()
  .trim()
  .min(4, '请输入 4 位验证码')
  .max(4, '验证码为 4 位');

export const captchaIdSchema = z.string().uuid('验证码标识无效');

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    captchaId: captchaIdSchema,
    captchaAnswer: captchaAnswerSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的密码不一致',
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, '请输入用户名或邮箱').max(120),
  password: z.string().min(1, '请输入密码').max(72),
  captchaId: captchaIdSchema,
  captchaAnswer: captchaAnswerSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

export const emailCodeSchema = z.object({
  email: emailSchema,
  purpose: z.enum(['register', 'reset']).default('register'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码').max(72),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的密码不一致',
  });

export const titleSchema = z.string().trim().min(1, '请填写标题').max(120, '标题最多 120 字');
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug 仅支持小写字母、数字与连字符');

export const pageInputSchema = z.object({
  title: titleSchema,
  slug: slugSchema.optional(),
  content: z.string().min(1, '正文不能为空').max(200_000, '正文过长'),
  summary: z.string().trim().max(240, '摘要最多 240 字').optional().default(''),
  categoryId: z.string().trim().min(1, '请选择分类').nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12, '标签最多 12 个').optional().default([]),
  editSummary: z.string().trim().max(160, '编辑摘要最多 160 字').optional().default(''),
  isProtected: z.boolean().optional().default(false),
});

export type PageInput = z.infer<typeof pageInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmailCodeInput = z.infer<typeof emailCodeSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;

export const commentSchema = z.object({
  content: z.string().trim().min(1, '评论不能为空').max(4000, '评论最多 4000 字'),
  parentId: z.string().uuid().nullable().optional(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, '请填写分类名').max(40),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug 仅支持小写字母、数字与连字符')
    .optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(60),
  siteDescription: z.string().trim().max(300),
  allowRegistration: z.boolean(),
  siteFooter: z.string().trim().max(160).optional().default(''),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

export const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(300).optional().default(''),
});

export const roleUpdateSchema = z.object({
  role: z.enum(['user', 'editor', 'admin']),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['active', 'banned']),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  sort: z.enum(['updated', 'created', 'title', 'views']).default('updated'),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PageSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: PageStatus;
  updatedAt: string;
  createdAt: string;
  viewCount: number;
  isProtected: boolean;
  author: { id: string; username: string; avatarSeed: string } | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string }[];
}

export interface PageDetail extends PageSummary {
  content: string;
  pendingTitle: string | null;
  pendingContent: string | null;
  pendingEditSummary: string | null;
  revisionCount: number;
  lastEditor: { id: string; username: string } | null;
  pendingAuthor: { id: string; username: string } | null;
}

export interface RevisionSummary {
  id: string;
  version: number;
  title: string;
  editSummary: string;
  createdAt: string;
  editor: { id: string; username: string; avatarSeed: string } | null;
}

export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffResult {
  from: number;
  to: number;
  lines: DiffLine[];
  stats: { added: number; removed: number };
}

export interface CommentNode {
  id: string;
  content: string;
  status: 'visible' | 'deleted';
  createdAt: string;
  user: { id: string; username: string; avatarSeed: string; role: Role } | null;
  replies: CommentNode[];
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  pageCount: number;
  children: CategoryNode[];
}

export interface SearchHit {
  slug: string;
  title: string;
  summary: string;
  categoryName: string | null;
  snippet: string;
  titleMatched: boolean;
  updatedAt: string;
}

export function slugify(input: string): string {
  const normalized = input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['"“”‘’]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!normalized) {
    return `entry-${Math.random().toString(36).slice(2, 8)}`;
  }
  if (/^[0-9-]+$/.test(normalized)) {
    return `entry-${normalized}`;
  }
  return normalized;
}

export function summaryFromContent(content: string, max = 150): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

export function computeWordCount(content: string): number {
  const cjk = (content.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = content
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .replace(/[`*_>#|~\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + words;
}

export function diffLines(oldText: string, newText: string): DiffResult['lines'] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;
  if (n * m > 1_500_000) {
    const lines: DiffLine[] = [];
    for (let i = 0; i < n; i += 1) {
      lines.push({ type: 'del', text: a[i], oldLine: i + 1, newLine: null });
    }
    for (let j = 0; j < m; j += 1) {
      lines.push({ type: 'add', text: b[j], oldLine: null, newLine: j + 1 });
    }
    return lines;
  }
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ type: 'del', text: a[i], oldLine: i + 1, newLine: null });
      i += 1;
    } else {
      out.push({ type: 'add', text: b[j], oldLine: null, newLine: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ type: 'del', text: a[i], oldLine: i + 1, newLine: null });
    i += 1;
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j], oldLine: null, newLine: j + 1 });
    j += 1;
  }
  return out;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.type === 'add').length,
    removed: lines.filter((line) => line.type === 'del').length,
  };
}

export const WIKI_LINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

export function extractWikiLinks(content: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(WIKI_LINK_PATTERN.source, 'g');
  while ((match = pattern.exec(content)) !== null) {
    found.add(match[1].trim());
  }
  return [...found];
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function highlightSnippet(content: string, query: string, radius = 60): string {
  const text = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!query) return escapeHtml(text.slice(0, radius * 2));
  const lower = text.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return escapeHtml(text.slice(0, radius * 2));
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  const before = escapeHtml(text.slice(start, index));
  const hit = escapeHtml(text.slice(index, index + query.length));
  const after = escapeHtml(text.slice(index + query.length, end));
  return `${start > 0 ? '…' : ''}${before}<mark>${hit}</mark>${after}${end < text.length ? '…' : ''}`;
}

export const PASSWORD_STRENGTH_LABELS = ['很弱', '偏弱', '一般', '较强', '很强'] as const;

export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const clamped = Math.min(4, score);
  return { score: clamped, label: PASSWORD_STRENGTH_LABELS[clamped] };
}

export const ADMIN_TABS = ['overview', 'review', 'users', 'categories', 'settings', 'audit'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
