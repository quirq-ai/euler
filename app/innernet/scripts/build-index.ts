// Crawl the configured roots and write data/index.json.
//   pnpm index                                      # uses innernet.config.json
//   INNERNET_ROOTS=~/a,~/b INNERNET_MAX_DEPTH=3 pnpm index   # other roots and depth, one run
//   INNERNET_OUT=/tmp/test.json pnpm index         # writes there; data/index.json is left alone
//
// Privacy rules this script keeps:
//   - It only ever reads README*, CLAUDE.md, AGENTS.md, project manifests and a project's
//     own logo image (found by name: logo, icon, mark, favicon...). Never .env, keys, or
//     any other file content, and nothing at all inside secret-looking folders.
//   - Secret-looking file names are left out of the listings.
//   - Credential-shaped values in README text, manifests and commit subjects are
//     redacted (lib/text.ts redactSecrets), and git remotes lose any embedded login.
//   - Output stays on this machine (data/ is gitignored), and the indexer never reads
//     its own output back in.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { MEDIA_EXT, normalizeIndex, SECRET_NAME, utc } from "../lib/normalize";
import { cleanLine, firstParagraph, markdownToText, readsAsInstructions, redactSecrets } from "../lib/text";
import type { Commit, GitInfo, IndexMeta, LogoSurface, Manifest, Page, PageKind, SiteIndex } from "../lib/types";

const started = Date.now();
const projectDir = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(projectDir, "innernet.config.json"), "utf8")) as {
  roots: string[];
  maxDepth: number;
};
const rootSpecs = (process.env.INNERNET_ROOTS?.split(",") ?? config.roots).map((r) => r.trim()).filter(Boolean);
const maxDepth = Number(process.env.INNERNET_MAX_DEPTH ?? config.maxDepth ?? 6);
const outFile = path.resolve(process.env.INNERNET_OUT ?? path.join(projectDir, "data", "index.json"));
// Our own output is never indexed: it would count itself and mark every ancestor
// touched at index time.
const ownData = path.join(projectDir, "data");
const now = new Date();

// ---------------------------------------------------------------- rules

const PRUNE = new Set([
  "node_modules", "bower_components", "jspm_packages", "vendor", ".git", ".hg", ".svn",
  ".next", ".nuxt", ".svelte-kit", ".turbo", ".vercel", ".cache", ".parcel-cache", ".output",
  "dist", "build", "out", "coverage", "target", "DerivedData", "Pods",
  "__pycache__", "venv", ".venv", "site-packages", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".gradle", ".dart_tool", ".idea", ".vscode", ".expo", "storybook-static",
]);

const SECRET_DIR = /cred|secret|private|keys?$/i;

const CODE_DIR_NAMES = new Set([
  "src", "lib", "app", "apps", "components", "pages", "hooks", "utils", "util", "routes", "api",
  "server", "client", "scripts", "test", "tests", "__tests__", "styles", "public", "static",
  "assets", "types", "config", "middleware", "models", "services", "store", "stores", "packages",
  "contracts", "migrations", "templates", "layouts", "views", "controllers", "helpers", "core",
]);

const LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", ipynb: "Jupyter", rs: "Rust", go: "Go", sol: "Solidity", dart: "Dart",
  swift: "Swift", kt: "Kotlin", java: "Java", rb: "Ruby", php: "PHP", c: "C", h: "C",
  cpp: "C++", cc: "C++", hpp: "C++", cs: "C#", lua: "Lua", zig: "Zig", ex: "Elixir",
  sh: "Shell", zsh: "Shell", bash: "Shell", html: "HTML", css: "CSS", scss: "CSS",
  vue: "Vue", svelte: "Svelte", astro: "Astro", md: "Markdown", mdx: "MDX",
  sql: "SQL", glsl: "GLSL", wgsl: "WGSL", json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML",
};
const NON_CODE_LANGS = new Set(["Markdown", "MDX", "JSON", "YAML", "TOML", "HTML", "CSS"]);
const DOC_EXT = new Set(["md", "mdx", "html", "pdf", "txt", "docx", "doc", "rtf", "pages", "key", "pptx", "numbers", "csv", "xlsx"]);

const FRAMEWORKS: [string, string][] = [
  ["next", "Next.js"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"],
  ["@sveltejs/kit", "SvelteKit"], ["astro", "Astro"], ["vite", "Vite"], ["three", "Three.js"],
  ["@react-three/fiber", "React Three Fiber"], ["tailwindcss", "Tailwind CSS"],
  ["@tauri-apps/api", "Tauri"], ["electron", "Electron"], ["express", "Express"],
  ["fastify", "Fastify"], ["hono", "Hono"], ["@nestjs/core", "NestJS"], ["remotion", "Remotion"],
  ["fumadocs-core", "Fumadocs"], ["@clerk/nextjs", "Clerk"], ["drizzle-orm", "Drizzle"],
  ["@prisma/client", "Prisma"], ["ethers", "ethers.js"], ["viem", "viem"], ["wagmi", "wagmi"],
  ["hardhat", "Hardhat"], ["@anthropic-ai/sdk", "Anthropic SDK"],
  ["@anthropic-ai/claude-agent-sdk", "Claude Agent SDK"], ["openai", "OpenAI SDK"], ["ai", "AI SDK"],
  ["zustand", "Zustand"], ["gsap", "GSAP"], ["framer-motion", "Framer Motion"], ["motion", "Motion"],
  ["d3", "D3"], ["expo", "Expo"], ["react-native", "React Native"], ["@mui/material", "MUI"],
  ["@radix-ui/react-dialog", "Radix UI"], ["socket.io", "Socket.IO"], ["@supabase/supabase-js", "Supabase"],
  ["mongoose", "MongoDB"], ["pg", "PostgreSQL"], ["stripe", "Stripe"], ["@vercel/sandbox", "Vercel Sandbox"],
  ["@modelcontextprotocol/sdk", "MCP"], ["langchain", "LangChain"], ["hyperframes", "HyperFrames"],
];
const PY_FRAMEWORKS: [RegExp, string][] = [
  [/\bfastapi\b/i, "FastAPI"], [/\bflask\b/i, "Flask"], [/\bdjango\b/i, "Django"],
  [/\bstreamlit\b/i, "Streamlit"], [/\blangchain/i, "LangChain"], [/\bopenai\b/i, "OpenAI SDK"],
  [/\banthropic\b/i, "Anthropic SDK"], [/\btorch\b/i, "PyTorch"], [/\bpandas\b/i, "pandas"],
  [/\bagno\b/i, "Agno"], [/\bqdrant/i, "Qdrant"], [/\bpeewee\b/i, "Peewee"], [/\bweb3\b/i, "web3.py"],
  [/\bccxt\b/i, "ccxt"], [/\bselenium\b/i, "Selenium"], [/\bnumpy\b/i, "NumPy"],
];

// ---------------------------------------------------------------- helpers

const expand = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);
const label = (p: string) => (p.startsWith(os.homedir()) ? "~" + p.slice(os.homedir().length) : p);
const iso = (ms: number | null) => (ms && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);
const extOf = (f: string) => {
  const i = f.lastIndexOf(".");
  return i > 0 ? f.slice(i + 1).toLowerCase() : "";
};
const pruned = (dir: string, name: string) =>
  PRUNE.has(name) || name.startsWith(".") || name.endsWith(".app") || name.endsWith(".xcassets") || path.join(dir, name) === ownData;

