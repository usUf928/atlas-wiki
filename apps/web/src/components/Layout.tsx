import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useSite, FALLBACK_SITE } from '../lib/site';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { Logo } from './Logo';

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

function Footer() {
  const site = useSite();
  const settings = site.data?.settings ?? FALLBACK_SITE.settings;
  const stats = site.data?.stats ?? FALLBACK_SITE.stats;
  return (
    <footer className="mt-16 border-t border-line bg-sunken">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Logo size={20} />
            <span className="text-sm font-medium">{settings.siteName}</span>
          </div>
          <p className="text-[12px] leading-5 text-tertiary">{settings.siteFooter}</p>
          <p className="font-mono text-[12px] text-disabled">
            {stats.pages} 条目 · {stats.users} 位贡献者
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-[12px] sm:grid-cols-3">
          <Link to="/" className="text-tertiary hover:text-secondary">
            首页
          </Link>
          <Link to="/search" className="text-tertiary hover:text-secondary">
            搜索
          </Link>
          <Link to="/new" className="text-tertiary hover:text-secondary">
            新建条目
          </Link>
          <Link to="/login" className="text-tertiary hover:text-secondary">
            登录
          </Link>
          <Link to="/register" className="text-tertiary hover:text-secondary">
            注册
          </Link>
          <Link to="/403" className="text-tertiary hover:text-secondary">
            权限说明
          </Link>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 py-3 text-[12px] text-disabled sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Atlas Wiki · 自托管 · 无追踪 · 无外部字体 CDN</span>
          <span className="font-mono">默认深色 · 内容优先</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-sunken">
      <ScrollToTop />
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      {user?.mustChangePassword ? <ChangePasswordDialog /> : null}
    </div>
  );
}
