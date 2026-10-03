import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { Globe, type GlobeTile } from "@/components/wiki/main/globe";
import { allCategories, cap, globeTiles, gloss, indexTime, type CategoryInfo } from "@/components/wiki/main/insights";
import { getIndex } from "@/lib/data";
import { logoSrc } from "@/lib/logo";
import { longDate, num, timeAgo } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { categoryHref, wikiHref } from "@/lib/links";

// The Main page's first screen: the Innerpedia globe, every project a tile you can reach
// from here, beside the greeting, the live counts and the portals. The rest of the Main
// page waits below the scroll cue.

const TILES = 96;

export function Welcome() {
  const { index } = getIndex();
  const { counts, generatedAt, roots } = index.meta;
  const cats = allCategories();
  // Portals: the largest collections, or where folders are not gathered into any (the
  // demo is one organization's repositories), the most substantial repositories.
  const collections = cats.filter((c) => c.kind === "collection" && c.page).slice(0, 4);
  const languages = cats.filter((c) => c.kind === "language").slice(0, 4);
  const repos = collections.length >= 2 ? [] : globeTiles(TILES).filter((p) => p.kind === "repo" && p.depth === 1).slice(0, 5);
  const withHistory = index.pages.filter((p) => p.git && p.git.commitCount > 0).length;

  const tiles: GlobeTile[] = globeTiles(TILES).map((p) => ({
    slug: p.slug,
    href: wikiHref(p.slug),
    title: p.title,
    name: p.name,
    kind: p.kind,
    gloss: cap(gloss(p)),
    logo: logoSrc(p),
    logoSurface: p.logoSurface ?? null,
  }));
  // The demo's root carries its organization's avatar: it becomes the globe's core.
  const root = index.pages.find((p) => p.depth === 0 && p.logo);
  const coreLogo = logoSrc(root);
  const core = root && coreLogo ? { href: wikiHref(root.slug), title: root.title, logo: coreLogo } : null;

  return (
    <section aria-labelledby="welcome" className="relative -mt-8 flex min-h-[calc(100svh-var(--demo-bar,0px)-4rem)] flex-col">
      <div className="grid flex-1 content-center items-center gap-y-4 pb-2 pt-8 sm:gap-y-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-8 lg:pt-6">
        <div className="relative z-10 min-w-0 text-center lg:pb-10 lg:text-left">
          <h1 id="welcome" className="rise font-display text-[38px] leading-[1.02] tracking-[-0.02em] text-balance text-ink min-[400px]:text-[42px] sm:text-[58px] xl:text-[68px]">
            Welcome to <em className="italic">Inner</em>pedia,
            <span className="block text-ink-2">the encyclopedia of you.</span>
          </h1>
          <p className="rise mx-auto mt-4 max-w-[34rem] text-pretty text-[14.5px] leading-relaxed text-ink-2 sm:mt-6 sm:text-[15.5px] lg:mx-0" style={{ animationDelay: "60ms" }}>
            <Link href={wikiHref("Special:AllPages")} className="link tabular-nums">
              {num(counts.articles)} articles
            </Link>{" "}
            about{" "}
            <Link href={wikiHref("Special:Statistics")} className="link tabular-nums">
              {num(counts.pages)} folders
            </Link>
            , <span className="tabular-nums">{num(withHistory)}</span> of them with a history in Git.
          </p>
          <p className="rise mt-1 text-[13px] text-muted" style={{ animationDelay: "90ms" }}>
            Written from{" "}
            <span className="inline-flex items-center gap-1.5 align-bottom">
              {root && <PageSigil page={root} size={16} />}
              <span className="font-mono text-[12px]">{roots.map((r) => r.label).join(", ")}</span>
            </span>
            , {timeAgo(generatedAt)}.
          </p>
          <nav aria-label="Portals" className="rise mx-auto mt-6 hidden max-w-[34rem] gap-y-2 text-[14px] sm:mt-8 sm:grid lg:mx-0" style={{ animationDelay: "120ms" }}>
            {repos.length ? (
              <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 lg:justify-start">
                <span className="w-full text-[11px] font-medium uppercase tracking-[0.12em] text-muted min-[480px]:w-auto lg:w-24">Repositories</span>
                {repos.map((p) => (
                  <Link key={p.slug} href={wikiHref(p.slug)} className="link inline-flex items-baseline gap-1.5 whitespace-nowrap">
                    {/* Centred on its own, so the name sets the baseline the row lines up on. */}
                    <PageSigil page={p} size={16} className="self-center" />
                    {p.title}
                  </Link>
                ))}
              </p>
            ) : (
              <Portal label="Collections" items={collections} />
            )}
            <Portal label="Languages" items={languages} dots />
          </nav>
        </div>

        <div className="relative min-w-0">
          <div aria-hidden className="aurora">
            <span />
            <span />
            <span />
          </div>
          <div className="relative mx-auto w-[min(100%,52svh,440px)] sm:w-[min(100%,50svh,520px)] lg:w-[min(100%,calc(100svh-var(--demo-bar,0px)-12rem),720px)]">
            <Globe tiles={tiles} core={core} label={`The globe of ${num(tiles.length)} projects. Each tile opens its article; use the arrow keys to move between them.`} />
          </div>
          <p className="relative mt-1 text-center text-[12.5px] text-muted">
            Every tile is an article. <span className="hidden sm:inline">Drag to turn the globe, or pick one.</span>
            <span className="sm:hidden">Swipe to turn it, tap to open one.</span>
          </p>
        </div>
      </div>

      <a href="#today" className="group relative mx-auto mb-3 mt-2 flex flex-col items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink">
        <span>
          Today on Innerpedia<span aria-hidden className="px-2 text-faint">·</span>
          <span className="tabular-nums">{longDate(new Date(indexTime()).toISOString())}</span>
        </span>
        <span aria-hidden className="relative block h-8 w-px overflow-hidden bg-line-strong">
          <span className="absolute inset-x-0 top-0 block h-3 bg-ink/55 animate-[innerpedia-cue_2.6s_cubic-bezier(0.45,0,0.25,1)_infinite]" />
        </span>
      </a>
      <style href="innerpedia-cue" precedence="default">{`@keyframes innerpedia-cue{0%{transform:translateY(-100%)}70%,100%{transform:translateY(270%)}}`}</style>
    </section>
  );
}

function Portal({ label, items, dots = false }: { label: string; items: CategoryInfo[]; dots?: boolean }) {
  if (!items.length) return null;
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 lg:justify-start">
      <span className="w-full text-[11px] font-medium uppercase tracking-[0.12em] text-muted min-[480px]:w-auto lg:w-24">{label}</span>
      {items.map((c) => (
        <Link key={c.name} href={categoryHref(c.name)} className="link inline-flex items-center gap-1.5 whitespace-nowrap">
          {dots && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: langColor(c.subject) }} />}
          {c.subject}
          <span className="text-[12px] tabular-nums text-faint">{num(c.count)}</span>
        </Link>
      ))}
    </p>
  );
}
