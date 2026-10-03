import { PROJECT_ROOT } from "@/lib/project-root";
import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vscodeHref } from "@/lib/links";
import { DEMO, repoFileUrl } from "@/lib/mode";

// Innernet's own files, read at request time so the guide quotes the code as it is
// today: excerpts, line numbers for the small print, line counts for the file map.
// Only files inside this project are read, never anything from the index. The paths
// are hidden from the bundler's tracer, which would otherwise ship the whole project
// with the server; next.config.ts names the files a deployment needs.

const ROOT = PROJECT_ROOT;

const cache = new Map<string, { mtime: number; lines: string[] }>();

/** The file's lines, or null when it is missing. Re-read when it changes. */
export function sourceLines(file: string): string[] | null {
  const abs = path.join(/*turbopackIgnore: true*/ ROOT, file);
  if (!abs.startsWith(ROOT + path.sep)) return null;
  try {
    const mtime = fs.statSync(abs).mtimeMs;
    const hit = cache.get(file);
    if (hit && hit.mtime === mtime) return hit.lines;
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    cache.set(file, { mtime, lines });
    return lines;
  } catch {
    return null;
  }
}

/** 1-based line of the first line containing `needle`, or null. */
export function lineOf(file: string, needle: string, after = 0): number | null {
  const lines = sourceLines(file);
  if (!lines) return null;
  const i = lines.findIndex((l, n) => n >= after && l.includes(needle));
  return i >= 0 ? i + 1 : null;
}

/** "scripts/build-index.ts:446", or the bare path when the line has moved away. */
export function cite(file: string, needle: string): string {
  const n = lineOf(file, needle);
  return n ? `${file}:${n}` : file;
}

export function lineCount(file: string): number | null {
  const lines = sourceLines(file);
  if (!lines) return null;
  return lines.length - (lines[lines.length - 1] === "" ? 1 : 0);
}

export function exists(file: string): boolean {
  try {
    return fs.statSync(path.join(/*turbopackIgnore: true*/ ROOT, file)).isFile();
  } catch {
    return false;
  }
}

export function fileSize(file: string): number | null {
  try {
    return fs.statSync(path.join(/*turbopackIgnore: true*/ ROOT, file)).size;
  } catch {
    return null;
  }
}

export function readText(file: string): string | null {
  const lines = sourceLines(file);
  return lines ? lines.join("\n") : null;
}

/** This project's folder as the reader would type it: "~/Programming/...". In the demo,
 * the folder `git clone` makes, since the server's own folder is nobody's business. */
export function projectDir(): string {
  if (DEMO) return "innernet";
  const home = os.homedir();
  return ROOT.startsWith(home) ? "~" + ROOT.slice(home.length) : ROOT;
}

/** TypeScript files under a folder of this project, counted recursively. */
export function fileCount(dir: string): number {
  const abs = path.join(/*turbopackIgnore: true*/ ROOT, dir);
  if (!abs.startsWith(ROOT + path.sep)) return 0;
  let n = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (/\.(ts|tsx)$/.test(e.name)) n++;
    }
  };
  walk(abs);
  return n;
}

/** Absolute path of a project file, for "Open in VS Code" links. */
export function absPath(file: string): string {
  return path.join(/*turbopackIgnore: true*/ ROOT, file);
}

/** Where a link to one of this project's files goes: VS Code on this machine, the file
 * on GitHub in the demo. */
export function fileHref(file: string, dir = false): string {
  return DEMO ? repoFileUrl(file, dir) : vscodeHref(absPath(file));
}
