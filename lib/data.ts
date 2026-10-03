import "server-only";

import fs from "node:fs";
import path from "node:path";
import { heldLocalIndex, rememberLocalIndex, remoteDemoIndex } from "./db/sync";
import { DEMO } from "./mode";
import { normalizeIndex } from "./normalize";
import type { Page, SiteIndex } from "./types";

// Loads data/index.json once and reloads it when the file changes, so `pnpm index`
// takes effect without restarting the server. The demo (lib/mode.ts) reads the
// committed data/demo/index.json instead; next.config.ts ships that one file with
// every server function, and never the local index.
//
// The database (lib/db) keeps a copy, and the file stays the source. On this machine
// each new index is stored in the background, and if data/index.json goes missing the
// stored one serves instead. On the demo a newer index stored in Neon replaces the
// bundled one once it has been read (lib/db/sync.ts). getIndex() itself never waits on
// a database: it answers from memory.

const LOCAL_INDEX = path.join(process.cwd(), "data", "index.json");
const DEMO_INDEX = path.join(process.cwd(), "data", "demo", "index.json");
const INDEX_FILE = DEMO ? DEMO_INDEX : LOCAL_INDEX;

export interface Loaded {
  index: SiteIndex;
  missing: boolean; // true when there is no index to show: none built yet, and none stored
  version: number; // changes whenever the index served changes (the file's mtime, or below -1 for one read from the database)
  source: "file" | "database" | "none"; // where the index served came from
  bySlug: Map<string, Page>;
  byLowerSlug: Map<string, Page>;
  categories: Map<string, Page[]>; // category -> articles, sorted by title
  articles: Page[];
  byName: Map<string, Page[]>; // lowercased folder name -> every folder of that name
}

let fromFileCache: Loaded | null = null; // the index file, by its mtime
let fromDbCache: Loaded | null = null; // an index read from the database, by its version

const EMPTY: SiteIndex = {
  meta: { generatedAt: "", roots: [], maxDepth: 0, counts: { pages: 0, articles: 0, repos: 0, stubs: 0, categories: 0 }, durationMs: 0 },
  pages: [],
  disambiguation: {},
};