function readText(file: string, max = 14_000): string | null {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(max);
    const n = fs.readSync(fd, buf, 0, max, 0);
    fs.closeSync(fd);
    return buf.subarray(0, n).toString("utf8");
  } catch {
    return null;
  }
}

function stripCreds(url: string): string {
  let u = url.trim().replace(/\/\/[^/@\s]+@/, "//");
  const ssh = u.match(/^git@([^:]+):(.+?)(\.git)?$/);
  if (ssh) u = `https://${ssh[1]}/${ssh[2]}`;
  return u.replace(/\.git$/, "");
}

function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function parseManifest(dir: string, files: Set<string>): Manifest | null {
  if (files.has("package.json")) {
    try {
      const pkg = JSON.parse(readText(path.join(dir, "package.json"), 400_000) ?? "{}");
      return {
        file: "package.json",
        name: typeof pkg.name === "string" ? pkg.name : null,
        version: typeof pkg.version === "string" ? pkg.version : null,
        description: typeof pkg.description === "string" ? cleanLine(pkg.description) : null,
        scripts: Object.keys(pkg.scripts ?? {}).slice(0, 20),
        dependencies: Object.keys(pkg.dependencies ?? {}),
        devDependencies: Object.keys(pkg.devDependencies ?? {}),
      };
    } catch {
      /* fall through */
    }
  }
  for (const file of ["pyproject.toml", "Cargo.toml"] as const) {
    if (!files.has(file)) continue;
    const t = readText(path.join(dir, file), 60_000) ?? "";
    const field = (k: string) => t.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, "m"))?.[1] ?? null;
    const deps = [...t.matchAll(/^\s*"?([A-Za-z0-9_.-]+)\s*(?:[=<>~^!].*)?"?,?\s*$/gm)]
      .map((m) => m[1])
      .filter((d) => !/^(name|version|description|authors|readme|license|edition|requires-python|python)$/i.test(d));
    const description = field("description");
    return { file, name: field("name"), version: field("version"), description: description && cleanLine(description), scripts: [], dependencies: [...new Set(deps)].slice(0, 60), devDependencies: [] };
  }
  if (files.has("go.mod")) {
    const t = readText(path.join(dir, "go.mod"), 60_000) ?? "";
    const deps = [...t.matchAll(/^\s+([\w./-]+)\s+v[\w.+-]+/gm)].map((m) => m[1]);
    return { file: "go.mod", name: t.match(/^module\s+(\S+)/m)?.[1] ?? null, version: null, description: null, scripts: [], dependencies: deps, devDependencies: [] };
  }
  if (files.has("requirements.txt")) {
    const t = readText(path.join(dir, "requirements.txt"), 60_000) ?? "";
    const deps = t.split("\n").map((l) => l.trim().split(/[=<>~!\[;\s]/)[0]).filter((d) => d && !d.startsWith("#") && !d.startsWith("-"));
    return { file: "requirements.txt", name: null, version: null, description: null, scripts: [], dependencies: [...new Set(deps)], devDependencies: [] };
  }
  return null;
}

function gitInfo(dir: string): GitInfo | null {
  const log = git(dir, ["log", "--no-merges", "-n", "6000", "--format=%h%x1f%aI%x1f%an%x1f%s"]);
  const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const remoteRaw = git(dir, ["config", "--get", "remote.origin.url"]);
  // Counted the same way as the log above (no merges), so the total, the monthly chart
  // and the author list on one page agree.
  const countRaw = git(dir, ["rev-list", "--count", "--no-merges", "HEAD"]);
  // Root commits, so a history longer than the log cap still starts where it started.
  const roots = (git(dir, ["log", "--max-parents=0", "--format=%aI", "HEAD"]) ?? "").split("\n").filter(Boolean);
  const commits: Commit[] = (log ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author, subject] = line.split("\x1f");
      return { hash, date, author, subject: cleanLine((subject ?? "").slice(0, 160)) };
    });
  if (!commits.length && !branch) return null;

  const authors = new Map<string, number>();
  const monthly = new Map<string, number>();
  for (const c of commits) {
    authors.set(c.author, (authors.get(c.author) ?? 0) + 1);
    const m = c.date.slice(0, 7);
    monthly.set(m, (monthly.get(m) ?? 0) + 1);
  }
  const months: { month: string; count: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, count: monthly.get(key) ?? 0 });
  }
  const md = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const onThisDay = commits.filter((c) => c.date.slice(5, 10) === md && Number(c.date.slice(0, 4)) < now.getFullYear()).slice(0, 10);

  return {
    branch: branch && branch !== "HEAD" ? branch : null,
    remote: remoteRaw ? stripCreds(remoteRaw) : null,
    commitCount: Number(countRaw) || commits.length,
    firstCommit: utc([...roots, commits.at(-1)?.date].filter(Boolean).sort((a, b) => Date.parse(a!) - Date.parse(b!))[0]),
    lastCommit: utc(commits[0]?.date),
    recent: commits.slice(0, 15),
    authors: [...authors].map(([name, n]) => ({ name, commits: n })).sort((a, b) => b.commits - a.commits).slice(0, 8),
    authorCount: authors.size,
    monthly: months,
    onThisDay,
  };
}

// ---------------------------------------------------------------- logos
// A project's own mark, embedded in the index as a data URI so every page that shows the
// project can show it without a request. Found by file name alone (logo, icon, mark,
// brand, favicon, apple-touch-icon, with suffixes like -light, -512 or @2x) in the
// project's folder and in the places projects keep their branding, at most three folders
// down. A file is opened only when its name, its folder and every folder on the way pass
// the secret rules; symbolic links are never followed. Directory listings come from the
// crawl itself where it has them, so the search costs almost nothing.

