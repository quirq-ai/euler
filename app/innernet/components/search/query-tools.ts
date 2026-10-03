import "server-only";

import { getPage } from "@/lib/data";
import { search, type ParsedQuery, type SearchResponse, type Tab } from "@/lib/search";
import type { Page } from "@/lib/types";

// Small server-side helpers for the results page: operator editing, the kind line,
// breadcrumbs and related searches. Spelling suggestions and the knowledge-panel pick
// live in lib/search, so every consumer of search() gets them.

export type OpKey = keyof ParsedQuery["filters"];

const OP_RE = /\b(lang|in|kind|fw|is):("([^"]+)"|\S+)/gi;

export const OP_LABEL: Record<OpKey, string> = {
  lang: "Language",
  in: "Inside",
  kind: "Kind",
  fw: "Framework",
  is: "Is",
};

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** The raw query with every occurrence of one operator removed. */
export function withoutOperator(raw: string, key: OpKey): string {
  return squash(raw.replace(OP_RE, (m: string, op: string) => (op.toLowerCase() === key ? " " : m)));
}

/** Free text with no operators at all. */
export function withoutOperators(raw: string): string {
  return squash(raw.replace(OP_RE, " "));
}

/** Splits a raw query into free text and operator tokens, for typesetting. */
export function tokens(raw: string): { text: string; op: boolean }[] {
  const out: { text: string; op: boolean }[] = [];
  let last = 0;
  for (const m of raw.matchAll(OP_RE)) {
    if (m.index! > last) out.push({ text: raw.slice(last, m.index), op: false });
    out.push({ text: m[0], op: true });
    last = m.index! + m[0].length;
  }
  if (last < raw.length) out.push({ text: raw.slice(last), op: false });
  return out;
}

export const opToken = (key: OpKey, value: string) => `${key}:${/\s/.test(value) ? `"${value}"` : value}`;

// ------------------------------------------------------------------ kind line

const APP_FRAMEWORKS: Record<string, string> = {
  "Next.js": "Next.js application",
  Vite: "Vite application",
  Expo: "Expo app",
  "React Native": "React Native app",
  Flutter: "Flutter app",
  FastAPI: "FastAPI service",
  Flask: "Flask service",
  Express: "Express server",
  Fumadocs: "Fumadocs site",
  Remotion: "Remotion project",
  Tauri: "Tauri app",
  Electron: "Electron app",
  Streamlit: "Streamlit app",
  Hardhat: "Hardhat project",
};

const NOUN: Record<Page["kind"], string> = {
  repo: "repository",
  project: "project",
  docs: "document collection",
  assets: "media folder",
  code: "source folder",
  folder: "folder",
};

const PROSE_LANGS = new Set(["Markdown", "MDX", "JSON", "YAML", "TOML", "HTML", "CSS"]);

// Mirrors the aliases lib/search accepts for lang:, so lang:rs highlights Rust.
const LANG_ALIASES: Record<string, string> = { ts: "typescript", js: "javascript", py: "python", rs: "rust", sol: "solidity", rb: "ruby", sh: "shell" };

/** The language worth naming: the one a lang: filter asked for, else the first real code language. */
export function primaryLanguage(p: Page, filter?: string): Page["languages"][number] | undefined {
  const want = filter ? (LANG_ALIASES[filter] ?? filter) : null;
  return (
    (want ? p.languages.slice(0, 3).find((l) => l.name.toLowerCase() === want) : undefined) ??
    p.languages.find((l) => !PROSE_LANGS.has(l.name)) ??
    p.languages[0]
  );
}

/** The framework that names the kind of thing a page is, e.g. Next.js for "Next.js application". */
export const appFramework = (p: Page) => p.frameworks.find((f) => APP_FRAMEWORKS[f]);

/** "Next.js application", "Rust project", "Source folder". */
export function kindLabel(p: Page): string {
  const app = appFramework(p);
  const lang = p.languages.find((l) => !PROSE_LANGS.has(l.name))?.name;
  const noun = NOUN[p.kind];
  const what = app ? APP_FRAMEWORKS[app] : lang && p.kind !== "docs" && p.kind !== "assets" ? `${lang} ${noun}` : noun;
  return what[0].toUpperCase() + what.slice(1);
}

