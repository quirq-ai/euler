import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { timeAgo } from "@/lib/format";
import { wikiHref } from "@/lib/links";
import { displayPath } from "@/lib/search";
import type { Page } from "@/lib/types";

// The articles you worked on last. `modified` bubbles up the tree, so a container
// shares its timestamp with whichever project inside it changed; skip those and keep
// the project where the work actually happened.

export function recentlyTouched(articles: Page[], limit = 8): Page[] {
  const candidates = articles.filter((p) => p.depth > 0 && !p.partOf && p.modified);
  const byModified = new Map<string, Page[]>();
  for (const p of candidates) byModified.set(p.modified!, [...(byModified.get(p.modified!) ?? []), p]);

  const out: Page[] = [];
  for (const p of [...candidates].sort((a, b) => Date.parse(b.modified!) - Date.parse(a.modified!))) {
    if (out.length >= limit) break;
    const twins = byModified.get(p.modified!) ?? [];
    if (twins.some((q) => q !== p && q.path.startsWith(p.path + "/"))) continue;
    out.push(p);
  }
  return out;
}

/** "now", "5m", "3h", "2d", "6w", "4mo", "2y" */
function shortAgo(iso: string, now = Date.now()): string {
  const m = Math.max(0, (now - Date.parse(iso)) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${Math.floor(m)}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  if (m < 1440 * 14) return `${Math.floor(m / 1440)}d`;
  if (m < 1440 * 60) return `${Math.floor(m / 10080)}w`;
  if (m < 1440 * 365) return `${Math.floor(m / 43200)}mo`;
  return `${Math.floor(m / 525600)}y`;
}

// From sm up, how many chips show: 3, then 4 at md, 5 at lg, 6 at xl.
const WIDE = ["", "", "", "sm:hidden md:list-item", "sm:hidden lg:list-item", "sm:hidden xl:list-item"];

export function RecentlyTouched({ pages, delay = 0 }: { pages: Page[]; delay?: number }) {
  if (!pages.length) return null;
  return (
    <section aria-labelledby="recent-heading" className="mx-auto w-full max-w-[1120px] px-4">
      <div className="rise flex items-center justify-center gap-4" style={{ animationDelay: `${delay}ms` }}>
        <span aria-hidden className="h-px w-10 bg-line-strong" />
        <h2 id="recent-heading" className="text-[11px] uppercase tracking-[0.12em] text-muted">
          Recently touched
        </h2>
        <span aria-hidden className="h-px w-10 bg-line-strong" />
      </div>
      {/* Phones get one row that scrolls sideways. Wider screens get one centred row of
          three to six chips by width; names vary in length, so the row is also clipped to
          a single line and any chip that would wrap onto a second one is simply not seen.
          The deep bottom padding leaves room for the hover shadow inside the clip. */}
      <ul className="-mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] sm:mx-0 sm:-mb-4 sm:mt-4 sm:max-h-[76px] sm:flex-wrap sm:justify-center sm:gap-y-10 sm:overflow-clip sm:px-0 sm:pb-7 sm:pt-2 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
        {pages.map((p, i) => (
          <li
            key={p.slug}
            className={`rise min-w-0 max-w-full shrink-0 ${WIDE[i] ?? "sm:hidden"}`}
            style={{ animationDelay: `${delay + 60 + i * 40}ms` }}
          >
            <Link
              href={wikiHref(p.slug)}
              title={`${displayPath(p)}/${p.name} · touched ${timeAgo(p.modified)}`}
              className="group flex h-10 min-w-0 items-center gap-2.5 rounded-full border border-line bg-surface/70 pl-[7px] pr-4 text-[13.5px] text-ink-2 shadow-[var(--shadow-sm)] backdrop-blur-sm transition-[color,border-color,box-shadow] duration-150 hover:border-line-strong hover:text-ink hover:shadow-soft"
            >
              <PageSigil page={p} size={26} muted={false} />
              {/* Baseline-aligned so the small mono age sits on the name's line, not its centre. */}
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 max-w-[190px] truncate">{p.name}</span>
                <span aria-hidden className="font-mono text-[11px] tabular-nums text-muted transition-colors group-hover:text-ink-2">
                  {shortAgo(p.modified!)}
                </span>
                <span className="sr-only">, touched {timeAgo(p.modified)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
