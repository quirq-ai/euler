"use client";

import { useEffect, useState } from "react";

// The contents list. On wide screens it sits sticky beside the article and follows the
// reader with an IntersectionObserver; elsewhere it folds into a details box.

export interface ContentsItem {
  id: string;
  label: string;
  depth?: 0 | 1;
  count?: number;
}

function useActive(key: string): string {
  const [active, setActive] = useState(key.split("|")[0] ?? "");

  useEffect(() => {
    const els = key
      .split("|")
      .map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    // The last footer on the page is only fully in view at the very bottom.
    const foot = [...document.querySelectorAll("footer")].pop();

    // Whichever heading last crossed a line just below the sticky header. At the very
    // bottom the line drops, so short closing sections still light up.
    const line = Math.min(160, window.innerHeight * 0.3);
    const pick = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const at = atBottom && window.scrollY > 0 ? window.innerHeight * 0.7 : line;
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= at) current = el.id;
      setActive(current);
    };

    const io = new IntersectionObserver(pick, { rootMargin: `0px 0px -${Math.round(window.innerHeight - line)}px 0px`, threshold: [0, 1] });
    const tail = new IntersectionObserver(pick, { threshold: [0, 0.5, 1] });
    els.forEach((el) => io.observe(el));
    if (foot) tail.observe(foot);
    pick();
    return () => {
      io.disconnect();
      tail.disconnect();
    };
  }, [key]);

  return active;
}

export function ContentsNav({ items, title = "Contents" }: { items: ContentsItem[]; title?: string }) {
  const active = useActive(items.map((i) => i.id).join("|"));
  return (
    <nav aria-label={title} className="sticky top-[88px] max-h-[calc(100dvh-112px)] overflow-y-auto overscroll-contain pb-6 pr-2 [scrollbar-width:thin]">
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.13em] text-muted">{title}</div>
      <ol className="border-l border-line">
        {items.map((it) => {
          const on = it.id === active;
          return (
            <li key={it.id} className="relative">
              {on && <span aria-hidden className="absolute -left-px top-1 bottom-1 w-[2px] rounded-full bg-ink" />}
              <a
                href={`#${it.id}`}
                aria-current={on ? "location" : undefined}
                className={`flex items-baseline gap-2 py-[5px] leading-snug transition-colors ${it.depth ? "pl-6 text-[12.5px]" : "pl-3.5 text-[13.5px]"} ${
                  on ? "font-medium text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <span className="min-w-0 flex-1">{it.label}</span>
                {it.count !== undefined && <span className="font-mono text-[11px] tabular-nums text-muted">{it.count}</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The same list for narrow screens, folded by default. */
export function ContentsBox({ items, title = "Contents", className = "" }: { items: ContentsItem[]; title?: string; className?: string }) {
  return (
    <details className={`group rounded-xl border border-line bg-surface/60 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-muted">{title}</span>
        <svg aria-hidden width="12" height="12" viewBox="0 0 10 10" className="text-muted transition-transform group-open:rotate-180">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ol className="border-t border-line px-4 py-2.5">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className={`flex items-baseline gap-2 py-1 text-ink-2 hover:text-ink ${it.depth ? "pl-4 text-[13px]" : "text-[14px]"}`}>
              <span className="min-w-0 flex-1">{it.label}</span>
              {it.count !== undefined && <span className="font-mono text-[11px] tabular-nums text-muted">{it.count}</span>}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
