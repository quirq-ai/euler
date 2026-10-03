import { appPath } from "@/lib/base-path";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { num } from "@/lib/format";
import { DEMO } from "@/lib/mode";
import { CHAPTERS } from "./chapters";
import { C, ChapterHead, Command, Excerpt, Fine, Prose, SectionHead } from "./parts";
import { Plate } from "./plate";
import { cite, exists, fileCount, fileHref, lineCount, lineOf, readText } from "./source";

// Chapter IV: a map of the code, four recipes quoted from the code itself, the loop,
// the conventions, and the checklist from CONTRIBUTING.md.

const MAP: { group: string; dir: string; items: { path: string; role: string; dir?: boolean }[] }[] = [
  {
    group: "The indexer",
    dir: "scripts/",
    items: [
      { path: "scripts/build-index.ts", role: "The crawler: walks the roots, reads, classifies, names, links and writes the index." },
      { path: "scripts/try-search.ts", role: "The search core from a terminal." },
      { path: "scripts/shot.mjs", role: "Headless screenshots of the running app, with the culprits of any sideways scroll." },
    ],
  },
  {
    group: "The core",
    dir: "lib/",
    items: [
      { path: "lib/types.ts", role: "The index contract: Page, IndexMeta, SiteIndex." },
      { path: "lib/text.ts", role: "Markdown to text, first paragraphs, house style, redaction. Shared with the indexer." },
      { path: "lib/normalize.ts", role: "Brings any index up to today's rules, at write and at load." },
      { path: "lib/data.ts", role: "Loads the index, reloads it when it changes, resolves every /wiki slug." },
      { path: "lib/search.ts", role: "MiniSearch, operators, the prior, snippets, did you mean, suggestions." },
      { path: "lib/links.ts", role: "wikiHref, categoryHref, searchHref, vscodeHref." },
      { path: "lib/activity.ts", role: "The history's folders: one per session, one JSON Lines file per app." },
      { path: "lib/db", role: "The database: PGlite on this machine, Neon on the demo, the same SQL for both.", dir: true },
    ],
  },
  {
    group: "The routes",
    dir: "app/",
    items: [
      { path: "app/page.tsx", role: "Home: the wordmark, the box, recently touched, then this guide." },
      { path: "app/activity/page.tsx", role: "History: every session, newest first, merged across apps." },
      { path: "app/search/page.tsx", role: "Results, tabs, the knowledge panel." },
      { path: "app/wiki/[slug]/page.tsx", role: "Every Innerpedia page but the Main page, through resolveSlug." },
      { path: "app/api/suggest/route.ts", role: "Suggestions for the search box, as you type." },
      { path: "app/api/activity/route.ts", role: "Writes the history: to this machine's folders, or on a demo with a database, to Neon for 30 days. Same origin only." },
      { path: "app/api/db/store/route.ts", role: "Store now, from the history page: the index and the history into this machine's database." },
      { path: "app/globals.css", role: "The tokens, both themes, the aurora, prose." },
    ],
  },
  {
    group: "The views",
    dir: "components/",
    items: [
      { path: "components/home", role: "The front page's pieces.", dir: true },
      { path: "components/search", role: "Results, chips, tabs, the panel, pagination.", dir: true },
      { path: "components/wiki", role: "Articles, stubs, categories, the Main page, specials.", dir: true },
      { path: "components/guide", role: "This guide, its plates and its recipe, bound in field-guide.tsx.", dir: true },
      { path: "components/sigil.tsx", role: "Every folder's identity: its own logo, or a sigil drawn from its slug." },
    ],
  },
  {
    group: "At the edges",
    dir: "./",
    items: [
      { path: "proxy.ts", role: "Refuses any request not addressed to localhost." },
      { path: "next.config.ts", role: "The Content-Security-Policy and the other headers." },
      { path: "innernet.config.json", role: "The roots and the depth." },
      { path: "DESIGN.md", role: "How it should look and sound." },
      { path: "CONTRIBUTING.md", role: "How to work on it." },
    ],
  },
];

