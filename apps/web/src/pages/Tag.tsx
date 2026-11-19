import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import { api } from '../lib/api';
import type { PageSummaryDTO } from '../lib/types';
import { formatRelative } from '../lib/utils';
import { EmptyState, LoadingBlock } from '../components/ui';

interface PagesResponse {
  items: PageSummaryDTO[];
  total: number;
}

export function TagPage() {
  const { tag = '' } = useParams();
  const pagesQuery = useQuery({
    queryKey: ['pages', 'tag', tag],
    queryFn: () => api<PagesResponse>(`/pages?tag=${encodeURIComponent(tag)}&pageSize=30`),
  });

  const displayName = pagesQuery.data?.items[0]?.tags.find((item) => item.slug === tag)?.name ?? tag;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="flex items-center gap-1 text-[12px] text-tertiary">
        <Link to="/" className="hover:text-secondary">
          首页
        </Link>
        <span aria-hidden>/</span>
        <span>标签</span>
        <span aria-hidden>/</span>
        <span className="text-secondary">{displayName}</span>
      </div>

      <div className="mt-2 border-b border-line pb-4">
        <h1 className="flex items-center gap-2 font-serif text-xl font-semibold text-primary">
          <Hash className="h-5 w-5 text-tertiary" aria-hidden />
          {displayName}
        </h1>
        <p className="mt-1 text-[12px] text-tertiary">
          共 {pagesQuery.data?.total ?? 0} 个条目使用这个标签。
        </p>
      </div>

      {pagesQuery.isLoading ? (
        <LoadingBlock />
      ) : pagesQuery.data?.items.length ? (
        <ul className="mt-2 divide-y divide-line border-b border-line">
          {pagesQuery.data.items.map((item) => (
            <li key={item.id} className="py-4">
              <Link to={`/wiki/${item.slug}`} className="font-serif text-md text-primary hover:text-link">
                {item.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-secondary">{item.summary}</p>
              <p className="mt-1 text-[12px] text-tertiary">
                {item.category?.name ?? '未分类'} · 更新于 {formatRelative(item.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState title="没有使用这个标签的条目" description="标签区分大小写之外的差异时，请返回搜索重试。" />
        </div>
      )}
    </div>
  );
}
