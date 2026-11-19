import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Folder, FolderOpen } from 'lucide-react';
import { api } from '../lib/api';
import type { CategoryDTO } from '../lib/types';
import { LoadingBlock } from '../components/ui';

function CategoryCard({ category }: { category: CategoryDTO }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/category/${category.slug}`} className="flex items-center gap-2 font-serif text-md text-primary hover:text-link">
          <FolderOpen className="h-4 w-4 text-tertiary" aria-hidden />
          {category.name}
        </Link>
        <span className="font-mono text-[12px] text-tertiary">{category.pageCount}</span>
      </div>
      <p className="mt-1 font-mono text-[12px] text-disabled">/{category.slug}</p>
      {category.children.length ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-2">
          {category.children.map((child) => (
            <li key={child.id} className="flex items-center justify-between gap-2">
              <Link
                to={`/category/${child.slug}`}
                className="flex items-center gap-1.5 text-[12px] text-secondary hover:text-primary"
              >
                <Folder className="h-3 w-3 text-tertiary" aria-hidden />
                {child.name}
              </Link>
              <span className="font-mono text-[12px] text-tertiary">{child.pageCount}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CategoriesPage() {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ categories: CategoryDTO[] }>('/categories'),
    staleTime: 2 * 60_000,
  });

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="border-b border-line pb-3">
        <h1 className="font-serif text-xl font-semibold text-primary">分类</h1>
        <p className="mt-1 text-[12px] text-tertiary">按主题浏览站点条目。数字为分类下公开条目数。</p>
      </div>
      {query.isLoading ? (
        <LoadingBlock label="正在读取分类树…" />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(query.data?.categories ?? []).map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
