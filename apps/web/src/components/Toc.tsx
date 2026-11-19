import { useEffect, useState } from 'react';
import type { TocItem } from '../lib/markdown';
import { cn } from '../lib/utils';

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    if (!items.length) return;
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: [0, 1] },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) {
    return <p className="text-[12px] text-tertiary">本条目没有小节。</p>;
  }

  return (
    <nav aria-label="页内目录">
      <ul className="space-y-0.5 border-l border-line">
        {items.map((item) => (
          <li key={`${item.id}-${item.level}`}>
            <a
              href={`#${item.id}`}
              data-active={active === item.id}
              className={cn(
                'toc-link -ml-px block border-l-2 border-transparent py-1 text-[12px] leading-5 text-tertiary transition-colors hover:text-secondary hover:no-underline',
                item.level === 3 ? 'pl-5' : 'pl-3',
                active === item.id && 'text-primary',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