function build(index: SiteIndex, version: number, source: Loaded["source"]): Loaded {
  const bySlug = new Map(index.pages.map((p) => [p.slug, p]));
  const byLowerSlug = new Map(index.pages.map((p) => [p.slug.toLowerCase(), p]));
  const categories = new Map<string, Page[]>();
  for (const p of index.pages) {
    for (const c of p.categories) categories.set(c, [...(categories.get(c) ?? []), p]);
  }
  for (const list of categories.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  const byName = new Map<string, Page[]>();
  for (const p of index.pages) byName.set(p.name.toLowerCase(), [...(byName.get(p.name.toLowerCase()) ?? []), p]);
  return {
    index,
    missing: source === "none",
    version,
    source,
    bySlug,
    byLowerSlug,
    categories,
    articles: index.pages.filter((p) => p.isArticle),
    byName,
  };
}

const NONE = build(EMPTY, -1, "none");

/** The index file, reloaded when its mtime changes, or null when there is none. */
function fromFile(): Loaded | null {
  let version = -1;
  try {
    version = fs.statSync(INDEX_FILE).mtimeMs;
  } catch {
    /* not built yet, or deleted */
  }
  if (version <= 0) return null;
  if (fromFileCache?.version === version) return fromFileCache;
  // Older indexes are brought up to the current rules on load: no credentials, no
  // dashes, UTC dates rolled up the tree (see lib/normalize.ts).
  const index = normalizeIndex(JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")));
  fromFileCache = build(index, version, "file");
  if (!DEMO) rememberLocalIndex(index, version);
  return fromFileCache;
}

/** An index the database holds, built once per version. Same version as the file it was stored from: the same Loaded. */
function fromDb(held: { index: SiteIndex; version: number }): Loaded {
  if (fromDbCache?.version === held.version) return fromDbCache;
  fromDbCache =
    fromFileCache?.version === held.version && fromFileCache.index === held.index
      ? { ...fromFileCache, source: "database" }
      : build(normalizeIndex(held.index), held.version, "database");
  return fromDbCache;
}

export function getIndex(): Loaded {
  const file = fromFile();
  if (DEMO) {
    const remote = remoteDemoIndex(file?.index.meta.generatedAt ?? "");
    return remote ? fromDb(remote) : (file ?? NONE);
  }
  if (file) return file;
  const held = heldLocalIndex();
  return held ? fromDb(held) : NONE;
}

export function getPage(slug: string | null | undefined): Page | null {
  if (!slug) return null;
  const { bySlug, byLowerSlug } = getIndex();
  return bySlug.get(slug) ?? byLowerSlug.get(slug.toLowerCase()) ?? null;
}

export function getPages(slugs: string[]): Page[] {
  return slugs.map(getPage).filter((p): p is Page => !!p);
}

/** Root first, page itself excluded. */
export function ancestors(page: Page): Page[] {
  const out: Page[] = [];
  let cur = getPage(page.parent);
  while (cur) {
    out.unshift(cur);
    cur = getPage(cur.parent);
  }
  return out;
}

export type Resolved =
  | { type: "page"; page: Page; disambiguation: string | null } // disambiguation: slug of the list page when this page is a primary topic
  | { type: "disambiguation"; name: string; primary: Page | null; pages: Page[] }
  | { type: "category"; name: string; pages: Page[] }
  | { type: "special"; name: string }
  | { type: "missing"; slug: string };

/** Decode a [slug] route param and work out what it names. */
export function resolveSlug(param: string): Resolved {
  let slug = param;
  try {
    slug = decodeURIComponent(param);
  } catch {
    /* already decoded */
  }
  const { index, categories } = getIndex();

  if (/^special:/i.test(slug)) return { type: "special", name: slug.slice(8) };
  if (/^category:/i.test(slug)) {
    // categoryHref writes spaces as underscores, and names can hold real underscores
    // ("Parts of NM_gen"), so compare with both read as spaces.
    const want = slug.slice(9).replace(/_/g, " ").toLowerCase();
    const hit = [...categories.keys()].find((c) => c.replace(/_/g, " ").toLowerCase() === want);
    return hit ? { type: "category", name: hit, pages: categories.get(hit)! } : { type: "missing", slug };
  }

  const dis = (key: string) => {
    const k = Object.keys(index.disambiguation).find((d) => d.toLowerCase() === key.toLowerCase());
    return k ? { key: k, entry: index.disambiguation[k] } : null;
  };
  // The folder name itself: keys write spaces as underscores, but so do real names.
  const shared = (d: { key: string; entry: { slugs: string[] } }) => getPage(d.entry.slugs[0])?.name ?? d.key.replace(/_/g, " ");

  const explicit = slug.match(/^(.*)_\(disambiguation\)$/i);
  if (explicit) {
    const d = dis(explicit[1]);
    if (d) return { type: "disambiguation", name: shared(d), primary: getPage(d.entry.primary), pages: getPages(d.entry.slugs) };
  }

  const page = getPage(slug);
  if (page) {
    const d = dis(page.slug);
    return { type: "page", page, disambiguation: d && d.entry.primary === page.slug ? `${d.key}_(disambiguation)` : null };
  }

  const d = dis(slug);
  if (d) return { type: "disambiguation", name: shared(d), primary: getPage(d.entry.primary), pages: getPages(d.entry.slugs) };
  return { type: "missing", slug };
}

/** Any article, uniformly at random. Used by Special:Random and "I'm feeling curious". */
export function randomArticle(): Page | null {
  const { articles } = getIndex();
  if (!articles.length) return null;
  return articles[Math.floor(Math.random() * articles.length)];
}
