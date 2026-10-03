import "server-only";

import MiniSearch, { type SearchResult as MiniHit } from "minisearch";
import { getIndex, getPage } from "./data";
import { logoSrc } from "./logo";
import { isListableName, markdownToText, readsAsInstructions, undash } from "./text";
import type { Page } from "./types";

// Server-side full-text search over the index. The engine is rebuilt only when the
// index file changes.

export type Tab = "all" | "articles" | "repos" | "folders" | "docs";
export const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "articles", label: "Projects" },
  { id: "repos", label: "Repositories" },
  { id: "docs", label: "Documents" },
  { id: "folders", label: "Folders" },
];

/** A run of snippet text; `hit` runs matched the query and render as <mark>. */
export interface Segment {
  text: string;
  hit?: boolean;
}

export interface ParsedQuery {
  raw: string;
  text: string; // free text with operators removed
  filters: { lang?: string; in?: string; kind?: string; fw?: string; is?: string };
}

export interface SearchHit {
  page: Page;
  score: number;
  snippet: Segment[];
}

export interface SearchResponse {
  query: ParsedQuery;
  hits: SearchHit[]; // the requested page of results
  total: number; // results in the active tab
  counts: Record<Tab, number>;
  page: number;
  pages: number;
  tookMs: number;
  best: Page | null; // knowledge-panel candidate
  didYouMean: string | null;
  strict: number; // results that matched every word (the rest matched some)
}

export interface Suggestion {
  slug: string;
  title: string;
  kind: Page["kind"];
  isArticle: boolean;
  path: string; // display path, e.g. "~/Programming/XO/ClaudeWorkspace"
  summary: string | null;
  logo: string | null; // the logo's address (lib/logo.ts), when the project has one
  logoSurface: Page["logoSurface"];
}

interface Doc {
  id: string;
  name: string;
  title: string;
  summary: string;
  pathText: string;
  readme: string;
  deps: string;
  cats: string;
  langs: string;
  fws: string;
  agent: string;
}

let engine: {
  version: number;
  ms: MiniSearch<Doc>;
  names: MiniSearch<{ id: string; name: string }>;
  terms: Set<string>; // every word in the index, so "Did you mean" leaves real words alone
} | null = null;

function plain(md: string | null, max: number): string {
  return md ? undash(markdownToText(md)).slice(0, max) : "";
}

// MiniSearch's own tokenizer: split on whitespace and punctuation, lowercased.
const tokens = (s: string) => s.toLowerCase().split(/[\n\r\p{Z}\p{P}]+/u).filter(Boolean);

/** A free-text query is at most this many distinct words; more only costs time. */
const MAX_TERMS = 16;

/** The page's summary, unless it is a CLAUDE.md paragraph giving orders to an agent. */
export function pageSummary(p: Page): string | null {
  return p.summary && !(p.summary === p.agentNotes && readsAsInstructions(p.summary)) ? p.summary : null;
}

function getEngine() {
  const { index, version } = getIndex();
  if (engine && engine.version === version) return engine;
  const ms = new MiniSearch<Doc>({
    fields: ["name", "title", "summary", "pathText", "readme", "deps", "cats", "langs", "fws", "agent"],
    storeFields: [],
    searchOptions: {
      boost: { name: 6, title: 3, summary: 2, fws: 1.6, cats: 1.2, langs: 1.2, pathText: 1, deps: 1, agent: 1, readme: 0.6 },
    },
  });
  const docs: Doc[] = index.pages.map((p) => ({
    id: p.slug,
    name: p.name,
    title: p.title,
    summary: p.summary ?? "",
    pathText: p.relPath.split(/[\\/]/).join(" "),
    readme: plain(p.readme, 5000),
    deps: [...(p.manifest?.dependencies ?? []), ...(p.manifest?.devDependencies ?? [])].join(" "),
    cats: p.categories.join(" "),
    langs: p.languages.map((l) => l.name).join(" "),
    fws: p.frameworks.join(" "),
    agent: p.agentNotes ?? "",
  }));
  ms.addAll(docs);
  const terms = new Set<string>();
  for (const d of docs) for (const [k, v] of Object.entries(d)) if (k !== "id") for (const t of tokens(v)) terms.add(t);
  const names = new MiniSearch<{ id: string; name: string }>({ fields: ["name"], storeFields: [] });
  names.addAll(index.pages.filter((p) => p.isArticle).map((p) => ({ id: p.slug, name: p.name })));
  engine = { version, ms, names, terms };
  return engine;
}

