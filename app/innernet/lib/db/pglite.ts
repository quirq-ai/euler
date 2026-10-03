import "server-only";

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { Db, LockHolder, Row } from "./types";

// This machine's database: PGlite, a whole Postgres compiled to WebAssembly, running
// inside the Innernet process on a folder of plain files. Nothing listens on a port and
// nothing leaves the machine.
//
//   ~/.innernet/db/          INNERNET_DB_DIR overrides it, INNERNET_DB=off turns it off
//     pgdata/                the Postgres cluster PGlite keeps
//     owner.lock             {"pid":…,"by":"next dev","since":…} while a process has it open
//
// One process at a time: two PGlites on one folder would corrupt it. So a process takes
// owner.lock before it opens the folder and lets go when it closes or exits. A lock
// whose process has died is stale and is taken over, and so is one whose pid now
// belongs to a process that started after the lock was written (a crashed server's pid,
// reused); one held by a live process is respected, and the newcomer runs on files
// alone. The folder is made 700 and the lock 600, like the history beside it. With no
// Innernet running, deleting owner.lock is always safe.
//
// PGlite is imported only here, only when this function runs, and never in the demo:
// next.config.ts keeps it out of the demo's server functions.

const HOME = os.homedir();
const LOCK = "owner.lock";
const DATA = "pgdata";

export function resolveDbDir(raw = process.env.INNERNET_DB_DIR): string {
  const dir = raw?.trim() || "~/.innernet/db";
  return path.resolve(dir.replace(/^~(?=$|[\\/])/, HOME));
}

/** The folder as a person writes it: ~ for the home folder. */
export const dbDirLabel = (dir: string) => (dir === HOME ? "~" : dir.startsWith(HOME + path.sep) ? `~${dir.slice(HOME.length)}` : dir);

function alive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** When a process started (ms, to the second), or null when that cannot be told. */
function startedAt(pid: number): number | null {
  try {
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    const t = Date.parse(out);
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/** A lock is held while its process lives, and only if that process could have written
 * it: taken since this machine started (after a restart an old pid may belong to
 * something else entirely), by a process already running when it was taken. */
function live(holder: LockHolder): boolean {
  const since = Date.parse(holder.since);
  const booted = Date.now() - os.uptime() * 1000;
  if (!alive(holder.pid) || since < booted - 60_000) return false;
  if (holder.pid === process.pid) return true;
  // ps tells the start to the second, rounded down: a second's grace.
  const started = startedAt(holder.pid);
  return started === null || !Number.isFinite(since) || started <= since + 1000;
}

function readLockFile(file: string): LockHolder | null {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<LockHolder>;
    return typeof v.pid === "number" ? { pid: v.pid, by: String(v.by ?? "another process"), since: String(v.since ?? "") } : null;
  } catch {
    return null;
  }
}

/** Who has the folder open right now, if anyone alive does. */
export function lockHolder(dir: string): LockHolder | null {
  const holder = readLockFile(path.join(dir, LOCK));
  return holder && live(holder) ? holder : null;
}

/** Make the folder (700) if it is not there, and make sure it is a real folder. */
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = fs.lstatSync(dir);
  if (!st.isDirectory()) throw new Error(`${dbDirLabel(dir)} is not a folder`);
  if (st.mode & 0o077) {
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      /* not ours to change; it still works */
    }
  }
}

type Taken = { ok: true; release: () => void } | { ok: false; holder: LockHolder | null };

/**
 * Take owner.lock for this process. The lock is written whole to a temporary file and
 * linked into place, which fails if a lock is already there, so nobody ever reads a half
 * written one. A stale lock is moved aside before it is replaced, and put back if what
 * was moved turns out to belong to someone alive.
 */
function takeLock(dir: string, by: string): Taken {
  const file = path.join(dir, LOCK);
  const tmp = path.join(dir, `${LOCK}.${process.pid}.tmp`);
  const mine: LockHolder = { pid: process.pid, by, since: new Date().toISOString() };
  fs.writeFileSync(tmp, JSON.stringify(mine), { mode: 0o600 });
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.linkSync(tmp, file);
        const release = () => {
          if (readLockFile(file)?.pid === process.pid) fs.rmSync(file, { force: true });
        };
        return { ok: true, release };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
      const holder = readLockFile(file);
      // Our own pid: this process opened it already (lib/db keeps one instance), so no second.
      if (holder && (holder.pid === process.pid || live(holder))) return { ok: false, holder };
      if (!holder) {
        // Unreadable: give a lock being written a moment before calling it stale.
        try {
          if (Date.now() - fs.statSync(file).mtimeMs < 10_000) return { ok: false, holder: null };
        } catch {
          continue;
        }
      }
      const aside = path.join(dir, `${LOCK}.${process.pid}.stale`);
      try {
        fs.renameSync(file, aside);
      } catch {
        continue; // someone else moved it first; look again
      }
      const moved = readLockFile(aside);
      if (moved && moved.pid !== holder?.pid && live(moved)) {
        try {
          fs.linkSync(aside, file);
        } catch {
          /* a third process holds it now */
        }
        fs.rmSync(aside, { force: true });
        return { ok: false, holder: moved };
      }
      fs.rmSync(aside, { force: true });
    }
    return { ok: false, holder: readLockFile(file) };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export type Opened = { ok: true; db: Db } | { ok: false; holder: LockHolder | null };

/** Open PGlite on the folder, as `by` ("next dev", "pnpm db:store"). */
export async function openPglite(dir: string, by: string): Promise<Opened> {
  ensureDir(dir);
  const lock = takeLock(dir, by);
  if (!lock.ok) return lock;
  const onExit = () => lock.release();
  process.once("exit", onExit);
  let pg: PGlite;
  try {
    const { PGlite } = await import("@electric-sql/pglite");
    const data = path.join(dir, DATA);
    fs.mkdirSync(data, { mode: 0o700, recursive: true });
    // Single-user Postgres has no checkpointer, so its write-ahead log is recycled only
    // when it outgrows max_wal_size, 1 GB by default: a small folder would grow to that.
    // A 64 MB ceiling keeps the log to a few files.
    pg = await PGlite.create(data, { startParams: [...PGlite.defaultStartParams, "-c", "max_wal_size=64MB", "-c", "min_wal_size=32MB"] });
  } catch (err) {
    process.removeListener("exit", onExit);
    lock.release();
    throw err;
  }

  let closed = false;
  const db: Db = {
    kind: "pglite",
    label: dbDirLabel(dir),
    async query<T extends Row = Row>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    async batch(statements) {
      return pg.transaction(async (tx) => {
        const out: Row[][] = [];
        for (const s of statements) out.push((await tx.query<Row>(s.text, s.params ?? [])).rows);
        return out;
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await pg.close();
      } finally {
        process.removeListener("exit", onExit);
        lock.release();
      }
    },
  };
  return { ok: true, db };
}

/** Bytes on disk under the folder, links not followed. */
export function folderBytes(dir: string): number {
  let total = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        try {
          total += fs.statSync(p).size;
        } catch {
          /* gone */
        }
      }
    }
  };
  walk(dir);
  return total;
}
