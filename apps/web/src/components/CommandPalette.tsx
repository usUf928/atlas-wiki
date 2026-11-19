import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, FileText, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import type { SearchHitDTO } from '../lib/types';
import { Spinner } from './ui';

interface SearchResponse {
  query: string;
  total: number;
  hits: SearchHitDTO[];
}

const QUICK_LINKS = [
  { title: '首页', description: '站点概览与最近更新', to: '/' },
  { title: '全部条目', description: '按更新时间浏览', to: '/search' },
  { title: '新建条目', description: '撰写一份新的档案', to: '/new' },
  { title: '登录 / 注册', description: '参与编辑与讨论', to: '/login' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) return;
    setValue('');
    setDebounced('');
    setSelected(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 220);
    return () => clearTimeout(timer);
  }, [value]);

  const searchQuery = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(debounced)}&limit=8`),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  });

  const hits = debounced ? searchQuery.data?.hits ?? [] : [];
  const totalItems = debounced ? hits.length + (hits.length ? 1 : 0) : QUICK_LINKS.length;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  useEffect(() => {
    if (selected >= totalItems) setSelected(0);
  }, [selected, totalItems]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(8,9,10,.72)] px-4 pt-[12vh]">
      <button type="button" aria-label="关闭搜索" className="absolute inset-0 cursor-default" onClick={onClose} tabIndex={-1} />
      <div className="relative z-10 w-full max-w-xl rounded-md border border-strong bg-overlay shadow-overlay">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((current) => (totalItems ? (current + 1) % totalItems : 0));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((current) => (totalItems ? (current - 1 + totalItems) % totalItems : 0));
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                if (!debounced) {
                  const link = QUICK_LINKS[selected];
                  if (link) go(link.to);
                  return;
                }
                const hit = hits[selected];
                if (hit) go(`/wiki/${hit.slug}`);
                else if (debounced) go(`/search?q=${encodeURIComponent(debounced)}`);
              }
            }}
            placeholder="搜索条目…"
            className="h-11 flex-1 bg-transparent text-md text-primary outline-none placeholder:text-tertiary"
            aria-label="命令面板搜索"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
          />
          {searchQuery.isFetching ? <Spinner /> : null}
          <button type="button" className="btn-ghost btn h-7 w-7 p-0" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div id="command-results" className="max-h-[52vh] overflow-y-auto py-1" role="listbox">
          {!debounced ? (
            <div>
              <p className="px-3 pb-1 pt-2 text-[12px] uppercase tracking-wider text-tertiary">快捷入口</p>
              {QUICK_LINKS.map((link, index) => (
                <button
                  key={link.to}
                  type="button"
                  role="option"
                  aria-selected={selected === index}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-raised aria-selected:bg-accent-muted"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => go(link.to)}
                >
                  <FileText className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
                  <span className="flex-1">
                    <span className="block text-sm text-primary">{link.title}</span>
                    <span className="block text-[12px] text-tertiary">{link.description}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : searchQuery.isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-secondary">正在检索…</p>
          ) : hits.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-secondary">没有匹配「{debounced}」的条目</p>
              <Link to={`/new?title=${encodeURIComponent(debounced)}`} className="mt-2 inline-block text-sm text-link">
                创建这个条目 →
              </Link>
            </div>
          ) : (
            <div>
              {hits.map((hit, index) => (
                <button
                  key={hit.slug}
                  type="button"
                  role="option"
                  aria-selected={selected === index}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => go(`/wiki/${hit.slug}`)}
                  className="block w-full px-3 py-2 text-left hover:bg-raised aria-selected:bg-accent-muted"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-primary">{hit.title}</span>
                    <span className="shrink-0 text-[12px] text-tertiary">{hit.categoryName ?? '未分类'}</span>
                  </div>
                  <span
                    className="mt-0.5 line-clamp-1 block text-[12px] text-secondary"
                    dangerouslySetInnerHTML={{ __html: hit.snippet }}
                  />
                </button>
              ))}
              <button
                type="button"
                role="option"
                aria-selected={selected === hits.length}
                className="mt-1 flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm text-link hover:bg-raised"
                onMouseEnter={() => setSelected(hits.length)}
                onClick={() => go(`/search?q=${encodeURIComponent(debounced)}`)}
              >
                <CornerDownLeft className="h-3.5 w-3.5" aria-hidden />
                查看全部结果
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[12px] text-tertiary">
          <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
          <span className="font-mono">CTRL K</span>
        </div>
      </div>
    </div>
  );
}
