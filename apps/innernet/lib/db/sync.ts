import { PROJECT_ROOT } from "../project-root";
import "server-only";

import fs from "node:fs";
import path from "node:path";
import { after } from "next/server";
import { demoIndexProblems } from "../demo-check";
import { DEMO } from "../mode";
import type { SiteIndex } from "../types";
import { dbEnabled, getDb } from "./index";
import { loadIndex, storedIndexInfo, storeIndex } from "./index-store";
import { errorText, say, sayOnce } from "./log";

// How the server keeps the index and the database in step, without ever making a page
// wait for the database. getIndex() (lib/data.ts) stays synchronous and asks this
// module, which answers at once from memory and does its database work in the
// background.
//
//   local  Whenever data/index.json is loaded anew, it is stored in the database if
//          that holds a different one (by generatedAt). When the database cannot take it
//          just then (another process has it open, or it failed a moment ago), the store
//          waits and is tried again a minute later, until it lands or a newer index
//          replaces it. Should the file go missing, the
//          index the database holds is served instead: the one just stored, or, in a
//          fresh process, the one read back (instrumentation.ts waits for that read
//          before the first request).
//   demo   The server never writes the index (only visitors' history, elsewhere: see
//          lib/db/demo-history.ts). On first use, then at most every five minutes, it
//          reads Neon's index meta, and if Neon holds a demo index newer than the
//          bundled data/demo/index.json, it reads that index, checks it is fit for the
//          public (lib/demo-check.ts), and serves it from then on. Until then, and
//          whenever Neon fails or is not set, the bundled file serves.
//
// State lives on globalThis: instrumentation and the pages are separate bundles in one
// process, and a hot reload must not forget what was stored.

const DEMO_EVERY_MS = 5 * 60_000;
const LOCAL_RETRY_MS = 30_000;
/** A store the database could not take, tried again after this (getDb() waits a minute after a failure). */
const STORE_RETRY_MS = 61_000;

/** An index held in memory, as the database has it. `version` never equals a file's mtime. */
export interface HeldIndex {
  index: SiteIndex;
  version: number;
  generatedAt: string;
}

interface SyncState {
  serial: number;
  // local
  pending: HeldIndex | null;
  storing: boolean;
  retry: ReturnType<typeof setTimeout> | null;
  held: HeldIndex | null; // the index the local database is known to hold
  loadTriedAt: number;
  loading: Promise<void> | null;
  // demo
  remote: HeldIndex | null; // a newer demo index read from Neon
  checkedAt: number;
  checking: Promise<void> | null;
  seen: { generatedAt: string; storedAt: number; demo: boolean } | null; // Neon's meta at the last check
}

const G = globalThis as typeof globalThis & { __innernetSync?: SyncState };
const S = (G.__innernetSync ??= {
  serial: 0,
  pending: null,
  storing: false,
  retry: null,
  held: null,
  loadTriedAt: 0,
  loading: null,
  remote: null,
  checkedAt: 0,
  checking: null,
  seen: null,
});

/** A version for an index read from the database: below -1 (missing), so never an mtime. */
const nextVersion = () => -2 - S.serial++;

const time = (iso: string | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? -Infinity : t;
};

/** Keep a serverless function alive until background work is done, where Next can. */
function keepAlive(work: Promise<unknown>): void {
  try {
    after(work);
  } catch {
    /* outside a request (instrumentation, the CLI): nothing to extend */
  }
}

// ---------------------------------------------------------------- local

/** data/index.json was loaded anew: store it in the background if the database differs. */
export function rememberLocalIndex(index: SiteIndex, version: number): void {
  if (DEMO || !dbEnabled()) return;
  S.pending = { index, version, generatedAt: index.meta.generatedAt };
  if (!S.storing) void drain();
}

async function drain(): Promise<void> {
  S.storing = true;
  try {
    while (S.pending) {
      const job = S.pending;
      S.pending = null;
      const db = await getDb();
      if (!db) {
        storeLater(job);
        return;
      }
      try {
        const stored = await storedIndexInfo(db);
        if (stored?.meta.generatedAt !== job.generatedAt || stored.meta.demo) {
          const t = Date.now();
          const r = await storeIndex(db, job.index);
          say(`stored the index in ${db.label}: ${job.index.pages.length} pages, ${r.written} written, ${r.deleted} removed, ${Date.now() - t} ms`);
        }
        S.held = job;
      } catch (err) {
        sayOnce("store", `could not store the index in ${db.label} (${errorText(err)}); data/index.json still serves, and the store is tried again in a minute`);
        storeLater(job);
        return;
      }
    }
  } finally {
    S.storing = false;
  }
}

/** Keep a store the database could not take, and try it again later, unless a newer index has come in meanwhile. */
function storeLater(job: HeldIndex): void {
  S.pending ??= job;
  if (S.retry) return;
  S.retry = setTimeout(() => {
    S.retry = null;
    if (S.pending && !S.storing) void drain();
  }, STORE_RETRY_MS);
  S.retry.unref?.();
}

