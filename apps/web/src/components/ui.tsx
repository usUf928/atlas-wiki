import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-secondary', className)} aria-hidden />;
}

export function LoadingBlock({ label = '正在取回档案…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-secondary">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger' | 'success' | 'warn';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line text-secondary',
    accent: 'border-strong text-primary bg-accent-muted',
    danger: 'border-strong text-danger',
    success: 'border-strong text-success',
    warn: 'border-strong text-warn',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[12px] leading-[18px]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-line px-6 py-14 text-center">
      <p className="text-md text-primary">{title}</p>
      {description ? <p className="max-w-md text-sm text-secondary">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded border border-line bg-raised px-3 py-2 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(8,9,10,.72)] px-4 py-12">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (dismissible) onClose();
        }}
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full rounded-md border border-strong bg-overlay shadow-overlay',
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-md font-medium text-primary">{title}</h2>
          {dismissible ? (
            <button type="button" className="btn-ghost btn h-7 w-7 p-0" onClick={onClose} aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Avatar({
  username,
  seed,
  size = 24,
  square = false,
}: {
  username: string;
  seed: string;
  size?: number;
  square?: boolean;
}) {
  const palette = ['var(--accent)', 'var(--success)', 'var(--warn)', 'var(--danger)', 'var(--link)'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  const color = palette[hash % palette.length];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-strong bg-raised font-medium uppercase',
        square ? 'rounded-sm' : 'rounded',
      )}
      style={{ width: size, height: size, color, fontSize: Math.max(10, Math.round(size * 0.4)) }}
      aria-hidden
    >
      {username.slice(0, 2)}
    </span>
  );
}
