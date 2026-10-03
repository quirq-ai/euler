import "server-only";

import { getIndex } from "../data";
import { DEMO, INDEX_PATH } from "../mode";
import { activityCounts, type ActivityCounts } from "./activity";
import { RETENTION_DAYS } from "./demo-history";
import { dbState, getDb } from "./index";
import { storedIndexInfo, storedPageCount } from "./index-store";
import { errorText } from "./log";
import { folderBytes, resolveDbDir } from "./pglite";
import { syncSnapshot } from "./sync";
import type { DbKind, DbStateName, LockHolder } from "./types";

// What the database holds and where, in one call, for the history page (/activity) and
// anything else that wants to say so. Never throws and never waits on the network: on
// this machine it asks PGlite, which is in the process; on the demo it reports what the
// last background check of Neon saw, so rendering a page never queries Neon. (The demo's
// visitor history is read by the visitor's own browser, through /api/activity.)

export interface DbStatus {
  mode: "local" | "demo";
  kind: DbKind | null; // null: no database in use
  state: DbStateName;
  /** Where the data lives, for people: "~/.innernet/db", "Neon Postgres" or the file the site reads. */
  label: string;
  /** One plain sentence about it. Never holds a secret. */
  note: string;
  /** Who else has this machine's database open, when that is why this process has none. */
  holder: LockHolder | null;
  /** Where the index on screen came from: its file, the database, or nowhere yet. */
  serving: "file" | "database" | "none";
  /** The index the database holds, if any. Times are ISO. */
  index: { generatedAt: string; storedAt: string | null; pages: number | null } | null;
  /** The history lines the database holds (local only). Times are ISO. `kept`: sessions held
   * for `pnpm db:load` because the history folder they were in was lost or replaced. */
  activity: { lines: number; sessions: number; apps: number; first: string | null; last: string | null; kept: number } | null;
  /** The database's folder on disk, in bytes (local only). */
  bytes: number | null;
  /** Demo: when Neon was last asked (ISO), null before the first check. */
  checkedAt: string | null;
}

const iso = (ms: number | null | undefined) => (ms == null || !Number.isFinite(ms) ? null : new Date(ms).toISOString());
const isoCounts = (c: ActivityCounts, kept: number) => ({ lines: c.lines, sessions: c.sessions, apps: c.apps, first: iso(c.first), last: iso(c.last), kept });

export async function dbStatus(): Promise<DbStatus> {
  const loaded = getIndex();
  const serving = loaded.source;
  const snap = syncSnapshot();

  if (DEMO) {
    const st = dbState();
    const off = st.state === "off";
    return {
      mode: "demo",
      kind: off ? null : "neon",
      state: st.state,
      label: off ? INDEX_PATH : "Neon Postgres",
      note: off
        ? st.note
        : snap.remoteServing
          ? `Serving a newer demo index from Neon, which also keeps the pages and searches visitors open for ${RETENTION_DAYS} days, anonymously.`
          : `The demo checks Neon every few minutes for a newer index, and serves the bundled one until it finds one. Neon also keeps the pages and searches visitors open for ${RETENTION_DAYS} days, anonymously.`,
      holder: null,
      serving,
      index: snap.heldAt ? { generatedAt: snap.heldAt, storedAt: iso(snap.remoteStoredAt), pages: null } : null,
      activity: null,
      bytes: null,
      checkedAt: iso(snap.checkedAt),
    };
  }

  const db = await getDb();
  const st = dbState();
  const base: DbStatus = {
    mode: "local",
    kind: st.kind ?? (st.state === "off" ? null : "pglite"),
    state: st.state,
    label: st.label || "files only",
    note: st.note,
    holder: st.holder ?? null,
    serving,
    index: null,
    activity: null,
    bytes: st.state === "off" || st.state === "building" ? null : folderBytes(resolveDbDir()),
    checkedAt: null,
  };
  if (!db) return base;
  try {
    const [info, pages, counts, kept] = await Promise.all([
      storedIndexInfo(db),
      storedPageCount(db),
      activityCounts(db),
      db.query<{ n: number }>("SELECT CASE WHEN jsonb_typeof(value) = 'array' THEN jsonb_array_length(value) ELSE 0 END AS n FROM kv WHERE key = 'history.kept'"),
    ]);
    return {
      ...base,
      index: info ? { generatedAt: info.meta.generatedAt, storedAt: iso(info.storedAt), pages } : null,
      activity: isoCounts(counts, Number(kept[0]?.n ?? 0)),
    };
  } catch (err) {
    return { ...base, state: "failed", note: `The database in ${db.label} did not answer (${errorText(err)}).` };
  }
}
