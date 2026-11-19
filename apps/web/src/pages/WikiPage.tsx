import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  FolderTree,
  History,
  ListTree,
  Lock,
  MessageSquare,
  Pencil,
  X,
} from 'lucide-react';
import { computeWordCount } from '@atlas/shared';
import { api, ApiClientError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { PageDetailDTO, PageSummaryDTO, CommentDTO } from '../lib/types';
import { extractHeadings } from '../lib/markdown';
import { formatDateTime, formatRelative, readingMinutes } from '../lib/utils';
import { Avatar, Badge, InlineError, LoadingBlock } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { CategoryTree } from '../components/CategoryTree';
import { Toc } from '../components/Toc';
import { Comments } from '../components/Comments';
import { NotFoundPage } from './ErrorPages';

interface PageResponse {
  page: PageDetailDTO;
}

interface RelatedResponse {
  pages: PageSummaryDTO[];
}

function Actions({ page, slug }: { page: PageDetailDTO; slug: string }) {
  const { user, isEditor } = useAuth();
  const [copied, setCopied] = useState(false);
  const canEdit = Boolean(user && (isEditor || (!page.isProtected && user.id === page.author?.id)));

  return (
    <div className="space-y-1">
      {canEdit ? (
        <Link to={`/wiki/${slug}/edit`} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm text-secondary hover:bg-raised hover:text-primary hover:no-underline">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          编辑本页
        </Link>
      ) : null}
      <Link
        to={`/wiki/${slug}/history`}
        className="flex items-center gap-2 rounded px-1 py-1.5 text-sm text-secondary hover:bg-raised hover:text-primary hover:no-underline"
      >
        <History className="h-3.5 w-3.5" aria-hidden />
        历史版本
        <span className="ml-auto font-mono text-[12px] text-tertiary">{page.revisionCount}</span>
      </Link>
      <a
        href="#comments"
        className="flex items-center gap-2 rounded px-1 py-1.5 text-sm text-secondary hover:bg-raised hover:text-primary hover:no-underline"
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        讨论
      </a>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm text-secondary hover:bg-raised hover:text-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? '已复制链接' : '复制链接'}
      </button>
    </div>
  );
}

