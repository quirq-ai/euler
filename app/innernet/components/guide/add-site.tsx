import Link from "next/link";
import { PageSigil } from "@/components/page-sigil";
import { count } from "@/components/wiki/article/lead";
import { getIndex } from "@/lib/data";
import { longDate, monthYear, num } from "@/lib/format";
import { categoryHref, isRemote, sourceHref, wikiHref } from "@/lib/links";
import { DEMO } from "@/lib/mode";
import { displayPath } from "@/lib/search";
import type { Page } from "@/lib/types";
import { CHAPTERS } from "./chapters";
import { indexFacts, mostWanted, nameExamples, type NameGroup } from "./data";
import { FolderRecipe } from "./folder-recipe";
import { C, ChapterHead, Command, Excerpt, Fine, Prose, SectionHead } from "./parts";
import { Figure, Plate } from "./plate";
import { RECIPE_NAMES, type Namesakes, type RecipeProps } from "./recipe-shared";
import { cite, projectDir } from "./source";

// Chapter II: what a folder needs to become an article, the five steps, roots, names,
// and the folders most in need of a README.

const B = "scripts/build-index.ts";

/** The root a reader's own folders would sit under. The demo's root is a GitHub
 * organization, not a folder, so its examples use the default in innernet.config.json. */
const DEFAULT_ROOT = "~/Programming";
const localRoot = (): string => (DEMO ? DEFAULT_ROOT : (getIndex().index.meta.roots[0]?.label ?? DEFAULT_ROOT));

function recipeProps(): RecipeProps {
  const { index, byName } = getIndex();
  const rootLabel = localRoot();
  const namesakes = Object.fromEntries(
    RECIPE_NAMES.map((n) => {
      const pages = byName.get(n.toLowerCase()) ?? [];
      return [n, { depths: pages.map((p) => ({ depth: p.depth, isArticle: p.isArticle })), slugs: pages.map((p) => p.slug), rootPrimary: pages.some((p) => p.depth === 0) }];
    }),
  ) as Namesakes;
  const now = new Date().toISOString();
  // The name that leads the most repositories here: whoever a first commit would credit.
  const leads = new Map<string, number>();
  for (const p of index.pages) {
    const a = p.git?.authors[0]?.name;
    if (a) leads.set(a, (leads.get(a) ?? 0) + 1);
  }
  return {
    maxDepth: index.meta.maxDepth || 6,
    rootLabel,
    rootName: rootLabel.split("/").pop() || "Programming",
    today: monthYear(now),
    todayLong: longDate(now),
    year: now.slice(0, 4),
    author: [...leads].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    namesakes,
    cites: {
      kind: cite(B, 'if (hasGit) page.kind = "repo"'),
      article: cite(B, "page.isArticle ="),
      summary: cite(B, "page.summary ="),
      normalize: cite("lib/normalize.ts", "const fromReadme"),
      names: cite(B, "const primaryOf"),
      categories: cite(B, "// Categories (articles only)"),
      lead: cite("components/wiki/article/lead.ts", "export function leadSegs"),
      prior: cite("lib/search.ts", "function prior("),
      prune: cite(B, "const PRUNE = new Set(["),
      secret: cite(B, "const SECRET_DIR"),
      depth: cite(B, "if (depth < maxDepth)"),
    },
  };
}

