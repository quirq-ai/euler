import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { cap, featured, gloss, undash } from "@/components/wiki/main/insights";
import { Box, Dotted, PageLink, Title } from "@/components/wiki/main/section";
import { plural, timeAgo } from "@/lib/format";
import { wikiHref } from "@/lib/links";

const WORDS = 80;

export function FeaturedArticle({ delay, className }: { delay?: number; className?: string }) {
  const [page, ...others] = featured();
  if (!page) return null;
  const words = undash(page.summary ?? "").split(/\s+/);
  const blurb = words.length > WORDS ? `${words.slice(0, WORDS).join(" ").replace(/[,.;:]$/, "")} …` : words.join(" ");
  const href = wikiHref(page.slug);

  return (
    <Box id="featured" title="From today’s featured article" delay={delay} className={className}>
      <article className="flow-root">
        <Link href={href} tabIndex={-1} aria-hidden className="float-left mb-3 mr-5 mt-1 block transition-transform duration-300 hover:-rotate-3">
          <PageSigil page={page} size={84} muted={false} className="shadow-soft" />
        </Link>
        <h3 className="font-display text-[32px] leading-[1.08] tracking-[-0.01em] sm:text-[36px]">
          <Link href={href} className="text-ink transition-colors hover:text-link">
            <Title page={page} />
          </Link>
        </h3>
        <p className="mt-1.5 text-[13px] text-muted">
          <Dotted>
            {[
              <span key="g">{cap(gloss(page))}</span>,
              ...(page.git ? [<span key="c" className="whitespace-nowrap tabular-nums">{plural(page.git.commitCount, "commit")}</span>] : []),
              <span key="t" className="whitespace-nowrap">touched {timeAgo(page.modified)}</span>,
            ]}
          </Dotted>
        </p>
        <p className="mt-4 font-serif text-[17.5px] leading-[1.65] text-ink">
          {blurb}{" "}
          <Link href={href} className="link whitespace-nowrap font-sans text-[14px] font-medium">
            Read more →
          </Link>
        </p>
      </article>
      {others.length > 0 && (
        <p className="mt-5 border-t border-line pt-3 text-[13px] leading-relaxed text-muted">
          <span className="mr-1.5 font-medium text-ink-2">Also notable:</span>
          <Dotted>
            {others.map((p) =>
              // A folder name with no spaces may be longer than a phone is wide.
              p.name.length > 28 ? (
                <Link key={p.slug} href={wikiHref(p.slug)} className="link [overflow-wrap:anywhere]">
                  <Title page={p} />
                </Link>
              ) : (
                <PageLink key={p.slug} page={p} />
              ),
            )}
          </Dotted>
        </p>
      )}
    </Box>
  );
}
