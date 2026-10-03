import Link from "next/link";
import { getIndex } from "@/lib/data";
import { searchHref, sourceHref, sourceLabel, wikiHref } from "@/lib/links";
import { readsAsInstructions } from "@/lib/text";
import type { Page } from "@/lib/types";
import { ContentsBox, ContentsNav, type ContentsItem } from "./article/contents-nav";
import { History } from "./article/history";
import { Infobox } from "./article/infobox";
import { count, leadSegs, leadSummary } from "./article/lead";
import { Notice, PageFoot, PageHeader, Section, Segs, Tool } from "./article/parts";
import { prepareReadme, Readme } from "./article/readme";
import { ExternalLinks, SeeAlso } from "./article/related";
import { Structure } from "./article/structure";
import { hasTechnology, Technology } from "./article/technology";

// A full Innerpedia article: contents on the left, the article with its infobox in
// the middle, sections only where there is something to say.

const SECTION_IDS = ["top", "overview", "structure", "technology", "history", "see-also", "external-links", "contents"];

function Hatnote({ page, slug }: { page: Page; slug: string }) {
  const key = slug.replace(/_\(disambiguation\)$/i, "");
  const others = (getIndex().index.disambiguation[key]?.slugs.length ?? 1) - 1;
  return (
    <p role="note" className="mt-5 pl-6 font-serif text-[15.5px] italic leading-snug text-ink-2">
      For {others > 1 ? `the ${count(others)} other folders` : "the other folder"} named {page.name}, see{" "}
      <Link href={wikiHref(slug)} className="link not-italic">
        {page.name} (disambiguation)
      </Link>
      .
    </p>
  );
}

export function ArticleView({ page, disambiguation }: { page: Page; disambiguation: string | null }) {
  const readme = prepareReadme(page, SECTION_IDS);
  const summary = leadSummary(page);
  const agentFile = page.markers.includes("CLAUDE.md") ? "CLAUDE.md" : "AGENTS.md";
  const agentQuote = !readme && page.agentNotes && page.agentNotes !== summary && !readsAsInstructions(page.agentNotes) ? page.agentNotes : null;
  const hasStructure = page.children.length > 0 || page.files.length > 0 || page.hiddenChildren.length > 0;
  const git = page.git && page.git.commitCount > 0 ? page.git : null;

  const items: ContentsItem[] = [{ id: "top", label: "(Top)" }];
  if (readme || agentQuote) {
    items.push({ id: "overview", label: "Overview" });
    for (const h of readme?.headings.slice(0, 10) ?? []) items.push({ id: h.id, label: h.text, depth: 1 });
  }
  if (hasStructure) items.push({ id: "structure", label: "Structure" });
  if (hasTechnology(page)) items.push({ id: "technology", label: "Technology" });
  if (git) items.push({ id: "history", label: "History" });
  if (page.related.length) items.push({ id: "see-also", label: "See also" });
  items.push({ id: "external-links", label: "External links" });

  const within = /\s/.test(page.name) ? `in:"${page.name}"` : `in:${page.name}`;

  return (
    <main className="xl:grid xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-12">
      <div className="hidden pt-1 xl:block">
        <ContentsNav items={items} />
      </div>

      <article className="mx-auto min-w-0 max-w-[640px] lg:max-w-[944px] xl:mx-0">
        <PageHeader
          page={page}
          title={page.title}
          tools={
            <>
              <Tool href={sourceHref(page.path)} external>
                {sourceLabel(page.path)}
              </Tool>
              {page.children.length > 0 && <Tool href={searchHref(within)}>Search inside</Tool>}
            </>
          }
        />

        <div className="flow-root">
          {disambiguation && <Hatnote page={page} slug={disambiguation} />}

          <Infobox page={page} className="rise mx-auto mt-7 w-full max-w-[420px] lg:float-right lg:mb-8 lg:ml-11 lg:w-[300px]" />

          <div className="lg:max-w-[600px]">
            <div className="prose-wiki rise mt-7">
              <p>
                <Segs segs={leadSegs(page)} />
              </p>
              {summary && <p>{summary}</p>}
            </div>

            {!page.readme && (
              <Notice page={page} className="mt-2">
                This article was written from the folder alone. You can help Innerpedia by{" "}
                <a href={sourceHref(page.path)} className="link whitespace-nowrap not-italic">
                  adding a README
                </a>
                .
              </Notice>
            )}

            <ContentsBox items={items} className="mt-8 xl:hidden" />

            {(readme || agentQuote) && (
              <Section id="overview" title="Overview">
                {readme ? (
                  <Readme doc={readme} />
                ) : (
                  <div className="prose-wiki">
                    <p>
                      The folder&apos;s <span className="font-mono text-[0.8em]">{agentFile}</span>, written for coding agents, begins:
                    </p>
                    <blockquote>{agentQuote}</blockquote>
                  </div>
                )}
              </Section>
            )}

            {hasStructure && (
              <Section id="structure" title="Structure">
                <Structure page={page} />
              </Section>
            )}

            {hasTechnology(page) && (
              <Section id="technology" title="Technology">
                <Technology page={page} />
              </Section>
            )}

            {git && (
              <Section id="history" title="History">
                <History git={git} />
              </Section>
            )}

            {page.related.length > 0 && (
              <Section id="see-also" title="See also">
                <SeeAlso page={page} />
              </Section>
            )}

            <Section id="external-links" title="External links">
              <ExternalLinks page={page} />
            </Section>
          </div>
        </div>

        <PageFoot page={page} />
      </article>
    </main>
  );
}
