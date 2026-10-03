import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { sigilGradient } from "@/components/sigil";
import { getPage, getPages } from "@/lib/data";
import { bytes, longDate, monthYear, num, timeAgo } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { wikiHref } from "@/lib/links";
import { displayPath, fallbackDescription, pageSummary } from "@/lib/search";
import type { Page } from "@/lib/types";
import { kindLine, primaryLanguage } from "./query-tools";

// The card beside the results when one article clearly answers the query: who it is,
// what it is made of, and where it lives, with the way into Innerpedia.

export function KnowledgePanel({ page }: { page: Page }) {
  const lang = primaryLanguage(page);
  const then = page.languages.find((l) => l !== lang);
  const related = getPages(page.related).slice(0, 6);
  const parent = getPage(page.parent);

  const facts: [string, React.ReactNode][] = [];
  if (lang)
    facts.push([
      "Language",
      <span key="l">
        <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full align-[0.05em]" style={{ background: langColor(lang.name) }} />
        {lang.name}
        {then && <span className="text-muted">, then {then.name}</span>}
      </span>,
    ]);
  if (page.frameworks.length) facts.push(["Frameworks", page.frameworks.slice(0, 4).join(", ")]);
  if (page.created) facts.push(["Created", <time key="c" dateTime={page.created}>{monthYear(page.created)}</time>]);
  if (page.modified)
    facts.push([
      "Last touched",
      <time key="m" dateTime={page.modified} title={longDate(page.modified)}>
        {timeAgo(page.modified)}
      </time>,
    ]);
  facts.push(["Files", <span key="f" className="tabular-nums">{num(page.totalFiles)}</span>]);
  if (page.totalBytes) facts.push(["Size", <span key="s" className="tabular-nums">{bytes(page.totalBytes)}</span>]);
  if (page.git) facts.push(["Commits", <span key="g" className="tabular-nums">{num(page.git.commitCount)}</span>]);
  // Break long paths only after a slash.
  const where = displayPath(page)
    .split("/")
    .map((seg, i, all) => (
      <span key={i}>
        {seg}
        {i < all.length - 1 && "/"}
        {i < all.length - 1 && <wbr />}
      </span>
    ));
  facts.push([
    "Location",
    parent ? (
      <Link key="p" href={wikiHref(parent.slug)} className="link font-mono text-[12px] leading-[1.6] [overflow-wrap:anywhere]">
        {where}
      </Link>
    ) : (
      <span key="p" className="font-mono text-[12px] leading-[1.6] [overflow-wrap:anywhere]">{where}</span>
    ),
  ]);

  const quick = [
    page.modified ? { k: "Touched", v: timeAgo(page.modified).replace(/ ago$/, "") } : null,
    { k: "Files", v: num(page.totalFiles) },
    page.git ? { k: "Commits", v: num(page.git.commitCount) } : page.totalBytes ? { k: "Size", v: bytes(page.totalBytes) } : null,
  ].filter((x): x is { k: string; v: string } => !!x);

  return (
    <aside aria-label={`About ${page.title}`} className="rise relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-soft">
      {/* A wash of the sigil's own colours, fading into the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-36 opacity-[0.15]"
        style={{
          background: sigilGradient(page.slug),
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />

      <div className="relative px-6 pb-6 pt-6">
        <div className="flex items-start gap-4 lg:block">
          <span className="shrink-0 lg:hidden">
            <PageSigil page={page} size={48} muted={false} className="shadow-soft" />
          </span>
          <span className="hidden lg:block">
            <PageSigil page={page} size={64} muted={false} className="shadow-soft" />
          </span>
          <div className="min-w-0 lg:mt-5">
            <h2 className="font-display text-[30px] leading-[1.05] tracking-[-0.01em] text-ink [overflow-wrap:anywhere] lg:text-[34px]">
              {page.title}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-muted">{kindLine(page)}</p>
          </div>
        </div>

        <p className="mt-4 font-serif text-[16.5px] leading-[1.6] text-ink-2 max-lg:line-clamp-4">
          {pageSummary(page) ?? fallbackDescription(page)}
        </p>

        {/* Phones get three numbers; the full table waits for room. */}
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line lg:hidden">
          {quick.map((q) => (
            <div key={q.k} className="px-3 py-2.5 text-center">
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted">{q.k}</dt>
              <dd className="mt-0.5 font-display text-[22px] leading-none tabular-nums text-ink">{q.v}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-5 hidden border-t border-line pt-1 lg:block">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 border-b border-line py-2 text-[13.5px] last:border-b-0">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {related.length > 0 && (
          <section className="mt-5 hidden lg:block">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-muted">See also</h3>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={wikiHref(r.slug)}
                    className="inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border border-line bg-bg py-1 pl-1 pr-2.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <PageSigil page={r} size={18} />
                    <span className="truncate">{r.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          href={wikiHref(page.slug)}
          className="group mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-link hover:text-link-hover"
        >
          Read on <span className="font-display text-[17px] font-normal"><em>Inner</em>pedia</span>
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </aside>
  );
}
