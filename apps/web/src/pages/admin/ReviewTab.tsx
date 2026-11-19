import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, FileEdit, X } from 'lucide-react';
import { api, ApiClientError } from '../../lib/api';
import type { ReviewItemDTO } from '../../lib/adminTypes';
import { formatDateTime } from '../../lib/utils';
import { Avatar, EmptyState, InlineError, LoadingBlock, Modal } from '../../components/ui';

interface ReviewResponse {
  items: ReviewItemDTO[];
}

function plainExcerpt(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' [代码块] ')
    .replace(/[#>*`_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function ReviewTab() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<{ item: ReviewItemDTO; decision: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'review'],
    queryFn: () => api<ReviewResponse>('/admin/review'),
  });

  const mutation = useMutation({
    mutationFn: (payload: { id: string; decision: 'approve' | 'reject'; reason: string }) =>
      api(`/admin/review/${payload.id}`, {
        method: 'POST',
        body: { decision: payload.decision, reason: payload.reason },
      }),
    onSuccess: () => {
      setTarget(null);
      setReason('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'review'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? caught.message : '操作失败');
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  if (query.isLoading) return <LoadingBlock label="正在读取审核队列…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between border-b border-line pb-2">
        <div>
          <h2 className="font-serif text-lg font-semibold text-primary">条目审核</h2>
          <p className="text-[12px] text-tertiary">
            注册用户的新建与修改在这里排队；通过后立即发布并生成版本，驳回需填写理由。
          </p>
        </div>
        <span className="font-mono text-[12px] text-tertiary">{items.length} 待审</span>
      </div>

      <InlineError message={error} />

      {items.length === 0 ? (
        <EmptyState title="队列已清空" description="目前没有等待审核的条目。" />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-md text-primary">{item.title}</h3>
                    <span className="rounded-sm border border-line px-1.5 py-0.5 text-[12px] text-secondary">
                      {item.isEdit ? '修改' : '新建'}
                    </span>
                    {item.category ? <span className="text-[12px] text-tertiary">{item.category.name}</span> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-tertiary">
                    提交者 {item.pendingAuthor?.username ?? item.author?.username ?? '未知'} ·{' '}
                    {formatDateTime(item.updatedAt)}
                    {item.isEdit && item.currentTitle !== item.title ? ` · 原题：${item.currentTitle}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/wiki/${item.slug}`} className="btn h-7" target="_blank">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    查看页面
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary h-7"
                    onClick={() => {
                      setTarget({ item, decision: 'approve' });
                      setReason('');
                    }}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    通过
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger h-7"
                    onClick={() => {
                      setTarget({ item, decision: 'reject' });
                      setReason('');
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    驳回
                  </button>
                </div>
              </div>

              {item.editSummary ? (
                <p className="mt-2 flex items-center gap-1 text-[12px] text-secondary">
                  <FileEdit className="h-3 w-3 text-tertiary" aria-hidden />
                  编辑摘要：{item.editSummary}
                </p>
              ) : null}

              <p className="mt-2 max-h-24 overflow-hidden border-l-2 border-line pl-3 text-[12px] leading-5 text-secondary">
                {plainExcerpt(item.content)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target?.decision === 'approve' ? '通过审核' : '驳回提交'}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setTarget(null)}>
              取消
            </button>
            <button
              type="button"
              className={target?.decision === 'approve' ? 'btn btn-primary' : 'btn btn-danger'}
              onClick={() => {
                if (!target) return;
                if (target.decision === 'reject' && !reason.trim()) {
                  setError('驳回时请填写理由');
                  return;
                }
                mutation.mutate({ id: target.item.id, decision: target.decision, reason: reason.trim() });
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? '处理中…' : target?.decision === 'approve' ? '确认发布' : '确认驳回'}
            </button>
          </>
        }
      >
        {target ? (
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              {target.decision === 'approve'
                ? `将通过「${target.item.title}」并写入公开版本。`
                : '驳回后，修改型提交会回到已发布版本；新建型提交会退回草稿。'}
            </p>
            <label className="block space-y-1">
              <span className="text-[12px] text-tertiary">{target.decision === 'approve' ? '备注（可选）' : '驳回理由'}</span>
              <textarea
                className="field min-h-[90px] resize-y"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                placeholder={target.decision === 'approve' ? '例如：资料完整，格式符合规范' : '例如：缺少来源，内链无效'}
              />
            </label>
            <div className="flex items-center gap-2 text-[12px] text-tertiary">
              <Avatar
                username={target.item.pendingAuthor?.username ?? 'unknown'}
                seed={target.item.pendingAuthor?.username ?? 'atlas'}
                size={18}
              />
              {target.item.pendingAuthor?.username ?? '未知提交者'}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