export function Contribute() {
  return (
    <section aria-labelledby="contribute-title">
      <ChapterHead
        chapter={CHAPTERS[3]}
        kicker="Innernet is small enough to hold in your head: one crawler, one file, one search engine and an encyclopedia drawn from it."
      >
        <Prose>
          <p>
            It is a Next.js 16 app in TypeScript, served by the same machine it describes. Pages are Server Components that read the index directly; the browser
            receives HTML and a handful of small client components, each doing something only a browser can. The setup is three commands:
          </p>
        </Prose>
        <Command code={"pnpm install\npnpm index\npnpm dev"} className="mt-6 max-w-[640px]" caption="From this folder" />
      </ChapterHead>

      <SectionHead id="codebase" mark="IV.1" title="The codebase" />
      <Plate
        id="codebase"
        fig={9}
        title="The codebase"
        className="mt-10"
        alt="The project's folders and how data flows between them: scripts write the index, lib reads and searches it, app routes call lib, components render, and proxy.ts stands in front."
        caption={<>The codebase. <C>scripts/</C> writes the index, <C>lib/</C> reads and searches it, <C>app/</C> asks <C>lib/</C> and hands the answer to <C>components/</C>, and <C>proxy.ts</C> stands at the door.</>}
      />
      <FileMap />

      <SectionHead id="recipes" mark="IV.2" title="Four recipes" />
      <Prose className="mt-8">
        <p>The changes people make most, with the exact places to make them. The excerpts are read from the code as this page is served, so they are never out of date.</p>
      </Prose>
      <Recipes />

      <SectionHead id="the-loop" mark="IV.3" title="The loop" />
      <Plate
        id="contribute"
        fig={10}
        title="The contributor loop"
        className="mt-10"
        alt="A loop of five stations: edit, typecheck, crawl, screenshot, pull request, and back to edit."
        caption={<>The contributor loop. Edit, typecheck, crawl a small folder, screenshot both themes, open a pull request; and round again.</>}
      />
      <Loop />

      <SectionHead id="conventions" mark="IV.4" title="Conventions" />
      <Conventions />

      <SectionHead id="checklist" mark="IV.5" title="Pull request checklist" />
      <Checklist />
    </section>
  );
}

