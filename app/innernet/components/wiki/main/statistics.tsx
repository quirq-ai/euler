import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { sigilGradient } from "@/components/sigil";
import { authorTotal } from "@/components/wiki/article/lead";
import { activity, statistics } from "@/components/wiki/main/insights";
import { PageTitle, SectionHeading, Title } from "@/components/wiki/main/section";
import { displayPath } from "@/lib/search";
import { getIndex } from "@/lib/data";
import { bytes, longDate, monthYear, num, plural, shortMonth } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref, wikiHref } from "@/lib/links";
import { DEMO } from "@/lib/mode";
import type { GitInfo } from "@/lib/types";

// Special:Statistics. A small, handsome table page: the headline counts, what the
// files are written in, when the work happened, and the biggest and busiest things.

const label = "text-[11px] font-medium uppercase tracking-[0.12em] text-muted";

/** " · 3 authors", " · 8+ authors" */
function authorLabel(g: GitInfo): string {
  const { n, atLeast } = authorTotal(g);
  return n ? ` · ${atLeast ? `${n}+ authors` : plural(n, "author")}` : "";
}

export function StatisticsView() {
  const { index } = getIndex();
  const m = index.meta;
  const s = statistics();
  const roots = m.roots.map((r) => r.label).join(", ");

  const figures = [
    { k: "Folders", v: num(m.counts.pages), note: "each with a page" },
    { k: "Articles", v: num(m.counts.articles), note: "projects, repositories, documents" },
    { k: "Stubs", v: num(m.counts.stubs), note: "folders without a story yet" },
    { k: "Repositories", v: num(m.counts.repos), note: s.withHistory === m.counts.repos ? "with a Git history" : `${num(s.withHistory)} with commits` },
    { k: "Files", v: num(s.files), note: m.deeperCounted ? "in every folder, indexed or counted" : "in indexed folders" },
    { k: DEMO ? "Size" : "On disk", v: bytes(s.bytes), note: DEMO ? "at each repository's latest commit" : "dependencies and builds excluded" },
    { k: "Commits", v: num(s.commits), note: `in ${num(s.histories)} distinct histories` },
    { k: "Categories", v: num(m.counts.categories), note: "ways to browse" },
  ];

  return (
    <main className="max-w-[1120px]">
      <PageTitle prefix="Special: " title="Statistics" />
      <p className="rise mt-6 max-w-[720px] font-serif text-[18px] leading-[1.68] text-ink" style={{ animationDelay: "40ms" }}>
        Innerpedia was last written on {longDate(m.generatedAt)} from <span className="font-mono text-[0.8em] text-ink-2">{roots}</span>, reading{" "}
        {num(m.counts.pages)} folders in {(m.durationMs / 1000).toFixed(1)} seconds. Of those, {num(m.counts.articles)} earned an article; the
        other {num(m.counts.stubs)} are stubs.
      </p>

      <dl className="rise mt-10 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4" style={{ animationDelay: "80ms" }}>
        {figures.map((f) => (
          <div key={f.k} className="min-w-0 border-t border-line-strong pt-3">
            <dt className={label}>{f.k}</dt>
            <dd className="mt-2 font-display text-[40px] leading-none tracking-[-0.01em] text-ink tabular-nums sm:text-[46px]">{f.v}</dd>
            <dd className="mt-1.5 text-[12.5px] text-muted">{f.note}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="languages" className="rise mt-16" style={{ animationDelay: "120ms" }}>
        <SectionHeading id="languages">Languages</SectionHeading>
        <div className="grid gap-x-14 gap-y-10 md:grid-cols-2">
          <FileLanguages langs={s.fileLanguages} roots={roots} />
          <div className="min-w-0">
            <h3 className={`${label} mb-3`}>Leading language of each article</h3>
            <Bars
              rows={s.articleLanguages.map((c) => ({
                key: c.name,
                label: c.subject,
                href: categoryHref(c.name),
                value: c.count,
                color: langColor(c.subject),
                title: `${c.subject}: ${plural(c.count, "article")}`,
              }))}
            />
          </div>
        </div>
      </section>

      <Activity />

      <div className="mt-16 grid gap-x-14 gap-y-16 lg:grid-cols-2">
        <section aria-labelledby="biggest" className="min-w-0">
          <SectionHeading id="biggest" aside="by files">
            Biggest folders
          </SectionHeading>
          <ol>
            {s.biggest.map((p, i) => (
              <li key={p.slug} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-2.5 last:border-b-0">
                <span className="font-mono text-[11.5px] tabular-nums text-muted">{i + 1}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <PageSigil page={p} size={24} />
                  <div className="min-w-0">
                    <Link href={wikiHref(p.slug)} className="link block truncate text-[14.5px]">
                      <Title page={p} />
                    </Link>
                    <p className="truncate font-mono text-[11px] text-muted">{displayPath(p)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] tabular-nums text-ink">{num(p.totalFiles)}</p>
                  <p className="text-[11.5px] tabular-nums text-muted">{bytes(p.totalBytes)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="busiest" className="min-w-0">
          <SectionHeading id="busiest" aside="by commits">
            Busiest repositories
          </SectionHeading>
          <ol>
            {s.busiest.map((p, i) => {
              const g = p.git!;
              const max = s.busiest[0].git!.commitCount;
              const since = g.firstCommit?.slice(0, 4);
              return (
                <li key={p.slug} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="font-mono text-[11.5px] tabular-nums text-muted">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <Link href={wikiHref(p.slug)} className="link truncate text-[14.5px]">
                        <Title page={p} />
                      </Link>
                      <span className="shrink-0 text-[11.5px] text-muted">
                        {since ? `since ${since}` : ""}
                        {authorLabel(g)}
                      </span>
                    </div>
                    <span aria-hidden className="mt-1.5 block h-[5px] rounded-full" style={{ width: `${Math.max(3, (g.commitCount / max) * 100)}%`, background: sigilGradient(p.slug) }} />
                  </div>
                  <p className="text-right text-[14px] tabular-nums text-ink">{num(g.commitCount)}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <div className="mt-16 grid gap-x-14 gap-y-16 lg:grid-cols-2">
        <section aria-labelledby="frameworks" className="min-w-0">
          <SectionHeading id="frameworks" aside="articles using each">
            Frameworks
          </SectionHeading>
          <Bars
            rows={s.frameworks.map((c) => ({ key: c.name, label: c.name, href: categoryHref(c.name), value: c.count, title: `${c.name}: ${plural(c.count, "article")}` }))}
          />
        </section>

        <section aria-labelledby="kinds" className="min-w-0">
          <SectionHeading id="kinds">Kinds of folder</SectionHeading>
          <table className="w-full border-collapse text-[14px]">
            <caption className="sr-only">Folders and articles by kind</caption>
            <thead>
              <tr>
                <th scope="col" className="pb-2 text-left font-normal">
                  <span className="sr-only">Kind</span>
                </th>
                <th scope="col" className={`${label} w-24 pb-2 text-right`}>Folders</th>
                <th scope="col" className={`${label} w-24 pb-2 text-right`}>Articles</th>
              </tr>
            </thead>
            <tbody>
              {s.kinds.map((k) => (
                <tr key={k.kind} className="border-t border-line">
                  <th scope="row" className="py-2 text-left font-normal text-ink">{k.label}</th>
                  <td className="py-2 text-right tabular-nums text-ink-2">{num(k.total)}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{k.articles ? num(k.articles) : "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Eras years={s.years} />
        </section>
      </div>
    </main>
  );
}

interface BarRow {
  key: string;
  label: string;
  href: string;
  value: number;
  color?: string;
  title: string;
}

function Bars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.key} title={r.title} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3rem] items-center gap-x-3 py-[3px]">
          <Link href={r.href} className="link flex min-w-0 items-center gap-2 text-[14px]">
            {r.color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />}
            <span className="truncate">{r.label}</span>
          </Link>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-bg-sunk">
            <span
              className={`block h-full rounded-full ${r.color ? "" : "bg-ink/35"}`}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color || undefined }}
            />
          </span>
          <span className="text-right text-[12.5px] tabular-nums text-muted">{num(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function FileLanguages({ langs, roots }: { langs: { name: string; files: number }[]; roots: string }) {
  const total = langs.reduce((a, l) => a + l.files, 0);
  if (!total) return null;
  return (
    <div className="min-w-0">
      <h3 className={`${label} mb-3`}>
        Files by language, across <span className="font-mono normal-case tracking-normal">{roots}</span>
      </h3>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={langs.map((l) => `${l.name} ${l.files} files`).join(", ")}>
        {langs.map((l) => (
          <span key={l.name} title={`${l.name}: ${num(l.files)} files`} className="h-full" style={{ flexGrow: l.files, flexBasis: 0, background: langColor(l.name) }} />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-8 gap-y-1 min-[480px]:grid-cols-2">
        {langs.map((l) => (
          <li key={l.name} className="flex items-baseline gap-2 border-b border-line py-1.5 text-[14px]">
            <span aria-hidden className="size-2 shrink-0 -translate-y-px rounded-full" style={{ background: langColor(l.name) }} />
            <span className="min-w-0 truncate text-ink">{l.name}</span>
            <span className="ml-auto text-[12.5px] tabular-nums text-ink-2">{num(l.files)}</span>
            <span className="w-9 text-right text-[12.5px] tabular-nums text-muted">{Math.round((l.files / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] text-muted">The eight most common languages by file count. Markup and data are counted here, unlike in categories.</p>
    </div>
  );
}

function Activity() {
  const months = activity().slice(-24);
  if (!months.length) return null;
  const max = Math.max(1, ...months.map((m) => m.count));
  const peak = months.reduce((a, b) => (b.count > a.count ? b : a));
  const total = months.reduce((a, b) => a + b.count, 0);
  return (
    <section aria-labelledby="activity" className="rise mt-16" style={{ animationDelay: "160ms" }}>
      <SectionHeading id="activity" aside={`${plural(total, "commit")} in ${months.length} months`}>
        Activity
      </SectionHeading>
      <div className="relative">
        <div className="flex h-44 items-end gap-[3px] sm:gap-1.5" role="img" aria-label={`Commits per month. Busiest: ${monthYear(`${peak.month}-15`)}, ${peak.count} commits.`}>
          {months.map((m) => {
            const isPeak = m === peak;
            return (
              <div key={m.month} className="group relative flex h-full flex-1 flex-col justify-end" title={`${monthYear(`${m.month}-15`)}: ${plural(m.count, "commit")}`}>
                {isPeak && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11.5px] tabular-nums text-ink-2" style={{ bottom: `calc(${(m.count / max) * 100}% + 6px)` }}>
                    {num(m.count)}
                  </span>
                )}
                <span
                  className={`block rounded-t-[4px] transition-colors ${isPeak ? "bg-ink/70" : "bg-ink/20 group-hover:bg-ink/45"}`}
                  style={{ height: `${Math.max(1.5, (m.count / max) * 100)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-[3px] border-t border-line pt-2 sm:gap-1.5">
          {months.map((m, i) => (
            <span key={m.month} className="flex-1 text-center text-[10.5px] leading-tight text-muted">
              {m.month.endsWith("-01") || i === 0 ? (
                <>
                  <span className="text-ink-2">{shortMonth(m.month)}</span>
                  <br />
                  {m.month.slice(0, 4)}
                </>
              ) : /-(04|07|10)$/.test(m.month) ? (
                <span className="hidden sm:inline">{shortMonth(m.month)}</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[13px] text-muted">
        Commits per month across every distinct history, so copies and forks count once. The busiest was {monthYear(`${peak.month}-15`)}, with {plural(peak.count, "commit")}.
      </p>
    </section>
  );
}

function Eras({ years }: { years: { year: string; count: number }[] }) {
  if (years.length < 2) return null;
  const first = Number(years[0].year);
  const last = Number(years[years.length - 1].year);
  const all = Array.from({ length: last - first + 1 }, (_, i) => {
    const y = String(first + i);
    return { year: y, count: years.find((x) => x.year === y)?.count ?? 0 };
  });
  const max = Math.max(1, ...all.map((y) => y.count));
  return (
    <div className="mt-10">
      <h3 className={`${label} mb-3`}>Articles by the year they were begun</h3>
      <div className="flex h-28 items-end gap-1.5">
        {all.map((y) => {
          const body = (
            <>
              <span className="mb-1 text-center text-[10.5px] tabular-nums text-muted">{y.count ? num(y.count) : ""}</span>
              <span className="block rounded-t-[4px] bg-ink/20 transition-colors group-hover:bg-link" style={{ height: `${y.count ? Math.max(3, (y.count / max) * 80) : 0}%` }} />
            </>
          );
          const cls = "group relative flex h-full flex-1 flex-col justify-end";
          return y.count ? (
            <Link key={y.year} href={categoryHref(`Started in ${y.year}`)} title={`${y.year}: ${plural(y.count, "article")}`} className={cls}>
              {body}
            </Link>
          ) : (
            <span key={y.year} title={`${y.year}: no articles`} className={cls}>
              {body}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-line pt-1.5">
        {all.map((y) => (
          <span key={y.year} className="flex-1 text-center text-[10.5px] tabular-nums text-muted">
            {`’${y.year.slice(2)}`}
          </span>
        ))}
      </div>
    </div>
  );
}
