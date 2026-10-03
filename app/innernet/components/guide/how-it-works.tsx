import Link from "next/link";
import { count, leadSegs } from "@/components/wiki/article/lead";
import { Segs } from "@/components/wiki/article/parts";
import { ResultItem } from "@/components/search/result-item";
import { getIndex, getPage } from "@/lib/data";
import { bytes, num } from "@/lib/format";
import { categoryHref, searchHref, wikiHref } from "@/lib/links";
import { DEMO, INDEX_PATH } from "@/lib/mode";
import { pageSummary, search } from "@/lib/search";
import type { Page } from "@/lib/types";
import { CHAPTERS } from "./chapters";
import { depthCounts, indexFacts, kindCounts, specimenPage } from "./data";
import { C, ChapterHead, Excerpt, Figures, Fine, Prose, SectionHead } from "./parts";
import { Figure, Plate } from "./plate";
import { cite, fileSize } from "./source";

// Chapter I: the pipeline, then its three stations, each with its plate and the live
// numbers of this machine's index.

const B = "scripts/build-index.ts";

export function HowItWorks() {
  const { index, missing } = getIndex();
  const { meta } = index;
  const size = fileSize(INDEX_PATH);
  const roots = meta.roots.map((r) => r.label);
  // The demo's root is a GitHub organization that `pnpm index` would not walk.
  const walked = DEMO ? [] : roots;
  const facts = indexFacts();

  return (
    <section aria-labelledby="how-it-works-title">
      <ChapterHead
        chapter={CHAPTERS[0]}
        kicker="One command reads your folders into one file. Two readers, a search engine and an encyclopedia, turn that file into pages you can browse."
      >
        <Plate
          id="pipeline"
          fig={1}
          title="The pipeline"
          alt="Folders on disk flow into the indexer, which writes one file, data/index.json. Two readers, search and Innerpedia, read that file and show it to you."
          caption={
            <>
              The pipeline. Folders are crawled by <C>pnpm index</C> into <C>data/index.json</C>; the server reads that one file twice, as search results and as Innerpedia
              pages, and you read both.
            </>
          }
        />
        <Prose className="mt-12">
          <p>
            Innernet is a personal internet. Its web is the folders on this machine; its search engine finds them the way you find pages, and its encyclopedia,
            Innerpedia, gives every project an article and every other folder a stub. Nothing leaves the machine.
          </p>
          <p>
            The whole thing runs on one file. <C>pnpm index</C> walks {walked.length ? <C>{walked.join(", ")}</C> : "the configured roots"}, reads a handful of small
            files in each folder, and writes <C>data/index.json</C> through a temporary file and a rename, so the server never sees half of one. The server checks the
            file&apos;s modification time on every request and reloads it when it changes: no restart, no file watcher.
          </p>
        </Prose>
        {!missing && (
          <Figures
            className="mt-10"
            items={[
              { value: num(meta.counts.pages), label: "folders indexed", note: roots.join(", ") },
              { value: meta.maxDepth + 1, label: "levels of pages", note: `maxDepth ${meta.maxDepth}, depth 0 to ${meta.maxDepth}` },
              { value: `${Math.round(meta.durationMs / 1000)} s`, label: "to index, last run", note: "durationMs" },
              { value: size ? bytes(size) : "none", label: "one JSON file", note: INDEX_PATH },
            ]}
          />
        )}
      </ChapterHead>

      {/* ---------------------------------------------------------------- the crawl */}
      <SectionHead id="the-crawl" mark="I.1" title="The crawl" aside="Station one" />
      <Plate
        id="crawl"
        fig={2}
        title="The crawl"
        className="mt-10"
        alt="A folder tree drawn as rings of depth from 0 to 6. Pruned folders such as node_modules are struck through, and only a few files in each folder are read."
        caption={
          <>
            The crawl. Depth first, subfolders in name order, {count((meta.maxDepth || 6) + 1)} rings of depth from the root at 0 to the limit at {meta.maxDepth || 6}. Pruned folders are passed
            by unopened; in each folder only the README, the agent notes, one manifest and the git history are read.
          </>
        }
      />
      <Prose className="mt-12">
        <p>
          The crawler starts at each root and goes down, one folder at a time, sorting subfolders by name. A folder gets a page at every depth from the root at 0 to{" "}
          {meta.maxDepth || 6}; the limit is inclusive, so there are {count((meta.maxDepth || 6) + 1)} levels of pages. A folder at the limit that still has folders inside keeps
          a tally of what lies below{!missing && <> ({num(facts.deeper)} of them do)</>}, so it is never called empty.
        </p>
      </Prose>
      {!missing && <DepthChart />}
      <Prose className="mt-10">
        <p>
          It never follows a symlink, skips any folder holding <C>pyvenv.cfg</C> (a Python virtualenv by any name), and prunes names that are build output, caches or
          dependencies. Pruned names that do not start with a dot, and <C>.git</C>, are listed on the parent&apos;s page as left out; other dot-folders vanish without a
          word.
        </p>
      </Prose>
      <Excerpt file={B} from="const PRUNE = new Set([" lines={7} className="mt-6" />
      <Prose className="mt-8">
        <p>
          In each folder it opens three kinds of file at most: the README (its first 14,000 bytes), <C>CLAUDE.md</C> or else <C>AGENTS.md</C> (the first prose
          paragraph of its first 20,000 bytes), and one manifest (<C>package.json</C>, then <C>pyproject.toml</C>, <C>Cargo.toml</C>, <C>go.mod</C>,{" "}
          <C>requirements.txt</C>). A folder with its own <C>.git</C> also gets five <C>git</C> commands, ten seconds each at most. Every other file is only counted:
          its size, its dates and its extension, which becomes a language.
        </p>
      </Prose>
      {!missing && (
        <Figures
          className="mt-10"
          items={[
            { value: num(facts.rootFiles), label: "files counted under the roots" },
            { value: bytes(facts.rootBytes), label: "in all" },
            { value: num(meta.counts.repos), label: "git histories read" },
            { value: num(facts.deeper), label: "folders at the limit with a tally" },
          ]}
        />
      )}

      {/* ---------------------------------------------------------------- the index */}
      <SectionHead id="the-index" mark="I.2" title="The index" aside="Station two" />
      <Plate
        id="anatomy"
        fig={3}
        title="Anatomy of an article"
        className="mt-10"
        alt="A folder's ingredients mapped to the parts of an article: the README to the lead and Overview, package.json to the infobox and Technology, .git to History, CLAUDE.md to the agent line, and the files to the languages bar."
        caption={
          <>
            Anatomy of an article. Each ingredient of a folder feeds a part of its page: the README the lead and Overview, the manifest the infobox and Technology,
            <C>.git</C> the History, <C>CLAUDE.md</C> a line for the agents, and the files themselves the languages bar.
          </>
        }
      />
      <Prose className="mt-12">
        <p>
          Every folder becomes one record in the index. Each gets a <em>kind</em>, decided by the first rule that matches, and becomes either an article or a stub.
          Repositories, projects, document folders of four files or more, folders with agent notes and the roots are articles; everything else is a stub, a short page
          that asks politely for a README.
        </p>
      </Prose>
      <KindTable />
      <Prose className="mt-10">
        <p>
          Then the records are joined up. Each page learns its parent and children and the nearest enclosing project (its <em>partOf</em>
          {!missing && <>, set on {num(facts.partOf)} pages</>}). Articles are filed into categories{!missing && <>, {num(meta.counts.categories)} of them</>}, and
          given up to eight See also links by how much they share: frameworks, dependencies, categories, words in their names. Folders that share a name are told
          apart, which chapter two explains. Last, <C>normalizeIndex</C> blacks out anything that looks like a credential, sets the text in house style, and rolls
          dates up the tree, before the file is written.
        </p>
      </Prose>
      <Fine className="mt-4">
        Kind and article: {cite(B, 'if (hasGit) page.kind = "repo"')} to {cite(B, "page.isArticle =")}. The write: {cite(B, "fs.renameSync(tmpFile, outFile)")}.
      </Fine>

      {/* ---------------------------------------------------------------- the readers */}
      <SectionHead id="the-readers" mark="I.3" title="The two readers" aside="Station three" />
      <Specimen />
      <Prose className="mt-12">
        <p>
          The first reader is a search engine. On the first search after the file changes, the server builds a full-text index of every page with MiniSearch, which
          takes a quarter of a second or so; after that a search takes a few milliseconds. It answers in the manners of the web: &ldquo;About 36 results (0.004
          seconds)&rdquo;, blue links that turn violet once visited, a knowledge panel for a clear winner, and a box that suggests pages as you type. Chapter three is
          about using it well.
        </p>
        <p>
          The second reader is <Link href="/wiki" className="link">Innerpedia</Link>, which writes each record up the way Wikipedia would: a lead in encyclopedia voice,
          an infobox, contents, hatnotes for namesakes, categories at the foot. Every kind of page is served by one route.
        </p>
      </Prose>
      <PageTypes />
    </section>
  );
}

