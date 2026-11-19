import { isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { api } from '../lib/api';
import { headingId, normalizeTitle, resolveWikiLinks, sanitizeSchema } from '../lib/markdown';
import { highlightCode } from '../lib/shiki';
import { cn } from '../lib/utils';

interface PageIndexResponse {
  pages: { slug: string; title: string }[];
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    highlightCode(code, lang).then((result) => {
      if (alive) setHtml(result);
    });
    return () => {
      alive = false;
    };
  }, [code, lang]);

  return (
    <div className="group relative my-5">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        <span className="rounded-sm border border-line bg-base px-1.5 py-0.5 font-mono text-[12px] text-tertiary">
          {lang}
        </span>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-sm border border-line bg-base text-tertiary opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="复制代码"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="!my-0">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const indexQuery = useQuery({
    queryKey: ['page-index'],
    queryFn: () => api<PageIndexResponse>('/pages/index'),
    staleTime: 5 * 60_000,
  });

  const prepared = useMemo(() => {
    const map = new Map<string, string>();
    for (const page of indexQuery.data?.pages ?? []) {
      map.set(normalizeTitle(page.title), page.slug);
      map.set(normalizeTitle(page.slug), page.slug);
    }
    return resolveWikiLinks(content, map);
  }, [content, indexQuery.data]);

  return (
    <div className={cn('wiki-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          h1: ({ children }) => <h1 id={headingId(textOf(children))}>{children}</h1>,
          h2: ({ children }) => <h2 id={headingId(textOf(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
          h4: ({ children }) => <h4 id={headingId(textOf(children))}>{children}</h4>,
          a: ({ href, children, title }) => {
            const target = href ?? '#';
            if (target.startsWith('/wiki/') || target.startsWith('/category/') || target.startsWith('/tags/')) {
              return (
                <Link to={target} title={title}>
                  {children}
                </Link>
              );
            }
            if (target.startsWith('/new?title=')) {
              return (
                <Link to={target} className="wiki-new" title="该条目尚未创建">
                  {children}
                </Link>
              );
            }
            if (target.startsWith('#')) {
              return (
                <a href={target} title={title}>
                  {children}
                </a>
              );
            }
            return (
              <a href={target} title={title} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            <img src={typeof src === 'string' ? src : ''} alt={alt ?? ''} loading="lazy" />
          ),
          pre: ({ children }) => {
            const child = Array.isArray(children) ? children[0] : children;
            if (isValidElement(child)) {
              const props = child.props as { className?: string; children?: ReactNode };
              const match = /language-([\w-]+)/.exec(props.className ?? '');
              const code = textOf(props.children).replace(/\n$/, '');
              return <CodeBlock code={code} lang={match?.[1] ?? 'text'} />;
            }
            return <pre>{children}</pre>;
          },
          code: ({ className, children }) => <code className={className}>{children}</code>,
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
