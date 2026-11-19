import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

interface CaptchaState {
  captchaId: string;
  svg: string;
}

export function useCaptcha() {
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<CaptchaState>('/auth/captcha');
      setCaptcha(data);
    } catch {
      setCaptcha(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const src = captcha ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captcha.svg)}` : '';

  return { captcha, src, loading, refresh };
}
