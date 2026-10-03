import Link from "next/link";
import { IndexEntry } from "@/components/wiki/main/browse";
import { allCategories, categoryInfo, codeLanguage, KIND_BLURBS, subcollections, type CategoryInfo } from "@/components/wiki/main/insights";
import { LetterColumns } from "@/components/wiki/main/letter-columns";
import { Dotted, PageLink, PageTitle, SectionHeading } from "@/components/wiki/main/section";
import { num, plural, timeAgo } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref, wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";

// Category:Name. What the category means, what its pages have in common, then every
// page A to Z in balanced columns.

export function CategoryView({ name, pages }: { name: string; pages: Page[] }) {
  const info = categoryInfo(name);
  const repos = pages.filter((p) => p.kind === "repo").length;
  const latest = pages.reduce<Page | null>((a, p) => (p.modified && (!a?.modified || p.modified > a.modified || (p.modified === a.modified && p.depth > a.depth)) ? p : a), null);
  const subs = info.kind === "collection" ? subcollections(name) : [];

  return (
    <main className="max-w-[1120px]">
      <PageTitle prefix="Category: " title={name} />

      <div className="rise mt-6 max-w-[720px]" style={{ animationDelay: "40ms" }}>
        <Description info={info} pages={pages} />
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          <Dotted>
            {[
              <span key="n" className="tabular-nums">{plural(pages.length, "article")}</span>,
              ...(repos && info.name !== "Git repositories" ? [<span key="r" className="tabular-nums">{plural(repos, "repository", "repositories")}</span>] : []),
              ...(latest
                ? [
                    <span key="l">
                      latest activity {timeAgo(latest.modified)} in <PageLink page={latest} />
                    </span>,
                  ]
                : []),
            ]}
          </Dotted>
        </p>
        {info.kind === "maintenance" && <ReadmeNotice />}
        {info.kind === "year" && <YearNav year={Number(info.subject)} />}
      </div>

      <Composition info={info} pages={pages} />

      {subs.length > 0 && (
        <section aria-labelledby="subcats" className="rise mt-12" style={{ animationDelay: "100ms" }}>
          <SectionHeading id="subcats" aside={plural(subs.length, "subcategory", "subcategories")}>
            Subcategories
          </SectionHeading>
          <p className="-mt-1 mb-4 text-[14px] text-muted">
            {subs.length === 1 ? "This category has only the following subcategory." : `This category has the following ${num(subs.length)} subcategories.`}
          </p>
          <ul className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((c) => (
              <li key={c.name}>
                <IndexEntry c={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pages" className="rise mt-12" style={{ animationDelay: "140ms" }}>
        <SectionHeading id="pages">Pages in category “{name}”</SectionHeading>
        <p className="-mt-1 mb-7 text-[14px] text-muted">
          {pages.length === 1 ? "This category contains only the following page." : `The following ${num(pages.length)} pages are in this category.`}
        </p>
        <LetterColumns pages={pages} />
      </section>
    </main>
  );
}

function Description({ info, pages }: { info: CategoryInfo; pages: Page[] }) {
  const prose = "font-serif text-[18px] leading-[1.68] text-ink";
  const strong = (s: string) => <b className="font-semibold">{s}</b>;
  switch (info.kind) {
    case "language":
      return (
        <p className={prose}>
          <span aria-hidden className="mr-2 inline-block size-3 -translate-y-px rounded-full align-middle" style={{ background: langColor(info.subject) }} />
          Articles about projects written mostly in {strong(info.subject)}. A project joins this category when {info.subject} is the leading
          programming language among its files; markup, styles and data files such as Markdown, CSS and JSON are not counted.
        </p>
      );
    case "framework":
      return (
        <p className={prose}>
          Projects built with {strong(info.name)}. Innerpedia spots frameworks in each project&rsquo;s manifest and dependencies, so a project
          can sit in several of these categories at once.
        </p>
      );
    case "year":
      return (
        <p className={prose}>
          Projects begun in {strong(info.subject)}, judged by the oldest file or the first commit Innerpedia found in each folder.
          {spread(pages)}
        </p>
      );
    case "kind":
      return <p className={prose}>{KIND_BLURBS[info.name]}</p>;
    case "maintenance":
      return (
        <p className={prose}>
          Articles about projects that have no README yet. Innerpedia wrote each of them from metadata alone: the folder&rsquo;s name, its
          manifest, its languages and its dates.
        </p>
      );
    case "part":
      return (
        <p className={prose}>
          Articles about folders inside{" "}
          {info.page ? (
            <Link href={wikiHref(info.page.slug)} className="link font-semibold">
              {info.subject}
            </Link>
          ) : (
            strong(info.subject)
          )}{" "}
          that are substantial enough to have pages of their own: packages, apps and services with a manifest or a README.
        </p>
      );
    case "collection":
      return (
        <p className={prose}>
          Articles about the projects kept in the{" "}
          {info.page ? (
            <Link href={wikiHref(info.page.slug)} className="link font-semibold">
              {info.name}
            </Link>
          ) : (
            strong(info.name)
          )}{" "}
          folder
          {info.page && (
            <>
              , at <span className="font-mono text-[0.8em] text-ink-2 [overflow-wrap:anywhere]">{[info.page.root, info.page.relPath].filter(Boolean).join("/")}</span>
            </>
          )}
          . Innerpedia treats any folder holding three or more articles as a collection, and files everything beneath it here.
        </p>
      );
  }
}

/** "Most were begun in March." for year categories. */
function spread(pages: Page[]): string {
  const months = new Map<number, number>();
  for (const p of pages) if (p.created) months.set(new Date(p.created).getMonth(), (months.get(new Date(p.created).getMonth()) ?? 0) + 1);
  const top = [...months.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || pages.length < 4) return "";
  const name = new Date(2000, top[0], 1).toLocaleString("en-GB", { month: "long" });
  return ` The busiest month for new beginnings was ${name}, with ${num(top[1])}.`;
}

function ReadmeNotice() {
  return (
    <div className="mt-6 flex items-start gap-3.5 rounded-xl border border-notice-line bg-notice px-4 py-3">
      <span aria-hidden className="font-display text-[22px] leading-[1.1] text-muted">¶</span>
      <p className="font-serif text-[15.5px] italic leading-[1.55] text-ink-2">
        Each of these would be a richer article with a few paragraphs from the person who made it. You can help Innerpedia by adding a
        README to any of them.
      </p>
    </div>
  );
}

/** Every year with a category, the current one set in ink: a navbox for the eras. */
function YearNav({ year }: { year: number }) {
  const years = allCategories()
    .filter((c) => c.kind === "year")
    .map((c) => Number(c.subject))
    .sort((a, b) => a - b);
  if (years.length < 2) return null;
  return (
    <nav aria-label="Projects by year begun" className="mt-5 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-y border-line py-1.5">
      <span className="mr-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Begun in</span>
      {years.map((y) =>
        y === year ? (
          <span key={y} aria-current="page" className="grid h-8 place-items-center rounded-md bg-bg-sunk px-2 font-display text-[19px] leading-none tabular-nums text-ink">
            {y}
          </span>
        ) : (
          <Link
            key={y}
            href={categoryHref(`Started in ${y}`)}
            className="grid h-8 place-items-center rounded-md px-2 font-display text-[19px] leading-none tabular-nums text-link transition-colors hover:bg-bg-sunk hover:text-link-hover"
          >
            {y}
          </Link>
        ),
      )}
    </nav>
  );
}

/** What the category's pages are made of: leading languages as a bar, and the
 *  frameworks they most often share. */
function Composition({ info, pages }: { info: CategoryInfo; pages: Page[] }) {
  const langs = new Map<string, number>();
  for (const p of pages) {
    const l = codeLanguage(p);
    if (l) langs.set(l, (langs.get(l) ?? 0) + 1);
  }
  const counted = [...langs.values()].reduce((a, b) => a + b, 0);
  const ranked = [...langs.entries()].sort((a, b) => b[1] - a[1]);
  const shown = ranked.slice(0, 5);
  const other = counted - shown.reduce((a, [, n]) => a + n, 0);
  const segments = [...shown.map(([name, n]) => ({ name, n, color: langColor(name) })), ...(other ? [{ name: "Other", n: other, color: "" }] : [])];

  const fws = new Map<string, number>();
  for (const p of pages) for (const f of p.frameworks) if (f !== info.name) fws.set(f, (fws.get(f) ?? 0) + 1);
  const known = new Set(allCategories().map((c) => c.name));
  const together = [...fws.entries()].filter(([f, n]) => known.has(f) && n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const showLangs = info.kind !== "language" && segments.length > 1 && counted >= 3;
  if (!showLangs && !together.length) return null;

  return (
    <div
      className={`rise mt-9 grid gap-x-14 gap-y-6 border-y border-line py-5 ${showLangs && together.length ? "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" : ""}`}
      style={{ animationDelay: "80ms" }}
    >
      {showLangs && (
        <div className="min-w-0">
          <h2 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Written in</h2>
          <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.name} ${s.n}`).join(", ")}>
            {segments.map((s) => (
              <span
                key={s.name}
                title={`${s.name}: ${plural(s.n, "article")}`}
                className={`h-full first:rounded-l-full last:rounded-r-full ${s.color ? "" : "bg-line-strong"}`}
                style={{ flexGrow: s.n, flexBasis: 0, background: s.color || undefined }}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
            {segments.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span aria-hidden className={`size-2 rounded-full ${s.color ? "" : "bg-line-strong"}`} style={{ background: s.color || undefined }} />
                <span className="text-ink-2">{s.name}</span>
                <span className="tabular-nums">{Math.round((s.n / counted) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {together.length > 0 && (
        <div className="min-w-0">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Often found with</h2>
          <ul className="flex flex-wrap gap-1.5">
            {together.map(([f, n]) => (
              <li key={f}>
                <Link
                  href={categoryHref(f)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-bg-sunk px-2.5 py-1 text-[12.5px] text-ink-2 transition-colors hover:bg-line hover:text-ink"
                >
                  {f}
                  <span className="tabular-nums text-muted">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