const listings = new Map<string, fs.Dirent[]>();
function listing(dir: string): fs.Dirent[] {
  const hit = listings.get(dir);
  if (hit) return hit;
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

const LOGO_DIRS = new Set([
  "public", "assets", "static", "app", "src", "docs", ".github", "images", "img", "media",
  "brand", "branding", "logo", "logos", "icons", "resources", "_static", "src-tauri",
]);
const LOGO_DEPTH = 3;
const LOGO_EXT: Record<string, { rank: number; mime: string; max: number }> = {
  svg: { rank: 0, mime: "image/svg+xml", max: 64 * 1024 },
  png: { rank: 1, mime: "image/png", max: 96 * 1024 },
  webp: { rank: 2, mime: "image/webp", max: 96 * 1024 },
  jpg: { rank: 3, mime: "image/jpeg", max: 96 * 1024 },
  jpeg: { rank: 3, mime: "image/jpeg", max: 96 * 1024 },
  ico: { rank: 4, mime: "image/x-icon", max: 96 * 1024 },
};
// logo before icon before mark before favicon. Within a tier, the extension decides.
const LOGO_TIER: Record<string, number> = { logo: 0, icon: 1, mark: 2, brand: 2, favicon: 3, "apple-touch-icon": 3, "apple-icon": 3 };
const LOGO_WORDS = "light|dark|white|black|colou?r|mono|full|small|large|square|round(?:ed)?|circle|inverse|inverted|transparent|text|mark|symbol|only|primary|default|main";
// "xo-logo-light.svg": an optional prefix (checked against the project's name below), the
// name, then suffixes. Lazy prefix, so "apple-touch-icon" is read as one name.
const LOGO_RE = new RegExp(
  `^(?:(.+?)[-_.])??(apple-touch-icon|apple-icon|favicon|logo|icon|mark|brand)((?:[-_.@](?:${LOGO_WORDS}|\\d+(?:x\\d+)?|\\d+x))*|\\d+(?:x\\d+)?)\\.(svg|png|webp|jpe?g|ico)$`,
  "i",
);
const TONE_WORDS = /light|dark|white|black|inver|mono/i;
const GENERIC_PREFIX = ["app", "site", "web", "main", "default", "brand", "project"];

/** Prefixes a logo file may carry and still be this project's: its name, its package's
 * name and their words ("xo-logo.svg" in xo-cowork-api), never a third party's. */
function logoPrefixes(name: string, pkg: string | null): Set<string> {
  const out = new Set(GENERIC_PREFIX);
  for (const n of [name, pkg?.replace(/^@[^/]+\//, "")]) {
    if (!n) continue;
    out.add(n.toLowerCase());
    for (const t of n.toLowerCase().split(/[-_.\s]+/)) if (t.length >= 2) out.add(t);
  }
  return out;
}

interface Pixels {
  w: number;
  h: number;
  at: (x: number, y: number) => [number, number, number, number];
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A small PNG reader (non-interlaced, any colour type and bit depth), enough to look at
 * a logo's colours. Null for anything it does not follow. */
function decodePng(buf: Buffer): Pixels | null {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  let off = 8;
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString("latin1", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR" && len >= 13) [w, h, depth, type, interlace] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9], data[12]];
    else if (kind === "PLTE") palette = data;
    else if (kind === "tRNS") trns = data;
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    off += 12 + len;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type];
  if (!w || !h || !channels || interlace !== 0 || w * h > 4_000_000 || ![1, 2, 4, 8, 16].includes(depth) || (depth < 8 && type !== 0 && type !== 3)) return null;
  let raw: Buffer;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const bits = channels * depth;
  const stride = Math.ceil((w * bits) / 8);
  const bpp = Math.max(1, bits >> 3);
  if (raw.length < h * (stride + 1)) return null;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[row + i - bpp] : 0;
      const b = y ? px[row - stride + i] : 0;
      const c = i >= bpp && y ? px[row - stride + i - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : -1;
      if (pred < 0) return null;
      px[row + i] = (raw[src + i] + pred) & 255;
    }
  }
  const max = (1 << depth) - 1;
  const sample = (y: number, i: number): number => {
    if (depth === 8) return px[y * stride + i];
    if (depth === 16) return px[y * stride + i * 2];
    const bit = i * depth;
    const v = (px[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & max;
    return type === 3 ? v : Math.round((v * 255) / max);
  };
  const at = (x: number, y: number): [number, number, number, number] => {
    if (type === 0) {
      const g = sample(y, x);
      return [g, g, g, 255];
    }
    if (type === 2) return [sample(y, x * 3), sample(y, x * 3 + 1), sample(y, x * 3 + 2), 255];
    if (type === 3) {
      const i = sample(y, x);
      if (!palette || i * 3 + 2 >= palette.length) return [0, 0, 0, 0];
      return [palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], trns && i < trns.length ? trns[i] : 255];
    }
    if (type === 4) {
      const g = sample(y, x * 2);
      return [g, g, g, sample(y, x * 2 + 1)];
    }
    return [sample(y, x * 4), sample(y, x * 4 + 1), sample(y, x * 4 + 2), sample(y, x * 4 + 3)];
  };
  return { w, h, at };
}

// Raster logos are stored no larger than this on their long side: twice the largest tile
// they fill, so they stay crisp on a high-density screen without weighing down a page.
const LOGO_PX = 160;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** The pixels as an RGBA PNG, box-filtered down to LOGO_PX on the long side (alpha
 * weighted, so edges keep no dark fringe). Deterministic: the same image, the same bytes. */
function encodePng(px: Pixels): Buffer {
  const scale = Math.min(1, LOGO_PX / Math.max(px.w, px.h));
  const w = Math.max(1, Math.round(px.w * scale));
  const h = Math.max(1, Math.round(px.h * scale));
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y / scale), y1 = Math.max(y0 + 1, Math.min(px.h, Math.floor((y + 1) / scale)));
    raw[y * stride] = 1; // "sub" filter: each byte stored as its difference from the pixel to its left
    let prev = [0, 0, 0, 0];
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x / scale), x1 = Math.max(x0 + 1, Math.min(px.w, Math.floor((x + 1) / scale)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const [pr, pg, pb, pa] = px.at(sx, sy);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa; n++;
        }
      }
      const cur = a ? [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / n)] : [0, 0, 0, 0];
      const at = y * stride + 1 + x * 4;
      for (let c = 0; c < 4; c++) raw[at + c] = (cur[c] - prev[c]) & 255;
      prev = cur;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8; // bit depth
  head[9] = 6; // RGBA
  return Buffer.concat([PNG_SIG, pngChunk("IHDR", head), pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

const linear = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
/** Light ink (white, pale grey), dark ink (black, charcoal), or a colour. */
function inkTone(r: number, g: number, b: number): "light" | "dark" | null {
  const lum = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  if (lum > 0.7 && chroma < 0.2) return "light";
  if (lum < 0.07 && chroma < 0.3) return "dark";
  return null;
}
/** A mark mostly in light ink needs a dark tile; one mostly in dark ink, a light one. */
const surfaceFor = (light: number, dark: number): LogoSurface | null => (light >= 0.5 ? "dark" : dark >= 0.6 ? "light" : null);

function pixelSurface(px: Pixels): LogoSurface | null {
  const step = Math.max(1, Math.floor(Math.max(px.w, px.h) / 96));
  let total = 0, opaque = 0, ink = 0, light = 0, dark = 0;
  for (let y = 0; y < px.h; y += step) {
    for (let x = 0; x < px.w; x += step) {
      const [r, g, b, a] = px.at(x, y);
      total++;
      if (a >= 230) opaque++;
      if (a < 100) continue;
      const k = inkTone(r, g, b);
      ink += a;
      if (k === "light") light += a;
      else if (k === "dark") dark += a;
    }
  }
  const corners = [[0, 0], [px.w - 1, 0], [0, px.h - 1], [px.w - 1, px.h - 1]].every(([x, y]) => px.at(x, y)[3] >= 230);
  if (corners && opaque / total > 0.9) return "none"; // a picture with its own background
  return ink ? surfaceFor(light / ink, dark / ink) : null;
}

const NAMED: Record<string, [number, number, number]> = { white: [255, 255, 255], black: [0, 0, 0], currentcolor: [0, 0, 0], snow: [255, 250, 250], whitesmoke: [245, 245, 245] };
function parseColor(v: string): [number, number, number] | null {
  const s = v.trim().toLowerCase();
  if (s in NAMED) return NAMED[s];
  const hex = s.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex.slice(0, 3)].map((c) => c + c).join("") : hex;
    return full.length >= 6 ? [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)] : null;
  }
  const rgb = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** The same judgement for an SVG, from the colours it paints with. Shapes given no fill
 * at all are painted black. */
function svgSurface(svg: string): LogoSurface | null {
  let n = 0, light = 0, dark = 0, fills = 0;
  for (const m of svg.matchAll(/(?:^|[\s;"'{])(fill|stroke|stop-color)\s*(?:=\s*["']|:\s*)([^"';}>]+)/gi)) {
    if (m[1].toLowerCase() === "fill") fills++;
    const c = parseColor(m[2]);
    if (!c) continue;
    n++;
    const k = inkTone(...c);
    if (k === "light") light++;
    else if (k === "dark") dark++;
  }
  if (!fills) {
    n++;
    dark++;
  }
  return surfaceFor(light / n, dark / n);
}

/** An SVG made safe and small for an <img>: no prolog, comments, editor metadata or
 * editor attributes (which can hold the designer's file paths), a namespace and a
 * viewBox so it draws and scales. Null when it is not a drawable, self-contained SVG. */
function tidySvg(text: string): string | null {
  let s = text.replace(/^﻿/, "");
  if (!/<svg[\s>]/i.test(s)) return null;
  if (/<script|<foreignObject|<!ENTITY|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/)/i.test(s)) return null;
  s = s
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<sodipodi:namedview[\s\S]*?(?:\/>|<\/sodipodi:namedview>)/gi, "")
    .replace(/\s(?:inkscape|sodipodi):[\w-]+\s*=\s*"[^"]*"/g, "")
    .replace(/\sxmlns:(?:inkscape|sodipodi|dc|cc|rdf)\s*=\s*"[^"]*"/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const open = s.match(/<svg\b[^>]*>/i);
  if (!open) return null;
  let tag = open[0];
  if (!/\sxmlns\s*=/.test(tag)) tag = tag.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/\sviewBox\s*=/i.test(tag)) {
    const dim = (k: string) => Number(tag.match(new RegExp(`\\s${k}\\s*=\\s*["']\\s*([\\d.]+)(?:px)?\\s*["']`))?.[1]);
    const w = dim("width"), h = dim("height");
    if (w > 0 && h > 0) tag = tag.replace(/^<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }
  s = s.slice(0, open.index) + tag + s.slice(open.index! + open[0].length);
  return s.slice(s.search(/<svg\b/i));
}

