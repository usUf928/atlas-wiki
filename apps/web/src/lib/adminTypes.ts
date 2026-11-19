export interface AdminUserDTO {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'editor' | 'admin';
  status: 'active' | 'banned';
  avatarSeed: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lockedUntil: string | null;
  _count: { revisions: number; pages: number };
}

export interface ReviewItemDTO {
  id: string;
  slug: string;
  title: string;
  currentTitle: string;
  summary: string;
  content: string;
  isEdit: boolean;
  editSummary: string | null;
  updatedAt: string;
  author: { id: string; username: string; avatarSeed: string } | null;
  pendingAuthor: { id: string; username: string } | null;
  category: { id: string; name: string } | null;
}

export interface AuditLogDTO {
  id: string;
  action: string;
  actionLabel: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; username: string } | null;
}
