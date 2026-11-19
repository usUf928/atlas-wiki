import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SiteSettings } from '@atlas/shared';
import { api, ApiClientError } from '../../lib/api';
import { InlineError, LoadingBlock } from '../../components/ui';

interface SettingsResponse {
  settings: SiteSettings;
}

const DEFAULTS: SiteSettings = {
  siteName: 'Atlas Wiki',
  siteDescription: '',
  allowRegistration: true,
  siteFooter: '',
};

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SiteSettings>(DEFAULTS);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api<SettingsResponse>('/admin/settings'),
  });

  useEffect(() => {
    if (query.data?.settings) setForm(query.data.settings);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => api<SettingsResponse>('/admin/settings', { method: 'PUT', body: form }),
    onSuccess: () => {
      setNotice('站点设置已保存');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['site'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (caught) => {
      setNotice(null);
      setError(caught instanceof ApiClientError ? caught.message : '保存失败');
    },
  });

  if (query.isLoading) return <LoadingBlock label="正在读取站点设置…" />;

  return (
    <div className="space-y-4">
      <div className="border-b border-line pb-2">
        <h2 className="font-serif text-lg font-semibold text-primary">站点设置</h2>
        <p className="text-[12px] text-tertiary">修改会立即影响全站顶栏、页脚与注册入口。</p>
      </div>

      <div className="panel max-w-2xl space-y-4 p-4">
        <label className="block space-y-1">
          <span className="text-[12px] text-tertiary">站点名称</span>
          <input
            className="field"
            value={form.siteName}
            onChange={(event) => setForm({ ...form, siteName: event.target.value })}
            maxLength={60}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[12px] text-tertiary">站点描述</span>
          <textarea
            className="field min-h-[90px] resize-y"
            value={form.siteDescription}
            onChange={(event) => setForm({ ...form, siteDescription: event.target.value })}
            maxLength={300}
          />
          <span className="block text-right text-[12px] text-tertiary">{form.siteDescription.length} / 300</span>
        </label>

        <label className="flex items-start gap-2 border border-line bg-sunken px-3 py-2">
          <input
            type="checkbox"
            checked={form.allowRegistration}
            onChange={(event) => setForm({ ...form, allowRegistration: event.target.checked })}
            className="mt-1 h-4 w-4 rounded-sm border-strong bg-sunken"
          />
          <span>
            <span className="block text-sm text-primary">开放注册</span>
            <span className="block text-[12px] text-tertiary">
              关闭后，注册接口返回 403，登录页仍可访问，管理员可在后台创建或重置账号。
            </span>
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-[12px] text-tertiary">页脚文字</span>
          <input
            className="field"
            value={form.siteFooter}
            onChange={(event) => setForm({ ...form, siteFooter: event.target.value })}
            maxLength={160}
          />
        </label>

        {notice ? <p className="border border-line bg-raised px-3 py-2 text-[12px] text-success">{notice}</p> : null}
        <InlineError message={error} />

        <div className="flex items-center gap-2 border-t border-line pt-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? '保存中…' : '保存设置'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setForm(query.data?.settings ?? DEFAULTS)}
            disabled={mutation.isPending}
          >
            还原
          </button>
        </div>
      </div>
    </div>
  );
}
