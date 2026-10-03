// Build the demo index: the public repositories of github.com/quirq-ai as one Innerpedia.
//   pnpm index:demo        # clones into .demo-cache/, writes data/demo/index.json
//   INNERNET_DEMO_MAX_DEPTH=4 pnpm index:demo   # fewer folder levels (default 6)
//
// data/demo/index.json is committed, and it is all the demo (Vercel) ever serves, so this
// script keeps it to what any anonymous visitor of GitHub can already see:
//   - The repository list comes from the public GitHub REST API, unauthenticated: no gh,
//     no token. Only repositories it reports as public (private: false and visibility
//     "public") are cloned, and that is asserted again right before each clone.
//   - git runs without global or system config (GIT_CONFIG_GLOBAL=/dev/null,
//     GIT_CONFIG_NOSYSTEM=1) and with no credential helper, so no stored login, token or
//     URL rewrite can reach anything an anonymous visitor could not.
//   - Clones live in .demo-cache/ (gitignored). Anything there that is not on the public
//     list is deleted before the crawl, so a repository made private drops out.
//   - The crawl is the ordinary one (scripts/build-index.ts, through its env overrides),
//     logos included. Afterwards every page path becomes its GitHub URL, file dates become
//     git dates, and the run fails if any string in the output, or any SVG logo once
//     decoded, still names this machine.
//   - The root's logo is the organization's public GitHub avatar, fetched here once,
//     anonymously, and embedded, so the demo itself never asks GitHub for anything.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEMO_ORG, DEMO_ORG_URL } from "../lib/mode";
import { normalizeIndex } from "../lib/normalize";
import { cleanLine, markdownToText, redactSecrets } from "../lib/text";
import type { IndexMeta, Page, SiteIndex } from "../lib/types";

const started = Date.now();
const projectDir = path.resolve(__dirname, "..");
const cacheRoot = path.join(projectDir, ".demo-cache");
const orgDir = path.join(cacheRoot, DEMO_ORG);
const crawlFile = path.join(cacheRoot, "crawl.json");
const outFile = path.join(projectDir, "data", "demo", "index.json");
const ROOT_LABEL = `github.com/${DEMO_ORG}`;
/** Commits fetched per repository. Dates and counts are read within this history. */
const HISTORY = 300;
/** Folder levels below the organization that get pages (repositories are level 1). */
const MAX_DEPTH = Number(process.env.INNERNET_DEMO_MAX_DEPTH ?? 6);
/** The crawler skips dot folders, so ".github" is cloned under this stand-in and renamed back. */
const DOT = "__dot__";
const README_MAX = 14_000; // the crawler's README cap

// ---------------------------------------------------------------- GitHub, anonymously

interface GhRepo {
  name: string;
  private: boolean;
  visibility?: string;
  archived: boolean;
  disabled?: boolean;
  fork: boolean;
  size: number;
  default_branch?: string | null;
  description: string | null;
}

/** Deliberately no Authorization header: an anonymous caller can only ever be shown
 * public repositories. Network errors are retried; HTTP errors are not. */
