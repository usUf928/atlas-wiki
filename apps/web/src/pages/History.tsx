import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, GitCompare, RotateCcw } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { DiffLineDTO, PageDetailDTO, RevisionDTO } from '../lib/types';
import { formatDateTime, formatRelative } from '../lib/utils';
import { Avatar, InlineError, LoadingBlock, Modal } from '../components/ui';
import { DiffView } from '../components/DiffView';
import { Markdown } from '../components/Markdown';

interface RevisionsResponse {
  revisions: RevisionDTO[];
}

interface DiffResponse {
  from: number;
  to: number;
  lines: DiffLineDTO[];
  stats: { added: number; removed: number };
}

export function HistoryPage() {
  const { slug = '' } = useParams();
  const { isEditor } = useAuth();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [preview, setPreview] = useState<RevisionDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageQuery = useQuery({
    queryKey: ['page-history', slug],
    queryFn: () => api<{ page: PageDetailDTO }>(`/pages/${encodeURIComponent(slug)}`),
    retry: false,
  });

  const revisionsQuery = useQuery({
    queryKey: ['revisions', slug],
    queryFn: () => api<RevisionsResponse>(`/pages/${encodeURIComponent(slug)}/revisions`),
    retry: false,
  });

  useEffect(() => {
    const list = revisionsQuery.data?.revisions;
    if (!list?.length) return;
    if (to === null) setTo(list[0].version);
    if (from === null) setFrom(list[1]?.version ?? list[0].version);
  }, [revisionsQuery.data, from, to]);

  const diffQuery = useQuery({
    queryKey: ['diff', slug, from, to],
    queryFn: () => api<DiffResponse>(`/pages/${encodeURIComponent(slug)}/diff?from=${from}&to=${to}`),
    enabled: Boolean(from && to),
    retry: false,
  });

  const revisionQuery = useQuery({
    queryKey: ['revision', slug, preview?.version],
    queryFn: () => api<{ revision: RevisionDTO }>(`/pages/${encodeURIComponent(slug)}/revisions/${preview?.version}`),
    enabled: Boolean(preview),
  });

  const revertMutation = useMutation({
    mutationFn: (version: number) =>
      api<{ version: number }>(`/pages/${encodeURIComponent(slug)}/revert/${version}`, { method: 'POST' }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['revisions', slug] });
      await queryClient.invalidateQueries({ queryKey: ['page', slug] });
      await queryClient.invalidateQueries({ queryKey: ['page-history', slug] });
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '回滚失败'),
  });

  if (revisionsQuery.isLoading) return <LoadingBlock label="正在读取版本记录…" />;

  if (revisionsQuery.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <InlineError
          message={revisionsQuery.error instanceof ApiClientError ? revisionsQuery.error.message : '版本记录加载失败'}
        />
        <Link to="/" className="btn mt-4">
          返回首页
        </Link>
      </div>
    );
  }

  const revisions = revisionsQuery.data?.revisions ?? [];
  const page = pageQuery.data?.page;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-1 text-[12px] text-tertiary">
        <Link to="/" className="hover:text-secondary">
          首页
        </Link>
        <span aria-hidden>/</span>
        <Link to={`/wiki/${slug}`} className="hover:text-secondary">
          {page?.title ?? slug}
        </Link>
        <span aria-hidden>/</span>
        <span>历史版本</span>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="font-serif text-xl font-semibold text-primary">历史版本</h1>
          <p className="mt-1 text-[12px] text-tertiary">
            {page?.title ?? slug} · 共 {revisions.length} 个已发布版本。回滚会生成新版本，不会覆盖历史。
          </p>
        </div>
        <Link to={`/wiki/${slug}`} className="btn">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回条目
        </Link>
      </div>

      <InlineError message={error} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="panel overflow-hidden">
          <div className="border-b border-line px-3 py-2 text-[12px] text-tertiary">版本列表</div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {revisions.map((revision) => (
              <li key={revision.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-primary">v{revision.version}</span>
                  <span className="text-[12px] text-tertiary">{formatRelative(revision.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-secondary">{revision.editSummary || '无摘要'}</p>
                <p className="mt-0.5 text-[12px] text-tertiary">{revision.editor?.username ?? '未知'}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[12px]">
                  <button type="button" className="inline-flex items-center gap-1 text-link hover:text-primary" onClick={() => setPreview(revision)}>
                    <Eye className="h-3 w-3" aria-hidden />
                    查看
                  </button>
                  <button
                    type="button"
                    className="text-tertiary hover:text-secondary"
                    onClick={() => {
                      setFrom(revision.version);
                      setTo(revisions[0]?.version ?? revision.version);
                    }}
                  >
                    作为对比基准
                  </button>
                  {isEditor ? (
                    <button
                      type="button"
                      className="ml-auto inline-flex items-center gap-1 text-tertiary hover:text-warn"
                      onClick={() => {
                        if (window.confirm(`确认回滚到 v${revision.version}？将生成一个新版本。`)) {
                          revertMutation.mutate(revision.version);
                        }
                      }}
                      disabled={revertMutation.isPending}
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      回滚
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <GitCompare className="h-4 w-4 text-tertiary" aria-hidden />
            <label className="flex items-center gap-1 text-[12px] text-tertiary">
              从
              <select
                className="field h-8 w-24 py-0"
                value={from ?? ''}
                onChange={(event) => setFrom(Number(event.target.value))}
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.version}>
                    v{revision.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[12px] text-tertiary">
              到
              <select
                className="field h-8 w-24 py-0"
                value={to ?? ''}
                onChange={(event) => setTo(Number(event.target.value))}
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.version}>
                    v{revision.version}
                  </option>
                ))}
              </select>
            </label>
            {diffQuery.data ? (
              <span className="ml-auto font-mono text-[12px] text-tertiary">
                <span className="text-success">+{diffQuery.data.stats.added}</span>{' '}
                <span className="text-danger">−{diffQuery.data.stats.removed}</span>
              </span>
            ) : null}
          </div>

          {diffQuery.isLoading ? (
            <LoadingBlock label="正在逐行对比…" />
          ) : diffQuery.data ? (
            <DiffView lines={diffQuery.data.lines} />
          ) : (
            <p className="border border-line px-3 py-6 text-sm text-tertiary">选择两个版本进行对比。</p>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? `版本 v${preview.version} · ${formatDateTime(preview.createdAt)}` : '版本内容'}
        width="max-w-2xl"
      >
        {revisionQuery.isLoading ? (
          <LoadingBlock label="正在读取快照…" />
        ) : revisionQuery.data?.revision ? (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="mb-3 flex items-center gap-2 text-[12px] text-tertiary">
              <Avatar
                username={revisionQuery.data.revision.editor?.username ?? 'unknown'}
                seed={revisionQuery.data.revision.editor?.avatarSeed ?? 'atlas'}
                size={20}
              />
              {revisionQuery.data.revision.editor?.username ?? '未知编辑者'}
              <span aria-hidden>·</span>
              {revisionQuery.data.revision.editSummary || '无编辑摘要'}
            </div>
            <Markdown content={revisionQuery.data.revision.content ?? ''} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