/** The largest image inside an .ico, and its pixels when it is a PNG or a 32-bit bitmap. */
function icoImage(buf: Buffer): { size: number; px: Pixels | null } | null {
  if (buf.length < 22 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  let best = -1, size = 0;
  for (let i = 0; i < buf.readUInt16LE(4) && 22 + i * 16 <= buf.length; i++) {
    const s = buf[6 + i * 16] || 256;
    if (s > size) [best, size] = [i, s];
  }
  if (best < 0) return null;
  const len = buf.readUInt32LE(6 + best * 16 + 8);
  const at = buf.readUInt32LE(6 + best * 16 + 12);
  const img = buf.subarray(at, at + len);
  if (img.subarray(0, 8).equals(PNG_SIG)) return { size, px: decodePng(img) };
  if (img.length >= 40 && img.readUInt16LE(14) === 32) {
    const head = img.readUInt32LE(0);
    const w = img.readInt32LE(4);
    const h = Math.abs(img.readInt32LE(8)) / 2; // the height counts the AND mask too
    if (w > 0 && h > 0 && head + w * h * 4 <= img.length) {
      return { size, px: { w, h, at: (x, y) => { const o = head + ((h - 1 - y) * w + x) * 4; return [img[o + 2], img[o + 1], img[o], img[o + 3]]; } } };
    }
  }
  return { size, px: null };
}

interface Logo {
  uri: string;
  surface: LogoSurface | null;
}

// Icons that come with a project template rather than with the project: the Next.js
// favicon and Expo's starter icons, by their exact bytes, and the React atom of
// create-react-app by its colour. A project still wearing one has no logo of its own yet.
const TEMPLATE_ICONS = new Set([
  "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932", // create-next-app favicon.ico
  "74c64047eb557b1341bba7a2831eedde9ddb705e6451a9ad9f5552bf558f13de", // Expo assets/icon.png
  "5f4c0a732b6325bf4071d9124d2ae67e037cb24fcc9c482ef82bea742109a3b8", // Expo adaptive and splash icons
  "24272cdaeff82cc5facdaccd982a6f05b60c4504704bbf94c19a6388659880bb", // Expo assets/favicon.png
]);
const TEMPLATE = Symbol("template icon");
const reactAtom = (svg: string) => {
  const colours = new Set([...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase()));
  return colours.size > 0 && [...colours].every((c) => c === "#61dafb");
};
/** The same atom as pixels (create-react-app's logo192.png and favicon.ico). */
function reactAtomPixels(px: Pixels): boolean {
  const step = Math.max(1, Math.floor(Math.max(px.w, px.h) / 64));
  let ink = 0, cyan = 0;
  for (let y = 0; y < px.h; y += step) {
    for (let x = 0; x < px.w; x += step) {
      const [r, g, b, a] = px.at(x, y);
      if (a < 128) continue;
      ink++;
      if (Math.abs(r - 97) + Math.abs(g - 218) + Math.abs(b - 251) < 60) cyan++;
    }
  }
  return ink > 20 && cyan / ink > 0.85;
}

/** Reads one candidate. Null when it is too big, too small to draw crisply, a link, or
 * not the image its extension claims; TEMPLATE when it is a starter template's icon. */
function readLogo(file: string, ext: string): Logo | typeof TEMPLATE | null {
  const spec = LOGO_EXT[ext];
  let buf: Buffer;
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size === 0 || st.size > spec.max) return null;
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  if (TEMPLATE_ICONS.has(createHash("sha256").update(buf).digest("hex"))) return TEMPLATE;
  const uri = (data: Buffer) => `data:${spec.mime};base64,${data.toString("base64")}`;
  if (ext === "svg") {
    const svg = tidySvg(buf.toString("utf8"));
    if (svg && reactAtom(svg)) return TEMPLATE;
    return svg && svg.length <= spec.max ? { uri: uri(Buffer.from(svg, "utf8")), surface: svgSurface(svg) } : null;
  }
  if (ext === "png") {
    const px = decodePng(buf);
    if (!px || Math.min(px.w, px.h) < 32) return null;
    if (reactAtomPixels(px)) return TEMPLATE;
    // Stored at its own size when that is small, re-encoded smaller when that is lighter.
    const small = Math.max(px.w, px.h) > LOGO_PX ? encodePng(px) : buf;
    return { uri: `data:image/png;base64,${(small.length < buf.length ? small : buf).toString("base64")}`, surface: pixelSurface(px) };
  }
  if (ext === "jpg" || ext === "jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? { uri: uri(buf), surface: "none" } : null;
  if (ext === "webp") {
    if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return null;
    const chunk = buf.toString("latin1", 12, 16);
    // Lossy without an alpha chunk is opaque; anything else is left to a quiet tile.
    return { uri: uri(buf), surface: chunk === "VP8 " || (chunk === "VP8X" && !(buf[20] & 0x10)) ? "none" : null };
  }
  const ico = icoImage(buf);
  if (!ico || ico.size < 32) return null;
  if (!ico.px) return { uri: uri(buf), surface: null };
  if (reactAtomPixels(ico.px)) return TEMPLATE;
  // An .ico carries every size at once; its largest image alone, as a PNG, is lighter.
  const png = encodePng(ico.px);
  return { uri: png.length < buf.length ? `data:image/png;base64,${png.toString("base64")}` : uri(buf), surface: pixelSurface(ico.px) };
}

/** The best logo in a project folder, or null. */
function findLogo(dir: string, prefixes: Set<string>): Logo | null {
  const found: { file: string; ext: string; key: (number | string)[] }[] = [];
  const queue: [string, number][] = [[dir, 0]];
  while (queue.length) {
    const [d, depth] = queue.shift()!;
    for (const e of [...listing(d)].sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        const lower = e.name.toLowerCase();
        if (depth < LOGO_DEPTH && LOGO_DIRS.has(lower) && !SECRET_DIR.test(e.name) && (lower === ".github" || !pruned(d, e.name))) queue.push([path.join(d, e.name), depth + 1]);
        continue;
      }
      if (!e.isFile() || SECRET_NAME.some((re) => re.test(e.name))) continue;
      const m = e.name.match(LOGO_RE);
      if (!m) continue;
      const [, prefix, base, suffix, rawExt] = m;
      if (prefix && !prefixes.has(prefix.toLowerCase())) continue;
      const ext = rawExt.toLowerCase();
      const words = suffix.replace(/[-_.@]?\d+(?:x\d+)?x?/g, "");
      const variant = TONE_WORDS.test(suffix) ? 3 : words ? 2 : prefix ? 1 : 0;
      const size = Math.max(0, ...[...suffix.matchAll(/\d+/g)].map((n) => Number(n[0])));
      found.push({ file: path.join(d, e.name), ext, key: [LOGO_TIER[base.toLowerCase()], LOGO_EXT[ext].rank, depth, variant, -size, path.relative(dir, path.join(d, e.name))] });
    }
  }
  found.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) {
      const x = a.key[i], y = b.key[i];
      if (x !== y) return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    }
    return 0;
  });
  for (const c of found.slice(0, 8)) {
    const logo = readLogo(c.file, c.ext);
    // The best candidate came with a template: the project has not made a logo yet.
    if (logo === TEMPLATE) return null;
    if (logo) return logo;
  }
  return null;
}