export function WikiPage() {
  const { slug = '' } = useParams();
  const { user, isEditor } = useAuth();
  const [drawer, setDrawer] = useState<'left' | 'right' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const pageQuery = useQuery({
    queryKey: ['page', slug],
    queryFn: () => api<PageResponse>(`/pages/${encodeURIComponent(slug)}`),
    retry: false,
  });

  const relatedQuery = useQuery({
    queryKey: ['related', slug],
    queryFn: () => api<RelatedResponse>(`/pages/${encodeURIComponent(slug)}/related`),
    enabled: Boolean(pageQuery.data),
  });

  const page = pageQuery.data?.page;
  const toc = useMemo(() => extractHeadings(page?.content ?? ''), [page?.content]);
  const wordCount = useMemo(() => computeWordCount(page?.content ?? ''), [page?.content]);

  if (pageQuery.isError) {
    if (pageQuery.error instanceof ApiClientError && pageQuery.error.status === 404) {
      return <NotFoundPage />;
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <InlineError message={pageQuery.error instanceof Error ? pageQuery.error.message : '条目加载失败'} />
      </div>
    );
  }

  if (pageQuery.isLoading || !page) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8">
        <LoadingBlock label="正在取回条目…" />
      </div>
    );
  }

  const canEdit = Boolean(user && (isEditor || (!page.isProtected && user.id === page.author?.id)));

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_200px]">
        <aside className="hidden border-r border-line px-4 py-5 lg:block">
          <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pr-1">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-tertiary">
              <FolderTree className="h-3.5 w-3.5" aria-hidden />
              分类树
            </div>
            <CategoryTree activeSlug={page.category?.slug ?? null} />
          </div>
        </aside>

        <div className="min-w-0 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <button type="button" className="btn" onClick={() => setDrawer('left')}>
              <FolderTree className="h-4 w-4" aria-hidden />
              分类
            </button>
            <div className="flex items-center gap-2">
              {canEdit ? (
                <Link to={`/wiki/${slug}/edit`} className="btn">
                  <Pencil className="h-4 w-4" aria-hidden />
                  编辑
                </Link>
              ) : null}
              <button type="button" className="btn" onClick={() => setDrawer('right')}>
                <ListTree className="h-4 w-4" aria-hidden />
                目录
              </button>
            </div>
          </div>

          <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1 text-[12px] text-tertiary">
            <Link to="/" className="hover:text-secondary">
              首页
            </Link>
            <span aria-hidden>/</span>
            {page.category ? (
              <>
                <Link to={`/category/${page.category.slug}`} className="hover:text-secondary">
                  {page.category.name}
                </Link>
                <span aria-hidden>/</span>
              </>
            ) : null}
            <span className="max-w-[240px] truncate text-secondary">{page.title}</span>
          </nav>

          <header className="mt-3 border-b border-line pb-4">
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="font-serif text-2xl font-semibold leading-tight text-primary">{page.title}</h1>
              {page.isProtected ? (
                <span className="mt-1 inline-flex items-center gap-1 text-[12px] text-warn">
                  <Lock className="h-3 w-3" aria-hidden />
                  受保护
                </span>
              ) : null}
              {page.status === 'pending' ? <Badge tone="warn" className="mt-1">待审核</Badge> : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tertiary">
              {page.lastEditor ? (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar
                    username={page.lastEditor.username}
                    seed={page.lastEditor.username}
                    size={18}
                  />
                  最后编辑：{page.lastEditor.username}
                </span>
              ) : (
                <span>{page.author?.username ?? '未知作者'} 创建</span>
              )}
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                <time dateTime={page.updatedAt}>{formatDateTime(page.updatedAt)}</time>
              </span>
              <span aria-hidden>·</span>
              <span>{wordCount} 字</span>
              <span aria-hidden>·</span>
              <span>约 {readingMinutes(wordCount)} 分钟</span>
              <span aria-hidden>·</span>
              <span className="font-mono">{page.viewCount} 次浏览</span>
            </div>

            {page.tags.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {page.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/tags/${tag.slug}`}
                    className="rounded-sm border border-line px-1.5 py-0.5 text-[12px] text-tertiary hover:border-strong hover:text-secondary hover:no-underline"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </header>

          {page.status === 'pending' ? (
            <div className="mt-4 border-l-2 border-warn bg-raised px-3 py-2 text-sm text-secondary">
              <p>
                本条目存在待审核的修改
                {page.pendingAuthor ? `（提交者：${page.pendingAuthor.username}）` : ''}
                {page.pendingEditSummary ? `：${page.pendingEditSummary}` : '。'}
              </p>
              <p className="mt-1 text-[12px] text-tertiary">
                {page.pendingContent
                  ? '页面内容仍为已发布版本，审核通过后才会替换。'
                  : '新条目将在编辑者审核通过后公开。'}
              </p>
            </div>
          ) : null}

          <article className="mt-5">
            <Markdown content={page.content} />
          </article>

          {copyError ? <InlineError message={copyError} /> : null}

          <section className="mt-10 max-w-prose border-t border-line pt-5">
            <h2 className="font-serif text-lg font-semibold text-primary">相关条目</h2>
            {relatedQuery.data?.pages.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {relatedQuery.data.pages.map((item) => (
                  <li key={item.id} className="rounded border border-line bg-base p-3 hover:border-strong">
                    <Link to={`/wiki/${item.slug}`} className="text-sm text-primary hover:text-link">
                      {item.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-[12px] text-secondary">{item.summary}</p>
                    <p className="mt-1 text-[12px] text-tertiary">
                      {item.category?.name ?? '未分类'} · {formatRelative(item.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-tertiary">暂时没有同类条目。</p>
            )}
          </section>

          <Comments slug={slug} />

          <div className="mt-8">
            <Link to="/" className="inline-flex items-center gap-1 text-[12px] text-tertiary hover:text-secondary">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              返回首页
            </Link>
          </div>
        </div>

        <aside className="hidden border-l border-line px-4 py-5 xl:block">
          <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-tertiary">
              <ListTree className="h-3.5 w-3.5" aria-hidden />
              页内目录
            </div>
            <Toc items={toc} />
            <div className="mt-6 border-t border-line pt-3">
              <p className="mb-2 text-[12px] uppercase tracking-wider text-tertiary">本页操作</p>
              <Actions page={page} slug={slug} />
            </div>
            <p className="mt-5 text-[12px] leading-5 text-disabled">
              摘要：{page.summary || '—'}
            </p>
          </div>
        </aside>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="关闭抽屉"
            className="absolute inset-0 bg-[rgba(8,9,10,.72)]"
            onClick={() => setDrawer(null)}
          />
          <div
            className={`absolute bottom-0 top-0 w-[86%] max-w-[320px] overflow-y-auto border-strong bg-base p-4 ${
              drawer === 'left' ? 'left-0 border-r' : 'right-0 border-l'
            }`}
            role="dialog"
            aria-label={drawer === 'left' ? '分类树' : '页内目录'}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-primary">{drawer === 'left' ? '分类树' : '页内目录与操作'}</span>
              <button type="button" className="btn-ghost btn h-7 w-7 p-0" onClick={() => setDrawer(null)} aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            {drawer === 'left' ? (
              <CategoryTree activeSlug={page.category?.slug ?? null} />
            ) : (
              <div className="space-y-6">
                <Toc items={toc} />
                <div className="border-t border-line pt-3">
                  <p className="mb-2 text-[12px] uppercase tracking-wider text-tertiary">本页操作</p>
                  <Actions page={page} slug={slug} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
