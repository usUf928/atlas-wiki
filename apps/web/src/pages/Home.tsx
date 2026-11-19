import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Clock, FolderTree, Shuffle, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useSite, FALLBACK_SITE } from '../lib/site';
import type { CategoryDTO, PageSummaryDTO } from '../lib/types';
import { formatRelative, randomItem } from '../lib/utils';
import { Logo } from '../components/Logo';
import { EmptyState, LoadingBlock } from '../components/ui';

interface PagesResponse {
  items: PageSummaryDTO[];
  total: number;
}

interface CategoriesResponse {
  categories: CategoryDTO[];
}

function MetaLine({ page }: { page: PageSummaryDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-tertiary">
      {page.category ? <span className="text-secondary">{page.category.name}</span> : <span>未分类</span>}
      <span aria-hidden>·</span>
      <span>{page.author?.username ?? '未知作者'}</span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" aria-hidden />
        {formatRelative(page.updatedAt)}
      </span>
      <span aria-hidden>·</span>
      <span className="font-mono">{page.viewCount} 次浏览</span>
    </div>
  );
}

export function HomePage() {
  const site = useSite();
  const settings = site.data?.settings ?? FALLBACK_SITE.settings;
  const stats = site.data?.stats ?? FALLBACK_SITE.stats;

  const recentQuery = useQuery({
    queryKey: ['pages', 'recent', 8],
    queryFn: () => api<PagesResponse>('/pages?pageSize=8&sort=updated'),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoriesResponse>('/categories'),
  });

  const randomPoolQuery = useQuery({
    queryKey: ['pages', 'random-pool'],
    queryFn: () => api<PagesResponse>('/pages?pageSize=50&sort=updated'),
  });

  const [randomSeed, setRandomSeed] = useState(0);
  const randomPage = useMemo(() => {
    void randomSeed;
    return randomItem(randomPoolQuery.data?.items ?? []);
  }, [randomPoolQuery.data, randomSeed]);

  const categories = categoriesQuery.data?.categories ?? [];
  const countAll = (nodes: CategoryDTO[]): number =>
    nodes.reduce((sum, node) => sum + node.pageCount + countAll(node.children), 0);
  const totalCategoryPages = countAll(categories);

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
      <section className="grid gap-6 border-b border-line py-10 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="inline-flex items-center justify-center rounded border border-strong bg-raised p-2">
              <Logo size={30} className="text-primary" />
            </div>
            <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-tertiary">
              低照度知识档案馆
            </div>
          </div>
          <h1 className="font-serif text-2xl font-semibold leading-tight text-primary">
            {settings.siteName}
          </h1>
          <p className="mt-3 max-w-prose text-md leading-[1.65] text-secondary">{settings.siteDescription}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link to="/search" className="btn btn-primary">
              <BookOpen className="h-4 w-4" aria-hidden />
              开始浏览
            </Link>
            <Link to="/new" className="btn">
              新建条目
            </Link>
            <span className="ml-1 text-[12px] text-tertiary">
              {stats.pages} 条目 · {stats.users} 位贡献者
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
          {[
            { label: '公开条目', value: stats.pages, icon: BookOpen },
            { label: '贡献者', value: stats.users, icon: Sparkles },
            { label: '分类', value: categories.length, icon: FolderTree },
            { label: '分类内条目', value: totalCategoryPages, icon: ArrowRight },
          ].map((item) => (
            <div key={item.label} className="bg-base px-4 py-3">
              <div className="flex items-center gap-1.5 text-[12px] text-tertiary">
                <item.icon className="h-3 w-3" aria-hidden />
                {item.label}
              </div>
              <p className="mt-1 font-mono text-lg text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between border-b border-line pb-2">
            <div>
              <h2 className="font-serif text-lg font-semibold text-primary">最近更新</h2>
              <p className="text-[12px] text-tertiary">按最后编辑时间排列，含被审核通过的新版本。</p>
            </div>
            <Link to="/search" className="text-[12px] text-link">
              全部条目 →
            </Link>
          </div>

          {recentQuery.isLoading ? (
            <LoadingBlock label="正在整理最近更新…" />
          ) : recentQuery.data?.items.length ? (
            <ul className="divide-y divide-line border-b border-line">
              {recentQuery.data.items.map((page) => (
                <li key={page.id} className="group py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="font-serif text-md font-medium text-primary">
                      <Link to={`/wiki/${page.slug}`} className="hover:text-link">
                        {page.title}
                      </Link>
                    </h3>
                    {page.isProtected ? (
                      <span className="text-[12px] text-warn">受保护</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-secondary">{page.summary}</p>
                  <div className="mt-2">
                    <MetaLine page={page} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="还没有公开条目"
              description="登录后创建第一个条目，或运行种子脚本填充演示内容。"
              action={
                <Link to="/new" className="btn btn-primary">
                  新建条目
                </Link>
              }
            />
          )}
        </section>

        <aside className="space-y-6">
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-primary">分类</h2>
              <FolderTree className="h-4 w-4 text-tertiary" aria-hidden />
            </div>
            {categories.length ? (
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <Link to={`/category/${category.slug}`} className="text-sm text-primary hover:text-link">
                        {category.name}
                      </Link>
                      <span className="font-mono text-[12px] text-tertiary">{category.pageCount}</span>
                    </div>
                    {category.children.length ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-1">
                        {category.children.map((child) => (
                          <Link
                            key={child.id}
                            to={`/category/${child.slug}`}
                            className="text-[12px] text-tertiary hover:text-secondary"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-tertiary">暂无分类。</p>
            )}
            <div className="mt-3 border-t border-line pt-2">
              <Link to="/categories" className="text-[12px] text-tertiary hover:text-secondary">
                查看分类树 →
              </Link>
            </div>
          </div>

          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-primary">随机条目</h2>
              <button
                type="button"
                className="btn-ghost btn h-6 w-6 p-0"
                onClick={() => setRandomSeed((value) => value + 1)}
                aria-label="换一条"
                title="换一条"
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>
            </div>
            {randomPage ? (
              <div>
                <Link to={`/wiki/${randomPage.slug}`} className="font-serif text-sm text-primary hover:text-link">
                  {randomPage.title}
                </Link>
                <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-secondary">{randomPage.summary}</p>
                <p className="mt-2 text-[12px] text-tertiary">{randomPage.category?.name ?? '未分类'}</p>
              </div>
            ) : (
              <p className="text-[12px] text-tertiary">条目池为空。</p>
            )}
          </div>

          <div className="panel p-4 text-[12px] leading-5 text-secondary">
            <h2 className="mb-2 text-sm font-medium text-primary">参与方式</h2>
            <p>游客可自由阅读与搜索。注册用户可以评论、提交条目草稿；编辑者负责审核与直接发布。</p>
            <ul className="mt-2 space-y-1 text-tertiary">
              <li>· 新建条目对注册用户进入待审队列</li>
              <li>· 每次保存保留完整历史版本</li>
              <li>· 所有管理操作写入审计日志</li>
            </ul>
            <Link to="/login" className="mt-3 inline-block text-link">
              登录参与 →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