/** One image worn by four or more projects whose names have nothing in common is a
 * template's default that slipped past TEMPLATE_ICONS, not anyone's logo; a family
 * sharing a mark (xo-swarm, xo-space, xo-pitch...) keeps it. Returns how many lost it. */
function dropSharedDefaults(pages: Page[]): number {
  const wearers = new Map<string, Page[]>();
  for (const p of pages) if (p.logo) wearers.set(p.logo, [...(wearers.get(p.logo) ?? []), p]);
  let dropped = 0;
  for (const group of wearers.values()) {
    if (group.length < 4) continue;
    const words = group.map((p) => new Set(p.name.toLowerCase().split(/[-_.\s]+/).filter((t) => t.length >= 2)));
    const kin = words.filter((w, i) => words.some((v, j) => j !== i && [...w].some((t) => v.has(t)))).length;
    if (kin / group.length >= 0.5) continue;
    for (const p of group) {
      delete p.logo;
      delete p.logoSurface;
      dropped++;
    }
  }
  return dropped;
}

// ---------------------------------------------------------------- crawl

interface Raw {
  page: Page;
  langCounts: Map<string, number>;
  docs: number; // document files in the subtree
  minBirth: number;
  maxMtime: number;
  childRaws: Raw[];
  ancestors: string[]; // folder names from root down to parent
}

