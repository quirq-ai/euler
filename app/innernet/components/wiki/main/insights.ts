import "server-only";

import { getIndex, getPage, type Loaded } from "@/lib/data";
import type { Commit, Page } from "@/lib/types";

// Everything the Main page, Category pages and Special pages compute from the index.
// Results are memoised per index version, so a rebuilt index refreshes them.

const NON_CODE = new Set(["Markdown", "MDX", "JSON", "YAML", "TOML", "HTML", "CSS"]);
const DAY = 86_400_000;

let memoVersion = Number.NaN;
const memo = new Map<string, unknown>();

function once<T>(key: string, fn: (L: Loaded) => T): T {
  const L = getIndex();
  if (L.version !== memoVersion) {
    memo.clear();
    memoVersion = L.version;
  }
  if (!memo.has(key)) memo.set(key, fn(L));
  return memo.get(key) as T;
}

/** The moment the index was taken. Facts are phrased relative to it, not to "now". */
export function indexTime(): number {
  const t = Date.parse(getIndex().index.meta.generatedAt);
  return Number.isNaN(t) ? Date.now() : t;
}

export const codeLanguage = (p: Page) => p.languages.find((l) => !NON_CODE.has(l.name))?.name ?? null;

/** "TypeScript repository in quirq", a short gloss used under headlines and links. */
export function gloss(p: Page): string {
  const lang = codeLanguage(p);
  const fw = p.frameworks[0];
  const noun =
    p.kind === "repo" ? "repository"
    : p.kind === "docs" ? "document collection"
    : fw === "Next.js" ? "Next.js application"
    : "project";
  const parent = getPage(p.parent);
  const where = p.partOf ? ` in ${getPage(p.partOf)?.title ?? p.partOf}` : parent ? ` in ${parent.name}` : "";
  return `${lang && p.kind !== "docs" ? `${lang} ` : ""}${noun}${where}`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The index is undashed on load (lib/normalize.ts); kept here for the Main page boxes.
export { undash } from "@/lib/text";

/** Splits "conversations (aifun)" into the name and its disambiguating qualifier. */
export function splitTitle(title: string): [string, string | null] {
  const m = title.match(/^(.*\S)\s(\([^()]+\))$/);
  return m ? [m[1], m[2]] : [title, null];
}

/** Articles that hold other independent articles beneath them (XO, ClaudeWorkspace...). */
export function containers(): Set<string> {
  return once("containers", ({ articles }) => {
    const out = new Set<string>();
    for (const a of articles) {
      if (a.partOf) continue;
      let cur = getPage(a.parent);
      while (cur) {
        out.add(cur.slug);
        cur = getPage(cur.parent);
      }
    }
    return out;
  });
}

/** Articles holding three or more independent articles: the ones prose calls workspaces. */
export function workspaces(): Set<string> {
  return once("workspaces", ({ articles }) => {
    const n = new Map<string, number>();
    for (const a of articles) {
      if (a.partOf || a.depth === 0) continue;
      for (let cur = getPage(a.parent); cur; cur = getPage(cur.parent)) n.set(cur.slug, (n.get(cur.slug) ?? 0) + 1);
    }
    return new Set([...n].filter(([slug, c]) => c >= 3 && getPage(slug)?.isArticle).map(([slug]) => slug));
  });
}

/* ------------------------------------------------------------ categories */

export type CategoryKind = "collection" | "language" | "framework" | "year" | "kind" | "maintenance" | "part";

export interface CategoryInfo {
  name: string;
  kind: CategoryKind;
  count: number;
  /** The language, framework or year the category is about. */
  subject: string;
  /** For collections: the folder. For "Parts of": the enclosing project. */
  page: Page | null;
}

export const MAINTENANCE = "Articles lacking a README";
export const KIND_BLURBS: Record<string, string> = {
  "Git repositories": "Folders with a Git history of their own. Their articles carry a History section: commits by month, first and latest commit, and who made them.",
  "Document collections": "Folders made mostly of writing rather than code: markdown, HTML, PDFs and notes.",
  "Agent-ready projects": "Projects that carry a CLAUDE.md or AGENTS.md, so an agent arriving cold can find its bearings before it touches anything.",
};

function classify(L: Loaded, name: string): CategoryInfo {
  const pages = L.categories.get(name) ?? [];
  const base = { name, count: pages.length, subject: name, page: null as Page | null };
  const year = name.match(/^Started in (\d{4})$/);
  if (year) return { ...base, kind: "year", subject: year[1] };
  if (name === MAINTENANCE) return { ...base, kind: "maintenance" };
  if (name in KIND_BLURBS) return { ...base, kind: "kind" };
  const part = name.match(/^Parts of (.+)$/);
  if (part) return { ...base, kind: "part", subject: part[1], page: getPage(pages.find((p) => p.partOf)?.partOf) };
  const lang = name.match(/^(.+) projects$/);
  if (lang && languageNames().has(lang[1])) return { ...base, kind: "language", subject: lang[1] };
  if (frameworkNames().has(name)) return { ...base, kind: "framework" };
  return { ...base, kind: "collection", page: collectionFolder(name, pages) };
}

const languageNames = () => once("langs", ({ index }) => new Set(index.pages.flatMap((p) => p.languages.map((l) => l.name))));
const frameworkNames = () => once("fws", ({ index }) => new Set(index.pages.flatMap((p) => p.frameworks)));

/** The folder a collection is named after: the same-named ancestor most members share. */
function collectionFolder(name: string, pages: Page[]): Page | null {
  const votes = new Map<string, number>();
  for (const p of pages) {
    let cur = getPage(p.parent);
    while (cur) {
      if (cur.name === name) {
        votes.set(cur.slug, (votes.get(cur.slug) ?? 0) + 1);
        break;
      }
      cur = getPage(cur.parent);
    }
  }
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? getPage(best[0]) : null;
}

export function categoryInfo(name: string): CategoryInfo {
  return once(`cat:${name}`, (L) => classify(L, name));
}

export function allCategories(): CategoryInfo[] {
  return once("allcats", (L) => [...L.categories.keys()].map((c) => categoryInfo(c)).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)));
}