/** "Next.js application in experiments", "Rust project in makepad", "Folder in XO". */
export function kindLine(p: Page): string {
  const parent = getPage(p.parent);
  return parent ? `${kindLabel(p)} in ${parent.name}` : kindLabel(p);
}

const crumbParts = (p: Page) => [p.root, ...p.relPath.split(/[\\/]/).filter(Boolean).slice(0, -1)];

/** Breadcrumb of the folders above a page, root first, collapsed in the middle when long. */
export function crumbs(p: Page): string[] {
  const parts = crumbParts(p);
  return parts.length <= 5 ? parts : [parts[0], "…", ...parts.slice(-3)];
}

/** The last two folders above a page, for narrow screens where the root is noise. */
export function tailCrumbs(p: Page): string[] {
  const parts = crumbParts(p);
  return parts.length <= 3 ? parts : ["…", ...parts.slice(-2)];
}

// ------------------------------------------------------------------ related searches

export interface Related {
  query: string; // the full query to run
  base: string; // the part the user already typed
  added: string; // the part we suggest adding
  count: number;
}

const fwOp = (name: string) => name.toLowerCase().replace(/\.js$/, "").split(/\s+/)[0].replace(/[^a-z0-9]/g, "");

/**
 * Narrower searches drawn from the frameworks, languages and collections of the top
 * hits in the current tab, each with how many results it would find there. Kinds are
 * left out: the tabs already offer them.
 */
export function relatedSearches(res: SearchResponse, tab: Tab = "all", limit = 8): Related[] {
  const raw = squash(res.query.raw);
  const top = search(raw, { tab, perPage: 30, correct: false }).hits.map((h) => h.page);
  const tally = new Map<string, { key: OpKey; value: string; weight: number }>();
  const words = new Set(res.query.text.toLowerCase().split(/[^a-z0-9]+/));
  const add = (key: OpKey, value: string, weight: number) => {
    // Skip filters already applied, and ones that only repeat the query's words
    // ("xo swarm in:xo-swarm").
    if (!value || res.query.filters[key] || value.split(/[^a-z0-9]+/).every((w) => !w || words.has(w))) return;
    const id = `${key}:${value}`;
    const cur = tally.get(id);
    tally.set(id, { key, value, weight: (cur?.weight ?? 0) + weight });
  };

  top.forEach((p, i) => {
    const w = 1 / (1 + i * 0.15);
    p.frameworks.slice(0, 3).forEach((f) => add("fw", fwOp(f), w));
    const lang = p.languages.find((l) => !PROSE_LANGS.has(l.name));
    if (lang) add("lang", lang.name.toLowerCase(), w * 0.9);
    // "in:" the enclosing project, or for a top-level project its collection.
    const home = getPage(p.partOf) ?? getPage(p.parent);
    if (home && home.depth > 0 && home.kind !== "code") add("in", home.name.toLowerCase(), w * 0.8);
    for (const c of p.categories) {
      const part = c.match(/^Parts of (.+)$/);
      if (part && !/[()\s]/.test(part[1])) add("in", part[1].toLowerCase(), w * 0.7);
    }
  });

  const out: Related[] = [];
  const perKey = new Map<OpKey, number>();
  for (const { key, value } of [...tally.values()].sort((a, b) => b.weight - a.weight)) {
    if (out.length >= limit) break;
    // At most three of a kind, so one busy folder can't fill the list.
    if ((perKey.get(key) ?? 0) >= 3 || !/^[a-z0-9][\w.-]*$/.test(value)) continue;
    const added = opToken(key, value);
    const query = squash(`${raw} ${added}`);
    const count = search(query, { tab, correct: false }).total;
    // Only searches that narrow things down by a useful amount: 28 of 29 is no help,
    // and a single result is a page, not a search.
    if (count < 2 || count > res.total * 0.9) continue;
    out.push({ query, base: raw, added, count });
    perKey.set(key, (perKey.get(key) ?? 0) + 1);
  }
  return out;
}
