import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search as SearchIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { PageSummaryDTO, SearchHitDTO } from '../lib/types';
import { formatRelative } from '../lib/utils';
import { EmptyState, LoadingBlock } from '../components/ui';

interface SearchResponse {
  query: string;
  total: number;
  hits: SearchHitDTO[];
}

interface PagesResponse {
  items: PageSummaryDTO[];
  total: number;
  totalPages: number;
  page: number;
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  if (!query) return <>{title}</>;
  const index = title.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, index)}
      <mark>{title.slice(index, index + query.length)}</mark>
      {title.slice(index + query.length)}
    </>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(q);
  }, [q]);

  const resultsQuery = useQuery({
    queryKey: ['search-page', q],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(q)}&limit=30`),
    enabled: q.length > 0,
  });

  const allQuery = useQuery({
    queryKey: ['pages', 'search-index'],
    queryFn: () => api<PagesResponse>('/pages?pageSize=30&sort=updated'),
    enabled: q.length === 0,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    setParams(next ? { q: next } : {});
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="border-b border-line pb-4">
        <h1 className="font-serif text-xl font-semibold text-primary">搜索</h1>
        <p className="mt-1 text-[12px] text-tertiary">
          标题与正文全文匹配，标题命中优先。输入至少一个字符。
        </p>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
            <input
              className="field h-10 pl-9"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="搜索条目、标签或正文…"
              aria-label="搜索"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary h-10 px-4">
            搜索
          </button>
        </form>
      </div>

      {q ? (
        <div className="mt-4">
          <p className="mb-3 text-[12px] text-tertiary">
            「{q}」的搜索结果 · {resultsQuery.data?.total ?? 0} 条
          </p>
          {resultsQuery.isLoading ? (
            <LoadingBlock label="正在检索…" />
          ) : resultsQuery.data?.hits.length ? (
            <ul className="divide-y divide-line border-y border-line">
              {resultsQuery.data.hits.map((hit) => (
                <li key={hit.slug} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link to={`/wiki/${hit.slug}`} className="font-serif text-md text-primary hover:text-link">
                      <HighlightedTitle title={hit.title} query={q} />
                    </Link>
                    <span className="text-[12px] text-tertiary">{hit.categoryName ?? '未分类'}</span>
                    <span className="ml-auto text-[12px] text-tertiary">{formatRelative(hit.updatedAt)}</span>
                  </div>
                  <p
                    className="mt-1 text-sm leading-6 text-secondary"
                    dangerouslySetInnerHTML={{ __html: hit.snippet }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={`没有匹配「${q}」的条目`}
              description="可以换一个词，或者以这个标题创建新条目。"
              action={
                <Link to={`/new?title=${encodeURIComponent(q)}`} className="btn btn-primary">
                  创建「{q}」
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-[12px] text-tertiary">未输入关键词，展示最近更新的条目。</p>
          {allQuery.isLoading ? (
            <LoadingBlock />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {(allQuery.data?.items ?? []).map((page) => (
                <li key={page.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/wiki/${page.slug}`} className="font-serif text-sm text-primary hover:text-link">
                      {page.title}
                    </Link>
                    <p className="line-clamp-1 text-[12px] text-secondary">{page.summary}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-tertiary">{page.category?.name ?? '未分类'}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-disabled" aria-hidden />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
