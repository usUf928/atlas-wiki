export class ApiClientError extends Error {
  status: number;
  code: number;
  details: unknown;

  constructor(message: string, status: number, code?: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code ?? status;
    this.details = details ?? null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const target = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const value = part.trim();
    if (value.startsWith(target)) return decodeURIComponent(value.slice(target.length));
  }
  return null;
}

let csrfPromise: Promise<void> | null = null;

async function ensureCsrf(): Promise<void> {
  if (readCookie('atlas_csrf')) return;
  if (!csrfPromise) {
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'include' })
      .then(() => undefined)
      .finally(() => {
        csrfPromise = null;
      });
  }
  await csrfPromise;
}

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrf();
      const token = readCookie('atlas_csrf');
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { 'x-csrf-token': token } : undefined,
      });
      return response.ok;
    })()
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  retry?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const retry = options.retry ?? true;

  if (method !== 'GET') {
    await ensureCsrf();
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = readCookie('atlas_csrf');
    if (token) headers['x-csrf-token'] = token;
  }

  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    | { code: number; data: unknown; message: string }
    | null;

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, { ...options, retry: false });
  }

  if (!response.ok) {
    throw new ApiClientError(payload?.message ?? '请求失败，请稍后再试', response.status, payload?.code, payload?.data);
  }

  return (payload?.data ?? null) as T;
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  await ensureCsrf();
  const form = new FormData();
  form.append('file', file);
  const token = readCookie('atlas_csrf');
  const response = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
    headers: token ? { 'x-csrf-token': token } : undefined,
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as
    | { code: number; data: { url: string }; message: string }
    | null;
  if (!response.ok) {
    throw new ApiClientError(payload?.message ?? '上传失败', response.status);
  }
  return payload?.data ?? { url: '' };
}

export function getCookie(name: string): string | null {
  return readCookie(name);
}
