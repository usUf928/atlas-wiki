import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Eye, FileText, MessageSquare, PenLine, Users } from 'lucide-react';
import { AUDIT_ACTION_LABELS, type AuditAction } from '@atlas/shared';
import { api } from '../../lib/api';
import type { AdminStats } from '../../lib/types';
import { formatRelative } from '../../lib/utils';
import { LoadingBlock } from '../../components/ui';

function Sparkline({ data }: { data: { label: string; count: number }[] }) {
  const width = 560;
  const height = 140;
  const paddingX = 24;
  const paddingTop = 16;
  const paddingBottom = 28;
  const max = Math.max(1, ...data.map((item) => item.count));
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;
  const step = data.length > 1 ? usableWidth / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const x = paddingX + step * index;
    const y = paddingTop + usableHeight - (item.count / max) * usableHeight;
    return { x, y, ...item };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${paddingX},${paddingTop + usableHeight} ${line} ${paddingX + usableWidth},${paddingTop + usableHeight}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近 7 天编辑趋势" className="w-full">
      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          x1={paddingX}
          x2={width - paddingX}
          y1={paddingTop + usableHeight * ratio}
          y2={paddingTop + usableHeight * ratio}
          stroke="var(--border-subtle)"
          strokeWidth="1"
        />
      ))}
      <polygon points={area} fill="var(--accent-muted)" stroke="none" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="2.5" fill="var(--accent)" />
          <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">
            {point.label}
          </text>
          {point.count > 0 ? (
            <text x={point.x} y={point.y - 7} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
              {point.count}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function OverviewTab() {
  const query = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api<AdminStats>('/admin/stats'),
  });

  if (query.isLoading) return <LoadingBlock label="正在汇总站点数据…" />;
  if (!query.data) return <p className="text-sm text-danger">概览数据加载失败。</p>;

  const { counts, trend, recentLogs } = query.data;
  const cards = [
    { label: '公开条目', value: counts.pages, icon: FileText, to: '/search' },
    { label: '活跃用户', value: counts.users, icon: Users, to: '/admin?tab=users' },
    { label: '待审条目', value: counts.pending, icon: Activity, to: '/admin?tab=review' },
    { label: '可见评论', value: counts.comments, icon: MessageSquare, to: '/search' },
    { label: '历史版本', value: counts.revisions, icon: PenLine, to: '/search' },
    { label: '累计浏览', value: counts.views, icon: Eye, to: '/search' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className="block bg-base px-4 py-3 hover:bg-raised hover:no-underline">
            <div className="flex items-center gap-1.5 text-[12px] text-tertiary">
              <card.icon className="h-3.5 w-3.5" aria-hidden />
              {card.label}
            </div>
            <p className="mt-1 font-mono text-xl text-primary">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="panel p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-medium text-primary">最近 7 天编辑趋势</h2>
            <span className="font-mono text-[12px] text-tertiary">每日版本数</span>
          </div>
          <Sparkline data={trend} />
        </div>

        <div className="panel p-4">
          <h2 className="mb-2 text-sm font-medium text-primary">最近审计记录</h2>
          {recentLogs.length ? (
            <ul className="space-y-2">
              {recentLogs.map((log) => (
                <li key={log.id} className="border-b border-line pb-2 last:border-0 last:pb-0">
                  <p className="text-[12px] text-secondary">
                    <span className="text-primary">{log.actor?.username ?? '系统'}</span>{' '}
                    {AUDIT_ACTION_LABELS[log.action as AuditAction] ?? log.action}
                  </p>
                  <p className="text-[12px] text-tertiary">
                    {log.targetType ?? '—'} · {formatRelative(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-tertiary">暂无记录。</p>
          )}
          <Link to="/admin?tab=audit" className="mt-3 inline-block text-[12px] text-link">
            查看全部日志 →
          </Link>
        </div>
      </div>
    </div>
  );
}
