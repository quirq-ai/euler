import Link from "next/link";
import { searchHref } from "@/lib/links";
import type { Tab } from "@/lib/search";

// "I n n n e r n e t": the wordmark stretched by one n per page, the way a certain
// other search engine grows its o's. Current page in ink, the rest in link blue.

const MAX = 10;

export function Pagination({ q, tab, page, pages }: { q: string; tab: Tab; page: number; pages: number }) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 5, pages - MAX + 1));
  const nums = Array.from({ length: Math.min(MAX, pages) }, (_, i) => start + i);
  const href = (p: number) => searchHref(q, { t: tab === "all" ? undefined : tab, p });

  // Beside the word the arrows share a fixed width so the word stays centred; on a
  // phone they sit at the column's edges instead.
  const arrow = (dir: "prev" | "next", beside: boolean) => {
    const target = dir === "prev" ? page - 1 : page + 1;
    const on = dir === "prev" ? page > 1 : page < pages;
    const label = dir === "prev" ? "Previous" : "Next";
    const icon = (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    );
    const body = dir === "prev" ? <>{icon}{label}</> : <>{label}{icon}</>;
    // Padding with a matching negative margin: a finger-sized target, same layout.
    const cls = `inline-flex items-center gap-1 py-2.5 -my-2.5 text-[13.5px] ${beside ? `w-[5.5rem] ${dir === "prev" ? "justify-end" : "justify-start"}` : "-mx-2 px-2"}`;
    return on ? (
      <Link href={href(target)} rel={dir} className={`${cls} text-link hover:text-link-hover`}>
        {body}
      </Link>
    ) : (
      <span aria-hidden className={`${cls} invisible`}>{body}</span>
    );
  };

  return (
    <nav aria-label="Pages" className="flex flex-col items-center gap-4">
      <div className="flex items-end justify-center gap-4">
        <span className="hidden pb-[22px] sm:block">{arrow("prev", true)}</span>
        <ol className="flex items-end font-display text-[40px] leading-none sm:text-[46px]">
          <li aria-hidden className="px-[0.02em] pb-[22px] italic text-ink">
            I
          </li>
          {nums.map((n) =>
            n === page ? (
              <li key={n} aria-current="page" className="flex flex-col items-center px-[0.08em]">
                <span aria-hidden className="italic text-ink">
                  n
                </span>
                <span className="mt-1.5 pl-[0.3em] font-sans text-[12.5px] font-medium leading-4 tabular-nums text-ink">
                  <span className="sr-only">Page </span>
                  {n}
                </span>
              </li>
            ) : (
              <li key={n}>
                <Link href={href(n)} className="group flex flex-col items-center px-[0.08em] text-link hover:text-link-hover">
                  <span aria-hidden className="italic transition-transform duration-200 group-hover:-translate-y-0.5">
                    n
                  </span>
                  <span className="mt-1.5 pl-[0.3em] font-sans text-[12.5px] leading-4 tabular-nums group-hover:underline">
                    <span className="sr-only">Page </span>
                    {n}
                  </span>
                </Link>
              </li>
            ),
          )}
          <li aria-hidden className="pb-[22px] text-ink">
            <em>er</em>net
          </li>
        </ol>
        <span className="hidden pb-[22px] sm:block">{arrow("next", true)}</span>
      </div>
      <div className="flex w-full justify-between border-t border-line pt-4 sm:hidden">
        {arrow("prev", false)}
        {arrow("next", false)}
      </div>
    </nav>
  );
}
