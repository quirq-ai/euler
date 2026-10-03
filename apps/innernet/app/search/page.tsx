import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyTab } from "@/components/search/empty-tab";
import { KnowledgePanel } from "@/components/search/knowledge-panel";
import { NoResults } from "@/components/search/no-results";
import { OperatorChips } from "@/components/search/operator-chips";
import { Pagination } from "@/components/search/pagination";
import { relatedSearches } from "@/components/search/query-tools";
import { RelatedSearches } from "@/components/search/related-searches";
import { ResultItem } from "@/components/search/result-item";
import { ResultTabs } from "@/components/search/result-tabs";
import { SiteFooter } from "@/components/site-footer";
import { TopBar } from "@/components/top-bar";
import { num } from "@/lib/format";
import { searchHref } from "@/lib/links";
import { search, TABS, type SearchResponse, type Tab } from "@/lib/search";

// Results for /search?q=&t=&p=. Everything is computed here on the server; the page
// ships as HTML apart from the search box in the header.

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// On wide screens the results line up with the magnifier in the header's search box.
const INDENT = "xl:pl-[123px]";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function readParams(searchParams: Props["searchParams"]) {
  const sp = await searchParams;
  // Long enough for any real query; longer ones only cost time.
  const q = one(sp.q).trim().slice(0, 256).trim();
  const t = one(sp.t);
  const tab: Tab = TABS.some((x) => x.id === t) ? (t as Tab) : "all";
  const p = Number.parseInt(one(sp.p), 10);
  return { q, tab, page: Number.isFinite(p) && p > 0 ? p : 1 };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await readParams(searchParams);
  return { title: { absolute: q ? `${q} · Innernet` : "Innernet" } };
}

function MetaLine({ res }: { res: SearchResponse }) {
  const secs = Math.max(res.tookMs / 1000, 0.001).toFixed(3);
  const count = res.total === 1 ? "1 result" : `${res.total >= 10 ? "about " : ""}${num(res.total)} results`;
  const lead = res.page > 1 ? `Page ${res.page} of ${count}` : count[0].toUpperCase() + count.slice(1);
  return (
    <p className="text-[13px] text-muted tabular-nums">
      {lead} <span>({secs} seconds)</span>
    </p>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tab, page } = await readParams(searchParams);
  if (!q) redirect("/");

  const res = search(q, { tab, page });
  const fix = res.didYouMean;
  // A likely typo makes the hits weak, so related searches would only echo it.
  const related = res.hits.length && !fix ? relatedSearches(res, tab) : [];
  const best = res.page === 1 && tab === "all" ? res.best : null;
  const hasOps = Object.keys(res.query.filters).length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col">
      <TopBar q={q} />

      <div className="border-b border-line">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className={INDENT}>
            <ResultTabs q={q} tab={tab} counts={res.counts} />
          </div>
        </div>
      </div>

      <main id="content" tabIndex={-1} className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-20 pt-5 focus:outline-none sm:px-6">
        <h1 className="sr-only">
          Search results for {q}
          {tab !== "all" && ` in ${TABS.find((t) => t.id === tab)!.label}`}
        </h1>
        <div className={`grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,652px)_minmax(300px,360px)] ${INDENT}`}>
          <div className="min-w-0">
            {(hasOps || res.total > 0) && (
              <div className="space-y-3">
                <OperatorChips query={res.query} tab={tab} />
                {res.total > 0 && <MetaLine res={res} />}
              </div>
            )}

            {res.total > 0 && fix && (
              <p className="mt-3 text-[15px] text-ink-2">
                Did you mean{" "}
                <Link href={searchHref(fix, { t: tab === "all" ? undefined : tab })} className="link font-serif text-[17px] font-medium italic">
                  {fix}
                </Link>
                ?
              </p>
            )}

            {best && (
              <div className="mt-6 lg:hidden">
                <KnowledgePanel page={best} />
              </div>
            )}

            {res.total > 0 ? (
              <section aria-labelledby="results-h">
                <h2 id="results-h" className="sr-only">
                  Results
                </h2>
                <ol className="mt-7 space-y-9">
                  {res.hits.map((h, i) => (
                    <ResultItem key={h.page.slug} hit={h} index={i} lang={res.query.filters.lang} sitelinks={i === 0 && res.page === 1} />
                  ))}
                </ol>
              </section>
            ) : (
              <div className={hasOps ? "mt-8" : "mt-4"}>
                {tab !== "all" && res.counts.all > 0 ? (
                  <EmptyTab q={q} tab={tab} counts={res.counts} />
                ) : (
                  <NoResults text={res.query.text} filtered={hasOps} correction={fix} />
                )}
              </div>
            )}

            {related.length > 0 && (
              <div className="mt-14 border-t border-line pt-8">
                <RelatedSearches q={q} tab={tab} items={related} />
              </div>
            )}

            {res.pages > 1 && (
              <div className="mt-14">
                <Pagination q={q} tab={tab} page={res.page} pages={res.pages} />
              </div>
            )}
          </div>

          {best && (
            <div className="hidden lg:block">
              <KnowledgePanel page={best} />
            </div>
          )}
        </div>
      </main>

      <SiteFooter
        links={[
          { href: "/", label: "Home" },
          { href: "/wiki", label: "Innerpedia" },
        ]}
      />
    </div>
  );
}
