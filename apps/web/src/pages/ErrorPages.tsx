import { Link } from 'react-router-dom';
import { ArrowLeft, FileQuestion, Lock, ServerCrash } from 'lucide-react';
import { Logo } from '../components/Logo';

function ErrorLayout({
  code,
  title,
  description,
  icon,
}: {
  code: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex items-center gap-3">
        <Logo size={28} className="text-primary" />
        <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-tertiary">Atlas Wiki</span>
      </div>
      <div className="mb-4 text-tertiary">{icon}</div>
      <p className="font-mono text-[12px] text-tertiary">{code}</p>
      <h1 className="mt-1 font-serif text-xl font-semibold text-primary">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-secondary">{description}</p>
      <div className="mt-6 flex items-center gap-2">
        <Link to="/" className="btn btn-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          回到首页
        </Link>
        <Link to="/search" className="btn">
          搜索条目
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorLayout
      code="404 / NOT FOUND"
      title="这一页没有被归档"
      description="地址可能已经变更，或者该条目尚未创建。可以回到首页，或直接以这个标题新建条目。"
      icon={<FileQuestion className="h-10 w-10" aria-hidden />}
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorLayout
      code="403 / FORBIDDEN"
      title="权限不足"
      description="当前账号没有执行该操作的权限。编辑者与管理员的能力不同，具体见角色权限矩阵。"
      icon={<Lock className="h-10 w-10" aria-hidden />}
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorLayout
      code="500 / SERVER ERROR"
      title="档案室暂时断电"
      description="服务端出现了未预期的错误。请稍后重试；如果问题持续存在，请联系管理员查看审计日志。"
      icon={<ServerCrash className="h-10 w-10" aria-hidden />}
    />
  );
}
