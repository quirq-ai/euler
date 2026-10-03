import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { ancestors, getIndex, getPages } from "@/lib/data";
import { longDate } from "@/lib/format";
import { categoryHref, isRemote, wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";
import { fullPath, splitTitle, type Seg } from "./lead";

// Small building blocks shared by articles, stubs and disambiguation pages.

export const LABEL = "text-[10.5px] font-medium uppercase tracking-[0.13em] text-muted";

/** A path that may wrap after any slash, never mid-name. */
export function PathText({ path, className = "" }: { path: string; className?: string }) {
  return (
    <span className={`font-mono [overflow-wrap:anywhere] ${className}`}>
      {path.split("/").map((part, i) => (
        <span key={i}>
          {i > 0 && "/"}
          {i > 0 && <wbr />}
          {part}
        </span>
      ))}
    </span>
  );
}

/** Renders generated prose: plain text, bold names and internal links. */
export function Segs({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        s.href ? (
          <Link key={i} href={s.href} className="link">
            {s.text}
          </Link>
        ) : s.strong ? (
          <b key={i} className="font-semibold [overflow-wrap:anywhere]">
            {s.text}
          </b>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** The folder's address, mono, each step a link up the tree. */
export function Breadcrumb({ page, className = "" }: { page: Page; className?: string }) {
  const chain = ancestors(page);
  if (!chain.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={`font-mono text-[12px] leading-relaxed text-muted ${className}`}>
      {chain.map((a, i) => (
        <span key={a.slug}>
          <Link href={wikiHref(a.slug)} className="transition-colors hover:text-ink hover:underline hover:underline-offset-[3px]">
            {i === 0 ? a.root : a.name}
          </Link>
          <span aria-hidden className="px-[0.35em] text-faint">/</span>
          <wbr />
        </span>
      ))}
    </nav>
  );
}

export function Title({ title, className = "" }: { title: string; className?: string }) {
  const [name, qualifier] = splitTitle(title);
  return (
    <h1 className={`font-display text-[40px] leading-[1.04] tracking-[-0.018em] text-ink [overflow-wrap:anywhere] sm:text-[50px] ${className}`}>
      {name}
      {qualifier && <span className="text-muted"> {qualifier}</span>}
    </h1>
  );
}

/** Title block: address, title over a hairline, and the encyclopedia's byline. */
export function PageHeader({ page, title, tools }: { page?: Page; title: string; tools?: React.ReactNode }) {
  return (
    <header id="top" className="rise scroll-mt-24">
      {page && <Breadcrumb page={page} className="mb-3" />}
      <div className="flex items-end justify-between gap-8 border-b border-line pb-3.5">
        <Title title={title} />
        {tools && <div className="mb-1.5 hidden shrink-0 items-center gap-1 md:flex">{tools}</div>}
      </div>
      <p className="mt-2.5 font-serif text-[14px] italic text-muted">From Innerpedia, the encyclopedia of you</p>
    </header>
  );
}

/** A quiet header action: "Open in VS Code" (or "View on GitHub" in the demo), "Search inside". */
export function Tool({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "rounded-full px-3 py-1 text-[13px] text-muted transition-colors hover:bg-bg-sunk hover:text-ink";
  return external ? (
    <a href={href} className={cls} {...(isRemote(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Section({ id, title, children, className = "" }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`mt-14 scroll-mt-24 ${className}`}>
      <h2 id={`${id}-h`} className="mb-5 border-b border-line pb-2 font-display text-[30px] leading-[1.15] tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A small-caps label over a block, the way the infobox labels its groups. */
export function Sub({ label, aside, children, className = "" }: { label: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={/\bmt-/.test(className) ? className : `mt-8 first:mt-0 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className={LABEL}>{label}</h3>
        {aside && <div className="text-[12px] text-muted">{aside}</div>}
      </div>
      {children}
    </div>
  );
}

/** Maintenance and stub notices, Wikipedia's amber boxes made quiet. */
export function Notice({ page, children, className = "" }: { page: Page; children: React.ReactNode; className?: string }) {
  return (
    <div role="note" className={`flex items-center gap-3.5 rounded-xl border border-notice-line bg-notice px-4 py-3 ${className}`}>
      <PageSigil page={page} size={30} />
      <p className="font-serif text-[15.5px] italic leading-snug text-ink-2">{children}</p>
    </div>
  );
}

/** Categories box and the provenance line that closes every page. */
export function PageFoot({ page }: { page: Page }) {
  const { categories, index } = getIndex();
  const cats = page.categories.filter((c) => categories.has(c));
  return (
    <footer className="clear-both pt-14">
      {cats.length > 0 && (
        <nav aria-label="Categories" className="rounded-xl border border-line px-4 py-3 text-[13.5px] leading-[1.8]">
          <span className="mr-2 font-medium text-ink">Categories:</span>
          {cats.map((c, i) => (
            <span key={c}>
              <span className="whitespace-nowrap">
                <Link href={categoryHref(c)} className="link whitespace-normal [overflow-wrap:anywhere]">
                  {c}
                </Link>
                {i < cats.length - 1 && (
                  <span aria-hidden className="pl-[0.55em] pr-[0.28em] text-faint">
                    ·
                  </span>
                )}
              </span>{" "}
            </span>
          ))}
        </nav>
      )}
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        This page was generated from <PathText path={fullPath(page)} className="text-[11.5px]" /> on{" "}
        {longDate(index.meta.generatedAt)}.
      </p>
    </footer>
  );
}

const SIBLINGS = 11;

/** Where a stub sits, as a rail: every ancestor, then the folders beside it, with this
 * one marked, the way a file explorer shows the way up and the way across. */
export function LocationRail({ page }: { page: Page }) {
  const chain = ancestors(page);
  const parent = chain[chain.length - 1];
  const sibs = parent ? getPages(parent.children) : [page];
  const at = Math.max(0, sibs.findIndex((s) => s.slug === page.slug));
  const start = sibs.length > SIBLINGS ? Math.max(0, Math.min(at - 5, sibs.length - SIBLINGS)) : 0;
  const shown = sibs.slice(start, start + SIBLINGS);
  const hidden = sibs.length - shown.length;
  const row = "block truncate py-[5px] leading-snug transition-colors";
  return (
    <nav aria-label="Location" className="sticky top-[88px] max-h-[calc(100dvh-112px)] overflow-y-auto overscroll-contain pb-6 pr-2 [scrollbar-width:thin]">
      <div className={`${LABEL} mb-3`}>Location</div>
      <ol className="border-l border-line">
        {chain.map((a, i) => (
          <li key={a.slug}>
            <Link href={wikiHref(a.slug)} className={`${row} pl-3.5 text-[13.5px] text-muted hover:text-ink`}>
              {i === 0 ? a.root : a.name}
            </Link>
          </li>
        ))}
        <li>
          <ol aria-label={parent ? `Folders in ${parent.name}` : undefined}>
            {shown.map((s) =>
              s.slug === page.slug ? (
                <li key={s.slug} className="relative">
                  <span aria-hidden className="absolute -left-px top-1 bottom-1 w-[2px] rounded-full bg-ink" />
                  <span aria-current="page" className={`${row} pl-7 text-[13px] font-medium text-ink`}>
                    {s.name}
                  </span>
                </li>
              ) : (
                <li key={s.slug}>
                  <Link href={wikiHref(s.slug)} className={`${row} pl-7 text-[13px] text-muted hover:text-ink`}>
                    {s.name}
                  </Link>
                </li>
              ),
            )}
            {hidden > 0 && parent && (
              <li>
                <Link href={wikiHref(parent.slug)} className={`${row} pl-7 text-[12px] text-muted hover:text-ink`}>
                  and {hidden} more
                </Link>
              </li>
            )}
          </ol>
        </li>
      </ol>
    </nav>
  );
}

/** "Part of linear-clone", a chip with the enclosing project's sigil. */
export function PartOf({ page, className = "" }: { page: Page; className?: string }) {
  return (
    <Link
      href={wikiHref(page.slug)}
      className={`group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[13px] shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong ${className}`}
    >
      <PageSigil page={page} size={20} />
      <span className="shrink-0 whitespace-nowrap text-muted">Part of</span>
      <span className="min-w-0 truncate text-link group-hover:text-link-hover">{page.name}</span>
    </Link>
  );
}
