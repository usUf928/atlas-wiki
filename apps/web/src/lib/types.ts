export interface WebUser {
  id: string;
  username: string;
  email: string;
  role: 'visitor' | 'user' | 'editor' | 'admin';
  status: 'active' | 'banned';
  avatarSeed: string;
  bio: string;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PageSummaryDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  viewCount: number;
  isProtected: boolean;
  author: { id: string; username: string; avatarSeed: string } | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string }[];
}

export interface PageDetailDTO extends PageSummaryDTO {
  content: string;
  pendingTitle: string | null;
  pendingContent: string | null;
  pendingEditSummary: string | null;
  pendingAuthor: { id: string; username: string } | null;
  revisionCount: number;
  lastEditor: { id: string; username: string } | null;
}

export interface RevisionDTO {
  id: string;
  version: number;
  title: string;
  content?: string;
  editSummary: string;
  createdAt: string;
  editor: { id: string; username: string; avatarSeed: string } | null;
}

export interface DiffLineDTO {
  type: 'same' | 'add' | 'del';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface CommentDTO {
  id: string;
  content: string;
  status: 'visible' | 'deleted';
  createdAt: string;
  user: { id: string; username: string; avatarSeed: string; role: string } | null;
  replies: CommentDTO[];
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  pageCount: number;
  children: CategoryDTO[];
}

export interface SearchHitDTO {
  slug: string;
  title: string;
  summary: string;
  categoryName: string | null;
  snippet: string;
  titleMatched: boolean;
  updatedAt: string;
}

export interface SiteInfo {
  settings: {
    siteName: string;
    siteDescription: string;
    allowRegistration: boolean;
    siteFooter: string;
  };
  stats: { pages: number; users: number };
}

export interface AdminStats {
  counts: {
    pages: number;
    users: number;
    pending: number;
    comments: number;
    revisions: number;
    views: number;
  };
  trend: { date: string; label: string; count: number }[];
  recentLogs: Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
    actor: { username: string } | null;
  }>;
}
