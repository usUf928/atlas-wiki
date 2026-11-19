import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FolderTree } from 'lucide-react';
import { api } from '../lib/api';
import type { CategoryDTO, PageSummaryDTO } from '../lib/types';
import { formatRelative } from '../lib/utils';
import { EmptyState, LoadingBlock } from '../components/ui';
import { NotFoundPage } from './ErrorPages';

interface CategoriesResponse {
  categories: CategoryDTO[];
}

interface PagesResponse {
  items: PageSummaryDTO[];
  total: number;
  page: number;
  totalPages: number;
}

function findCategory(nodes: CategoryDTO[], slug: string): CategoryDTO | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findCategory(node.children, slug);
    if (found) return found;
  }
  return null;
}

export function CategoryPage() {
  const { id = '' } = useParams();
  const [page, setPage] = useState(1);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoriesResponse>('/categories'),
    staleTime: 2 * 60_000,
  });

  const pagesQuery = useQuery({
    queryKey: ['pages', 'category', id, page],
    queryFn: () => api<PagesResponse>(`/pages?category=${encodeURIComponent(id)}&pageSize=20&page=${page}`),
    retry: false,
  });

  if (categoriesQuery.isLoading) return <LoadingBlock label="正在读取分类…" />;

  const category = findCategory(categoriesQuery.data?.categories ?? [], id);
  const pages = pagesQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="flex items-center gap-1 text-[12px] text-tertiary">
        <Link to="/" className="hover:text-secondary">
          首页
        </Link>
        <span aria-hidden>/</span>
        <span>分类</span>
        <span aria-hidden>/</span>
        <span className="text-secondary">{category?.name ?? id}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-xl font-semibold text-primary">
            <FolderTree className="h-5 w-5 text-tertiary" aria-hidden />
            {category?.name ?? id}
          </h1>
          <p className="mt-1 text-[12px] text-tertiary">
            分类内共 {category?.pageCount ?? pagesQuery.data?.total ?? 0} 个公开条目
            {category?.children.length ? ` · ${category.children.length} 个子分类` : ''}
          </p>
        </div>
        <Link to="/search" className="btn">
          查看全部条目
        </Link>
      </div>

      {category?.children.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              to={`/category/${child.slug}`}
              className="rounded border border-line px-2 py-1 text-[12px] text-secondary hover:border-strong hover:text-primary hover:no-underline"
            >
              {child.name} <span className="font-mono text-tertiary">{child.pageCount}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {pagesQuery.isLoading ? (
        <LoadingBlock />
      ) : pages.length ? (
        <ul className="mt-2 divide-y divide-line border-b border-line">
          {pages.map((item) => (
            <li key={item.id} className="py-4">
              <Link to={`/wiki/${item.slug}`} className="font-serif text-md text-primary hover:text-link">
                {item.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-secondary">{item.summary}</p>
              <p className="mt-1 text-[12px] text-tertiary">
                {item.author?.username ?? '未知作者'} · 更新于 {formatRelative(item.updatedAt)} · {item.viewCount} 次浏览
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="这个分类还没有条目"
            description="登录后创建条目，并把它归入这个分类。"
            action={
              <Link to="/new" className="btn btn-primary">
                新建条目
              </Link>
            }
          />
        </div>
      )}

      {(pagesQuery.data?.totalPages ?? 1) > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-2 text-[12px]">
          <button
            type="button"
            className="btn h-8"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            上一页
          </button>
          <span className="text-tertiary">
            {page} / {pagesQuery.data?.totalPages}
          </span>
          <button
            type="button"
            className="btn h-8"
            disabled={page >= (pagesQuery.data?.totalPages ?? 1)}
            onClick={() => setPage((value) => value + 1)}
          >
            下一页
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {!page && !category ? <NotFoundPage /> : null}
    </div>
  );
}
