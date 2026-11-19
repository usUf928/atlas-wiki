import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '../../lib/api';
import type { AuditLogDTO } from '../../lib/adminTypes';
import { formatDateTime } from '../../lib/utils';
import { LoadingBlock } from '../../components/ui';

interface AuditResponse {
  logs: AuditLogDTO[];
  total: number;
  page: number;
  totalPages: number;
  actions: { value: string; label: string }[];
}

export function AuditTab() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'audit', action, page],
    queryFn: () => api<AuditResponse>(`/admin/audit-logs?action=${encodeURIComponent(action)}&page=${page}`),
  });

  if (query.isLoading) return <LoadingBlock label="正在读取审计日志…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-primary">
            <ScrollText className="h-4 w-4 text-tertiary" aria-hidden />
            审计日志
          </h2>
          <p className="text-[12px] text-tertiary">只读记录：登录、注册、角色变更、删除、回滚、审核与设置修改。</p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-tertiary">
          操作类型
          <select
            className="field h-8 w-40 py-0 text-[12px]"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部</option>
            {(query.data?.actions ?? []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-raised text-[12px] text-tertiary">
            <tr>
              <th className="px-3 py-2 text-left font-medium">时间</th>
              <th className="px-3 py-2 text-left font-medium">操作者</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
              <th className="px-3 py-2 text-left font-medium">对象</th>
              <th className="px-3 py-2 text-left font-medium">详情</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.logs ?? []).map((log) => (
              <tr key={log.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-tertiary">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-3 py-2 text-[12px] text-secondary">{log.actor?.username ?? '系统'}</td>
                <td className="px-3 py-2 text-[12px] text-primary">{log.actionLabel}</td>
                <td className="px-3 py-2 text-[12px] text-tertiary">
                  {log.targetType ?? '—'}
                  {log.targetId ? <span className="ml-1 font-mono text-disabled">{log.targetId.slice(0, 8)}</span> : null}
                </td>
                <td className="max-w-[280px] px-3 py-2">
                  {log.detail ? (
                    <code className="block break-all font-mono text-[12px] leading-5 text-secondary">
                      {JSON.stringify(log.detail)}
                    </code>
                  ) : (
                    <span className="text-[12px] text-disabled">—</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-tertiary">{log.ip ?? '—'}</td>
              </tr>
            ))}
            {query.data?.logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-tertiary">
                  没有匹配的日志。
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
          {query.data?.page ?? 1} / {query.data?.totalPages ?? 1} · 共 {query.data?.total ?? 0} 条
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
    </div>
  );
}