const OPS = ["lang", "in", "kind", "fw", "is"] as const;

export function parseQuery(raw: string): ParsedQuery {
  const filters: ParsedQuery["filters"] = {};
  const text = raw
    .replace(/\b(lang|in|kind|fw|is):("([^"]+)"|\S+)/gi, (_, op: string, v: string, quoted?: string) => {
      const key = op.toLowerCase() as (typeof OPS)[number];
      filters[key] = (quoted ?? v).toLowerCase();
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { raw, text: [...new Set(text.split(" "))].slice(0, MAX_TERMS).join(" "), filters };
}

const LANG_ALIASES: Record<string, string> = { ts: "typescript", js: "javascript", py: "python", rs: "rust", sol: "solidity", rb: "ruby", sh: "shell" };

function matchesFilters(p: Page, f: ParsedQuery["filters"]): boolean {
  if (f.lang) {
    const want = LANG_ALIASES[f.lang] ?? f.lang;
    if (!p.languages.slice(0, 3).some((l) => l.name.toLowerCase() === want)) return false;
  }
  if (f.in && !p.relPath.toLowerCase().split(/[\\/]/).slice(0, -1).some((seg) => seg.includes(f.in!))) return false;
  if (f.kind && p.kind !== f.kind) return false;
  if (f.fw && !p.frameworks.some((x) => x.toLowerCase().replace(/[.\s]/g, "").includes(f.fw!.replace(/[.\s]/g, "")))) return false;
  if (f.is === "article" && !p.isArticle) return false;
  if (f.is === "stub" && p.isArticle) return false;
  return true;
}

function inTab(p: Page, tab: Tab): boolean {
  switch (tab) {
    case "articles":
      return p.isArticle && p.kind !== "docs";
    case "repos":
      return p.kind === "repo";
    case "docs":
      return p.kind === "docs";
    case "folders":
      return !p.isArticle;
    default:
      return true;
  }
}

/** Prior: articles and repos over stubs, shallow over deep, recent over stale. */
function prior(p: Page): number {
  let w = p.isArticle ? 1.8 : 1;
  if (p.kind === "repo") w *= 1.25;
  if (p.kind === "code" && !p.isArticle) w *= 0.55;
  if (p.partOf) w *= 0.8;
  w *= 1 / (1 + 0.05 * p.depth);
  if (p.modified) {
    const days = (Date.now() - Date.parse(p.modified)) / 86_400_000;
    w *= 1 + 0.25 * Math.exp(-days / 60);
  }
  return w;
}