export function AddSite() {
  const { index, missing } = getIndex();
  const { meta } = index;
  const root = localRoot();
  const site = `${root}/weather-station`;
  const facts = indexFacts();

  const steps: { title: string; code: string; text: React.ReactNode }[] = [
    {
      title: "Make the folder",
      code: `mkdir -p ${site}`,
      text: (
        <>
          Anywhere under a root, at most {meta.maxDepth || 6} folders down. Nothing shows yet: the index is a snapshot, taken when you ask for one.
        </>
      ),
    },
    {
      title: "Write a README",
      code: `cd ${site}\nprintf '# weather-station\\n\\nA small weather station for the balcony. It reads a sensor once a minute, keeps a week of readings in a file, and draws them as one calm line.\\n' > README.md`,
      text: (
        <>
          Twenty-five words make a project, and an article. The first paragraph with forty letters or more becomes the summary: the lead&apos;s second paragraph, the
          snippet under the search result, the knowledge panel. The Overview section renders the whole README.
        </>
      ),
    },
    {
      title: "Add a manifest",
      code: `pnpm init\nnpm pkg set description="Reads a balcony sensor and charts the week" dependencies.next="^16.0.0" dependencies.react="^19.0.0"`,
      text: (
        <>
          Dependency names become frameworks: <C>next</C> files it under Next.js and calls it a Next.js application, <C>react</C> adds React. The infobox gains a Package group, Technology
          lists scripts and dependencies, and the description stands in when the README has no summary. Every folder inside now belongs to it.
        </>
      ),
    },
    {
      title: "Start its history",
      code: `git init && git add -A && git commit -m "First light"`,
      text: (
        <>
          A repository: a round sigil, a History section with its commits, a place in the Repositories tab and under <C>kind:repo</C>, and a quarter more weight in
          the ranking.
        </>
      ),
    },
    {
      title: "Index, then open it",
      code: `cd ${projectDir()}\npnpm index`,
      text: (
        <>
          {missing || DEMO ? "A minute or so" : <>About {Math.max(1, Math.round(meta.durationMs / 1000))} seconds on this machine</>}. Until the run ends,{" "}
          <Link href={wikiHref("weather-station")} prefetch={false} className="link font-mono text-[0.85em]">
            /wiki/weather-station
          </Link>{" "}
          says &ldquo;Nothing here, yet&rdquo;; the running server picks up the new file on the next request, and the article is there.
        </>
      ),
    },
  ];

  return (
    <section aria-labelledby="add-a-site-title">
      <ChapterHead
        chapter={CHAPTERS[1]}
        kicker="A site on your internet is a folder. Give one a README, a manifest, a history or a note for the agents, and Innerpedia writes it an article."
      >
        <Prose>
          <p>
            Every folder the crawler reaches already has a page: a stub, which says what the folder holds and asks for a README. Any one of a few small files turns
            it into an article with a lead, an infobox and sections. Which ones, and what each adds, is easiest to see by trying.
          </p>
        </Prose>
      </ChapterHead>

      <SectionHead id="folder-recipe" mark="II.1" title="A folder recipe" aside="Try it" />
      <Prose className="mt-8">
        <p>
          Choose what the folder holds, and the figure answers with the indexer&apos;s own rules: its kind, whether it earns an article, the lead Innerpedia would
          write, where its summary comes from, which rows the infobox shows, which sections appear, how it is filed and how search sees it.
        </p>
      </Prose>
      <Figure fig={5} title="A folder recipe" className="mt-10" caption={<>A folder recipe. The same rules as the indexer, run in your browser on a folder that does not exist.</>}>
        <FolderRecipe {...recipeProps()} />
      </Figure>

      <SectionHead id="five-steps" mark="II.2" title="The five steps" aside="Folder to article" />
      <Plate
        id="add-site"
        fig={6}
        title="Adding a site"
        className="mt-10"
        alt="Five steps from left to right: a folder, a README, a manifest, a git history and pnpm index, ending in a new Innerpedia article."
        caption={<>Adding a site. A folder, a README, a manifest, a history, and one run of the indexer: five steps from an empty folder to an article.</>}
      />
      <ol className="mt-12 space-y-10">
        {steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[30px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-x-6" data-reveal>
            <span aria-hidden className="font-display text-[34px] leading-[0.95] text-faint sm:text-[44px] sm:leading-[0.9]">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h4 className="font-display text-[26px] leading-tight text-ink">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h4>
              <p className="mt-2 max-w-[640px] font-serif text-[17px] leading-[1.62] text-ink-2">{s.text}</p>
              <Command code={s.code} className="mt-4" />
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-12 max-w-[680px] space-y-2 border-l-2 border-line-strong pl-5 text-[14.5px] leading-[1.6] text-ink-2" data-reveal>
        <p>
          <span className="font-medium text-ink">Any one of steps two to four is enough.</span> So is a <C>CLAUDE.md</C> that opens with a paragraph of prose,
          forty letters or more, or four files side by side when at least three in five of them are documents.
        </p>
        <p>
          <span className="font-medium text-ink">Some names are never read.</span> The crawler skips a name that starts with a dot, a pruned name such as{" "}
          <C>dist</C>, <C>build</C> or <C>vendor</C>, a name ending <C>.app</C>, a symlink, and a folder holding <C>pyvenv.cfg</C>. A name containing cred, secret or
          private, or ending in key or keys, still gets a page, but its README, notes and manifest are never opened.
        </p>
        <p className="fg-fine">
          {cite(B, "const PRUNE = new Set([")} and {cite(B, "const SECRET_DIR")}.
        </p>
      </div>

      <SectionHead id="new-root" mark="II.3" title="A whole new root" />
      <Prose className="mt-8">
        <p>
          A root is a folder the crawl starts from. The roots and the depth live in <C>innernet.config.json</C>, at the top of this project. Add a path to the list and
          index again; or name the roots for one run with <C>INNERNET_ROOTS</C>, which replaces the list rather than adding to it.
        </p>
      </Prose>
      <div className="mt-6 max-w-[660px] space-y-3" data-reveal>
        <Excerpt file="innernet.config.json" from="{" lines={4} />
        <Command code={`INNERNET_ROOTS=${root},~/Documents/notes pnpm index`} caption="Or, for one run" />
      </div>
      <Prose className="mt-8">
        <p>
          Each root becomes an article at depth 0, typed Root folder, and always the primary topic for its name. Its own name is not part of any path below it, so{" "}
          <C>in:</C> with the root&apos;s name does not list what the root holds, only what sits under some other folder of that name; search for what is inside
          instead. The footers list every root, and the server only ever reads{" "}
          <C>data/index.json</C> in this folder, so an index written elsewhere with <C>INNERNET_OUT</C> cannot be browsed.
        </p>
      </Prose>

      <SectionHead id="names" mark="II.4" title="How names work" aside={missing ? undefined : `${num(facts.shared)} shared names`} />
      <Plate
        id="names"
        fig={7}
        title="Names"
        className="mt-10"
        alt="Folder names become slugs. A shared name gives one primary topic the bare slug, the others get qualifiers in parentheses such as src (linear-clone), and a disambiguation page lists them all."
        caption={<>Names. A folder&apos;s name is its address. When several folders share one, a primary topic keeps it, the others take the name of a folder above them, and a disambiguation page lists them all.</>}
      />
      <Prose className="mt-12">
        <p>
          A folder&apos;s address is its name, with spaces turned into underscores: <C>/wiki/innernet</C>. Names are compared without regard to case, and when several
          folders share one{!missing && <> (as {num(facts.shared)} names do here)</>}, Innerpedia tells them apart the way Wikipedia does.
        </p>
        <p>
          If one of them is clearly the main one, it is the <em>primary topic</em> and keeps the bare name: a root, or else the shallowest article, provided no other
          article sits at its depth and every other namesake lies deeper{!missing && <> ({num(facts.primaries)} names have one)</>}. Each of the rest takes the name of
          the folder above it in parentheses, growing to two folders when that is taken, and the crawl order decides who gets the shorter one.
        </p>
      </Prose>
      <NameExamples />

      <SectionHead id="most-wanted" mark="II.5" title="Most wanted READMEs" />
      <MostWanted />
    </section>
  );
}

function PageRow({ page, note }: { page: Page; note?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <PageSigil page={page} size={24} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Link href={wikiHref(page.slug)} className="link text-[15px] [overflow-wrap:anywhere]">
          {page.title}
        </Link>
        <div className="truncate font-mono text-[11.5px] text-muted">{note ?? displayPath(page)}</div>
      </div>
    </li>
  );
}

function NameCard({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow-sm)]" data-reveal style={{ transitionDelay: `${delay}ms` }}>
      <div className="fg-label">{title}</div>
      {children}
    </div>
  );
}