async function anonymousGet(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, {
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "innernet-demo-index" },
      });
    } catch (err) {
      if (attempt >= 4) throw new Error(`could not reach ${url}: ${err instanceof Error ? ((err.cause as Error | undefined)?.message ?? err.message) : err}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function listPublicRepos(): Promise<GhRepo[]> {
  const all: GhRepo[] = [];
  for (let page = 1; page <= 50; page++) {
    const url = `https://api.github.com/orgs/${DEMO_ORG}/repos?type=public&per_page=100&page=${page}`;
    const res = await anonymousGet(url);
    if (!res.ok) {
      const hint = res.status === 403 || res.status === 429 ? " (anonymous calls are limited to 60 an hour; try again later)" : "";
      throw new Error(`GitHub API answered ${res.status} for ${url}${hint}`);
    }
    const batch = (await res.json()) as GhRepo[];
    if (!Array.isArray(batch)) throw new Error(`GitHub API returned no list for ${url}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter((r) => r.private === false && r.visibility === "public");
}

/** The organization's avatar as a data URI: github.com/<org>.png, redirected to GitHub's
 * avatar host, anonymously. Null when it cannot be had (the caller keeps the last one). */
async function orgAvatar(): Promise<string | null> {
  for (const size of [256, 160, 96]) {
    let res: Response;
    try {
      res = await anonymousGet(`${DEMO_ORG_URL}.png?size=${size}`);
    } catch {
      return null;
    }
    const host = new URL(res.url).hostname;
    if (!res.ok || (host !== "github.com" && !host.endsWith(".githubusercontent.com"))) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type =
      buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? "image/jpeg"
      : buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
      : null;
    if (!type) return null;
    if (buf.length <= 96 * 1024) return `data:${type};base64,${buf.toString("base64")}`;
  }
  return null;
}

// ---------------------------------------------------------------- git, with no config

const gitEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "never",
};
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_ASKPASS", "SSH_ASKPASS", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GH_TOKEN", "GITHUB_TOKEN"]) {
  delete gitEnv[k];
}
const NO_CREDENTIALS = ["-c", "credential.helper=", "-c", "core.askPass="];

function git(cwd: string, args: string[], timeout = 300_000): string {
  return execFileSync("git", args, {
    cwd,
    env: gitEnv,
    encoding: "utf8",
    timeout,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(cwd: string, args: string[]): string | null {
  try {
    return git(cwd, args, 30_000).trim();
  } catch {
    return null;
  }
}

const cacheName = (name: string) => (name.startsWith(".") ? DOT + name.slice(1) : name);
const cloneUrl = (name: string) => `https://github.com/${DEMO_ORG}/${name}.git`;

function syncRepo(repo: GhRepo, branch: string): void {
  // Asserted here, right before any network fetch, whatever the filters above did.
  if (repo.private !== false || repo.visibility !== "public") throw new Error(`refusing to clone ${repo.name}: not public`);
  const dir = path.join(orgDir, cacheName(repo.name));
  const url = cloneUrl(repo.name);
  const fresh = fs.existsSync(path.join(dir, ".git")) && tryGit(dir, ["config", "--get", "remote.origin.url"]) === url;
  if (fresh) {
    git(dir, [...NO_CREDENTIALS, "fetch", "--quiet", "--depth", String(HISTORY), "--filter=blob:none", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    git(dir, ["checkout", "--quiet", "--force", "-B", branch, `refs/remotes/origin/${branch}`]);
    git(dir, ["reset", "--quiet", "--hard"]);
    git(dir, ["clean", "-ffdxq"]);
  } else {
    fs.rmSync(dir, { recursive: true, force: true });
    // Blobless: full trees for the history read below, file contents only for the checkout.
    git(orgDir, [...NO_CREDENTIALS, "clone", "--quiet", "--depth", String(HISTORY), "--single-branch", "--branch", branch, "--filter=blob:none", "--no-tags", url, cacheName(repo.name)]);
  }
}

/** True when the history stops at the fetch depth rather than at the first commit. */
function truncated(dir: string): boolean {
  const shallow = path.join(dir, ".git", "shallow");
  if (!fs.existsSync(shallow)) return false;
  return fs
    .readFileSync(shallow, "utf8")
    .split("\n")
    .filter(Boolean)
    .some((sha) => /^parent /m.test(tryGit(dir, ["cat-file", "-p", sha]) ?? ""));
}

// ---------------------------------------------------------------- dates from history

interface Span {
  created: number;
  modified: number;
}

/** Each folder's first and last commit dates, keyed by its path inside the repository
 * ("" for the repository itself), from one `git log --name-only` pass. A file counts from
 * the first commit (within the fetched history) that touched it to the last. */
function folderSpans(dir: string): { folders: Map<string, Span>; repo: Span } {
  const log = git(dir, ["-c", "core.quotePath=false", "log", "--no-renames", "--name-only", "--format=%x1e%aI", "HEAD"]);
  const files = new Map<string, Span>();
  const repo: Span = { created: Infinity, modified: 0 };
  for (const chunk of log.split("\x1e")) {
    const lines = chunk.split("\n");
    const t = Date.parse(lines[0]?.trim() ?? "");
    if (Number.isNaN(t)) continue;
    repo.created = Math.min(repo.created, t);
    repo.modified = Math.max(repo.modified, t);
    for (const raw of lines.slice(1)) {
      const f = raw.trim().normalize("NFC");
      if (!f) continue;
      const s = files.get(f);
      if (s) {
        s.created = Math.min(s.created, t);
        s.modified = Math.max(s.modified, t);
      } else files.set(f, { created: t, modified: t });
    }
  }
  const folders = new Map<string, Span>();
  const tracked = git(dir, ["ls-tree", "-r", "-z", "--name-only", "HEAD"]).split("\0").filter(Boolean);
  for (const raw of tracked) {
    const f = raw.normalize("NFC");
    const segs = f.split("/");
    // Dot files and dot folders are not content to the crawler; they do not date a folder either.
    if (segs.some((s) => s.startsWith("."))) continue;
    const span = files.get(f) ?? repo;
    for (let i = 0; i < segs.length; i++) {
      const key = segs.slice(0, i).join("/");
      const cur = folders.get(key);
      if (cur) {
        cur.created = Math.min(cur.created, span.created);
        cur.modified = Math.max(cur.modified, span.modified);
      } else folders.set(key, { ...span });
    }
  }
  return { folders, repo };
}

const iso = (ms: number) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);

// ---------------------------------------------------------------- checks

/** Calls fn for every string in the value, object keys included, with a readable location. */
function walkStrings(value: unknown, fn: (s: string, at: string[]) => void, at: string[] = []): void {
  if (typeof value === "string") fn(value, at);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, fn, [...at, String(i)]));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      fn(k, [...at, "(key)"]);
      walkStrings(v, fn, [...at, k]);
    }
  }
}

