import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiClientError } from '../lib/api';
import { useCaptcha } from '../lib/useCaptcha';
import { InlineError } from '../components/ui';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { login, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = searchParams.get('next') || '/';
  const reason = searchParams.get('reason');
  const { captcha, src, refresh, loading: captchaLoading } = useCaptcha();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user && !user.mustChangePassword) {
      navigate(next, { replace: true });
    }
  }, [user, next, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!captcha) {
      setError('验证码尚未加载，请稍后重试');
      return;
    }
    setPending(true);
    try {
      await login({ identifier, password, captchaId: captcha.captchaId, captchaAnswer: answer });
      navigate(next, { replace: true });
    } catch (caught) {
      const message = caught instanceof ApiClientError ? caught.message : '登录失败，请稍后再试';
      setError(message);
      setAnswer('');
      await refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo size={34} className="text-primary" />
        <div>
          <h1 className="font-serif text-xl font-semibold text-primary">登录 Atlas Wiki</h1>
          <p className="mt-1 text-sm text-secondary">继续阅读、编辑与讨论。</p>
        </div>
      </div>

      <div className="card p-5 shadow-soft">
        {reason === 'auth' ? (
          <p className="mb-4 border-l-2 border-accent bg-accent-muted px-3 py-2 text-sm text-secondary">
            登录后即可编辑。游客可以浏览与搜索站内全部公开条目。
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={submit} noValidate>
          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">用户名或邮箱</span>
            <input
              className="field"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              placeholder="admin 或 admin@atlas.local"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">密码</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" />
              <input
                type="password"
                className="field pl-8"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <div className="space-y-1">
            <span className="text-[12px] text-tertiary">图形验证码</span>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="flex h-11 w-[132px] shrink-0 items-center justify-center overflow-hidden rounded border border-strong bg-raised"
                title="点击刷新验证码"
                aria-label="刷新验证码"
              >
                {captchaLoading && !src ? (
                  <Loader2 className="h-4 w-4 animate-spin text-secondary" />
                ) : src ? (
                  <img src={src} alt="图形验证码" className="h-full w-full object-contain" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-secondary" />
                )}
              </button>
              <input
                className="field"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                maxLength={4}
                autoComplete="off"
                placeholder="4 位字符"
                aria-label="验证码"
                required
              />
              <button type="button" className="btn px-2" onClick={() => void refresh()} aria-label="换一张验证码">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[12px] text-tertiary">验证码 5 分钟内有效，验证一次后立即失效。</p>
          </div>

          <InlineError message={error} />

          <button type="submit" className="btn btn-primary w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? '登录中…' : '登录'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[12px] text-tertiary">
          <Link to="/register" className="text-link">
            还没有账号？注册
          </Link>
          <Link to="/" className="hover:text-secondary">
            以游客身份继续 →
          </Link>
        </div>
      </div>

      <details className="mt-4 rounded border border-line bg-base px-3 py-2 text-[12px] text-secondary">
        <summary className="cursor-pointer text-tertiary">演示账号（由种子数据创建）</summary>
        <ul className="mt-2 space-y-1 font-mono text-[12px]">
          <li>admin / Admin@12345 · 管理员（首次登录强制改密）</li>
          <li>editor / Editor@12345 · 编辑者</li>
          <li>wanderer / User@12345 · 注册用户</li>
        </ul>
        <p className="mt-2 flex items-center gap-1 text-tertiary">
          <ShieldCheck className="h-3.5 w-3.5" />
          连续 5 次密码错误将锁定账号 15 分钟。
        </p>
      </details>
    </div>
  );
}
