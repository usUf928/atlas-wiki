import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Folder, Search } from 'lucide-react';
import { api } from '../lib/api';
import type { CategoryDTO } from '../lib/types';
import { cn } from '../lib/utils';

interface CategoriesResponse {
  categories: CategoryDTO[];
}

function matches(node: CategoryDTO, keyword: string): boolean {
  if (!keyword) return true;
  if (node.name.toLowerCase().includes(keyword)) return true;
  return node.children.some((child) => matches(child, keyword));
}

function collectIds(nodes: CategoryDTO[]): string[] {
  const ids: string[] = [];
  const walk = (list: CategoryDTO[]) => {
    for (const node of list) {
      ids.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

function TreeNode({
  node,
  depth,
  activeSlug,
  expanded,
  toggle,
  keyword,
}: {
  node: CategoryDTO;
  depth: number;
  activeSlug: string | null;
  expanded: Set<string>;
  toggle: (id: string) => void;
  keyword: string;
}) {
  if (!matches(node, keyword)) return null;
  const isExpanded = expanded.has(node.id) || Boolean(keyword);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className={cn(
          'tree-link flex items-center gap-1 rounded-r-sm py-0.5 pr-1 text-sm',
          activeSlug === node.slug ? 'text-primary' : 'text-secondary',
        )}
        data-active={activeSlug === node.slug}
        style={{ paddingLeft: `${Math.max(2, depth * 14 + 2)}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-tertiary hover:text-primary"
            aria-label={isExpanded ? '收起分类' : '展开分类'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0 text-tertiary" aria-hidden />
        <Link
          to={`/category/${node.slug}`}
          className="flex-1 truncate py-0.5 hover:no-underline"
          title={node.name}
        >
          {node.name}
        </Link>
        <span className="font-mono text-[12px] text-tertiary">{node.pageCount}</span>
      </div>
      {hasChildren && isExpanded ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeSlug={activeSlug}
              expanded={expanded}
              toggle={toggle}
              keyword={keyword}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoryTree({ activeSlug = null }: { activeSlug?: string | null }) {
  const location = useLocation();
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoriesResponse>('/categories'),
    staleTime: 2 * 60_000,
  });
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!query.data) return;
    setExpanded((previous) => (previous.size ? previous : new Set(collectIds(query.data.categories))));
  }, [query.data]);

  const normalized = keyword.trim().toLowerCase();
  const categories = useMemo(() => query.data?.categories ?? [], [query.data]);

  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary" />
        <input
          className="field h-8 pl-7 text-sm"
          placeholder="过滤分类"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          aria-label="过滤分类"
        />
      </label>
      {query.isLoading ? (
        <div className="space-y-1.5 py-1">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-5 w-full" />
          ))}
        </div>
      ) : categories.length ? (
        <ul className="space-y-0.5">
          {categories.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              activeSlug={activeSlug ?? (location.pathname.startsWith('/category/') ? location.pathname.split('/')[2] : null)}
              expanded={expanded}
              toggle={(id) =>
                setExpanded((previous) => {
                  const next = new Set(previous);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              keyword={normalized}
            />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-[12px] text-tertiary">暂无分类</p>
      )}
      <div className="pt-1">
        <Link to="/search" className="text-[12px] text-tertiary hover:text-secondary">
          浏览全部条目 →
        </Link>
      </div>
    </div>
  );
}