// ---------------------------------------------------------------- run

async function main() {
  const listed = await listPublicRepos();
  const repos = listed
    .filter((r) => !r.archived && !r.disabled && r.size > 0 && !!r.default_branch)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const skipped = listed.filter((r) => !repos.includes(r)).map((r) => `${r.name} (${r.archived ? "archived" : r.disabled ? "disabled" : "empty"})`);
  for (const r of repos) {
    if (!/^[A-Za-z0-9._-]+$/.test(r.name) || r.name === "." || r.name === ".." || r.name.includes(DOT)) throw new Error(`unexpected repository name ${JSON.stringify(r.name)}`);
    if (!/^[A-Za-z0-9._/-]+$/.test(r.default_branch!) || r.default_branch!.includes("..")) throw new Error(`unexpected branch name on ${r.name}`);
  }
  if (new Set(repos.map((r) => cacheName(r.name).toLowerCase())).size !== repos.length) throw new Error("two repositories map to one cache folder");
  if (!repos.length) throw new Error(`no public, non-empty repositories found for ${DEMO_ORG}`);
  console.log(`${repos.length} public repositories in ${DEMO_ORG}${skipped.length ? `, skipping ${skipped.join(", ")}` : ""}`);

  // Clone or refresh each, and clear out anything that is no longer on the public list.
  fs.mkdirSync(orgDir, { recursive: true });
  const wanted = new Set(repos.map((r) => cacheName(r.name)));
  for (const entry of fs.readdirSync(orgDir)) {
    if (!wanted.has(entry)) {
      console.log(`removing ${entry} from the cache: not a public repository`);
      fs.rmSync(path.join(orgDir, entry), { recursive: true, force: true });
    }
  }
  const info = new Map<string, { repo: GhRepo; branch: string; dir: string; truncated: boolean; spans: ReturnType<typeof folderSpans> }>();
  for (const repo of repos) {
    const branch = repo.default_branch!;
    const t = Date.now();
    syncRepo(repo, branch);
    const dir = path.join(orgDir, cacheName(repo.name));
    const head = tryGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (head !== branch) throw new Error(`${repo.name}: expected branch ${branch}, found ${head}`);
    const entry = { repo, branch, dir, truncated: truncated(dir), spans: folderSpans(dir) };
    info.set(cacheName(repo.name), entry);
    console.log(`  ${repo.name.padEnd(24)} ${branch.padEnd(8)} ${repo.fork ? "fork " : "     "}${entry.truncated ? `last ${HISTORY} commits` : "full history"}  ${Date.now() - t} ms`);
  }

  // The ordinary crawl, pointed at the cache.
  fs.rmSync(crawlFile, { force: true });
  execFileSync(path.join(projectDir, "node_modules", ".bin", "tsx"), [path.join(projectDir, "scripts", "build-index.ts")], {
    cwd: projectDir,
    env: { ...gitEnv, INNERNET_ROOTS: orgDir, INNERNET_OUT: crawlFile, INNERNET_MAX_DEPTH: String(MAX_DEPTH) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const crawled = JSON.parse(fs.readFileSync(crawlFile, "utf8")) as SiteIndex;
  fs.rmSync(crawlFile, { force: true });

  // ------------------------------------------------ paths become GitHub URLs
  const undot = (s: string) => s.split(DOT).join(".");
  const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  const rootPage = crawled.pages.find((p) => p.depth === 0);
  if (!rootPage || crawled.pages.filter((p) => p.depth === 0).length !== 1) throw new Error("the crawl should have exactly one root");

  for (const p of crawled.pages) {
    const rel = p.relPath.split(path.sep).join("/");
    const [first, ...rest] = rel ? rel.split("/") : [];
    p.root = ROOT_LABEL;
    if (p.depth === 0) {
      p.path = DEMO_ORG_URL;
      p.relPath = "";
      continue;
    }
    const repo = info.get(first);
    if (!repo) throw new Error(`page ${p.slug} lies outside the public repositories`);
    const inRepo = rest.join("/");
    p.path = inRepo
      ? `${DEMO_ORG_URL}/${encodeURIComponent(repo.repo.name)}/tree/${encodePath(repo.branch)}/${encodePath(inRepo)}`
      : `${DEMO_ORG_URL}/${encodeURIComponent(repo.repo.name)}`;
    p.relPath = [repo.repo.name, ...rest].join("/");
    // Dates from history: a fresh clone stamps every file with today.
    const span = repo.spans.folders.get(inRepo.normalize("NFC")) ?? repo.spans.repo;
    p.created = iso(span.created);
    p.modified = iso(span.modified);
    if (p.depth === 1 && repo.repo.fork && !p.categories.includes("Forked repositories")) {
      p.categories.splice(p.categories.indexOf("Git repositories") + 1 || p.categories.length, 0, "Forked repositories");
    }
  }

  // The ".github" stand-in, renamed back everywhere a folder name can surface.
  for (const p of crawled.pages) {
    p.name = undot(p.name);
    p.title = undot(p.title);
    p.slug = undot(p.slug);
    p.parent = p.parent && undot(p.parent);
    p.partOf = p.partOf && undot(p.partOf);
    p.children = p.children.map(undot);
    p.related = p.related.map(undot);
    p.categories = p.categories.map(undot);
  }
  crawled.disambiguation = Object.fromEntries(
    Object.entries(crawled.disambiguation).map(([k, v]) => [undot(k), { primary: v.primary && undot(v.primary), slugs: v.slugs.map(undot) }]),
  );

  // The root: the organization, with its GitHub profile as its README.
  const repoSpans = [...info.values()].map((r) => r.spans.repo);
  rootPage.name = DEMO_ORG;
  rootPage.title = DEMO_ORG;
  rootPage.created = iso(Math.min(...repoSpans.map((s) => s.created)));
  rootPage.modified = iso(Math.max(...repoSpans.map((s) => s.modified)));
  const profile = info.get(cacheName(".github"));
  const profileText = profile ? tryGit(profile.dir, ["show", "HEAD:profile/README.md"]) : null;
  if (profileText) {
    rootPage.readme = redactSecrets(profileText.replace(/\r\n/g, "\n").trim().slice(0, README_MAX)) || null;
    rootPage.readmeFile = ".github/profile/README.md";
    rootPage.words = rootPage.readme ? markdownToText(rootPage.readme).split(" ").length : 0;
    if (rootPage.readme && !rootPage.markers.includes("README")) rootPage.markers.push("README");
    if (rootPage.readme) rootPage.categories = rootPage.categories.filter((c) => c !== "Articles lacking a README");
  }

  // The root's logo: the organization's avatar. Should GitHub not answer, the avatar of
  // the last demo index stands in, so an offline rebuild does not lose it.
  let avatar = await orgAvatar();
  if (!avatar) {
    try {
      const last = (JSON.parse(fs.readFileSync(outFile, "utf8")) as SiteIndex).pages.find((p) => p.depth === 0)?.logo;
      if (typeof last === "string" && last.startsWith("data:image/")) avatar = last;
    } catch {
      /* no earlier index */
    }
    console.warn(avatar ? "  could not fetch the organization's avatar; keeping the last one" : "  could not fetch the organization's avatar; the root keeps its sigil");
  }
  rootPage.logo = avatar;
  rootPage.logoSurface = avatar ? "none" : null;

  const meta: IndexMeta = {
    ...crawled.meta,
    roots: [{ label: ROOT_LABEL, path: DEMO_ORG_URL }],
    durationMs: Date.now() - started,
    demo: {
      org: DEMO_ORG,
      repos: [...info.values()].map(({ repo, branch }) => ({
        name: repo.name,
        url: `${DEMO_ORG_URL}/${repo.name}`,
        branch,
        fork: repo.fork,
        description: repo.description ? cleanLine(repo.description) : null,
      })),
    },
  };
  // Summaries, dash-free text, rolled-up dates and "Started in" categories, as on load.
  const index = normalizeIndex({ meta, pages: crawled.pages, disambiguation: crawled.disambiguation });
  const json = JSON.stringify(index);

  // ------------------------------------------------ checks: nothing from this machine
  const problems: string[] = [];
  const realOr = (p: string) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return p;
    }
  };
  // Never anywhere, not even inside README text.
  const banned = [...new Set([orgDir, cacheRoot, projectDir, realOr(orgDir), realOr(projectDir), os.homedir(), realOr(os.homedir()), ".demo-cache", DOT])].filter(Boolean);
  for (const b of banned) if (json.includes(b)) problems.push(`output contains ${JSON.stringify(b)}`);

  // Path shapes that name a machine. In text quoted from a repository (README, notes,
  // manifest, commit subjects) they pass only when that repository publishes the same
  // path itself; everywhere else they fail outright.
  const LOCAL = /(?:~\/|\/Users\/|\/private\/)[^\s"'`<>()[\]{}|,;*]*/g;
  const QUOTED = new Set(["readme", "summary", "agentNotes", "subject", "manifest", "logo"]);
  const published = new Map<string, boolean>();
  const quotedPaths = new Set<string>(); // home-style paths a repository itself publishes
  const subjects = new Map<string, string>();
  const isPublished = (repoKey: string | undefined, core: string) => {
    const r = repoKey ? info.get(repoKey) : undefined;
    if (!r) return false;
    const key = `${repoKey}\0${core}`;
    if (!published.has(key)) {
      // In a file at HEAD, or in a commit subject: either way, on GitHub already.
      const inTree = tryGit(r.dir, ["grep", "-F", "-q", "-e", core, "HEAD", "--"]) !== null;
      if (!inTree && !subjects.has(repoKey!)) subjects.set(repoKey!, tryGit(r.dir, ["log", "--format=%s", "HEAD"]) ?? "");
      published.set(key, inTree || subjects.get(repoKey!)!.includes(core));
    }
    return published.get(key)!;
  };
  const repoKeyOf = (p: Page) => (p.depth === 0 ? cacheName(".github") : cacheName(p.relPath.split("/")[0]));
  const checkLocal = (s: string, at: string[], repoKey: string | undefined) => {
    for (const m of s.matchAll(LOCAL)) {
      // Sentence punctuation after a path is prose, not part of it.
      const core = m[0].replace(/[.:!?]+$/, "");
      const quoted = at.some((k) => QUOTED.has(k));
      if (!quoted || !isPublished(repoKey, core)) problems.push(`${at.join(".")}: ${JSON.stringify(m[0])}`);
      else quotedPaths.add(core);
    }
  };
  index.pages.forEach((p) => walkStrings(p, (s, at) => checkLocal(s, [`pages[${p.slug}]`, ...at], repoKeyOf(p))));
  // Logos travel as base64, which the checks above cannot read: an SVG is text, so it is
  // decoded and held to the same rules as a README quoted from the same repository.
  for (const p of index.pages) {
    const svg = p.logo?.match(/^data:image\/svg\+xml;base64,(.*)$/)?.[1];
    if (!svg) continue;
    const text = Buffer.from(svg, "base64").toString("utf8");
    for (const b of banned) if (text.includes(b)) problems.push(`pages[${p.slug}].logo contains ${JSON.stringify(b)}`);
    checkLocal(text, [`pages[${p.slug}]`, "logo"], repoKeyOf(p));
  }
  walkStrings(index.disambiguation, (s, at) => checkLocal(s, ["disambiguation", ...at], undefined));
  walkStrings({ ...index.meta, demo: { ...index.meta.demo, repos: index.meta.demo!.repos.map((r) => ({ ...r, description: null })) } }, (s, at) =>
    checkLocal(s, ["meta", ...at], undefined),
  );

  const repoNames = new Set(index.meta.demo!.repos.map((r) => r.name));
  for (const p of index.pages) {
    if (p.path !== DEMO_ORG_URL && !p.path.startsWith(`${DEMO_ORG_URL}/`)) problems.push(`pages[${p.slug}].path is ${JSON.stringify(p.path)}`);
    if (p.root !== ROOT_LABEL) problems.push(`pages[${p.slug}].root is ${JSON.stringify(p.root)}`);
    if (p.depth === 1 && !repoNames.has(p.name)) problems.push(`pages[${p.slug}] is not a listed repository`);
    if (p.git && p.git.remote !== `${DEMO_ORG_URL}/${p.name}`) problems.push(`pages[${p.slug}].git.remote is ${JSON.stringify(p.git.remote)}`);
  }
  if (index.pages.filter((p) => p.depth === 1).length !== repoNames.size) problems.push("repository pages and meta.demo.repos disagree");

  // The public list once more: a repository made private during the run must not ship.
  const nowPublic = new Set((await listPublicRepos()).map((r) => r.name));
  for (const name of repoNames) if (!nowPublic.has(name)) problems.push(`${name} is no longer a public repository`);

  if (problems.length) {
    console.error(`demo index NOT written, ${problems.length} problem(s):`);
    for (const pr of problems.slice(0, 40)) console.error(`  ${pr}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = `${outFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, outFile);

  const c = index.meta.counts;
  const shallow = [...info.values()].filter((r) => r.truncated).map((r) => r.repo.name);
  const projects = index.pages.filter((p) => p.isArticle && (p.kind === "repo" || p.kind === "project"));
  console.log(
    `demo index: ${repoNames.size} repositories, ${c.pages} folders, ${c.articles} articles, ${c.categories} categories, ` +
      `${(json.length / 1024 / 1024).toFixed(2)} MB -> ${path.relative(projectDir, outFile)} in ${Date.now() - started} ms` +
      `\n  logos: ${projects.filter((p) => p.logo).length} of ${projects.length} repositories and projects${rootPage.logo ? ", and the organization's avatar on the root" : ""}` +
      (shallow.length ? `\n  history read to the last ${HISTORY} commits for: ${shallow.join(", ")}` : "") +
      (quotedPaths.size ? `\n  paths quoted from the repositories' own text: ${[...quotedPaths].join(", ")}` : ""),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
