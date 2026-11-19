import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Reply, Trash2 } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { CommentDTO } from '../lib/types';
import { formatDateTime } from '../lib/utils';
import { Avatar, InlineError, Spinner } from './ui';
import { Markdown } from './Markdown';

interface CommentsResponse {
  comments: CommentDTO[];
}

function CommentItem({
  comment,
  slug,
  onReply,
  canDelete,
  onDelete,
  deleting,
}: {
  comment: CommentDTO;
  slug: string;
  onReply: (comment: CommentDTO) => void;
  canDelete: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <li className="border-t border-line py-4 first:border-t-0">
      <div className="flex gap-3">
        {comment.user ? (
          <Avatar username={comment.user.username} seed={comment.user.avatarSeed} size={26} square />
        ) : (
          <span className="h-[26px] w-[26px] rounded-sm border border-line bg-raised" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-tertiary">
            {comment.user ? (
              <Link to={`/u/${comment.user.username}`} className="text-secondary hover:text-primary">
                {comment.user.username}
              </Link>
            ) : (
              <span>已注销用户</span>
            )}
            {comment.user?.role === 'admin' ? <span className="text-warn">管理员</span> : null}
            {comment.user?.role === 'editor' ? <span className="text-accent">编辑者</span> : null}
            <span aria-hidden>·</span>
            <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
          </div>

          {comment.status === 'deleted' ? (
            <p className="mt-1 text-sm italic text-disabled">该评论已被管理员删除。</p>
          ) : (
            <div className="mt-1 text-sm">
              <Markdown content={comment.content} className="!text-sm [&_p]:my-1 [&_h2]:text-md" />
            </div>
          )}

          {comment.status === 'visible' ? (
            <div className="mt-1.5 flex items-center gap-3 text-[12px]">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-tertiary hover:text-secondary"
                onClick={() => onReply(comment)}
              >
                <Reply className="h-3 w-3" aria-hidden />
                回复
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-tertiary hover:text-danger"
                  onClick={() => onDelete(comment.id)}
                  disabled={deleting}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  删除
                </button>
              ) : null}
            </div>
          ) : null}

          {comment.replies.length ? (
            <ul className="mt-3 space-y-3 border-l border-line pl-4">
              {comment.replies.map((reply) => (
                <li key={reply.id}>
                  <div className="flex gap-2">
                    {reply.user ? (
                      <Avatar username={reply.user.username} seed={reply.user.avatarSeed} size={22} square />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-tertiary">
                        {reply.user ? (
                          <Link to={`/u/${reply.user.username}`} className="text-secondary hover:text-primary">
                            {reply.user.username}
                          </Link>
                        ) : (
                          <span>已注销用户</span>
                        )}
                        <span aria-hidden>·</span>
                        <time dateTime={reply.createdAt}>{formatDateTime(reply.createdAt)}</time>
                      </div>
                      {reply.status === 'deleted' ? (
                        <p className="mt-1 text-sm italic text-disabled">该回复已被管理员删除。</p>
                      ) : (
                        <div className="mt-1 text-sm">
                          <Markdown content={reply.content} className="!text-sm [&_p]:my-1" />
                        </div>
                      )}
                      {reply.status === 'visible' && canDelete ? (
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 text-[12px] text-tertiary hover:text-danger"
                          onClick={() => onDelete(reply.id)}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function Comments({ slug }: { slug: string }) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<CommentDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const commentsQuery = useQuery({
    queryKey: ['comments', slug],
    queryFn: () => api<CommentsResponse>(`/pages/${slug}/comments`),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      api(`/pages/${slug}/comments`, {
        method: 'POST',
        body: { content, parentId: replyTo?.id ?? null },
      }),
    onSuccess: () => {
      setContent('');
      setReplyTo(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['comments', slug] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? caught.message : '评论发布失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/comments/${id}`, { method: 'DELETE' }),
    onMutate: () => setDeleting(true),
    onSettled: () => setDeleting(false),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', slug] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiClientError ? caught.message : '删除失败');
    },
  });

  const submit = () => {
    if (!content.trim()) {
      setError('评论内容不能为空');
      return;
    }
    if (content.length > 4000) {
      setError('评论最多 4000 字');
      return;
    }
    setError(null);
    postMutation.mutate();
  };

  return (
    <section id="comments" className="mt-12 max-w-prose border-t border-line pt-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-tertiary" aria-hidden />
        <h2 className="font-serif text-lg font-semibold text-primary">讨论</h2>
        <span className="font-mono text-[12px] text-tertiary">{(commentsQuery.data?.comments ?? []).length}</span>
      </div>

      {commentsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-secondary">
          <Spinner />
          正在取回讨论…
        </div>
      ) : commentsQuery.data?.comments.length ? (
        <ul className="border-b border-line">
          {commentsQuery.data.comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              slug={slug}
              onReply={setReplyTo}
              canDelete={isAdmin}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleting}
            />
          ))}
        </ul>
      ) : (
        <p className="border-y border-line py-5 text-sm text-tertiary">还没有讨论。登录后留下第一条评论。</p>
      )}

      <div className="mt-5">
        {user ? (
          <div className="space-y-2">
            {replyTo ? (
              <div className="flex items-center justify-between border border-line bg-raised px-3 py-1.5 text-[12px] text-secondary">
                <span>正在回复 {replyTo.user?.username ?? '该评论'}</span>
                <button type="button" className="text-tertiary hover:text-primary" onClick={() => setReplyTo(null)}>
                  取消
                </button>
              </div>
            ) : null}
            <textarea
              className="field min-h-[96px] resize-y"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="支持 Markdown，讨论请保持具体的观察与证据。"
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-tertiary">{content.length} / 4000</span>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={postMutation.isPending}>
                {postMutation.isPending ? '发布中…' : replyTo ? '发布回复' : '发布评论'}
              </button>
            </div>
            <InlineError message={error} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-line bg-base px-3 py-3 text-sm text-secondary">
            <span>登录后即可参与讨论。</span>
            <Link to="/login" className="btn">
              登录
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