/** Collection categories wholly contained in another collection, for "Subcategories". */
export function subcollections(name: string): CategoryInfo[] {
  return once(`sub:${name}`, (L) => {
    const outer = new Set((L.categories.get(name) ?? []).map((p) => p.slug));
    return allCategories().filter(
      (c) => c.kind === "collection" && c.name !== name && c.count >= 3 && c.count < outer.size && (L.categories.get(c.name) ?? []).every((p) => outer.has(p.slug)),
    );
  });
}

export interface BrowseGroup {
  label: string;
  items: CategoryInfo[];
}

/** Categories worth browsing, grouped. Maintenance and "Parts of" lists are left out. */
export function browseGroups(): BrowseGroup[] {
  return once("browse", () => {
    const all = allCategories();
    const of = (k: CategoryKind) => all.filter((c) => c.kind === k);
    return [
      { label: "Collections", items: of("collection").slice(0, 8) },
      { label: "Languages", items: of("language").slice(0, 8) },
      { label: "Frameworks", items: of("framework").slice(0, 8) },
      { label: "Kinds", items: of("kind") },
      { label: "Eras", items: of("year").sort((a, b) => b.subject.localeCompare(a.subject)) },
    ].filter((g) => g.items.length);
  });
}

/* ------------------------------------------------------------ main page */

function substance(p: Page): number {
  return Math.log1p(p.words) * Math.log1p(p.totalFiles) * (1 + Math.log1p(p.git?.commitCount ?? 0) / 4);
}

const independent = (p: Page) => p.isArticle && !p.partOf && p.depth > 0;

