import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { SiteInfo } from './types';

export function useSite() {
  return useQuery({
    queryKey: ['site'],
    queryFn: () => api<SiteInfo>('/site'),
    staleTime: 5 * 60_000,
  });
}

export const FALLBACK_SITE: SiteInfo = {
  settings: {
    siteName: 'Atlas Wiki',
    siteDescription: '一座低照度的中文知识档案馆，收录基础设施、设计系统与自然志的长期笔记。',
    allowRegistration: true,
    siteFooter: 'Atlas Wiki · 内容以 CC BY-SA 4.0 共享',
  },
  stats: { pages: 0, users: 0 },
};