/** Counts what lies below a folder at the depth limit without indexing it, so totals,
 * dates and languages stay true to the disk. Capped, so one huge tree cannot stall a run. */
function tally(dirs: string[]) {
  const t = { folders: 0, files: 0, bytes: 0, docs: 0, minBirth: Infinity, maxMtime: 0, langs: new Map<string, number>() };
  const stack = [...dirs];
  let budget = 200_000;
  while (stack.length && budget > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.some((e) => e.isFile() && e.name === "pyvenv.cfg")) continue;
    t.folders++;
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!pruned(dir, e.name)) stack.push(path.join(dir, e.name));
        continue;
      }
      if (!e.isFile() || e.name.startsWith(".")) continue;
      budget--;
      t.files++;
      try {
        const st = fs.statSync(path.join(dir, e.name));
        t.bytes += st.size;
        if (st.birthtimeMs > 0) t.minBirth = Math.min(t.minBirth, st.birthtimeMs);
        t.maxMtime = Math.max(t.maxMtime, st.mtimeMs);
      } catch {
        /* unreadable file */
      }
      const ext = extOf(e.name);
      if (DOC_EXT.has(ext)) t.docs++;
      const lang = LANG[ext];
      if (lang) t.langs.set(lang, (t.langs.get(lang) ?? 0) + 1);
    }
  }
  return t;
}

const raws: Raw[] = [];

function crawl(dir: string, rootLabel: string, rootPath: string, depth: number, ancestors: string[]): Raw | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  listings.set(dir, entries);
  const name = depth === 0 ? path.basename(dir) : path.basename(dir);
  const fileNames: string[] = [];
  const fileSet = new Set<string>();
  const subdirs: string[] = [];
  const hidden: string[] = [];
  let bytes = 0;
  let minBirth = Infinity;
  let maxMtime = 0;
  const langCounts = new Map<string, number>();
  let isVenv = false;

  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (pruned(dir, e.name)) {
        if (!e.name.startsWith(".") || e.name === ".git") hidden.push(e.name);
        if (e.name === ".git") fileSet.add(".git");
        continue;
      }
      subdirs.push(e.name);
    } else if (e.isFile()) {
      fileSet.add(e.name);
      if (e.name === "pyvenv.cfg") isVenv = true;
      if (e.name.startsWith(".")) continue;
      try {
        const st = fs.statSync(path.join(dir, e.name));
        bytes += st.size;
        if (st.birthtimeMs > 0) minBirth = Math.min(minBirth, st.birthtimeMs);
        maxMtime = Math.max(maxMtime, st.mtimeMs);
      } catch {
        /* unreadable file */
      }
      const ext = extOf(e.name);
      const lang = LANG[ext];
      if (lang) langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
      fileNames.push(e.name);
    }
  }
  if (isVenv && depth > 0) return null;
  // .git can also be a file (worktrees, submodules)
  const hasGit = fileSet.has(".git");

  // A secret-looking folder is listed by name only: no file names, nothing read.
  const secretDir = SECRET_DIR.test(name);
  const visibleFiles = secretDir ? [] : fileNames.filter((f) => !SECRET_NAME.some((re) => re.test(f)));
  visibleFiles.sort((a, b) => a.localeCompare(b));

  const readmeFile = secretDir ? null : (fileNames.find((f) => /^readme(\.(md|mdx|markdown|txt|rst))?$/i.test(f)) ?? null);
  const readmeRaw = readmeFile ? readText(path.join(dir, readmeFile)) : null;
  const readme = readmeRaw ? redactSecrets(readmeRaw.replace(/\r\n/g, "\n").trim()) || null : null;
  const agentFile = secretDir ? undefined : ["CLAUDE.md", "AGENTS.md"].find((f) => fileSet.has(f));
  const agentNotes = agentFile ? firstParagraph(readText(path.join(dir, agentFile), 20_000) ?? "") : null;
  const manifest = secretDir ? null : parseManifest(dir, fileSet);

  const markers: string[] = [];
  if (hasGit) markers.push("git");
  for (const f of ["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod", "pubspec.yaml", "Dockerfile", "docker-compose.yml", "CLAUDE.md", "AGENTS.md", "foundry.toml"]) {
    if (fileSet.has(f)) markers.push(f);
  }
  if (readmeFile) markers.push("README");
  for (const f of fileNames) {
    const m = f.match(/^(next|vite|astro|svelte|nuxt|tailwind|hardhat|remotion|vitest|playwright)\.config\./);
    if (m && !markers.includes(m[1])) markers.push(m[1]);
  }

  const frameworks = new Set<string>();
  if (manifest?.file === "package.json") {
    const all = new Set([...manifest.dependencies, ...manifest.devDependencies]);
    for (const [dep, fw] of FRAMEWORKS) if (all.has(dep)) frameworks.add(fw);
  } else if (manifest) {
    const blob = manifest.dependencies.join(" ");
    for (const [re, fw] of PY_FRAMEWORKS) if (re.test(blob)) frameworks.add(fw);
  }
  if (fileSet.has("pubspec.yaml")) frameworks.add("Flutter");
  if (fileSet.has("foundry.toml")) frameworks.add("Foundry");

  const relPath = path.relative(rootPath, dir);
  const page: Page = {
    slug: "",
    name,
    title: name,
    path: dir,
    relPath,
    root: rootLabel,
    depth,
    kind: "folder",
    isArticle: false,
    parent: null,
    partOf: null,
    children: [],
    hiddenChildren: hidden.sort(),
    files: visibleFiles.slice(0, 24),
    fileCount: fileNames.length,
    totalFiles: fileNames.length,
    bytes,
    totalBytes: bytes,
    created: null,
    modified: null,
    languages: [],
    markers,
    frameworks: [...frameworks],
    manifest,
    summary: null,
    readme,
    readmeFile,
    agentNotes,
    git: hasGit ? gitInfo(dir) : null,
    categories: [],
    related: [],
    words: readme ? markdownToText(readme).split(" ").length : 0,
  };

  const docs = fileNames.filter((f) => DOC_EXT.has(extOf(f))).length;
  const raw: Raw = { page, langCounts, docs, minBirth, maxMtime, childRaws: [], ancestors };
  raws.push(raw);
  // A repository is as old as its first commit and was touched at its last, and so are
  // the folders that hold it.
  if (page.git?.firstCommit) raw.minBirth = Math.min(raw.minBirth, Date.parse(page.git.firstCommit));
  if (page.git?.lastCommit) raw.maxMtime = Math.max(raw.maxMtime, Date.parse(page.git.lastCommit));

  subdirs.sort((a, b) => a.localeCompare(b));
  if (depth < maxDepth) {
    for (const sub of subdirs) {
      const child = crawl(path.join(dir, sub), rootLabel, rootPath, depth + 1, [...ancestors, name]);
      if (child) raw.childRaws.push(child);
    }
  } else if (subdirs.length) {
    // At the limit: not indexed, but counted, so this folder is never called empty.
    const t = tally(subdirs.map((sub) => path.join(dir, sub)));
    if (t.folders) {
      page.deeper = { names: subdirs, folders: t.folders, files: t.files };
      page.totalFiles += t.files;
      page.totalBytes += t.bytes;
      raw.docs += t.docs;
      raw.minBirth = Math.min(raw.minBirth, t.minBirth);
      raw.maxMtime = Math.max(raw.maxMtime, t.maxMtime);
      for (const [k, v] of t.langs) raw.langCounts.set(k, (raw.langCounts.get(k) ?? 0) + v);
    }
  }

  // Roll the subtree up into this folder.
  for (const c of raw.childRaws) {
    page.totalFiles += c.page.totalFiles;
    page.totalBytes += c.page.totalBytes;
    raw.docs += c.docs;
    raw.minBirth = Math.min(raw.minBirth, c.minBirth);
    raw.maxMtime = Math.max(raw.maxMtime, c.maxMtime);
    for (const [k, v] of c.langCounts) raw.langCounts.set(k, (raw.langCounts.get(k) ?? 0) + v);
  }
  page.docFiles = raw.docs;
  page.modified = iso(raw.maxMtime || null);
  // Files copied in keep an older mtime than their birth; the older one is the truth.
  page.created = iso(Number.isFinite(raw.minBirth) ? Math.min(raw.minBirth, raw.maxMtime || Infinity) : null);
  page.languages = [...raw.langCounts].map(([n, files]) => ({ name: n, files })).sort((a, b) => b.files - a.files).slice(0, 8);

  // Kind.
  const direct = fileNames.length;
  const share = (set: Set<string>) => (direct ? fileNames.filter((f) => set.has(extOf(f))).length / direct : 0);
  if (hasGit) page.kind = "repo";
  else if (manifest || markers.includes("pubspec.yaml") || (readme && page.words >= 25)) page.kind = "project";
  else if (direct >= 2 && share(DOC_EXT) >= 0.6) page.kind = "docs";
  else if ((direct >= 3 && share(MEDIA_EXT) >= 0.6) || (direct > 0 && !subdirs.length && share(MEDIA_EXT) === 1)) page.kind = "assets";
  else if (CODE_DIR_NAMES.has(name.toLowerCase()) || (direct > 0 && fileNames.filter((f) => LANG[extOf(f)] && !NON_CODE_LANGS.has(LANG[extOf(f)])).length / direct >= 0.5)) page.kind = "code";
  if (agentNotes && page.kind !== "repo") page.kind = "project";
  page.isArticle = depth === 0 || page.kind === "repo" || page.kind === "project" || (page.kind === "docs" && direct >= 4) || !!agentNotes;

  // The project's own logo. Not for a secret-looking folder, nor anything inside one.
  if (page.isArticle && (page.kind === "repo" || page.kind === "project") && !secretDir && !ancestors.some((a) => SECRET_DIR.test(a))) {
    const logo = findLogo(dir, logoPrefixes(name, manifest?.name ?? null));
    if (logo) {
      page.logo = logo.uri;
      if (logo.surface) page.logoSurface = logo.surface;
    }
  }

  // Agent notes describe the project only sometimes; orders to an agent are no summary.
  page.summary = (readme && firstParagraph(readme)) || manifest?.description || (agentNotes && !readsAsInstructions(agentNotes) ? agentNotes : null);
  return raw;
}

