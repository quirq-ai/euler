import "server-only";

import { getIndex, getPage, getPages } from "@/lib/data";
import { search } from "@/lib/search";
import type { Page, PageKind } from "@/lib/types";

// Every live number in the guide, computed from the index the rest of the site reads.
// Each helper copes with an empty index, so the guide still renders before the first
// `pnpm index`.

export function depthCounts(): { depth: number; pages: number }[] {
  const { index } = getIndex();
  const max = Math.max(index.meta.maxDepth, 0);
  const counts = Array.from({ length: max + 1 }, (_, depth) => ({ depth, pages: 0 }));
  for (const p of index.pages) if (counts[p.depth]) counts[p.depth].pages++;
  return counts;
}

export function kindCounts(): { kind: PageKind; articles: number; stubs: number }[] {
  const { index } = getIndex();
  const order: PageKind[] = ["project", "repo", "docs", "code", "folder", "assets"];
  return order.map((kind) => ({
    kind,
    articles: index.pages.filter((p) => p.kind === kind && p.isArticle).length,
    stubs: index.pages.filter((p) => p.kind === kind && !p.isArticle).length,
  }));
}

export function indexFacts() {
  const { index } = getIndex();
  const roots = index.pages.filter((p) => p.depth === 0);
  const dis = Object.values(index.disambiguation);
  return {
    partOf: index.pages.filter((p) => p.partOf).length,
    deeper: index.pages.filter((p) => p.deeper).length,
    rootFiles: roots.reduce((n, r) => n + r.totalFiles, 0),
    rootBytes: roots.reduce((n, r) => n + r.totalBytes, 0),
    shared: dis.length,
    primaries: dis.filter((d) => d.primary).length,
    agentReady: index.pages.filter((p) => p.isArticle && (p.markers.includes("CLAUDE.md") || p.markers.includes("AGENTS.md"))).length,
    lackingReadme: index.pages.filter((p) => p.isArticle && !p.readme).length,
  };
}

/** Live match counts for an operator query, the way the results page counts them. */
export function matches(q: string): number {
  if (getIndex().missing) return 0;
  return search(q, { perPage: 1, correct: false }).counts.all;
}

/** A page to show both readers at work on: this project, if it is indexed. */
export function specimenPage(): Page | null {
  const own = getPage("innernet");
  if (own?.isArticle && own.summary) return own;
  const { articles } = getIndex();
  return [...articles].filter((p) => p.summary && p.readme && p.depth > 1).sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""))[0] ?? null;
}

/** The largest articles written from the folder alone, and the largest plain folders
 * still waiting for a word. Pages inside another project are left out: the project's
 * own README speaks for them. */
export function mostWanted(limit = 6): { articles: Page[]; folders: Page[] } {
  const { index } = getIndex();
  const free = index.pages.filter((p) => p.depth > 0 && !p.readme && !p.partOf);
  const bySize = (a: Page, b: Page) => b.totalFiles - a.totalFiles;
  return {
    articles: free.filter((p) => p.isArticle).sort(bySize).slice(0, limit),
    folders: free.filter((p) => !p.isArticle && p.kind === "folder" && p.totalFiles > 0).sort(bySize).slice(0, limit),
  };
}

export interface NameGroup {
  key: string;
  name: string;
  primary: Page | null;
  pages: Page[];
}

function group(key: string): NameGroup | null {
  const { index } = getIndex();
  const entry = index.disambiguation[key];
  if (!entry) return null;
  const pages = getPages(entry.slugs);
  if (!pages.length) return null;
  return { key, name: pages[0].name, primary: getPage(entry.primary), pages };
}

/** Three real namesakes: a primary topic, a qualifier that had to grow, and a name so
 * common that its bare slug is the list itself. Preferred examples first, then the
 * best the index offers. */
export function nameExamples(): { primary: NameGroup | null; grown: NameGroup | null; common: NameGroup | null; root: NameGroup | null } {
  const { index } = getIndex();
  const keys = Object.keys(index.disambiguation);
  const pick = (preferred: string, test: (g: NameGroup) => boolean, rank: (g: NameGroup) => number) => {
    const first = group(preferred);
    if (first && test(first)) return first;
    return (
      keys
        .map(group)
        .filter((g): g is NameGroup => !!g && test(g))
        .sort((a, b) => rank(b) - rank(a))[0] ?? null
    );
  };
  return {
    primary: pick("xo-swarm", (g) => !!g.primary && g.primary.depth > 0 && g.pages.length >= 3, (g) => g.pages.length),
    grown: pick("web", (g) => !!g.primary && g.pages.some((p) => p.slug.includes(",_")), (g) => -g.pages.length),
    common: pick("src", (g) => !g.primary, (g) => g.pages.length),
    root: keys.map(group).find((g): g is NameGroup => !!g?.primary && g.primary.depth === 0) ?? null,
  };
}