export function search(raw: string, opts: { tab?: Tab; page?: number; perPage?: number; correct?: boolean } = {}): SearchResponse {
  const t0 = performance.now();
  const tab = opts.tab ?? "all";
  const perPage = opts.perPage ?? 10;
  const query = parseQuery(raw);
  const { index } = getIndex();
  const { ms, names: nameIndex } = getEngine();
  const hasFilters = Object.keys(query.filters).length > 0;

  const words = new Set(tokens(query.text));
  // An article whose name shares a distinctive word with the query ("espeak" for
  // py-espeak-ng), not one that many names share ("text").
  const names = vocabulary();
  const namedIn = (p: Page) => p.isArticle && tokens(p.name).some((t) => t.length >= 3 && words.has(t) && (names.get(t) ?? 0) <= 3);

  let scored: { page: Page; score: number; terms: string[]; strict: boolean; tier: number }[] = [];
  // Free text that is only punctuation ("-" in "-in:x") searches like no text at all.
  if (words.size) {
    const run = (combineWith: "AND" | "OR") =>
      ms.search(query.text, {
        combineWith,
        prefix: (term) => term.length >= 2,
        fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      });
    // Every word must match, but when that leaves little, pages matching some of them
    // follow below; one whose name is in the query is not left out for a missed word.
    const all: MiniHit[] = run("AND");
    const strict = new Set(all.map((h) => h.id));
    const hits = all.length >= 5 ? all : [...all, ...run("OR").filter((h) => !strict.has(h.id))];
    const lower = query.text.toLowerCase();
    scored = hits
      .map((h) => {
        const page = getPage(String(h.id))!;
        let score = h.score * prior(page);
        const name = page.name.toLowerCase();
        if (name === lower) score *= 4;
        else if (name.startsWith(lower)) score *= 1.6;
        return { page, score, terms: h.terms, strict: strict.has(h.id), tier: strict.has(h.id) || namedIn(page) ? 0 : 1 };
      })
      .filter((h) => h.page && (!hasFilters || matchesFilters(h.page, query.filters)));
  } else if (hasFilters) {
    scored = index.pages
      .filter((p) => matchesFilters(p, query.filters))
      .map((page) => ({ page, score: prior(page), terms: [], strict: true, tier: 0 }));
  }
  scored.sort((a, b) => a.tier - b.tier || b.score - a.score);

  const counts = Object.fromEntries(TABS.map((t) => [t.id, scored.filter((s) => inTab(s.page, t.id)).length])) as Record<Tab, number>;
  const inActive = scored.filter((s) => inTab(s.page, tab));
  const pages = Math.max(1, Math.ceil(inActive.length / perPage));
  const pageNo = Math.min(Math.max(1, opts.page ?? 1), pages);
  const slice = inActive.slice((pageNo - 1) * perPage, pageNo * perPage);

  const strict = scored.filter((s) => s.strict).length;

  // A spelling suggestion for words the index has never seen: word by word against
  // article names first, then, if nothing at all was found, the nearest article name.
  let didYouMean: string | null = null;
  if (query.text && opts.correct !== false) {
    didYouMean = correction(query, strict);
    if (!didYouMean && !scored.length) {
      const guess = nameIndex.search(query.text, { fuzzy: 0.34, prefix: true })[0];
      if (guess) didYouMean = getPage(String(guess.id))?.name ?? null;
    }
  }

  // Knowledge panel: the top article when its name is the query give or take spaces,
  // dashes and underscores ("xo swarm" for xo-swarm), or when it clearly leads. A lone
  // hit has nothing to lead, so it needs its name in the query; a likely typo gets none.
  let best: Page | null = null;
  const top = scored[0];
  if (top?.page.isArticle && query.text && !didYouMean) {
    const second = scored[1];
    if (bare(top.page.name) === bare(query.text)) best = top.page;
    else if (second ? top.score > second.score * 1.35 : namedIn(top.page)) best = top.page;
  }

  return {
    query,
    hits: slice.map((s) => ({ page: s.page, score: s.score, snippet: snippet(s.page, [...s.terms, ...query.text.toLowerCase().split(/\W+/)]) })),
    total: inActive.length,
    counts,
    page: pageNo,
    pages,
    tookMs: performance.now() - t0,
    best,
    didYouMean,
    strict,
  };
}

export function suggest(q: string, limit = 7): Suggestion[] {
  const text = parseQuery(q).text;
  if (!text) return [];
  const { ms } = getEngine();
  const lower = text.toLowerCase();
  return ms
    .search(text, { prefix: true, fuzzy: (t) => (t.length >= 5 ? 0.15 : false), boost: { name: 10, title: 4, summary: 1 }, fields: ["name", "title", "summary", "fws"] })
    .map((h) => {
      const page = getPage(String(h.id))!;
      const name = page.name.toLowerCase();
      const bonus = name === lower ? 5 : name.startsWith(lower) ? 2.5 : 1;
      return { page, score: h.score * prior(page) * bonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ page }) => ({
      slug: page.slug,
      title: page.title,
      kind: page.kind,
      isArticle: page.isArticle,
      path: displayPath(page),
      summary: pageSummary(page),
      logo: logoSrc(page),
      logoSurface: page.logoSurface ?? null,
    }));
}

