import { defaultSchema } from 'rehype-sanitize';

export function headingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()#!]/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(markdown: string): TocItem[] {
  const lines = markdown.split('\n');
  const headings: TocItem[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[*_`~]/g, '').trim();
    if (!text) continue;
    headings.push({ id: headingId(text), text, level: match[1].length });
  }
  return headings;
}

export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, '').trim().toLowerCase();
}

export function resolveWikiLinks(markdown: string, titleToSlug: Map<string, string>): string {
  return markdown.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_match, target: string, label: string | undefined) => {
    const name = target.trim();
    const display = (label ?? name).trim();
    const slug = titleToSlug.get(normalizeTitle(name)) ?? titleToSlug.get(normalizeTitle(name.replace(/\s+/g, '-')));
    if (slug) {
      return `[${display}](/wiki/${slug})`;
    }
    return `[${display}](/new?title=${encodeURIComponent(name)})`;
  });
}

export const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'figure', 'figcaption'],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'className', 'target', 'rel'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./]],
    pre: [...(defaultSchema.attributes?.pre ?? []), 'className'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'width', 'height'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
    mark: [],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
};
