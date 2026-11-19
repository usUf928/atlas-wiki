import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { passwordSchema, passwordStrength, registerSchema, usernameSchema, emailSchema } from '@atlas/shared';
import { useAuth } from '../lib/auth';
import { ApiClientError } from '../lib/api';
import { useCaptcha } from '../lib/useCaptcha';
import { useSite } from '../lib/site';
import { InlineError } from '../components/ui';
import { cn } from '../lib/utils';

export function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const site = useSite();
  const { captcha, src, refresh, loading: captchaLoading } = useCaptcha();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const allowRegistration = site.data?.settings.allowRegistration ?? true;
  const strength = passwordStrength(password);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const local = {
      username: usernameSchema.safeParse(username),
      email: emailSchema.safeParse(email),
      password: passwordSchema.safeParse(password),
    };
    const nextErrors: Record<string, string> = {};
    if (!local.username.success) nextErrors.username = local.username.error.issues[0]?.message ?? '用户名不合规';
    if (!local.email.success) nextErrors.email = local.email.error.issues[0]?.message ?? '邮箱不合规';
    if (!local.password.success) nextErrors.password = local.password.error.issues[0]?.message ?? '密码不合规';
    if (password !== confirmPassword) nextErrors.confirmPassword = '两次输入的密码不一致';
    if (!captcha) nextErrors.captcha = '验证码尚未加载';
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    const parsed = registerSchema.safeParse({
      username,
      email,
      password,
      confirmPassword,
      captchaId: captcha?.captchaId,
      captchaAnswer: answer,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0]) setFieldErrors({ [String(issue.path[0])]: issue.message });
      return;
    }

    setPending(true);
    try {
      await register(parsed.data);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : '注册失败，请稍后再试');
      setAnswer('');
      await refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="font-serif text-xl font-semibold text-primary">注册账号</h1>
        <p className="mt-1 text-sm text-secondary">注册后可以评论；新建与编辑需经编辑者审核。</p>
      </div>

      <div className="card p-5 shadow-soft">
        {!allowRegistration ? (
          <div className="mb-4 border-l-2 border-warn bg-raised px-3 py-2 text-sm text-warn">
            站点当前已关闭注册，请联系管理员开通账号。
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={submit} noValidate>
          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">用户名</span>
            <input
              className="field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="4–20 位字母、数字或下划线"
              autoComplete="username"
              disabled={!allowRegistration}
            />
            {fieldErrors.username ? <span className="text-[12px] text-danger">{fieldErrors.username}</span> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">邮箱</span>
            <input
              type="email"
              className="field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={!allowRegistration}
            />
            {fieldErrors.email ? <span className="text-[12px] text-danger">{fieldErrors.email}</span> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">密码</span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位，含大小写字母与数字"
              autoComplete="new-password"
              disabled={!allowRegistration}
            />
            <div className="flex items-center gap-2 pt-1">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={cn('h-1 flex-1 rounded-sm', index < strength.score ? 'bg-accent' : 'bg-line')}
                  />
                ))}
              </div>
              <span className="w-10 text-right text-[12px] text-tertiary">{strength.label}</span>
            </div>
            {fieldErrors.password ? <span className="text-[12px] text-danger">{fieldErrors.password}</span> : null}
          </label>

          <label className="block space-y-1">
            <span className="text-[12px] text-tertiary">确认密码</span>
            <input
              type="password"
              className="field"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={!allowRegistration}
            />
            {fieldErrors.confirmPassword ? (
              <span className="text-[12px] text-danger">{fieldErrors.confirmPassword}</span>
            ) : null}
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
                disabled={!allowRegistration}
              />
              <button type="button" className="btn px-2" onClick={() => void refresh()} aria-label="换一张验证码">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {fieldErrors.captcha ? <span className="text-[12px] text-danger">{fieldErrors.captcha}</span> : null}
          </div>

          <InlineError message={error} />

          <button type="submit" className="btn btn-primary w-full" disabled={pending || !allowRegistration}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? '创建中…' : '注册并登录'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[12px] text-tertiary">
          <Link to="/login" className="text-link">
            已有账号？登录
          </Link>
          <Link to="/" className="hover:text-secondary">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