function FileMap() {
  return (
    <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2" data-reveal>
      {MAP.map((g) => (
        <div key={g.group} className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-line-strong pb-2">
            <span className="font-display text-[22px] leading-none text-ink">{g.group}</span>
            <span className="font-mono text-[12px] text-muted">{g.dir}</span>
          </div>
          <ul className="mt-1">
            {g.items.map((it) => {
              const lines = it.dir ? null : lineCount(it.path);
              const files = it.dir ? fileCount(it.path) : 0;
              const present = it.dir ? files > 0 : exists(it.path);
              return (
                <li key={it.path} className="relative border-b border-line py-2.5 pl-4">
                  <span aria-hidden className="absolute left-0 top-[18px] h-px w-2.5 bg-line-strong" />
                  <div className="flex items-baseline gap-3">
                    {present ? (
                      <a href={fileHref(it.path, it.dir)} className="min-w-0 truncate font-mono text-[13px] text-link hover:underline">
                        {it.path}
                        {it.dir ? "/" : ""}
                      </a>
                    ) : (
                      <span className="min-w-0 truncate font-mono text-[13px] text-muted">{it.path}</span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-faint">
                      {it.dir ? `${files} files` : lines ? `${num(lines)} lines` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{it.role}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Fine className="md:col-span-2">
        The indexer imports only <C>lib/text.ts</C>, <C>lib/normalize.ts</C> and <C>lib/types.ts</C>, so it runs outside Next. <C>lib/data.ts</C> and{" "}
        <C>lib/search.ts</C> import <C>server-only</C>: they never reach the browser. File names open {DEMO ? "on GitHub" : "in VS Code"}.
      </Fine>
    </div>
  );
}

function Recipe({ letter, title, lead, steps, children }: { letter: string; title: string; lead: string; steps: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <article className="mt-12 grid grid-cols-[30px_minmax(0,1fr)] gap-x-3 border-t border-line pt-8 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-8" data-reveal>
      <span aria-hidden className="font-display text-[36px] italic leading-[0.9] text-faint sm:text-[54px] sm:leading-[0.8]">
        {letter}
      </span>
      <div className="min-w-0">
        <h4 className="font-display text-[28px] leading-tight text-ink">{title}</h4>
        <p className="mt-1.5 font-serif text-[17px] italic leading-snug text-ink-2">{lead}</p>
        <ol className="fg-steps mt-4">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <div className="mt-5 space-y-3">{children}</div>
      </div>
    </article>
  );
}

/** ":128", or nothing when the line has moved away. */
const at = (file: string, needle: string) => {
  const n = lineOf(file, needle);
  return n ? `:${n}` : "";
};
const inParens = (ref: string) => (ref ? ` (${ref})` : "");

function Recipes() {
  const S = "lib/search.ts";
  const Q = "components/search/query-tools.ts";
  const V = "components/wiki/special-view.tsx";
  const B = "scripts/build-index.ts";
  const A = "components/wiki/article-view.tsx";
  return (
    <>
      <Recipe
        letter="A"
        title="Add a search operator"
        lead="Say, owner: for the author of a repository."
        steps={[
          <>
            In <C>{S}</C>, add the key to <C>ParsedQuery.filters</C>
            {inParens(at(S, "filters: { lang?"))} and <C>OPS</C>
            {inParens(at(S, "const OPS ="))}, to the operator regex in <C>parseQuery()</C> and to its copy in <C>correction()</C>, and write its test in{" "}
            <C>matchesFilters()</C>
            {inParens(at(S, "function matchesFilters"))}.
          </>,
          <>
            In <C>{Q}</C>, add it to <C>OP_RE</C> and give it a label in <C>OP_LABEL</C>. That is a <C>Record</C>, so typecheck fails until you do.
          </>,
          <>
            Chips appear on their own. If it earns a place, add an example to <C>EXAMPLES</C> in <C>components/home/example-queries.tsx</C> and to README.md and
            DESIGN.md.
          </>,
        ]}
      >
        <Excerpt file={S} from="const OPS =" lines={8} mark={["lang|in|kind|fw|is", "const OPS"]} />
        <Excerpt file={Q} from="const OP_RE =" lines={9} mark={["lang|in|kind|fw|is", "OP_LABEL"]} />
      </Recipe>

      <Recipe
        letter="B"
        title="Add a Special page"
        lead="Say, Special:Oldest, the articles nobody has touched in years."
        steps={[
          <>Routing is done: any <C>/wiki/Special:Name</C> already reaches <C>SpecialView</C>.</>,
          <>
            A page that redirects, like Random, is handled in <C>app/wiki/[slug]/page.tsx</C> before anything renders.
          </>,
          <>
            A page that renders gets a branch in <C>SpecialView</C> (
            <C>
              {V}
              {at(V, "export function SpecialView")}
            </C>
            ; branches test <C>key</C>, the name lowercased without spaces or underscores) and an entry in <C>SPECIALS</C>. Build it like{" "}
            <C>StatisticsView</C>, with <C>PageTitle prefix=&quot;Special: &quot;</C>, and keep heavy work in <C>insights.ts</C> behind <C>once()</C>.
          </>,
          <>
            Link it from <C>LINKS</C> in <C>components/wiki/wiki-shell.tsx</C> and <C>AREAS</C> in <C>components/wiki/main/browse.tsx</C>.
          </>,
        ]}
      >
        <Excerpt file={V} from="export function SpecialView" lines={7} mark={['key === "statistics"']} />
      </Recipe>

      <Recipe
        letter="C"
        title="Add a framework detector"
        lead="Say, TanStack Query, from @tanstack/react-query."
        steps={[
          <>
            For JavaScript, add <C>[&quot;package-name&quot;, &quot;Display Name&quot;]</C> to <C>FRAMEWORKS</C> in{" "}
            <C>
              {B}
              {at(B, "const FRAMEWORKS")}
            </C>
            . It matches a dependency or devDependency name exactly.
          </>,
          <>
            For every other manifest, add <C>[/\bname\b/i, &quot;Display Name&quot;]</C> to <C>PY_FRAMEWORKS</C>, a few lines further down{" "}
            <C>
              {B}
              {at(B, "const PY_FRAMEWORKS")}
            </C>
            . It matches the dependency names joined together.
          </>,
          <>
            If it names what a project is, the way Next.js makes a Next.js application, add a noun to <C>NOUNS</C> in <C>components/wiki/article/lead.ts</C> and to{" "}
            <C>APP_FRAMEWORKS</C> in <C>{Q}</C>.
          </>,
          <>Re-index. The category, <C>fw:</C>, the search weight, See also, the infobox and the result chips all follow.</>,
        ]}
      >
        <Excerpt file={B} from="const FRAMEWORKS" lines={4} mark={['["next", "Next.js"]']} />
      </Recipe>

      <Recipe
        letter="D"
        title="Add an article section"
        lead="Say, Releases, from a folder's tags."
        steps={[
          <>
            If it needs new data, add an optional field to <C>Page</C> in <C>lib/types.ts</C>, fill it in <C>crawl()</C> in <C>{B}</C>, and backfill it in{" "}
            <C>normalizeIndex()</C> when it can be worked out without the disk, so older indexes still load.
          </>,
          <>
            Create <C>components/wiki/article/&lt;name&gt;.tsx</C> exporting <C>hasX(page)</C> and <C>X({"{ page }"})</C>, patterned on <C>technology.tsx</C>, with{" "}
            <C>Sub</C> from <C>parts.tsx</C> for labelled blocks.
          </>,
          <>
            In <C>{A}</C>, add the id to <C>SECTION_IDS</C> so a README heading cannot claim it, push a contents item, and render <C>&lt;Section id title&gt;</C> where it
            belongs. Stubs have their own view, <C>stub-view.tsx</C>.
          </>,
        ]}
      >
        <Excerpt file={A} from="const SECTION_IDS" lines={1} mark={["SECTION_IDS"]} />
        <Excerpt file={A} from='if (hasStructure) items.push' lines={5} mark={["hasTechnology"]} />
        <Excerpt file="components/wiki/article/technology.tsx" from="export function hasTechnology" lines={3} mark={["export function hasTechnology"]} />
      </Recipe>
    </>
  );
}

const CHECKS: { what: string; code: string; expect: string }[] = [
  { what: "Anything", code: "pnpm -s typecheck", expect: "A clean exit in about a second." },
  { what: "Search, ranking, operators", code: 'pnpm tsx --conditions=react-server scripts/try-search.ts "linear clone"', expect: "Results, the knowledge-panel pick, did you mean and suggestions." },
  { what: "Anything you can see", code: 'scripts/shot.sh "/wiki/innernet" out.png 1440 2400 dark', expect: "A settled screenshot, and the elements that scroll the page sideways, if any." },
  { what: "The indexer", code: "INNERNET_ROOTS=~/some/small/dir INNERNET_OUT=/tmp/innernet-test.json pnpm index", expect: "A test index; the real one is left alone." },
  { what: "The database", code: "INNERNET_DB_DIR=/tmp/innernet-db pnpm db:store", expect: "The index and the history stored in a scratch copy; then pnpm db:status with the same folder." },
  { what: "Copy", code: `rg -n "[\\x{2013}\\x{2014}]" -g '!node_modules' -g '!.next' -g '!data' .`, expect: "No matches: no em or en dashes anywhere." },
];

function Loop() {
  return (
    <>
      <Prose className="mt-12">
        <p>
          There is no lint, test or format tooling. Edit, let hot reload show you the page, then run the check for the part you touched. The dev server must run from
          this folder, because it reads the index relative to where it starts.
        </p>
      </Prose>
      <ol className="mt-8 space-y-6">
        {CHECKS.map((c, i) => (
          <li key={c.what} className="grid gap-x-6 gap-y-2 sm:grid-cols-[180px_minmax(0,1fr)]" data-reveal>
            <div className="pt-1">
              <div className="fg-smallcaps text-faint">Check {i + 1}</div>
              <div className="mt-1 font-display text-[21px] leading-tight text-ink">{c.what}</div>
            </div>
            <div className="min-w-0">
              <Command code={c.code} />
              <p className="mt-1.5 text-[13px] text-muted">{c.expect}</p>
            </div>
          </li>
        ))}
      </ol>
      <Fine className="mt-6">
        <C>try-search</C> needs <C>--conditions=react-server</C> because the search core imports <C>server-only</C>. <C>shot.sh</C> talks to port 3470 unless{" "}
        <C>SHOT_BASE</C> says otherwise; its last arguments are the height and the theme, and <C>SHOT_SCROLL</C> captures the window scrolled to an element.
      </Fine>
    </>
  );
}

const CONVENTIONS: { title: string; text: React.ReactNode }[] = [
  {
    title: "Server first",
    text: (
      <>
        Pages are Server Components. The browser asks only this app, and only two routes: the search box asks <C>/api/suggest</C>, and the history posts each page to{" "}
        <C>/api/activity</C> (on a demo with a database, its history page also reads and clears the visitor&apos;s own sessions there). On this machine nothing ever
        leaves it. A new client component needs a reason only the browser can satisfy.
      </>
    ),
  },
  {
    title: "Shared code stays shared",
    text: (
      <>
        <C>text</C>, <C>normalize</C>, <C>types</C>, <C>links</C>, <C>format</C> and <C>lang-colors</C> in <C>lib/</C> stay free of <C>server-only</C> and of Next, so
        the indexer and the browser can use them.
      </>
    ),
  },
  {
    title: "Tokens, not values",
    text: (
      <>
        Colours live in <C>app/globals.css</C>, in four places: <C>:root</C>, the dark media query, <C>[data-theme=&quot;dark&quot;]</C> and <C>@theme inline</C>.
        Components use the utilities, never hex. Check both themes.
      </>
    ),
  },
  {
    title: "Links through lib/links.ts",
    text: (
      <>
        Slugs hold spaces, parentheses and commas. <C>wikiHref</C>, <C>categoryHref</C>, <C>searchHref</C> and <C>vscodeHref</C> encode them for you.
      </>
    ),
  },
  {
    title: "Index text is never HTML",
    text: (
      <>
        Snippets and leads are arrays of segments rendered as React nodes; READMEs go through react-markdown with <C>skipHtml</C>. Nothing from the index goes near{" "}
        <C>dangerouslySetInnerHTML</C>.
      </>
    ),
  },
  {
    title: "House style",
    text: <>Encyclopedia voice in article prose. Plain, warm, a little wry. No exclamation marks, and no em or en dashes anywhere: commas, colons, middots or full stops.</>,
  },
];

function Conventions() {
  return (
    <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
      {CONVENTIONS.map((c, i) => (
        <div key={c.title} className="min-w-0 border-t border-line pt-4" data-reveal>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
            <h4 className="font-display text-[22px] leading-tight text-ink">{c.title}</h4>
          </div>
          <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-2">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

/** `code` spans and [links](url) in one line of the checklist, as React nodes. */
function inline(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const m of md.matchAll(re)) {
    if (m.index! > last) out.push(md.slice(last, m.index));
    if (m[1]) out.push(<C key={m.index}>{m[1]}</C>);
    else out.push(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(m[3]) ? <a key={m.index} href={appPath(new URL(m[3]).pathname)} className="link">{m[2]}</a> : <span key={m.index}>{m[2]}</span>);
    last = m.index! + m[0].length;
  }
  if (last < md.length) out.push(md.slice(last));
  return out;
}

function Checklist() {
  const text = readText("CONTRIBUTING.md");
  const section = text?.split(/\n## /).find((s) => s.startsWith("Pull request checklist"));
  const items = section?.split("\n").filter((l) => l.startsWith("- [ ] ")).map((l) => l.slice(6)) ?? [];
  return (
    <>
      {items.length > 0 && (
        <ul className="mt-8 divide-y divide-line border-y border-line" data-reveal>
          {items.map((it, i) => (
            <li key={i}>
              <label className="group flex cursor-pointer items-start gap-3.5 py-3 text-[15px] leading-snug text-ink-2 has-[:checked]:text-muted">
                <input type="checkbox" className="fg-check mt-[3px]" />
                <span className="decoration-faint group-has-[:checked]:line-through">{inline(it)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <Fine className="mt-3">Read from {text ? cite("CONTRIBUTING.md", "## Pull request checklist") : "CONTRIBUTING.md"} as the page is served. Ticks last as long as the page.</Fine>
      {text && (
        <details className="group mt-10 rounded-2xl border border-line bg-surface shadow-[var(--shadow-sm)]" data-reveal>
          <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[24px] leading-tight text-ink">CONTRIBUTING.md</span>
              <span className="block text-[13px] text-muted">The whole of it, as it stands in the repository.</span>
            </span>
            <span className="fg-smallcaps shrink-0 group-open:hidden">Read it</span>
            <span className="fg-smallcaps hidden shrink-0 group-open:inline">Fold it</span>
            <svg aria-hidden width="11" height="11" viewBox="0 0 10 10" className="shrink-0 text-muted transition-transform group-open:rotate-180">
              <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="prose-wiki fg-contributing border-t border-line px-5 pb-4 pt-2 sm:px-8">
            <Markdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                h1: () => null,
                a: ({ href, children }) =>
                  href && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(href) ? <a href={appPath(new URL(href).pathname)}>{children}</a> : <span className="font-mono text-[0.85em]">{children}</span>,
                // The list above is the one to tick; these boxes are only the file's own.
                input: ({ checked }) => <input type="checkbox" checked={!!checked} disabled aria-hidden className="fg-check mr-2 cursor-default align-[-2px]" />,
              }}
            >
              {text}
            </Markdown>
          </div>
          <p className="border-t border-line px-5 py-3 text-[13px] sm:px-8">
            <a href={fileHref("CONTRIBUTING.md")} className="link">
              {DEMO ? "Read CONTRIBUTING.md on GitHub" : "Open CONTRIBUTING.md in VS Code"}
            </a>
          </p>
        </details>
      )}
    </>
  );
}
