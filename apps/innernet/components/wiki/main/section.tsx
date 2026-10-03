import Link from "next/link";
import { Fragment } from "react";
import { splitTitle } from "@/components/wiki/main/insights";
import { wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";

// Small building blocks shared by the Main page, Category pages and Special pages.

/** A Main page box: small-caps heading over a hairline, with an optional quiet action. */
export function Box({
  id,
  title,
  action,
  delay = 0,
  className = "",
  children,
}: {
  id: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={`rise min-w-0 ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline gap-4 border-b border-line pb-2.5">
        <h2 id={id} className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          {title}
        </h2>
        {action && <div className="ml-auto shrink-0 text-[12.5px] text-muted">{action}</div>}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

/** Title block for generated pages, matching the article title treatment. */
export function PageTitle({ prefix, title, children }: { prefix?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="rise">
      <h1 className="font-display text-[40px] leading-[1.06] tracking-[-0.012em] text-ink sm:text-[50px]">
        {prefix && <span className="text-muted">{prefix}</span>}
        {title}
      </h1>
      <div className="mt-3 border-t border-line-strong pt-2.5">
        <p className="font-serif text-[14px] italic text-muted">From Innerpedia, the encyclopedia of you</p>
      </div>
      {children}
    </header>
  );
}

/** A section heading inside a generated page, the same voice as an article h2. */
export function SectionHeading({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-baseline gap-4 border-b border-line-strong pb-2">
      <h2 id={id} className="scroll-mt-24 font-display text-[28px] leading-tight text-ink sm:text-[30px]">
        {children}
      </h2>
      {aside && <div className="ml-auto shrink-0 text-[13px] text-muted">{aside}</div>}
    </div>
  );
}

/** A page title with its disambiguating qualifier set quietly: "conversations (aifun)". */
export function Title({ page }: { page: Page }) {
  const [name, qualifier] = splitTitle(page.title);
  return (
    <>
      {name}
      {qualifier && <span className="font-normal text-muted"> {qualifier}</span>}
    </>
  );
}

/** The bold blue link Wikipedia uses for the subject of a Main page item. */
export function Lead({ page, children }: { page: Page; children?: React.ReactNode }) {
  return (
    <Link href={wikiHref(page.slug)} className="link font-semibold">
      {children ?? <Title page={page} />}
    </Link>
  );
}

/** A plain link to a page, qualifier muted, kept on one line inside running lists. */
export function PageLink({ page, title, className = "" }: { page: Page; title?: string; className?: string }) {
  return (
    <Link href={wikiHref(page.slug)} title={title} className={`link whitespace-nowrap ${className}`}>
      <Title page={page} />
    </Link>
  );
}

/** "a, b and c" with React nodes. */
export function joinNodes(nodes: React.ReactNode[]): React.ReactNode[] {
  return nodes.map((n, i) => (
    <Fragment key={i}>
      {i === 0 ? null : i === nodes.length - 1 ? " and " : ", "}
      {n}
    </Fragment>
  ));
}

/** Middot-separated inline list. Lines break after a dot, never before one. */
export function Dotted({ children }: { children: React.ReactNode[] }) {
  return (
    <>
      {children.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <span aria-hidden className="px-1.5 text-faint">·</span>
              <wbr />
            </>
          )}
          {c}
        </Fragment>
      ))}
    </>
  );
}
