import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { computeWordCount } from '@atlas/shared';
import { api, ApiClientError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { CategoryDTO, PageDetailDTO } from '../lib/types';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { InlineError, LoadingBlock } from '../components/ui';

interface CategoriesResponse {
  categories: CategoryDTO[];
}

interface Draft {
  title: string;
  content: string;
  summary: string;
  tags: string;
  savedAt: number;
}

function flatten(nodes: CategoryDTO[], depth = 0): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: `${'　'.repeat(depth)}${node.name}` });
    out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

export function EditPage() {
  const { slug } = useParams();
  const isNew = !slug;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isEditor, isAdmin } = useAuth();
  const initialTitle = searchParams.get('title') ?? '';

  const pageQuery = useQuery({
    queryKey: ['page-edit', slug],
    queryFn: () => api<{ page: PageDetailDTO }>(`/pages/${encodeURIComponent(slug ?? '')}`),
    enabled: !isNew,
    retry: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<CategoriesResponse>('/categories'),
    staleTime: 2 * 60_000,
  });

  const page = pageQuery.data?.page;
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initialized, setInitialized] = useState(isNew);
  const initialState = useRef<{ title: string; content: string } | null>(null);
  const draftKey = `atlas-draft:${slug ?? 'new'}`;

  useEffect(() => {
    if (!page) return;
    setTitle(page.title);
    setContent(page.content);
    setSummary(page.summary);
    setCategoryId(page.category?.id ?? '');
    setTags(page.tags.map((tag) => tag.name).join(', '));
    setIsProtected(page.isProtected);
    initialState.current = { title: page.title, content: page.content };
    setInitialized(true);
  }, [page]);

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Draft;
      if (parsed && typeof parsed.content === 'string' && parsed.content.trim()) {
        setDraft(parsed);
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!initialized) return;
    if (!content.trim() && !title.trim()) return;
    const timer = setTimeout(() => {
      const payload: Draft = { title, content, summary, tags, savedAt: Date.now() };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    }, 800);
    return () => clearTimeout(timer);
  }, [initialized, title, content, summary, tags, draftKey]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const base = initialState.current;
      const dirty = !base || base.title !== title || base.content !== content;
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [title, content]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        content,
        summary,
        categoryId: categoryId || null,
        tags: tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        editSummary: editSummary || (isNew ? '创建条目' : '内容更新'),
        isProtected,
      };
      return isNew
        ? api<{ page: PageDetailDTO; pending: boolean }>('/pages', { method: 'POST', body: payload })
        : api<{ page: PageDetailDTO; pending: boolean }>(`/pages/${encodeURIComponent(slug ?? '')}`, {
            method: 'PUT',
            body: payload,
          });
    },
    onSuccess: (data) => {
      localStorage.removeItem(draftKey);
      initialState.current = { title: data.page.title, content: data.page.content };
      navigate(`/wiki/${data.page.slug}`, { replace: true });
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? caught.message : '保存失败，请稍后再试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/pages/${encodeURIComponent(slug ?? '')}`, { method: 'DELETE' }),
    onSuccess: () => navigate('/', { replace: true }),
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '删除失败'),
  });

  const save = () => {
    setError(null);
    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    if (!content.trim()) {
      setError('正文不能为空');
      return;
    }
    if (title.trim().length > 120) {
      setError('标题最多 120 字');
      return;
    }
    saveMutation.mutate();
  };

  if (!isNew && pageQuery.isLoading) return <LoadingBlock label="正在打开编辑器…" />;
  if (!isNew && pageQuery.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <InlineError message={pageQuery.error instanceof ApiClientError ? pageQuery.error.message : '无法打开条目'} />
        <Link to="/" className="btn mt-4">
          返回首页
        </Link>
      </div>
    );
  }

  const blocked = Boolean(page?.isProtected && !isEditor);
  const wordCount = computeWordCount(content);
  const categories = flatten(categoriesQuery.data?.categories ?? []);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1 text-[12px] text-tertiary">
            <Link to="/" className="hover:text-secondary">
              首页
            </Link>
            <span aria-hidden>/</span>
            {page ? (
              <>
                <Link to={`/wiki/${page.slug}`} className="hover:text-secondary">
                  {page.title}
                </Link>
                <span aria-hidden>/</span>
              </>
            ) : null}
            <span>{isNew ? '新建条目' : '编辑'}</span>
          </div>
          <h1 className="mt-1 font-serif text-xl font-semibold text-primary">
            {isNew ? '新建条目' : `编辑：${page?.title ?? ''}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-tertiary">约 {wordCount} 字</span>
          {page && isAdmin ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('确认软删除该条目？历史版本与讨论会保留。')) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              删除
            </button>
          ) : null}
        </div>
      </div>

      {draft ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border border-line bg-raised px-3 py-2 text-[12px] text-secondary">
          <span>
            发现本地草稿（{new Date(draft.savedAt).toLocaleString('zh-CN', { hour12: false })}）：{draft.title || '无标题'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn h-7"
              onClick={() => {
                setTitle(draft.title);
                setContent(draft.content);
                setSummary(draft.summary);
                setTags(draft.tags);
                setDraft(null);
              }}
            >
              恢复草稿
            </button>
            <button
              type="button"
              className="btn h-7"
              onClick={() => {
                localStorage.removeItem(draftKey);
                setDraft(null);
              }}
            >
              丢弃
            </button>
          </div>
        </div>
      ) : null}

      {blocked ? (
        <div className="mb-4 flex items-start gap-2 border border-line bg-base px-3 py-2 text-sm text-warn">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          该条目已受保护，只有编辑者与管理员可以提交修改。
        </div>
      ) : null}

      {!isEditor && !isNew ? (
        <div className="mb-4 flex items-start gap-2 border border-line bg-base px-3 py-2 text-sm text-secondary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
          保存后修改会进入审核队列，由编辑者批准后才会替换公开版本。
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <input
            className="field mb-3 h-11 font-serif text-lg"
            placeholder="条目标题"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={blocked}
            aria-label="条目标题"
          />
          <MarkdownEditor
            value={content}
            onChange={setContent}
            onSave={save}
            saving={saveMutation.isPending}
            disabled={blocked}
            error={error}
          />
        </div>

        <aside className="space-y-4">
          <div className="panel space-y-3 p-4">
            <h2 className="text-sm font-medium text-primary">条目信息</h2>
            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">分类</span>
              <select
                className="field"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={blocked}
              >
                <option value="">未分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">标签（逗号分隔）</span>
              <input
                className="field"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="潮汐, 观测"
                disabled={blocked}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">摘要</span>
              <textarea
                className="field min-h-[72px] resize-y"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="留空时自动从正文截取"
                maxLength={240}
                disabled={blocked}
              />
              <span className="block text-right text-[12px] text-tertiary">{summary.length} / 240</span>
            </label>

            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">编辑摘要</span>
              <input
                className="field"
                value={editSummary}
                onChange={(event) => setEditSummary(event.target.value)}
                placeholder="例如：补充观测数据"
                maxLength={160}
                disabled={blocked}
              />
            </label>

            {isAdmin ? (
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={isProtected}
                  onChange={(event) => setIsProtected(event.target.checked)}
                  className="h-4 w-4 rounded-sm border-strong bg-sunken"
                />
                保护此条目（仅编辑者可修改）
              </label>
            ) : null}
          </div>

          <div className="panel p-4 text-[12px] leading-5 text-secondary">
            <h2 className="mb-2 text-sm font-medium text-primary">保存行为</h2>
            <ul className="space-y-1 text-tertiary">
              <li>· 编辑者/管理员保存后立即发布并生成新版本</li>
              <li>· 普通用户的新建与修改进入审核队列</li>
              <li>· 受保护条目仅编辑者可改</li>
              <li>· 历史版本永远不会被覆盖</li>
            </ul>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => navigate(page ? `/wiki/${page.slug}` : '/')}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saveMutation.isPending || blocked}>
              {saveMutation.isPending ? '保存中…' : isNew ? '提交条目' : '保存修改'}
            </button>
          </div>
          {user?.role === 'user' ? (
            <p className="text-[12px] leading-5 text-tertiary">
              当前为普通用户：提交后由编辑者审核，审核结果会体现在条目状态上。
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