/**
 * The index the local database holds, when known, for when data/index.json is missing.
 * Not known yet: asks for it in the background (at most every 30 seconds) and returns null.
 */
export function heldLocalIndex(): HeldIndex | null {
  if (DEMO || !dbEnabled()) return null;
  if (S.held) return S.held;
  if (!S.loading && Date.now() - S.loadTriedAt >= LOCAL_RETRY_MS) {
    S.loadTriedAt = Date.now();
    S.loading = loadHeld().finally(() => {
      S.loading = null;
    });
  }
  return null;
}

async function loadHeld(): Promise<void> {
  const db = await getDb();
  if (!db || S.held) return;
  try {
    const index = await loadIndex(db);
    if (!index || index.meta.demo || S.held) return;
    S.held = { index, version: nextVersion(), generatedAt: index.meta.generatedAt };
    say(`data/index.json is missing, so the index stored in ${db.label} serves (generated ${index.meta.generatedAt}, ${index.pages.length} pages)`);
  } catch (err) {
    sayOnce("load", `could not read the index stored in ${db.label} (${errorText(err)})`);
  }
}

/**
 * Called once as the server starts (instrumentation.ts). Opens the database early, and
 * when data/index.json is missing, waits (up to 15 seconds) for the stored index, so the
 * very first page already has it.
 */
export async function warmDb(): Promise<void> {
  if (DEMO || !dbEnabled()) return;
  // Named in full, as lib/data.ts names it: a path built from a variable would make the
  // build trace the whole project into every server function.
  if (fs.existsSync(path.join(PROJECT_ROOT, "data", "index.json"))) {
    void getDb();
    return;
  }
  S.loadTriedAt = Date.now();
  S.loading ??= loadHeld().finally(() => {
    S.loading = null;
  });
  await Promise.race([S.loading, new Promise((r) => setTimeout(r, 15_000).unref())]);
}

// ---------------------------------------------------------------- demo

/**
 * A demo index from Neon newer than the bundled one (generated at `bundledAt`), or null.
 * Checks Neon in the background on first use and then at most every five minutes.
 */
export function remoteDemoIndex(bundledAt: string): HeldIndex | null {
  if (!DEMO || !dbEnabled()) return null;
  if (!S.checking && Date.now() - S.checkedAt >= DEMO_EVERY_MS) {
    S.checkedAt = Date.now();
    S.checking = revalidate(bundledAt).finally(() => {
      S.checking = null;
    });
    keepAlive(S.checking);
  }
  return S.remote && time(S.remote.generatedAt) > time(bundledAt) ? S.remote : null;
}

async function revalidate(bundledAt: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const stored = await storedIndexInfo(db);
    S.seen = stored ? { generatedAt: stored.meta.generatedAt, storedAt: stored.storedAt, demo: !!stored.meta.demo } : null;
    if (!stored?.meta.demo || time(stored.meta.generatedAt) <= time(bundledAt)) {
      if (S.remote) say("Neon no longer holds a newer demo index, so the bundled one serves again");
      S.remote = null;
      return;
    }
    if (S.remote?.generatedAt === stored.meta.generatedAt) return;
    const index = await loadIndex(db);
    if (!index) return;
    const problems = demoIndexProblems(index);
    if (problems.length) {
      sayOnce(`refused:${index.meta.generatedAt}`, `refused the demo index in Neon (${problems.length} problems, first: ${problems[0]}); serving ${S.remote ? "the last one read" : "the bundled one"}`);
      return;
    }
    S.remote = { index, version: nextVersion(), generatedAt: index.meta.generatedAt };
    say(`serving the demo index from Neon (generated ${index.meta.generatedAt}, ${index.pages.length} pages; bundled ${bundledAt || "none"})`);
  } catch (err) {
    sayOnce("demo", `could not read the demo index from Neon (${errorText(err)}); serving ${S.remote ? "the last one read" : "the bundled one"}`);
  }
}

// ---------------------------------------------------------------- for dbStatus

export interface SyncSnapshot {
  /** Local: generatedAt of the index the database is known to hold. Demo: Neon's, at the last check. */
  heldAt: string | null;
  /** Demo: when Neon was last asked (ms), whether its index serves now, and when it was stored. */
  checkedAt: number | null;
  remoteServing: boolean;
  remoteStoredAt: number | null;
}

export function syncSnapshot(): SyncSnapshot {
  return DEMO
    ? { heldAt: S.seen?.generatedAt ?? null, checkedAt: S.checkedAt || null, remoteServing: !!S.remote, remoteStoredAt: S.seen?.storedAt ?? null }
    : { heldAt: S.held?.generatedAt ?? null, checkedAt: null, remoteServing: false, remoteStoredAt: null };
}
