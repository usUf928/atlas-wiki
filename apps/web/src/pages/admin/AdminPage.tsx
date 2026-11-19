import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  FolderTree,
  LayoutDashboard,
  ScrollText,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { ADMIN_TABS, type AdminTab } from '@atlas/shared';
import { useAuth } from '../../lib/auth';
import { ForbiddenPage, NotFoundPage } from '../ErrorPages';
import { cn } from '../../lib/utils';
import { OverviewTab } from './OverviewTab';
import { ReviewTab } from './ReviewTab';
import { UsersTab } from './UsersTab';
import { CategoriesTab } from './CategoriesTab';
import { SettingsTab } from './SettingsTab';
import { AuditTab } from './AuditTab';

const TAB_META: Record<AdminTab, { label: string; icon: typeof LayoutDashboard; adminOnly: boolean }> = {
  overview: { label: '概览', icon: LayoutDashboard, adminOnly: true },
  review: { label: '条目审核', icon: ClipboardCheck, adminOnly: false },
  users: { label: '用户管理', icon: Users, adminOnly: true },
  categories: { label: '分类管理', icon: FolderTree, adminOnly: true },
  settings: { label: '站点设置', icon: Settings, adminOnly: true },
  audit: { label: '审计日志', icon: ScrollText, adminOnly: true },
};

export function AdminPage() {
  const { user, isLoading, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') as AdminTab | null;

  if (isLoading) {
    return <div className="mx-auto max-w-[1200px] px-4 py-10 text-sm text-secondary">正在校验权限…</div>;
  }
  if (!user) return <ForbiddenPage />;
  if (user.role === 'user') return <ForbiddenPage />;

  const available = (ADMIN_TABS as readonly AdminTab[]).filter((tab) => isAdmin || tab === 'review');
  const active: AdminTab = requested && available.includes(requested) ? requested : available[0];
  if (!available.includes(active)) return <NotFoundPage />;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-tertiary">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            后台 / {user.role === 'admin' ? '管理员' : '编辑者'}
          </p>
          <h1 className="mt-1 font-serif text-xl font-semibold text-primary">管理后台</h1>
        </div>
        <Link to="/" className="btn">
          返回站点
        </Link>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="管理后台分区" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {available.map((tab) => {
            const meta = TAB_META[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setParams({ tab })}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded border border-transparent px-2.5 py-1.5 text-left text-sm',
                  active === tab
                    ? 'border-line bg-accent-muted text-primary'
                    : 'text-secondary hover:bg-raised hover:text-primary',
                )}
              >
                <meta.icon className="h-4 w-4 shrink-0" aria-hidden />
                {meta.label}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0">
          {active === 'overview' ? <OverviewTab /> : null}
          {active === 'review' ? <ReviewTab /> : null}
          {active === 'users' ? <UsersTab /> : null}
          {active === 'categories' ? <CategoriesTab /> : null}
          {active === 'settings' ? <SettingsTab /> : null}
          {active === 'audit' ? <AuditTab /> : null}
        </section>
      </div>
    </div>
  );
}
