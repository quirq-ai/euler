import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { getPages } from "@/lib/data";
import { num, timeAgo } from "@/lib/format";
import { langColor } from "@/lib/lang-colors";
import { wikiHref } from "@/lib/links";
import type { SearchHit } from "@/lib/search";
import { appFramework, crumbs, kindLabel, primaryLanguage, tailCrumbs } from "./query-tools";
import { Snippet } from "./snippet";

// One result, laid out the way the web taught us to read them: the source (sigil,
// what it is, where it lives) over a blue title, a snippet with the matched words
// marked, then a quiet line of facts. The source line names the kind rather than the
// folder, so the name is not said twice in a row.

const SEP = "inline-flex items-center before:w-[17px] before:text-center before:text-faint before:content-['·']";

function Crumbs({ parts }: { parts: string[] }) {
  return parts.map((c, i) => (
    <span key={i}>
      {i > 0 && <span aria-hidden className="px-1 text-faint">›</span>}
      {c}
    </span>
  ));
}

export function ResultItem({
  hit,
  index,
  lang: langFilter,
  sitelinks = false,
}: {
  hit: SearchHit;
  index: number;
  lang?: string;
  sitelinks?: boolean;
}) {
  const p = hit.page;
  const href = wikiHref(p.slug);
  const lang = primaryLanguage(p, langFilter);
  const named = appFramework(p);
  const children = sitelinks && p.isArticle ? getPages(p.children).slice(0, 4) : [];
  // The link is named by its title; the kind and path describe it.
  const id = `result-${index}`;

  // `wide` facts wait for room, so the line stays on one row on a phone.
  const facts: { node: React.ReactNode; wide?: boolean }[] = [];
  if (lang) {
    facts.push({
      node: (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full" style={{ background: langColor(lang.name) }} />
          {lang.name}
        </span>
      ),
    });
  }
  p.frameworks
    .filter((f) => f !== named)
    .slice(0, 2)
    .forEach((f, i) => facts.push({ node: f, wide: i > 0 }));
  if (p.git) facts.push({ node: <span className="tabular-nums">{p.git.commitCount === 1 ? "1 commit" : `${num(p.git.commitCount)} commits`}</span> });
  if (p.modified) facts.push({ node: `updated ${timeAgo(p.modified)}` });

  return (
    <li className="rise" style={{ animationDelay: `${index * 40}ms` }}>
      <article>
        <Link href={href} aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`} className="group block text-link visited:text-visited">
          <span id={`${id}-s`} className="flex items-center gap-3">
            <PageSigil page={p} size={26} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] text-ink">{kindLabel(p)}</span>
              <cite className="mt-0.5 block truncate font-mono text-[12px] not-italic text-muted">
                {/* Phones keep the ends of the path, where the meaning is. */}
                <span className="sm:hidden">
                  <Crumbs parts={tailCrumbs(p)} />
                </span>
                <span className="max-sm:hidden">
                  <Crumbs parts={crumbs(p)} />
                </span>
              </cite>
            </span>
          </span>
          <h3 id={`${id}-t`} className="mt-2 text-[20px] leading-[1.3] tracking-[-0.01em] [overflow-wrap:anywhere] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-[0.18em]">
            {p.title}
          </h3>
        </Link>

        <p className="mt-1.5 text-[14.5px] leading-[1.55] text-ink-2 [overflow-wrap:anywhere]">
          <Snippet segments={hit.snippet} />
        </p>

        {(facts.length > 0 || !p.isArticle) && (
          // Each fact carries its own leading middot; the list is pulled left by one
          // separator's width and clipped, so a line never starts with a dot.
          <div className="mt-2 overflow-hidden">
            <ul className="-ml-[17px] flex flex-wrap items-center gap-y-1 text-[12.5px] text-muted">
              {!p.isArticle && (
                <li className={SEP}>
                  <span className="inline-flex h-[19px] items-center rounded-full border border-notice-line bg-notice px-2 pb-px font-serif text-[13px] italic leading-none text-ink-2">
                    stub
                  </span>
                </li>
              )}
              {facts.map((f, i) => (
                <li key={i} className={`${SEP} ${f.wide ? "max-sm:hidden" : ""}`}>
                  {f.node}
                </li>
              ))}
            </ul>
          </div>
        )}

        {children.length > 0 && (
          <nav aria-label={`Inside ${p.title}`} className="mt-3 flex flex-wrap gap-1.5">
            {children.map((c) => (
              <Link
                key={c.slug}
                href={wikiHref(c.slug)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1.5 pr-2.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              >
                <PageSigil page={c} size={14} />
                <span className="font-mono text-[12px]">{c.name}</span>
              </Link>
            ))}
          </nav>
        )}
      </article>
    </li>
  );
}