/** "~/Programming/XO/ClaudeWorkspace/experiments" for a page inside it (parent path). */
export function displayPath(p: Page): string {
  const parts = p.relPath.split(/[\\/]/).filter(Boolean);
  return [p.root, ...parts.slice(0, -1)].join("/");
}

/** Description used when a folder has no README or manifest text. */
export function fallbackDescription(p: Page): string {
  const bits: string[] = [];
  bits.push(`A ${p.kind === "code" ? "source folder" : p.kind === "assets" ? "media folder" : p.kind === "docs" ? "folder of documents" : "folder"}`);
  if (p.partOf) bits.push(`inside ${getPage(p.partOf)?.title ?? p.partOf}`);
  const contents: string[] = [];
  if (p.children.length) contents.push(`${p.children.length} subfolder${p.children.length === 1 ? "" : "s"}`);
  if (p.fileCount) contents.push(`${p.fileCount} file${p.fileCount === 1 ? "" : "s"}`);
  let s = bits.join(" ") + (contents.length ? ` holding ${contents.join(" and ")}` : "");
  const files = p.files.filter(isListableName);
  if (files.length) s += `, including ${files.slice(0, 4).join(", ")}`;
  return s + ".";
}

function snippet(p: Page, terms: string[], width = 230): Segment[] {
  const notes = p.agentNotes && !readsAsInstructions(p.agentNotes) ? p.agentNotes : null;
  const source = pageSummary(p) || plain(p.readme, 2400) || notes || fallbackDescription(p);
  const words = [...new Set(terms.map((t) => t.toLowerCase()).filter((t) => t.length >= 2))];
  if (!words.length) return [{ text: clipText(source, width) }];
  const re = new RegExp(`\\b(${words.map(escapeRe).join("|")})[\\w-]*`, "gi");
  const first = source.search(re);
  let start = 0;
  if (first > width * 0.5) {
    start = source.lastIndexOf(" ", first - 40) + 1;
  }
  let text = source.slice(start, start + width);
  if (start + width < source.length) text = text.replace(/\s+\S*$/, "") + " …";
  if (start > 0) text = "… " + text;
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], hit: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// ------------------------------------------------------------------ did you mean

const bare = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

// Edit distance with adjacent transpositions, so "linaer" is one step from "linear".
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return d[a.length][b.length];
}

let vocab: { version: number; words: Map<string, number> } | null = null;

/** Words that appear in article names, with how often. */
function vocabulary(): Map<string, number> {
  const { version, articles } = getIndex();
  if (vocab?.version === version) return vocab.words;
  const words = new Map<string, number>();
  for (const p of articles) {
    for (const w of p.name.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 3) words.set(w, (words.get(w) ?? 0) + 1);
  }
  vocab = { version, words };
  return words;
}

/** The query with near-miss words swapped for words from article names ("linaer" to
 * "linear"), offered only when it finds at least twice as many full matches. Words the
 * index already holds are never changed ("stripe" stays "stripe"). */
function correction(query: ParsedQuery, found: number): string | null {
  const words = vocabulary();
  const { terms } = getEngine();
  let changed = false;
  const fixed = query.text
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (w.length < 4 || words.has(w) || tokens(w).every((t) => terms.has(t))) return w;
      const cap = w.length >= 7 ? 2 : 1;
      let bestWord = w;
      let bestScore = Infinity;
      for (const [cand, freq] of words) {
        const dist = distance(w, cand, cap);
        if (dist > cap) continue;
        const score = dist - Math.min(freq, 20) / 100;
        if (score < bestScore) {
          bestScore = score;
          bestWord = cand;
        }
      }
      if (bestWord !== w) changed = true;
      return bestWord;
    });
  if (!changed) return null;
  const ops = query.raw.match(/\b(lang|in|kind|fw|is):("([^"]+)"|\S+)/gi) ?? [];
  const candidate = [fixed.join(" "), ...ops].join(" ").replace(/\s+/g, " ").trim();
  return search(candidate, { correct: false }).strict >= Math.max(2 * found, 1) ? candidate : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clipText = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + " …");