// ---------------------------------------------------------------- run

const roots: { label: string; path: string }[] = [];
for (const spec of rootSpecs) {
  const abs = path.resolve(expand(spec));
  if (!fs.existsSync(abs)) {
    console.warn(`skip missing root ${spec}`);
    continue;
  }
  roots.push({ label: label(abs), path: abs });
  crawl(abs, label(abs), abs, 0, []);
}

// Slugs. Unique folder names keep their bare name. Shared names get a Wikipedia-style
// qualifier from their ancestors, unless one folder is clearly the primary topic (a root,
// or the only article and shallower than every other namesake): it keeps the bare name
// and the others are listed at "<name>_(disambiguation)".
const byName = new Map<string, Raw[]>();
for (const r of raws) {
  const key = r.page.name.toLowerCase();
  byName.set(key, [...(byName.get(key) ?? []), r]);
}
const taken = new Set<string>();
const base = (s: string) => s.replace(/\s+/g, "_");
const disambiguation: SiteIndex["disambiguation"] = {};
const primaryOf = (group: Raw[]): Raw | null => {
  const root = group.find((r) => r.page.depth === 0);
  if (root) return root;
  // The shallowest article, when no other article sits at the same depth.
  const arts = group.filter((r) => r.page.isArticle).sort((a, b) => a.page.depth - b.page.depth);
  if (!arts.length || (arts[1] && arts[1].page.depth === arts[0].page.depth)) return null;
  const a = arts[0];
  return group.every((r) => r === a || r.page.depth > a.page.depth) ? a : null;
};
const primaries = new Map<Raw[], Raw | null>();
for (const group of byName.values()) {
  const primary = group.length === 1 ? group[0] : primaryOf(group);
  primaries.set(group, primary);
  if (primary) {
    primary.page.slug = base(primary.page.name);
    taken.add(primary.page.slug.toLowerCase());
  }
}
for (const group of byName.values()) {
  if (group.length === 1) continue;
  const primary = primaries.get(group) ?? null;
  for (const r of group) {
    if (r === primary) continue;
    const anc = [...r.ancestors].reverse();
    let slug = "";
    let qualifier = "";
    for (let n = 1; n <= anc.length; n++) {
      qualifier = anc.slice(0, n).join(", ");
      slug = `${base(r.page.name)}_(${base(qualifier)})`;
      if (!taken.has(slug.toLowerCase())) break;
    }
    if (!slug || taken.has(slug.toLowerCase())) {
      const stem = slug || base(r.page.name);
      let i = 2;
      while (taken.has(`${stem}_${i}`.toLowerCase())) i++;
      slug = `${stem}_${i}`;
    }
    taken.add(slug.toLowerCase());
    r.page.slug = slug;
    r.page.title = qualifier ? `${r.page.name} (${qualifier})` : r.page.name;
  }
  // Articles first, then shallow, then recent.
  const sorted = [...group].sort(
    (a, b) => Number(b.page.isArticle) - Number(a.page.isArticle) || a.page.depth - b.page.depth || (b.page.modified ?? "").localeCompare(a.page.modified ?? ""),
  );
  disambiguation[base(group[0].page.name)] = { primary: primary?.page.slug ?? null, slugs: sorted.map((r) => r.page.slug) };
}

