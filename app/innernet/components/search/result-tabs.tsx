import Link from "next/link";
import { searchHref } from "@/lib/links";
import { num } from "@/lib/format";
import { TABS, type Tab } from "@/lib/search";

// All · Projects · Repositories · Documents · Folders. Switching tabs keeps the query
// and starts again at page one.

export function ResultTabs({ q, tab, counts }: { q: string; tab: Tab; counts: Record<Tab, number> }) {
  return (
    <nav aria-label="Result types" className="-mb-px flex gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] [scrollbar-width:none] sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((t, i) => {
        const active = t.id === tab;
        const empty = counts[t.id] === 0;
        return (
          <Link
            key={t.id}
            href={searchHref(q, { t: t.id === "all" ? undefined : t.id })}
            aria-current={active ? "page" : undefined}
            // The nav scrolls sideways, which clips anything drawn outside a tab, so the
            // focus ring sits inside it.
            className={`relative flex shrink-0 items-baseline gap-1.5 rounded-md px-3 pb-3 pt-2.5 text-[13.5px] transition-colors first:pl-0 focus-visible:outline-offset-[-2px] ${
              active ? "font-medium text-ink" : empty ? "text-muted" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span className="text-[12px] font-normal tabular-nums text-muted">{num(counts[t.id])}</span>
            {active && <span aria-hidden className={`absolute bottom-0 h-0.5 rounded-full bg-ink ${i === 0 ? "left-0 right-3" : "inset-x-3"}`} />}
          </Link>
        );
      })}
    </nav>
  );
}
