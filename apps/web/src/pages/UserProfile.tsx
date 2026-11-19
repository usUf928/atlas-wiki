import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, MessageSquare, PenLine } from 'lucide-react';
import { api } from '../lib/api';
import type { PageSummaryDTO } from '../lib/types';
import { formatDate, formatRelative } from '../lib/utils';
import { Avatar, LoadingBlock } from '../components/ui';
import { NotFoundPage } from './ErrorPages';

interface ProfileResponse {
  user: {
    id: string;
    username: string;
    role: string;
    avatarSeed: string;
    bio: string;
    createdAt: string;
  };
  stats: { pages: number; revisions: number; comments: number };
  pages: PageSummaryDTO[];
  revisions: {
    id: string;
    version: number;
    editSummary: string;
    createdAt: string;
    page: { slug: string; title: string };
  }[];
}

export function UserProfilePage() {
  const { username = '' } = useParams();
  const query = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api<ProfileResponse>(`/users/${encodeURIComponent(username)}`),
    retry: false,
  });

  if (query.isLoading) return <LoadingBlock label="正在读取贡献记录…" />;
  if (query.isError || !query.data) return <NotFoundPage />;

  const { user, stats, pages, revisions } = query.data;
  const roleLabel = user.role === 'admin' ? '管理员' : user.role === 'editor' ? '编辑者' : '注册用户';

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start">
        <Avatar username={user.username} seed={user.avatarSeed} size={56} square />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-xl font-semibold text-primary">{user.username}</h1>
            <span className="rounded-sm border border-line px-1.5 py-0.5 text-[12px] text-secondary">{roleLabel}</span>
          </div>
          <p className="mt-1 max-w-prose text-sm text-secondary">{user.bio || '这位贡献者还没有写简介。'}</p>
          <p className="mt-1.5 flex items-center gap-1 text-[12px] text-tertiary">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            加入于 {formatDate(user.createdAt)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line text-center sm:w-[280px]">
          {[
            { label: '公开条目', value: stats.pages, icon: FileText },
            { label: '编辑版本', value: stats.revisions, icon: PenLine },
            { label: '讨论', value: stats.comments, icon: MessageSquare },
          ].map((item) => (
            <div key={item.label} className="bg-base px-2 py-3">
              <item.icon className="mx-auto h-3.5 w-3.5 text-tertiary" aria-hidden />
              <p className="mt-1 font-mono text-md text-primary">{item.value}</p>
              <p className="text-[12px] text-tertiary">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <h2 className="border-b border-line pb-2 font-serif text-lg font-semibold text-primary">创建的条目</h2>
          {pages.length ? (
            <ul className="divide-y divide-line">
              {pages.map((page) => (
                <li key={page.id} className="py-3">
                  <Link to={`/wiki/${page.slug}`} className="font-serif text-sm text-primary hover:text-link">
                    {page.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-[12px] text-secondary">{page.summary}</p>
                  <p className="mt-1 text-[12px] text-tertiary">
                    {page.category?.name ?? '未分类'} · 更新于 {formatRelative(page.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-tertiary">还没有公开条目。</p>
          )}
        </section>

        <aside>
          <h2 className="border-b border-line pb-2 font-serif text-lg font-semibold text-primary">最近编辑</h2>
          {revisions.length ? (
            <ul className="divide-y divide-line">
              {revisions.map((revision) => (
                <li key={revision.id} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link to={`/wiki/${revision.page.slug}`} className="truncate text-sm text-secondary hover:text-primary">
                      {revision.page.title}
                    </Link>
                    <span className="shrink-0 font-mono text-[12px] text-tertiary">v{revision.version}</span>
                  </div>
                  <p className="line-clamp-1 text-[12px] text-tertiary">
                    {revision.editSummary || '无摘要'} · {formatRelative(revision.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-tertiary">还没有编辑记录。</p>
          )}
        </aside>
      </div>
    </div>
  );
}
