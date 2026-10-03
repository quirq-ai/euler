// One pass that brings an index up to the current rules, shared by the indexer (before
// it writes) and the server (when it loads an index written by an older indexer). It
// only does what needs no disk: credentials redacted, text in house style, summaries
// re-picked, logos checked, dates in UTC and rolled up the tree, categories completed.
// Idempotent.
// No imports beyond lib/text, so the indexer can use it outside Next.

import { cleanLine, dropLeadIn, firstParagraph, readsAsInstructions, redactSecrets, undash } from "./text";
import type { Page, SiteIndex } from "./types";

export const MEDIA_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif", "mp4", "mov", "webm", "mp3", "wav", "m4a", "aac", "ico", "psd", "fig", "zip",
]);

/** File names never listed: keys, env files, credential stores, cookie jars. */
export const SECRET_NAME = [
  /^\.env/i, /\.env$/i, /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i, /\.keystore$/i, /\.jks$/i,
  /id_rsa/i, /id_ed25519/i, /secret/i, /credential/i, /^creds?\b/i, /token/i, /password/i,
  /-[0-9a-f]{12}\.json$/i, // cloud service-account key files
  /cookie/i, /\.session$/i, /\.kdbx$/i, /\.ppk$/i, /\.ovpn$/i,
];

const extOf = (f: string) => {
  const i = f.lastIndexOf(".");
  return i > 0 ? f.slice(i + 1).toLowerCase() : "";
};

/** ISO in UTC, so timestamps compare as strings and as dates alike. */
export function utc(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const earliest = (xs: (string | null | undefined)[]) =>
  xs.reduce<string | null>((m, x) => (x && (!m || Date.parse(x) < Date.parse(m)) ? x : m), null);
const latest = (xs: (string | null | undefined)[]) =>
  xs.reduce<string | null>((m, x) => (x && (!m || Date.parse(x) > Date.parse(m)) ? x : m), null);

function cleanText(p: Page) {
  p.files = p.files.filter((f) => !SECRET_NAME.some((re) => re.test(f)));
  if (p.readme) p.readme = redactSecrets(p.readme);
  if (p.manifest?.description) p.manifest.description = cleanLine(p.manifest.description.replace(/`/g, ""));
  // Agent notes are the first paragraph of CLAUDE.md; one that held a credential goes.
  if (p.agentNotes) {
    const notes = redactSecrets(p.agentNotes) === p.agentNotes ? cleanLine(p.agentNotes) : null;
    p.agentNotes = notes && (dropLeadIn(notes).length >= 60 ? dropLeadIn(notes) : notes);
  }
  if (p.git) {
    if (p.git.remote) p.git.remote = redactSecrets(p.git.remote);
    for (const c of [...p.git.recent, ...p.git.onThisDay]) c.subject = cleanLine(c.subject);
  }
  // The same choice the indexer makes: README, then manifest, then agent notes that
  // describe rather than instruct.
  const fromReadme = p.readme ? firstParagraph(p.readme) : null;
  const summary =
    (fromReadme && undash(fromReadme)) ||
    p.manifest?.description ||
    (p.agentNotes && !readsAsInstructions(p.agentNotes) ? p.agentNotes : null);
  p.summary = summary || null;
}

/** The only logos a page may carry: a base64 data URI of an image type the indexer
 * writes, of a size it could have written. Anything else (a URL, markup, a type no
 * browser draws in <img>) is dropped, and the letter sigil stands in. */
const LOGO_URI = /^data:image\/(?:svg\+xml|png|webp|jpeg|x-icon);base64,[A-Za-z0-9+/]+={0,2}$/;
const LOGO_MAX = 140_000; // 96 KB of image, base64
const SURFACES = new Set(["dark", "light", "none"]);

function cleanLogo(p: Page) {
  if (p.logo == null && p.logoSurface == null) return;
  if (typeof p.logo !== "string" || p.logo.length > LOGO_MAX || !LOGO_URI.test(p.logo)) p.logo = null;
  if (!p.logo || (p.logoSurface != null && !SURFACES.has(p.logoSurface))) p.logoSurface = null;
}

/** A folder named like source ("assets", "public") that holds nothing but media. */
function mediaOnly(p: Page): boolean {
  return p.fileCount > 0 && p.files.length === p.fileCount && p.files.every((f) => MEDIA_EXT.has(extOf(f)));
}

export function normalizeIndex(index: SiteIndex): SiteIndex {
  const bySlug = new Map(index.pages.map((p) => [p.slug, p]));

  for (const p of index.pages) {
    cleanText(p);
    cleanLogo(p);
    p.created = utc(p.created);
    p.modified = utc(p.modified);
    if (p.git) {
      p.git.firstCommit = utc(p.git.firstCommit);
      p.git.lastCommit = utc(p.git.lastCommit);
      // Older indexes counted merges in the total but not in the chart or the author
      // list. Where that list is complete (under eight names), its sum is the count the
      // rest of the page uses.
      const listed = p.git.authors.reduce((n, a) => n + a.commits, 0);
      if (p.git.authors.length < 8 && listed > 0 && listed < 6000) p.git.commitCount = listed;
    }
    if (!p.isArticle && p.kind === "code" && mediaOnly(p)) p.kind = "assets";
  }

  // Dates roll up: a folder is at least as old as anything inside it, including the
  // first commit of a repository it holds, and was touched whenever they were.
  for (const p of [...index.pages].sort((a, b) => b.depth - a.depth)) {
    const kids = p.children.map((s) => bySlug.get(s)).filter((c): c is Page => !!c);
    p.modified = latest([p.modified, p.git?.lastCommit, ...kids.map((c) => c.modified)]);
    p.created = earliest([p.created, p.git?.firstCommit, ...kids.map((c) => c.created), p.modified]);
  }

  for (const p of index.pages) {
    if (!p.isArticle) continue;
    const cats = p.categories.filter((c) => !/^Started in \d{4}$/.test(c));
    // Every framework the infobox names is a category the page belongs to.
    const missing = p.frameworks.filter((f) => !cats.includes(f));
    if (missing.length) {
      const at = Math.max(-1, ...p.frameworks.map((f) => cats.indexOf(f))) + 1;
      cats.splice(at > 0 ? at : cats.length, 0, ...missing);
    }
    const year = p.created?.slice(0, 4);
    if (year && p.kind !== "folder") {
      const at = cats.findIndex((c) => c === "Agent-ready projects" || c === "Articles lacking a README" || c.startsWith("Parts of "));
      cats.splice(at >= 0 ? at : cats.length, 0, `Started in ${year}`);
    }
    p.categories = cats;
  }
  index.meta.counts.categories = new Set(index.pages.flatMap((p) => p.categories)).size;
  return index;
}