/** The two-folder qualifier and the one-folder namesake it had to make way for. */
function grownPair(g: NameGroup): Page[] {
  const long = g.pages.find((p) => p.slug.includes(",_"));
  if (!long) return g.pages.slice(0, 3);
  const first = long.slug.slice(g.key.length + 2).split(",_")[0];
  const short = g.pages.find((p) => p.slug.toLowerCase() === `${g.key}_(${first})`.toLowerCase());
  const rest = g.pages.filter((p) => p !== long && p !== short && p.slug !== g.primary?.slug);
  return [...(short ? [short] : []), long, ...rest].slice(0, 4);
}

function NameExamples() {
  const { primary, grown, common, root } = nameExamples();
  if (!primary && !grown && !common) return null;
  const others = (g: NameGroup) => g.pages.filter((p) => p.slug !== g.primary?.slug);
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-3">
      {primary && primary.primary && (
        <NameCard title="A primary topic">
          <p className="mt-2 font-serif text-[15px] leading-snug text-ink-2">
            {count(primary.pages.length)[0].toUpperCase() + count(primary.pages.length).slice(1)} folders are named {primary.name}. The shallowest is an article with
            every other deeper, so it keeps the bare name and opens with a hatnote:
          </p>
          <p className="mt-3 border-l-2 border-line-strong pl-3 font-serif text-[14px] italic leading-snug text-ink-2">
            For the {count(primary.pages.length - 1)} other folders named {primary.name}, see{" "}
            <Link href={wikiHref(`${primary.key}_(disambiguation)`)} className="link not-italic">
              {primary.name} (disambiguation)
            </Link>
            .
          </p>
          <ul className="mt-2 divide-y divide-line">
            <PageRow page={primary.primary} note={<>{primary.primary.slug} · primary</>} />
            {others(primary)
              .slice(0, 3)
              .map((p) => (
                <PageRow key={p.slug} page={p} note={p.slug} />
              ))}
          </ul>
        </NameCard>
      )}
      {grown && (
        <NameCard title="A qualifier that grows">
          <p className="mt-2 font-serif text-[15px] leading-snug text-ink-2">
            Some folders named {grown.name} sit under folders that share a name too. The one the crawl reached first took the short qualifier; the next had to add a
            second folder.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {grownPair(grown).map((p) => (
              <PageRow key={p.slug} page={p} note={displayPath(p).replace(/^~\/[^/]+\//, "")} />
            ))}
          </ul>
        </NameCard>
      )}
      {common && (
        <NameCard title="Too common to choose">
          <p className="mt-2 font-serif text-[15px] leading-snug text-ink-2">
            {num(common.pages.length)} folders are named {common.name} and none stands out, so{" "}
            <Link href={wikiHref(common.key)} className="link font-mono text-[13px]">
              /wiki/{common.key}
            </Link>{" "}
            is the disambiguation page itself, grouped by project.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {common.pages.slice(0, 4).map((p) => (
              <PageRow key={p.slug} page={p} note={p.slug} />
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-muted">and {num(Math.max(0, common.pages.length - 4))} more</p>
        </NameCard>
      )}
      {root?.primary && (
        <Fine className="lg:col-span-3">
          A root always wins its name: <Link href={wikiHref(root.primary.slug)} className="link">{root.primary.title}</Link> keeps the bare slug, and{" "}
          {others(root)
            .slice(0, 1)
            .map((p) => (
              <Link key={p.slug} href={wikiHref(p.slug)} className="link">
                {p.title}
              </Link>
            ))}{" "}
          takes a qualifier ({cite(B, "const primaryOf")}). Slugs are looked up without regard to case ({cite("lib/data.ts", "byLowerSlug.get(slug.toLowerCase())")}).
        </Fine>
      )}
    </div>
  );
}

function MostWanted() {
  const { categories, missing } = getIndex();
  if (missing) {
    return (
      <Prose className="mt-8">
        <p>
          Once the index is built, the largest folders still without a README are listed here, with a way to open each one and write it. Run <C>pnpm index</C> to
          build it.
        </p>
      </Prose>
    );
  }
  const { articles, folders } = mostWanted(6);
  const lacking = categories.get("Articles lacking a README")?.length ?? 0;
  if (!articles.length && !folders.length) {
    return (
      <Prose className="mt-8">
        <p>Every folder here has a README. Innerpedia has nothing to ask for.</p>
      </Prose>
    );
  }
  const row = (p: Page) => (
    <li key={p.slug} className="flex items-center gap-3 py-3">
      <PageSigil page={p} size={30} />
      <div className="min-w-0 flex-1">
        <Link href={wikiHref(p.slug)} className="link text-[15.5px] [overflow-wrap:anywhere]">
          {p.title}
        </Link>
        <div className="truncate text-[12.5px] text-muted">
          {num(p.totalFiles)} files
          <span aria-hidden className="px-1.5 text-faint">
            ·
          </span>
          <span className="font-mono text-[11.5px]">{displayPath(p)}</span>
        </div>
      </div>
      <a
        href={sourceHref(p.path)}
        {...(isRemote(p.path) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] text-muted transition-colors hover:bg-bg-sunk hover:text-ink"
      >
        Write it<span className="sr-only">: open {p.title} {isRemote(p.path) ? "on GitHub" : "in VS Code"} to add a README</span>
      </a>
    </li>
  );
  return (
    <>
      <div className="mt-8 flex items-center gap-4 rounded-2xl border border-notice-line bg-notice px-5 py-4" data-reveal>
        <span aria-hidden className="font-display text-[40px] leading-none text-ink-2">
          ¶
        </span>
        <p className="font-serif text-[17px] italic leading-snug text-ink-2">
          You can help Innerpedia. These are the largest pages still written from the folder alone. A README of twenty-five words gives each a summary and an
          Overview, turns a stub into an article
          {lacking > 0 && (
            <>
              , and takes an article out of{" "}
              <Link href={categoryHref("Articles lacking a README")} className="link not-italic">
                Articles lacking a README
              </Link>{" "}
              ({num(lacking)})
            </>
          )}
          .
        </p>
      </div>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 lg:grid-cols-2">
        {articles.length > 0 && (
          <div className="min-w-0" data-reveal>
            <div className="fg-label border-b border-line pb-2">Articles without a README</div>
            <ol className="divide-y divide-line">{articles.map(row)}</ol>
          </div>
        )}
        {folders.length > 0 && (
          <div className="min-w-0" data-reveal>
            <div className="fg-label border-b border-line pb-2">Folders waiting for a word</div>
            <ol className="divide-y divide-line">{folders.map(row)}</ol>
          </div>
        )}
      </div>
      <Fine className="mt-4">Largest first, by files inside. Folders within another project are left out; that project&apos;s README speaks for them.</Fine>
    </>
  );
}
