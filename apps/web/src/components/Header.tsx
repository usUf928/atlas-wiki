import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Plus, Search, Shield, User as UserIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useSite, FALLBACK_SITE } from '../lib/site';
import { Avatar } from './ui';
import { Logo } from './Logo';

export function Header({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { user, logout, isAdmin } = useAuth();
  const site = useSite();
  const settings = site.data?.settings ?? FALLBACK_SITE.settings;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <header className="header-blur sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-primary hover:no-underline" aria-label={settings.siteName}>
          <Logo size={26} />
          <span className="hidden text-[16px] font-semibold tracking-wide sm:inline">{settings.siteName}</span>
          <span className="hidden text-[12px] text-tertiary lg:inline">低照度档案馆</span>
        </Link>

        <button
          type="button"
          onClick={onOpenSearch}
          className="group ml-2 flex h-8 flex-1 items-center gap-2 rounded border border-line bg-sunken px-3 text-left text-sm text-tertiary transition-colors hover:border-strong hover:text-secondary sm:max-w-[420px]"
          aria-label="搜索条目"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 truncate">搜索条目、标签或正文…</span>
          <kbd className="hidden rounded-sm border border-line px-1 font-mono text-[12px] text-tertiary sm:inline">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/new" className="btn hidden sm:inline-flex">
            <Plus className="h-4 w-4" aria-hidden />
            新建条目
          </Link>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-8 items-center gap-2 rounded border border-transparent px-1.5 hover:border-line hover:bg-raised"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar username={user.username} seed={user.avatarSeed} size={22} />
                <span className="hidden max-w-[96px] truncate text-sm text-secondary md:inline">{user.username}</span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 rounded border border-strong bg-overlay py-1 shadow-overlay"
                >
                  <div className="border-b border-line px-3 py-2">
                    <p className="text-sm text-primary">{user.username}</p>
                    <p className="text-[12px] text-tertiary">{user.email}</p>
                  </div>
                  <Link
                    to={`/u/${user.username}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:bg-raised hover:no-underline"
                    onClick={() => setMenuOpen(false)}
                  >
                    <UserIcon className="h-4 w-4" aria-hidden />
                    我的主页
                  </Link>
                  {isAdmin ? (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:bg-raised hover:no-underline"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Shield className="h-4 w-4" aria-hidden />
                      管理后台
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-secondary hover:bg-raised"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn">
                登录
              </Link>
              <Link to="/register" className="btn btn-primary hidden sm:inline-flex">
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