// Parent / child links, and the nearest enclosing project.
for (const r of raws) {
  r.page.children = r.childRaws.map((c) => c.page.slug);
  for (const c of r.childRaws) c.page.parent = r.page.slug;
}
const rawByPath = new Map(raws.map((r) => [r.page.path, r]));
for (const r of raws) {
  let dir = path.dirname(r.page.path);
  while (rawByPath.has(dir)) {
    const anc = rawByPath.get(dir)!;
    if (anc.page.manifest && anc.page.depth > 0) {
      r.page.partOf = anc.page.slug;
      break;
    }
    dir = path.dirname(dir);
  }
}

// Categories (articles only).
const articleChildCount = new Map<Raw, number>();
for (const r of raws) articleChildCount.set(r, r.childRaws.filter((c) => c.page.isArticle).length);
const titleBySlug = new Map(raws.map((r) => [r.page.slug, r.page.title]));
const isCollection = (r: Raw) =>
  r.page.depth > 0 &&
  (articleChildCount.get(r) ?? 0) >= 3 &&
  !CODE_DIR_NAMES.has(r.page.name.toLowerCase()) &&
  !r.page.partOf &&
  (r.page.kind === "folder" || r.page.kind === "docs" || r.page.kind === "assets" || !r.page.manifest);
for (const r of raws) {
  const p = r.page;
  if (!p.isArticle) continue;
  const cats = new Set<string>();
  // Collections: any ancestor folder holding three or more articles.
  let dir = path.dirname(p.path);
  while (rawByPath.has(dir)) {
    const anc = rawByPath.get(dir)!;
    if (isCollection(anc)) cats.add(anc.page.name);
    dir = path.dirname(dir);
  }
  const code = p.languages.find((l) => !NON_CODE_LANGS.has(l.name));
  if (code && p.kind !== "docs") cats.add(`${code.name} projects`);
  for (const fw of p.frameworks) cats.add(fw);
  if (p.kind === "repo") cats.add("Git repositories");
  if (p.kind === "docs") cats.add("Document collections");
  const year = p.created?.slice(0, 4);
  if (year && p.kind !== "folder") cats.add(`Started in ${year}`);
  if (p.markers.includes("CLAUDE.md") || p.markers.includes("AGENTS.md")) cats.add("Agent-ready projects");
  if (!p.readme) cats.add("Articles lacking a README");
  if (p.partOf) cats.add(`Parts of ${titleBySlug.get(p.partOf) ?? p.partOf}`);
  p.categories = [...cats];
}

// See also: similarity over frameworks, dependencies, categories, name tokens and siblings.
const articles = raws.filter((r) => r.page.isArticle && r.page.depth > 0);
const features = new Map<Raw, Set<string>>();
for (const r of articles) {
  const f = new Set<string>();
  for (const fw of r.page.frameworks) f.add(`fw:${fw}`);
  for (const d of r.page.manifest?.dependencies.slice(0, 40) ?? []) f.add(`dep:${d}`);
  for (const c of r.page.categories) if (!c.startsWith("Started") && !c.startsWith("Articles lacking")) f.add(`cat:${c}`);
  for (const t of r.page.name.toLowerCase().split(/[-_\s.]+/)) if (t.length > 2) f.add(`tok:${t}`);
  features.set(r, f);
}
for (const a of articles) {
  const fa = features.get(a)!;
  const scored: { slug: string; score: number }[] = [];
  for (const b of articles) {
    if (a === b || a.page.path.startsWith(b.page.path + path.sep) || b.page.path.startsWith(a.page.path + path.sep)) continue;
    const fb = features.get(b)!;
    let inter = 0;
    for (const x of fa) if (fb.has(x)) inter += x.startsWith("tok:") ? 2 : x.startsWith("fw:") ? 1.5 : 1;
    if (!inter) continue;
    let score = inter / (fa.size + fb.size - inter + 1);
    if (path.dirname(a.page.path) === path.dirname(b.page.path)) score += 0.05;
    if (b.page.readme) score += 0.03;
    // Packages inside some other project are rarely what "see also" wants.
    if (b.page.partOf && b.page.partOf !== a.page.partOf && b.page.partOf !== a.page.slug) score *= 0.35;
    scored.push({ slug: b.page.slug, score });
  }
  a.page.related = scored.sort((x, y) => y.score - x.score).filter((s) => s.score > 0.12).slice(0, 8).map((s) => s.slug);
}

const pages = raws.map((r) => r.page);
const unbranded = dropSharedDefaults(pages);
const meta: IndexMeta = {
  generatedAt: now.toISOString(),
  roots,
  maxDepth,
  deeperCounted: true,
  counts: {
    pages: pages.length,
    articles: pages.filter((p) => p.isArticle).length,
    repos: pages.filter((p) => p.kind === "repo").length,
    stubs: pages.filter((p) => !p.isArticle).length,
    categories: new Set(pages.flatMap((p) => p.categories)).size,
  },
  durationMs: Date.now() - started,
};
const index = normalizeIndex({ meta, pages, disambiguation });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
// Write then rename, so the server never reads a half-written index.
const tmpFile = `${outFile}.${process.pid}.tmp`;
fs.writeFileSync(tmpFile, JSON.stringify(index));
fs.renameSync(tmpFile, outFile);
const projects = index.pages.filter((p) => p.isArticle && (p.kind === "repo" || p.kind === "project"));
console.log(
  `indexed ${meta.counts.pages} folders (${meta.counts.articles} articles, ${meta.counts.repos} repos, ${meta.counts.categories} categories) from ${roots.map((r) => r.label).join(", ")} in ${meta.durationMs} ms` +
    `\n  logos: ${projects.filter((p) => p.logo).length} of ${projects.length} repositories and projects` +
    (unbranded ? ` (${unbranded} more wore a shared template icon, left out)` : ""),
);