/** Today's featured article and a few runners-up: substantial, recently active, with a README. */
export function featured(): Page[] {
  return once("featured", ({ articles }) => {
    const t = indexTime();
    const seen = new Set<string>();
    return articles
      .filter((p) => independent(p) && p.readme && p.summary && p.summary.length >= 120 && p.modified)
      .map((p) => ({ p, s: substance(p) * Math.exp(-(t - Date.parse(p.modified!)) / DAY / 60) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p)
      .filter((p) => {
        const key = p.summary!.slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  });
}

const KIND_ORDER: Record<Page["kind"], number> = { repo: 0, project: 1, docs: 2, code: 3, assets: 4, folder: 5 };

/** The tiles of the Main page's globe, best first. The most substantial independent
 * projects, one per distinct project, with those that keep a logo of their own drawn
 * forward; when they run short (a small index, like the demo's), every other article
 * joins them. No one logo is used more than twice, so a family of projects that share a
 * mark does not paper over the rest. */
export function globeTiles(n: number): Page[] {
  return once(`globeTiles:${n}`, ({ articles }) => {
    const seen = new Set<string>();
    const distinct = (p: Page) => {
      const key = p.summary?.slice(0, 60) ?? p.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    const score = (p: Page) => substance(p) * (p.logo ? 1.25 : 1) + (p.logo ? 0.25 : 0);
    const lead = (p: Page) => independent(p) && p.kind !== "docs";
    const ranked = [
      ...articles.filter(lead).sort((a, b) => score(b) - score(a)),
      ...articles.filter((p) => p.depth > 0 && !lead(p)).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || score(b) - score(a)),
    ].filter(distinct);
    const uses = new Map<string, number>();
    const picked: Page[] = [];
    const spare: Page[] = [];
    for (const p of ranked) {
      const u = p.logo ? (uses.get(p.logo) ?? 0) : 0;
      if (p.logo && u >= 2) {
        spare.push(p);
        continue;
      }
      if (p.logo) uses.set(p.logo, u + 1);
      picked.push(p);
    }
    return [...picked, ...spare].slice(0, n);
  });
}

export interface NewsItem {
  page: Page;
  commit: Commit | null;
}

/** The five most recently touched articles. When a change bubbles up through parent
 *  folders, the news belongs to the deepest article that made it. */
export function news(): { items: NewsItem[]; ongoing: Page[]; quiet: Page[] } {
  return once("news", ({ articles }) => {
    const t = indexTime();
    const candidates = articles
      .filter((p) => independent(p) && p.modified)
      .sort((a, b) => b.modified!.localeCompare(a.modified!) || b.depth - a.depth);
    const picked: Page[] = [];
    const heads = new Set<string>();
    for (const p of candidates) {
      if (picked.length >= 5) break;
      if (picked.some((q) => q.modified === p.modified && q.path.startsWith(p.path + "/"))) continue;
      const head = p.git?.recent[0]?.hash.slice(0, 7);
      if (head && heads.has(head)) continue;
      if (head) heads.add(head);
      picked.push(p);
    }
    const items = picked.map((page) => {
      const c = page.git?.recent[0] ?? null;
      const fresh = c && page.modified && Math.abs(Date.parse(page.modified) - Date.parse(c.date)) < 3 * DAY;
      return { page, commit: fresh ? c : null };
    });

    const repos = articles.filter((p) => independent(p) && p.git?.lastCommit);
    const recentCommits = (p: Page) => (p.git!.recent ?? []).filter((c) => t - Date.parse(c.date) < 30 * DAY).length;
    const dedupe = (list: Page[]) => {
      const seen = new Set<string>(picked.map((p) => p.slug));
      const hashes = new Set<string>();
      return list.filter((p) => {
        const h = p.git!.recent[0]?.hash.slice(0, 7) ?? p.slug;
        if (seen.has(p.slug) || hashes.has(h)) return false;
        hashes.add(h);
        return true;
      });
    };
    const ongoing = dedupe(
      repos
        .filter((p) => recentCommits(p) > 0)
        .sort((a, b) => recentCommits(b) - recentCommits(a) || a.depth - b.depth || a.title.length - b.title.length),
    ).slice(0, 4);
    const quiet = dedupe(
      repos
        .filter((p) => {
          const age = t - Date.parse(p.git!.lastCommit!);
          return age > 120 * DAY && age < 540 * DAY && p.git!.commitCount >= 10;
        })
        .sort((a, b) => b.git!.lastCommit!.localeCompare(a.git!.lastCommit!) || a.depth - b.depth || a.title.length - b.title.length),
    ).slice(0, 3);
    return { items, ongoing, quiet };
  });
}

export type Fact =
  | { type: "largest"; page: Page; busiest: Page | null }
  | { type: "oldest"; page: Page }
  | { type: "commits"; page: Page; runnerUp: Page | null }
  | { type: "framework"; name: string; count: number; second: string | null }
  | { type: "deepest"; page: Page; depth: number; atDepth: number }
  | { type: "readme"; count: number; total: number }
  | { type: "busiestMonth"; month: string; count: number }
  | { type: "agents"; count: number };

/** "Did you know..." facts, computed from the index. */
export function facts(): Fact[] {
  return once("facts", (L) => {
    const { articles, index, categories } = L;
    const box = containers();
    const out: Fact[] = [];

    const largest = articles
      .filter((p) => independent(p) && !box.has(p.slug))
      .sort((a, b) => b.totalFiles - a.totalFiles)[0];
    const repos = index.pages.filter((p) => p.git).sort((a, b) => b.git!.commitCount - a.git!.commitCount);
    const busiest = repos[0] ?? null;
    if (largest) out.push({ type: "largest", page: largest, busiest: busiest?.slug === largest.slug ? busiest : null });

    const oldest = articles.filter((p) => p.created && p.depth > 0).sort((a, b) => a.created!.localeCompare(b.created!))[0];
    if (oldest) out.push({ type: "oldest", page: oldest });

    if (busiest && busiest.slug !== largest?.slug) out.push({ type: "commits", page: busiest, runnerUp: repos[1] ?? null });

    const fw = new Map<string, number>();
    for (const p of articles) for (const f of p.frameworks) fw.set(f, (fw.get(f) ?? 0) + 1);
    const fws = [...fw.entries()].sort((a, b) => b[1] - a[1]);
    if (fws[0]) out.push({ type: "framework", name: fws[0][0], count: fws[0][1], second: fws[1]?.[0] ?? null });

    // The deepest folder is only a fact when the tree ends before the indexer's limit;
    // at the limit it is thousands of folders and says more about the indexer than you.
    const maxDepth = Math.max(0, ...index.pages.map((p) => p.depth));
    const deepest = index.pages.filter((p) => p.depth === maxDepth);
    const pick = [...deepest].sort((a, b) => Number(b.isArticle) - Number(a.isArticle) || b.relPath.length - a.relPath.length)[0];
    if (pick && maxDepth > 0 && maxDepth < index.meta.maxDepth) out.push({ type: "deepest", page: pick, depth: maxDepth, atDepth: deepest.length });

    // Spares, used when facts collapse into one or drop out.
    const lacking = categories.get(MAINTENANCE)?.length ?? 0;
    if (lacking) out.push({ type: "readme", count: lacking, total: articles.length });
    const agents = categories.get("Agent-ready projects")?.length ?? 0;
    if (agents) out.push({ type: "agents", count: agents });
    const monthly = activity();
    const top = [...monthly].sort((a, b) => b.count - a.count)[0];
    if (top?.count) out.push({ type: "busiestMonth", month: top.month, count: top.count });

    return out.slice(0, 5);
  });
}

/** Repositories with commits, one per history: copies and forks share a first commit,
 * and only the fullest of them counts. */
export function histories(): Page[] {
  return once("histories", ({ index }) => {
    const seen = new Set<string>();
    return index.pages
      .filter((p) => p.git && p.git.commitCount > 0)
      .sort((a, b) => b.git!.commitCount - a.git!.commitCount || a.depth - b.depth)
      .filter((p) => {
        const key = p.git!.firstCommit ?? p.slug;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  });
}

/** Commits per month across every distinct history, oldest first. */
export function activity(): { month: string; count: number }[] {
  return once("activity", () => {
    const months = new Map<string, number>();
    for (const p of histories()) for (const m of p.git?.monthly ?? []) months.set(m.month, (months.get(m.month) ?? 0) + m.count);
    return [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
  });
}

export interface OnThisDayEntry {
  pages: Page[]; // repos sharing these commits (forks show up together)
  commits: Commit[];
  lead: Commit;
}

export type OnThisDay =
  | { type: "commits"; years: { year: string; entries: OnThisDayEntry[] }[]; total: number }
  | { type: "anniversaries"; exact: boolean; items: Page[] }
  | { type: "none" };

const DULL = /^(merge|chore|bump|update readme|update readme\.md|wip|temp|initial commit|add files via upload)\b/i;

export function onThisDay(): OnThisDay {
  return once("otd", ({ index, articles }) => {
    const byYear = new Map<string, Map<string, { pages: Page[]; commits: Commit[] }>>();
    for (const p of index.pages) {
      if (!p.git?.onThisDay.length) continue;
      const perYear = new Map<string, Commit[]>();
      for (const c of p.git.onThisDay) perYear.set(c.date.slice(0, 4), [...(perYear.get(c.date.slice(0, 4)) ?? []), c]);
      for (const [year, commits] of perYear) {
        const unique = [...new Map(commits.map((c) => [c.hash.slice(0, 7), c])).values()];
        const key = unique.map((c) => c.hash.slice(0, 7)).sort().join(",");
        const groups = byYear.get(year) ?? new Map();
        const g = groups.get(key) ?? { pages: [], commits: unique };
        g.pages.push(p);
        groups.set(key, g);
        byYear.set(year, groups);
      }
    }
    if (byYear.size) {
      let total = 0;
      const years = [...byYear.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([year, groups]) => ({
          year,
          entries: [...groups.values()]
            .map((g) => {
              total += g.commits.length;
              const pages = [...g.pages].sort((a, b) => Number(!!a.partOf) - Number(!!b.partOf) || a.depth - b.depth || a.title.length - b.title.length);
              return { pages, commits: g.commits, lead: g.commits.find((c) => !DULL.test(c.subject)) ?? g.commits[0] };
            })
            .sort((a, b) => b.commits.length - a.commits.length),
        }));
      return { type: "commits", years, total };
    }

    // No commits on this date: fall back to projects begun on (or near) it.
    const t = new Date(indexTime());
    const md = (d: Date) => d.getMonth() * 31 + d.getDate();
    const today = md(t);
    const dated = articles.filter((p) => independent(p) && p.created && new Date(p.created).getFullYear() < t.getFullYear());
    const exact = dated.filter((p) => md(new Date(p.created!)) === today);
    if (exact.length) return { type: "anniversaries", exact: true, items: exact.sort((a, b) => a.created!.localeCompare(b.created!)).slice(0, 6) };
    const near = dated
      .map((p) => ({ p, d: Math.abs(md(new Date(p.created!)) - today) }))
      .filter((x) => x.d <= 10)
      .sort((a, b) => a.d - b.d || a.p.created!.localeCompare(b.p.created!))
      .map((x) => x.p)
      .slice(0, 6);
    return near.length ? { type: "anniversaries", exact: false, items: near } : { type: "none" };
  });
}

/* ------------------------------------------------------------ statistics */

export interface Statistics {
  files: number;
  bytes: number;
  commits: number; // across distinct histories
  histories: number;
  withHistory: number; // repositories with at least one commit
  authors: number;
  fileLanguages: { name: string; files: number }[];
  articleLanguages: CategoryInfo[];
  frameworks: CategoryInfo[];
  biggest: Page[];
  busiest: Page[];
  kinds: { kind: Page["kind"]; label: string; total: number; articles: number }[];
  years: { year: string; count: number }[];
}

const KIND_LABELS: Record<Page["kind"], string> = {
  project: "Projects",
  repo: "Repositories",
  docs: "Documents",
  code: "Source folders",
  assets: "Media folders",
  folder: "Plain folders",
};

export function statistics(): Statistics {
  return once("stats", ({ index, articles }) => {
    const roots = index.pages.filter((p) => p.depth === 0);
    const langs = new Map<string, number>();
    for (const r of roots) for (const l of r.languages) langs.set(l.name, (langs.get(l.name) ?? 0) + l.files);
    const repos = index.pages.filter((p) => p.git);
    const authors = new Set(repos.flatMap((p) => p.git!.authors.map((a) => a.name.toLowerCase())));
    const box = containers();
    const all = allCategories();
    const kinds = (Object.keys(KIND_LABELS) as Page["kind"][])
      .map((kind) => ({
        kind,
        label: KIND_LABELS[kind],
        total: index.pages.filter((p) => p.kind === kind).length,
        articles: articles.filter((p) => p.kind === kind).length,
      }))
      .filter((k) => k.total)
      .sort((a, b) => b.total - a.total);
    const years = all
      .filter((c) => c.kind === "year")
      .map((c) => ({ year: c.subject, count: c.count }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // Busiest: one entry per history, so forks and copies do not crowd the table.
    const seen = new Set<string>();
    const busiest = [...repos]
      .sort((a, b) => b.git!.commitCount - a.git!.commitCount || a.depth - b.depth)
      .filter((p) => {
        const key = `${p.git!.firstCommit}|${p.name.replace(/[-_](test|dev|copy).*$/i, "")}`;
        if (seen.has(key) || seen.has(p.git!.firstCommit ?? p.slug)) return false;
        seen.add(key);
        if (p.git!.firstCommit) seen.add(p.git!.firstCommit);
        return true;
      })
      .slice(0, 10);

    return {
      files: roots.reduce((s, r) => s + r.totalFiles, 0),
      bytes: roots.reduce((s, r) => s + r.totalBytes, 0),
      commits: histories().reduce((s, p) => s + p.git!.commitCount, 0),
      histories: histories().length,
      withHistory: repos.filter((p) => p.git!.commitCount > 0).length,
      authors: authors.size,
      fileLanguages: [...langs.entries()].map(([name, files]) => ({ name, files })).sort((a, b) => b.files - a.files),
      articleLanguages: all.filter((c) => c.kind === "language").slice(0, 10),
      frameworks: all.filter((c) => c.kind === "framework").slice(0, 12),
      biggest: index.pages
        .filter((p) => p.depth > 0 && !p.partOf && !box.has(p.slug))
        .sort((a, b) => b.totalFiles - a.totalFiles)
        .slice(0, 10),
      busiest,
      kinds,
      years,
    };
  });
}

/* ------------------------------------------------------------ alphabetical */

export interface LetterGroup {
  letter: string;
  pages: Page[];
}

const sortKey = (p: Page) => p.title.replace(/^[^\p{L}\p{N}]+/u, "") || p.title;

/** Pages under letter headings, the way an encyclopedia's index is set. */
export function letterGroups(pages: Page[]): LetterGroup[] {
  const sorted = [...pages].sort((a, b) => sortKey(a).localeCompare(sortKey(b), "en", { sensitivity: "base", numeric: true }));
  const groups = new Map<string, Page[]>();
  for (const p of sorted) {
    const c = sortKey(p)[0]?.toUpperCase() ?? "#";
    const letter = /[A-Z]/.test(c) ? c : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), p]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] === "#" ? -1 : b[0] === "#" ? 1 : a[0].localeCompare(b[0])))
    .map(([letter, pages]) => ({ letter, pages }));
}
