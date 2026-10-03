import Link from "next/link";
import { getIndex, getPage } from "@/lib/data";
import { num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { search } from "@/lib/search";
import { CHAPTERS } from "./chapters";
import { matches, specimenPage } from "./data";
import { C, ChapterHead, Excerpt, Fine, Prose, SectionHead } from "./parts";
import { Plate } from "./plate";
import { cite } from "./source";

// Chapter III: the operators with live counts, how results are ranked, and what the
// engine does with typos.

const S = "lib/search.ts";

const OPERATORS: { op: string; examples: string[]; finds: React.ReactNode }[] = [
  {
    op: "lang:",
    examples: ["lang:rust", "lang:ts"],
    finds: (
      <>
        Pages whose top three languages, counted over everything inside, include it. <C>ts</C>, <C>js</C>, <C>py</C>, <C>rs</C>, <C>sol</C>, <C>rb</C> and{" "}
        <C>sh</C> stand for the full names.
      </>
    ),
  },
  {
    op: "in:",
    examples: ["in:experiments"],
    finds: <>Pages with a folder above them, below the root, whose name contains it. The page&apos;s own folder never counts, so this lists what is inside.</>,
  },
  {
    op: "kind:",
    examples: ["kind:repo", "kind:repos"],
    finds: (
      <>
        Exactly one of <C>repo</C>, <C>project</C>, <C>docs</C>, <C>assets</C>, <C>code</C> or <C>folder</C>. Nothing else matches, plurals included.
      </>
    ),
  },
  {
    op: "fw:",
    examples: ["fw:next", "fw:next.js"],
    finds: <>A framework whose name, without dots or spaces, contains it, so both examples are the same search, and <C>fw:react</C> also finds React Native.</>,
  },
  {
    op: "is:",
    examples: ["is:article", "is:stub"],
    finds: <>Articles only, or stubs only. Any other value filters nothing.</>,
  },
];

export function SearchPro() {
  const { missing, index } = getIndex();
  // A real folder with a space in its name, to show quoting at work.
  const spaced = [...index.pages].filter((p) => p.depth > 0 && /\s/.test(p.name) && p.children.length > 0).sort((a, b) => b.children.length - a.children.length)[0];
  const quoted = `in:"${spaced?.name.toLowerCase() ?? "my folder"}"`;
  return (
    <section aria-labelledby="search-title">
      <ChapterHead chapter={CHAPTERS[2]} kicker="The box takes plain words, the way the web taught us. A few small operators, and a little knowledge of the ranking, make it a precise instrument.">
        <Prose>
          <p>
            Press <kbd className="fg-kbd">/</kbd> anywhere to reach the search box. It suggests up to seven pages as you type, by name, title, summary and framework;
            arrow keys pick one, Enter searches everything. Results come ten to a page, in five overlapping tabs: All, Projects (articles that are not document
            collections), Repositories, Documents and Folders (every stub).
          </p>
        </Prose>
      </ChapterHead>

      <SectionHead id="operators" mark="III.1" title="Operators" aside="Live counts" />
      <Prose className="mt-8">
        <p>
          An operator is a word with a colon. It narrows the results to pages that pass its test, and it can stand alone: <C>kind:repo</C> on its own lists every
          repository. Mix them with words and with each other.
        </p>
      </Prose>
      <div className="mt-8 overflow-x-auto" data-reveal>
        <table className="fg-table fg-stack sm:min-w-[620px]">
          <thead>
            <tr>
              <th scope="col">Operator</th>
              <th scope="col">Finds</th>
              <th scope="col" className="text-right">
                Try
              </th>
            </tr>
          </thead>
          <tbody>
            {OPERATORS.map((o) => (
              <tr key={o.op}>
                <td className="whitespace-nowrap font-mono text-[14px] text-ink">{o.op}</td>
                <td className="fg-wide text-ink-2">{o.finds}</td>
                <td className="text-right">
                  <ul className="space-y-1">
                    {o.examples.map((q) => (
                      <li key={q} className="whitespace-nowrap">
                        <Link href={searchHref(q)} className="group inline-flex items-baseline gap-2" prefetch={false}>
                          <span className="font-mono text-[12.5px] text-link group-hover:underline">{q}</span>
                          <span className="min-w-[44px] font-mono text-[11.5px] tabular-nums text-muted">{missing ? "" : num(matches(q))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3" data-reveal>
        {[
          { q: "fw:next in:experiments", text: "Operators combine: Next.js projects inside experiments." },
          { q: "agent kind:repo", text: "Words and operators together: repositories about agents." },
          { q: quoted, text: "Quotes keep a value with spaces in one piece." },
        ].map((x) => (
          <Link
            key={x.q}
            href={searchHref(x.q)}
            prefetch={false}
            className="group rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong"
          >
            <span className="block font-mono text-[13px] text-link group-hover:underline">{x.q}</span>
            <span className="mt-1.5 block text-[13px] leading-snug text-ink-2">{x.text}</span>
            {!missing && <span className="mt-2 block font-mono text-[11.5px] text-muted">{num(matches(x.q))} results</span>}
          </Link>
        ))}
      </div>
      <Prose className="mt-8">
        <p>
          Operator names may be in any case; values are read in lower case. If one is given twice, the last wins, and there is no negation: <C>agent -in:x</C> is
          the same search as <C>agent in:x</C>. Operators filter after the words are scored, so they never change the order, only what is left. With no words at all, every page that passes is
          listed in the order of its prior, which the next section explains.
        </p>
      </Prose>
      <Fine className="mt-3">
        {cite(S, "export function parseQuery")} and {cite(S, "function matchesFilters")}.
      </Fine>

      <SectionHead id="ranking" mark="III.2" title="How results are ranked" />
      <Plate
        id="search"
        fig={8}
        title="Search"
        className="mt-10"
        alt="A query is split into tokens, looked up in the inverted index, weighted by field, multiplied by a prior for each page, and laid out as results with a knowledge panel. Operators filter the list."
        caption={<>Search. The query becomes tokens, the tokens meet the inverted index, each hit is weighed by field and by a prior for its page, and operators filter what is left.</>}
      />
      <Prose className="mt-12">
        <p>
          A query is lowercased and split at spaces and punctuation, so <C>linear_clone</C>, <C>LINEAR-CLONE</C> and <C>clone linear</C> are the same search. Every
          word must match. Words of two letters or more match as prefixes, and words of five or more forgive typos: one slip in five to seven letters, two in eight to
          twelve. When fewer than five pages match every word, pages that match some of them follow below.
        </p>
        <p>Each hit is then weighed by where the words were found. A match in a folder&apos;s name counts ten times one in its README.</p>
      </Prose>
      <Boosts />
      <Prose className="mt-10">
        <p>
          That score is multiplied by a <em>prior</em>, a sense of how much each page is likely to matter before any word is read: articles over stubs, repositories a
          little higher, source folders lower, shallow over deep, the recently touched over the long untouched. A folder whose name is the query counts four times over,
          one whose name begins with it 1.6 times. Last, results that matched every word, and articles whose name holds a rare word of the query, sit above those that
          matched only some.
        </p>
      </Prose>
      <Excerpt file={S} from="function prior(" lines={12} className="mt-6" />

      <SectionHead id="near-misses" mark="III.3" title="Near misses" />
      <NearMisses />
    </section>
  );
}

const BOOSTS: [string, string, number][] = [
  ["name", "folder name", 6],
  ["title", "title, with qualifier", 3],
  ["summary", "summary", 2],
  ["fws", "frameworks", 1.6],
  ["cats", "categories", 1.2],
  ["langs", "languages", 1.2],
  ["pathText", "folders in its path", 1],
  ["deps", "dependencies", 1],
  ["agent", "agent notes", 1],
  ["readme", "README, first 5,000 characters", 0.6],
];

function Boosts() {
  const max = BOOSTS[0][2];
  return (
    <figure className="mt-8" data-reveal>
      <div className="fg-label mb-3 flex items-baseline justify-between">
        <span>Weight of a match, by field</span>
        <span className="font-mono normal-case tracking-normal text-faint">{cite(S, "boost: {")}</span>
      </div>
      <ul className="space-y-[7px]">
        {BOOSTS.map(([key, label, w]) => (
          <li key={key} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_40px] items-center gap-3 sm:grid-cols-[210px_minmax(0,1fr)_44px]" title={`${key}: ${w}`}>
            <span className="text-[13px] leading-snug text-ink-2">{label}</span>
            <span className="h-[7px] overflow-hidden rounded-full bg-bg-sunk">
              <span className="block h-full rounded-full bg-ink-2/85" style={{ width: `${(w / max) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums text-ink">×{w}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function NearMisses() {
  const { missing } = getIndex();
  const typo = missing ? null : search("linaer", { perPage: 1 });
  const fixed = typo?.didYouMean ? search(typo.didYouMean, { perPage: 1, correct: false }) : null;
  // An article whose name has a dash in it shows the panel's forgiving match best.
  const page = [getPage("xo-swarm"), specimenPage()].find((p) => p?.isArticle && /[-_]/.test(p.name)) ?? null;
  const spaced = page ? page.name.replace(/[-_]+/g, " ") : null;
  const panel = spaced && spaced !== page?.name ? search(spaced, { perPage: 1 }) : null;
  return (
    <>
      <Prose className="mt-8">
        <p>
          When a word of four letters or more appears nowhere in the index, the engine looks for the nearest word in an article&apos;s name, one slip away for short
          words and two for long ones, a swap of neighbours counting as one. It offers the fix only when the fixed query finds at least twice as many pages that match
          every word.
          {typo?.didYouMean && fixed && (
            <>
              {" "}
              Today, <Link href={searchHref("linaer")} className="link font-mono text-[0.85em]">linaer</Link> finds {num(typo.strict)} such{" "}
              {typo.strict === 1 ? "page" : "pages"} and <Link href={searchHref(typo.didYouMean)} className="link font-mono text-[0.85em]">{typo.didYouMean}</Link> finds{" "}
              {num(fixed.strict)}, so the page asks: <em>Did you mean {typo.didYouMean}?</em>
            </>
          )}{" "}
          With no results and no fix, it suggests the nearest article name instead.
        </p>
        <p>
          The knowledge panel, the card beside the results, appears for the top result when it is an article and either its name is the query, give or take spaces,
          dashes and underscores, or it scores well clear of the next.
          {page && panel?.best?.slug === page.slug && (
            <>
              {" "}
              So <Link href={searchHref(spaced!)} className="link font-mono text-[0.85em]">{spaced}</Link> brings up the panel for{" "}
              <Link href={wikiHref(page.slug)} className="link">{page.title}</Link>.
            </>
          )}{" "}
          It shows only on the first page of All, and a spelling suggestion hides it.
        </p>
        <p>
          Under the results, related searches offer up to eight refinements by framework, language or folder, each kept only when it would narrow the list without
          emptying it. They are the quickest way to learn the operators by accident.
        </p>
      </Prose>
      <Fine className="mt-3">
        {cite(S, "function correction(")}. Knowledge panel: {cite(S, "// Knowledge panel")}. Try any of these from a terminal with{" "}
        <C>pnpm tsx --conditions=react-server scripts/try-search.ts &quot;linear clone&quot;</C>.
      </Fine>
    </>
  );
}
