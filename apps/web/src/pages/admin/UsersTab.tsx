import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, KeyRound, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { passwordSchema } from '@atlas/shared';
import { api, ApiClientError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { AdminUserDTO } from '../../lib/adminTypes';
import { formatDateTime } from '../../lib/utils';
import { Avatar, InlineError, LoadingBlock, Modal } from '../../components/ui';

interface UsersResponse {
  users: AdminUserDTO[];
  total: number;
  page: number;
  totalPages: number;
}

const ROLE_OPTIONS: { value: AdminUserDTO['role']; label: string }[] = [
  { value: 'user', label: '注册用户' },
  { value: 'editor', label: '编辑者' },
  { value: 'admin', label: '管理员' },
];

export function UsersTab() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [resetTarget, setResetTarget] = useState<AdminUserDTO | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'users', search, page],
    queryFn: () => api<UsersResponse>(`/admin/users?search=${encodeURIComponent(search)}&page=${page}`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const roleMutation = useMutation({
    mutationFn: (payload: { id: string; role: string }) =>
      api(`/admin/users/${payload.id}/role`, { method: 'PATCH', body: { role: payload.role } }),
    onSuccess: () => {
      setNotice('角色已更新');
      setError(null);
      refresh();
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '修改角色失败'),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; status: 'active' | 'banned' }) =>
      api(`/admin/users/${payload.id}/status`, { method: 'PATCH', body: { status: payload.status } }),
    onSuccess: () => {
      setNotice('账号状态已更新');
      setError(null);
      refresh();
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '修改状态失败'),
  });

  const resetMutation = useMutation({
    mutationFn: (payload: { id: string; newPassword: string }) =>
      api(`/admin/users/${payload.id}/reset-password`, { method: 'POST', body: { newPassword: payload.newPassword } }),
    onSuccess: () => {
      setResetTarget(null);
      setNewPassword('');
      setNotice('密码已重置，用户下次登录需修改');
      setError(null);
      refresh();
    },
    onError: (caught) => setError(caught instanceof ApiClientError ? caught.message : '重置密码失败'),
  });

  if (query.isLoading) return <LoadingBlock label="正在读取用户列表…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
        <div>
          <h2 className="font-serif text-lg font-semibold text-primary">用户管理</h2>
          <p className="text-[12px] text-tertiary">共 {query.data?.total ?? 0} 个账号。角色变更、封禁与重置密码都会写入审计日志。</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary" />
            <input
              className="field h-8 w-48 pl-8 text-sm"
              placeholder="搜索用户名或邮箱"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <button type="submit" className="btn h-8">
            搜索
          </button>
        </form>
      </div>

      {notice ? <p className="border border-line bg-raised px-3 py-2 text-[12px] text-success">{notice}</p> : null}
      <InlineError message={error} />

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-raised text-[12px] text-tertiary">
            <tr>
              <th className="px-3 py-2 text-left font-medium">用户</th>
              <th className="px-3 py-2 text-left font-medium">角色</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">贡献</th>
              <th className="px-3 py-2 text-left font-medium">最近登录</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.users ?? []).map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar username={item.username} seed={item.avatarSeed} size={22} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm text-primary">
                        {item.username}
                        {item.id === me?.id ? <span className="text-[12px] text-tertiary">(我)</span> : null}
                      </p>
                      <p className="truncate text-[12px] text-tertiary">{item.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    className="field h-7 w-28 py-0 text-[12px]"
                    value={item.role}
                    disabled={item.id === me?.id || roleMutation.isPending}
                    onChange={(event) => {
                      setNotice(null);
                      roleMutation.mutate({ id: item.id, role: event.target.value });
                    }}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <span className={item.status === 'active' ? 'text-success' : 'text-danger'}>
                    {item.status === 'active' ? '正常' : '已封禁'}
                  </span>
                  {item.lockedUntil && new Date(item.lockedUntil).getTime() > Date.now() ? (
                    <span className="ml-1 text-[12px] text-warn">锁定中</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono text-[12px] text-secondary">
                  {item._count.pages} 条目 / {item._count.revisions} 版本
                </td>
                <td className="px-3 py-2.5 text-[12px] text-tertiary">
                  {item.lastLoginAt ? formatDateTime(item.lastLoginAt) : '从未登录'}
                  {item.lastLoginIp ? <span className="ml-1 font-mono text-[12px] text-disabled">{item.lastLoginIp}</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="btn h-7 px-2"
                      title="重置密码"
                      onClick={() => {
                        setResetTarget(item);
                        setNewPassword('');
                        setError(null);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    {item.status === 'active' ? (
                      <button
                        type="button"
                        className="btn btn-danger h-7 px-2"
                        title="封禁"
                        disabled={item.id === me?.id || item.role === 'admin' || statusMutation.isPending}
                        onClick={() => {
                          if (window.confirm(`确认封禁 ${item.username}？该用户将立即失去登录状态。`)) {
                            statusMutation.mutate({ id: item.id, status: 'banned' });
                          }
                        }}
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn h-7 px-2"
                        title="解封"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: item.id, status: 'active' })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {query.data?.users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-tertiary">
                  没有匹配的用户。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-[12px]">
        <button type="button" className="btn h-7" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
          上一页
        </button>
        <span className="text-tertiary">
          {query.data?.page ?? 1} / {query.data?.totalPages ?? 1}
        </span>
        <button
          type="button"
          className="btn h-7"
          disabled={page >= (query.data?.totalPages ?? 1)}
          onClick={() => setPage((value) => value + 1)}
        >
          下一页
        </button>
      </div>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`重置密码 · ${resetTarget?.username ?? ''}`}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setResetTarget(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (!resetTarget) return;
                const parsed = passwordSchema.safeParse(newPassword);
                if (!parsed.success) {
                  setError(parsed.error.issues[0]?.message ?? '密码不合规');
                  return;
                }
                resetMutation.mutate({ id: resetTarget.id, newPassword });
              }}
            >
              确认重置
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-secondary">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
            重置后该用户的所有刷新令牌会立即吊销，并在下次登录时被要求修改密码。
          </p>
          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">新密码</span>
            <input
              type="text"
              className="field font-mono"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="至少 8 位，含大小写字母与数字"
            />
          </label>
          <InlineError message={error} />
        </div>
      </Modal>
    </div>
  );
}
