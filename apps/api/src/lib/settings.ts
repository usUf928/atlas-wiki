import { prisma } from '../db.js';
import type { SiteSettings } from '@atlas/shared';

const DEFAULTS: SiteSettings = {
  siteName: 'Atlas Wiki',
  siteDescription: '一座低照度的中文知识档案馆，收录基础设施、设计系统与自然志的长期笔记。',
  allowRegistration: true,
  siteFooter: 'Atlas Wiki · 内容以 CC BY-SA 4.0 共享',
};

export async function getSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    siteName: map.get('siteName') ?? DEFAULTS.siteName,
    siteDescription: map.get('siteDescription') ?? DEFAULTS.siteDescription,
    allowRegistration: (map.get('allowRegistration') ?? 'true') === 'true',
    siteFooter: map.get('siteFooter') ?? DEFAULTS.siteFooter,
  };
}

export async function saveSettings(input: SiteSettings): Promise<SiteSettings> {
  const entries: Array<[string, string]> = [
    ['siteName', input.siteName],
    ['siteDescription', input.siteDescription],
    ['allowRegistration', String(input.allowRegistration)],
    ['siteFooter', input.siteFooter ?? ''],
  ];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  return getSettings();
}
