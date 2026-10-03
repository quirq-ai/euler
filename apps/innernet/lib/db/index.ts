import "server-only";

import { DEMO } from "../mode";
import { errorText, sayOnce } from "./log";
import { openNeon } from "./neon";
import { dbDirLabel, openPglite, resolveDbDir } from "./pglite";
import { bootstrap } from "./schema";
import type { Db, DbState } from "./types";

export type { Db, DbKind, DbState, DbStateName, LockHolder, Row, Statement } from "./types";

// Innernet's database, one per process, whichever it is:
//
//   local  PGlite in a folder on this machine (lib/db/pglite.ts). Nothing leaves it.
//   demo   Neon through DATABASE_URL (lib/db/neon.ts). The server reads the demo index
//          from it (written only by `pnpm db:store --demo`) and keeps the visitors'
//          history in it for 30 days (lib/db/demo-history.ts).
//
// getDb() resolves to the database, or to null when there is none to use: turned off,
// building, held by another process, or failing. Null is ordinary. Every caller falls
// back on the files, which stay the source of truth: data/index.json (or the demo's
// bundled data/demo/index.json) and the history folders.
//
// The instance lives on globalThis, so a hot reload in development reuses it rather than
// opening the folder a second time. A failure is retried a minute later at the soonest,
// and said once.

const RETRY_MS = 60_000;

interface Slot {
  db: Db | null;
  opening: Promise<Db | null> | null;
  failedAt: number;
  state: DbState;
  owner: string;
}

const IDLE: DbState = { state: "idle", kind: null, label: "", note: "The database has not been asked for yet." };

const G = globalThis as typeof globalThis & { __innernetDb?: Slot };
const slot = (G.__innernetDb ??= {
  db: null,
  opening: null,
  failedAt: 0,
  state: IDLE,
  owner: process.env.NODE_ENV === "production" ? "next start" : "next dev",
});

/** Why this process has no database at all, or null when it may have one. */
function unavailable(): DbState | null {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { state: "building", kind: null, label: "files only", note: "Pages are built from the files; the database is not used while building." };
  }
  if (DEMO) {
    return process.env.DATABASE_URL
      ? null
      : { state: "off", kind: null, label: "data/demo/index.json", note: "No DATABASE_URL is set, so the demo serves the index it was built with." };
  }
  if (process.env.INNERNET_DB?.trim().toLowerCase() === "off") {
    return { state: "off", kind: null, label: "files only", note: "INNERNET_DB=off: Innernet reads and writes its files alone." };
  }
  return null;
}

/** Whether this process may use a database: not off, not building, and on the demo, given one. */
export const dbEnabled = (): boolean => unavailable() === null;

/** Whether the demo keeps its visitors' history on the server (it has a database), as well
 * as in their browsers. Settled by DATABASE_URL alone, so a page says the same at build
 * time and at run time. Always false on this machine, whose history never leaves it. */
export const demoKeepsHistory = (): boolean => DEMO && !!process.env.DATABASE_URL;

/** Where this process stands with its database, right now. Never opens it. */
export function dbState(): DbState {
  return unavailable() ?? slot.state;
}

/** Name the process in the lock ("pnpm db:store"), before the first getDb(). */
export function setDbOwner(by: string): void {
  slot.owner = by;
}

/** The database, ready to query with its tables made, or null (see above). Never throws. */
export function getDb(): Promise<Db | null> {
  if (unavailable()) return Promise.resolve(null);
  if (slot.db) return Promise.resolve(slot.db);
  if (slot.opening) return slot.opening;
  if (slot.failedAt && Date.now() - slot.failedAt < RETRY_MS) return Promise.resolve(null);
  slot.opening = open().finally(() => {
    slot.opening = null;
  });
  return slot.opening;
}

async function open(): Promise<Db | null> {
  const kind = DEMO ? "neon" : "pglite";
  const dir = DEMO ? "" : resolveDbDir();
  const label = DEMO ? "Neon Postgres" : dbDirLabel(dir);
  slot.state = { state: "opening", kind, label, note: `Opening the database in ${label}.` };
  let db: Db | null = null;
  try {
    if (DEMO) db = await openNeon();
    else {
      const opened = await openPglite(dir, slot.owner);
      if (!opened.ok) {
        slot.failedAt = Date.now();
        const who = opened.holder ? `${opened.holder.by} (pid ${opened.holder.pid})` : "another process";
        slot.state = {
          state: "locked",
          kind,
          label,
          holder: opened.holder ?? undefined,
          note: `The database in ${label} is open in ${who}, so this process runs on files alone.`,
        };
        sayOnce("locked", slot.state.note);
        return null;
      }
      db = opened.db;
    }
    await bootstrap(db);
    slot.db = db;
    slot.failedAt = 0;
    slot.state = {
      state: "ready",
      kind,
      label,
      note: DEMO ? "The demo reads its index from Neon whenever Neon holds a newer one." : `Innernet keeps a copy of its data in ${label}, on this machine.`,
    };
    return db;
  } catch (err) {
    slot.failedAt = Date.now();
    await db?.close().catch(() => undefined);
    slot.state = { state: "failed", kind, label, note: `The database in ${label} would not open (${errorText(err)}), so this process runs on files alone.` };
    sayOnce(`failed:${slot.state.note}`, slot.state.note);
    return null;
  }
}

/** Close the database and let go of it (the CLI does, before it exits). */
export async function closeDb(): Promise<void> {
  const db = slot.db;
  slot.db = null;
  slot.state = IDLE;
  await db?.close();
}