function DepthChart() {
  const rows = depthCounts();
  const max = Math.max(1, ...rows.map((r) => r.pages));
  return (
    <figure className="mt-10" data-reveal>
      <div className="fg-label mb-4 flex items-baseline justify-between">
        <span>Pages at each depth</span>
        <span className="font-mono normal-case tracking-normal text-faint">0 is the root</span>
      </div>
      <div aria-hidden className="flex h-[170px] items-end gap-2 border-b border-line-strong sm:gap-4">
        {rows.map((r) => (
          <div key={r.depth} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`Depth ${r.depth}: ${num(r.pages)} pages`}>
            <span className="mb-1.5 text-center font-mono text-[11px] tabular-nums text-muted transition-colors group-hover:text-ink">{num(r.pages)}</span>
            <span className="fg-bar block w-full rounded-t-[4px]" style={{ height: `${Math.max(1.5, (r.pages / max) * 100 * 0.78)}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-2 flex gap-2 sm:gap-4">
        {rows.map((r) => (
          <span key={r.depth} className="min-w-0 flex-1 text-center font-display text-[17px] text-ink-2">
            {r.depth}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Pages at each depth below the root</caption>
        <thead>
          <tr>
            <th scope="col">Depth</th>
            <th scope="col">Pages</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.depth}>
              <td>{r.depth}</td>
              <td>{r.pages}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="fg-fine mt-3">Each depth holds more folders than the one above it, and the limit cuts the widest ring.</figcaption>
    </figure>
  );
}

const KIND_RULES: Record<string, { name: string; rule: string }> = {
  repo: { name: "repo", rule: "Has its own .git, a folder or a file." },
  project: { name: "project", rule: "A manifest, pubspec.yaml, or a README of 25 words or more. Agent notes promote any non-repo to this." },
  docs: { name: "docs", rule: "Two or more files, at least 60% documents. An article from four files." },
  assets: { name: "assets", rule: "Three or more files, at least 60% media; or media alone and no subfolders." },
  code: { name: "code", rule: "Named like source (src, lib, app, components...) or at least half code." },
  folder: { name: "folder", rule: "None of the above." },
};

function KindTable() {
  const rows = kindCounts();
  return (
    <div className="mt-8 overflow-x-auto" data-reveal>
      <table className="fg-table fg-stack sm:min-w-[560px]">
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">What makes it, first match wins</th>
            <th scope="col" className="text-right">
              Articles
            </th>
            <th scope="col" className="text-right">
              Stubs
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind}>
              <td>
                <Link href={searchHref(`kind:${r.kind}`)} className="link font-mono text-[13px]">
                  {KIND_RULES[r.kind].name}
                </Link>
              </td>
              <td className="fg-wide text-ink-2">{KIND_RULES[r.kind].rule}</td>
              <td data-label="articles" className="text-right font-mono tabular-nums">{r.articles ? num(r.articles) : <span className="text-faint">0</span>}</td>
              <td data-label="stubs" className="text-right font-mono tabular-nums">{r.stubs ? num(r.stubs) : <span className="text-faint">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One real page, read by both readers at once: its record in the index, the search
 * result it makes, and the opening of its article. */
function Specimen() {
  const page = specimenPage();
  if (!page) return null;
  const res = search(page.name, { perPage: 10, correct: false });
  const hit = res.hits.find((h) => h.page.slug === page.slug) ?? { page, score: 0, snippet: [{ text: pageSummary(page) ?? "" }] };
  return (
    <Figure
      fig={4}
      title="Two readers, one record"
      className="mt-10"
      bodyClassName="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      caption={
        <>
          Two readers, one record. The entry for <Link href={wikiHref(page.slug)} className="link not-italic">{page.title}</Link> in <C>{INDEX_PATH}</C>, as{" "}
          {DEMO ? "the demo" : "this machine"} holds it today, and what each reader makes of it.
        </>
      }
      imprint={
        <>
          <span>Drawn live from the index</span>
          <span>{page.slug}</span>
        </>
      }
    >
      <div className="min-w-0 border-line px-4 py-5 sm:px-6 lg:border-r">
        <div className="fg-label mb-3">The record</div>
        <Record page={page} />
      </div>
      <div className="min-w-0 divide-y divide-line">
        <div className="px-4 py-5 sm:px-6">
          <div className="fg-label mb-4">
            As a search result{" "}
            <Link href={searchHref(page.name)} className="ml-1 font-sans normal-case tracking-normal text-link hover:underline">
              for {page.name}
            </Link>
          </div>
          <ul>
            <ResultItem hit={hit} index={0} />
          </ul>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="fg-label mb-3">As an Innerpedia article</div>
          <div className="font-display text-[30px] leading-tight text-ink">{page.title}</div>
          <div className="mt-1 border-t border-line pt-1.5 font-serif text-[12.5px] italic text-muted">From Innerpedia, the encyclopedia of you</div>
          <p className="mt-3 font-serif text-[15.5px] leading-[1.62] text-ink">
            <Segs segs={leadSegs(page)} />
          </p>
          <Link href={wikiHref(page.slug)} className="link mt-2 inline-block text-[13px]">
            Read the article
          </Link>
        </div>
      </div>
    </Figure>
  );
}

function Record({ page }: { page: Page }) {
  const clip = (s: string | null, n: number) => (s ? (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s) : null);
  const fields: [string, React.ReactNode][] = [
    ["slug", <S key="s">{page.slug}</S>],
    ["kind", <S key="k">{page.kind}</S>],
    ["isArticle", <V key="a">{String(page.isArticle)}</V>],
    ["depth", <V key="d">{page.depth}</V>],
    ["languages", <L key="l" items={page.languages.slice(0, 3).map((l) => `${l.name} ${l.files}`)} />],
    ["frameworks", <L key="f" items={page.frameworks.slice(0, 3)} />],
    ["totalFiles", <V key="t">{page.totalFiles}</V>],
    ["markers", <L key="m" items={page.markers.slice(0, 4)} />],
    ["summary", <S key="u">{clip(pageSummary(page), 92) ?? "null"}</S>],
    ["categories", <L key="c" items={page.categories.slice(0, 3)} more={page.categories.length - 3} />],
    ["related", <L key="r" items={page.related.slice(0, 2)} more={page.related.length - 2} />],
  ];
  return (
    <pre className="whitespace-pre-wrap font-mono text-[12px] leading-[1.75] text-ink-2 [overflow-wrap:anywhere]">
      <code>
        <span className="text-faint">{"{"}</span>
        {"\n"}
        {fields.map(([k, v], i) => (
          <span key={k} className="block pl-8 -indent-4">
            <span className="text-muted">&quot;{k}&quot;</span>
            <span className="text-faint">: </span>
            {v}
            {i < fields.length - 1 && <span className="text-faint">,</span>}
          </span>
        ))}
        <span className="block pl-4 text-faint">…</span>
        <span className="text-faint">{"}"}</span>
      </code>
    </pre>
  );
}

const S = ({ children }: { children: React.ReactNode }) => <span className="whitespace-pre-wrap text-ink">&quot;{children}&quot;</span>;
const V = ({ children }: { children: React.ReactNode }) => <span className="text-link">{children}</span>;
function L({ items, more = 0 }: { items: string[]; more?: number }) {
  return (
    <span>
      <span className="text-faint">[</span>
      {items.map((x, i) => (
        <span key={x}>
          {i > 0 && <span className="text-faint">, </span>}
          <span className="text-ink">&quot;{x}&quot;</span>
        </span>
      ))}
      {more > 0 && <span className="text-faint">, +{more}</span>}
      <span className="text-faint">]</span>
    </span>
  );
}

function PageTypes() {
  const { index, articles, categories } = getIndex();
  const stub = index.pages.find((p) => !p.isArticle && p.partOf === "innernet") ?? index.pages.find((p) => !p.isArticle && p.depth === 3);
  const article = getPage("innernet") ?? articles[0];
  const dis = Object.entries(index.disambiguation).sort((a, b) => b[1].slugs.length - a[1].slugs.length)[0]?.[0];
  const cat = categories.has("Next.js") ? "Next.js" : [...categories.keys()][0];
  const rows: { type: string; href?: string; url: string; note: string }[] = [
    { type: "Main page", href: "/wiki", url: "/wiki", note: "Featured article, In the news, Did you know, On this day, categories." },
    { type: "Article", href: article ? wikiHref(article.slug) : undefined, url: article ? `/wiki/${article.slug}` : "/wiki/<slug>", note: "Projects, repositories, document collections and the roots." },
    { type: "Stub", href: stub ? wikiHref(stub.slug) : undefined, url: stub ? `/wiki/${stub.slug}` : "/wiki/<slug>", note: "Every other folder: a lead, its contents, a request for a README." },
    { type: "Disambiguation", href: dis ? wikiHref(dis) : undefined, url: dis ? `/wiki/${dis}` : "/wiki/<name>", note: "Folders that share a name, grouped by the project they sit in." },
    { type: "Category", href: cat ? categoryHref(cat) : undefined, url: cat ? `/wiki/Category:${cat.replace(/ /g, "_")}` : "/wiki/Category:<Name>", note: "Collections, languages, frameworks, years, kinds, maintenance, parts." },
    { type: "Special", href: wikiHref("Special:Statistics"), url: "/wiki/Special:Statistics", note: "Random, AllPages, Categories and Statistics." },
  ];
  return (
    <div className="mt-8 overflow-x-auto" data-reveal>
      <table className="fg-table fg-stack sm:min-w-[560px]">
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Example</th>
            <th scope="col">Holds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type}>
              <td className="whitespace-nowrap text-ink">{r.type}</td>
              <td className="font-mono text-[12.5px]">
                {r.href ? (
                  <Link href={r.href} className="link [overflow-wrap:anywhere]" prefetch={false}>
                    {r.url}
                  </Link>
                ) : (
                  <span className="text-muted">{r.url}</span>
                )}
              </td>
              <td className="fg-wide text-ink-2">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

