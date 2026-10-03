import Link from "next/link";
import { num } from "@/lib/format";
import { searchHref } from "@/lib/links";
import type { Tab } from "@/lib/search";
import { QueryText } from "./query-text";
import type { Related } from "./query-tools";

// "Searches related to linear": narrower searches built from what the top hits are made
// of, with the part we added in bold and how many results each would find.

export function RelatedSearches({ q, tab, items }: { q: string; tab: Tab; items: Related[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="related-h" className="rise">
      <h2 id="related-h" className="text-[18px] tracking-[-0.005em] text-ink">
        Searches related to{" "}
        <span className="font-display text-[21px] italic [overflow-wrap:anywhere]">
          <QueryText q={q} />
        </span>
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.query} className="min-w-0">
            <Link
              href={searchHref(r.query, { t: tab === "all" ? undefined : tab })}
              className="group flex h-11 items-center gap-3 rounded-full bg-bg-sunk pl-4 pr-4 text-[14px] text-ink-2 transition-colors hover:bg-line hover:text-ink"
            >
              <svg className="shrink-0 text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4.2-4.2" />
              </svg>
              <span className="min-w-0 flex-1 truncate">
                <QueryText q={r.base} opClassName="font-mono text-[13px]" />{" "}
                <span className="font-mono text-[13px] font-semibold text-ink">{r.added}</span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted">
                {num(r.count)}
                <span className="sr-only"> results</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
