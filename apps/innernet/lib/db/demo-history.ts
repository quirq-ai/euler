import "server-only";

import { createHash } from "node:crypto";
import { APP, DEMO_MAX_IDS, DEMO_RETENTION_DAYS, DEMO_SESSION_RE, validEvent, type ActivityEvent } from "@/components/activity/shared";
import { DEMO } from "../mode";
import { activityUid } from "./activity";
import { jsonParam } from "./schema";
import type { Db } from "./types";

// The public demo's visitor history, in its Neon database (the activity table, as on a
// local Innernet, with Innernet as the only app). It exists so a visitor's /activity
// page can show the pages they opened, and nothing else may read it.
//
//   what   per event: the kind (visit, search, back, forward), the page's path on the
//          demo (no query but the search's own), its title or the search words, how
//          the visitor moved (the header's buttons or the browser's), and the server's
//          time. Kept once, as JSON in `data`. Never an IP address, user agent, cookie
//          or any other header.
//   whose  each row carries a hash of the session id the visitor's tab made, never the
//          id itself. The id holds the time the tab opened, by the visitor's clock, and
//          12 random characters, so the hash cannot be turned back into the id or the
//          time, and the database alone cannot be used to read or clear anyone's history.
//   who    only someone holding a session's id, which lives in that visitor's own
//          browser, can read it or delete it, and it travels in a request's body, never
//          in an address a log would keep. Nothing lists sessions.
//   how    at most SESSION_CAP events per session, and DAILY_CAP stored across the demo
//   much   in a UTC day, counted by a row in kv that each insert claims in the same
//          statement (so deleting a session gives nothing back, and racing requests
//          cannot pass it); no insert at all once the table reaches MAX_BYTES. A read
//          returns at most READ_ROWS events, the newest SESSION_CAP of each session, and
//          the whole demo reads at most READ_DAILY_CAP a day: bounds on what one script
//          can cost the free plan in storage and in transfer.
//   how    RETENTION_DAYS: older rows are never served, and every insert deletes a few
//   long   of them first.
//
// Local mode never comes here: its history stays in its folders and PGlite.

export const RETENTION_DAYS = DEMO_RETENTION_DAYS;

/** A cap from the environment, for tests, which can only ever lower it. */
const capped = (name: string, max: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : max;
};

export const SESSION_CAP = capped("INNERNET_DEMO_SESSION_CAP", 400);
export const DAILY_CAP = capped("INNERNET_DEMO_DAILY_CAP", 10_000);
export const READ_DAILY_CAP = capped("INNERNET_DEMO_READ_CAP", 50_000);
/** Sessions one request may name. */
export const MAX_IDS = DEMO_MAX_IDS;
/** Events one read returns at most, the newest first. */
export const READ_ROWS = 1000;
/** The size of the activity table (with its indexes) past which nothing more is stored. */
const MAX_BYTES = 300 * 1024 * 1024;
/** Expired rows each insert deletes first. */
const PRUNE_ROWS = 50;

/** What the database keeps in place of a session id. */
export const sessionKey = (id: string) => createHash("sha256").update(`innernet demo session\n${id}`).digest("hex").slice(0, 32);

/** A UTC date, "2026-10-03", `days` from today. */
const utcDay = (days = 0) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

function neonOnly(db: Db): void {
  if (!DEMO || db.kind !== "neon") throw new Error("visitor history is kept only by the demo, in its own database");
}

/** The ids of the demo's shape, each once, at most MAX_IDS. */
const demoIds = (ids: string[]) => [...new Set(ids.filter((id) => DEMO_SESSION_RE.test(id)))].slice(0, MAX_IDS);

export type Added = "added" | "session-full" | "day-full" | "store-full";

/** Store one event, stamped with the server's time, unless a cap says no. */
export async function addVisit(db: Db, session: string, fields: Record<string, unknown>): Promise<Added> {
  neonOnly(db);
  const at = new Date().toISOString();
  const event = { at, app: APP, ...fields };
  const key = sessionKey(session);
  const [r] = await db.query<{ s: number; full: boolean; slot: number; added: number }>(
    "WITH pruned AS (" +
      "DELETE FROM activity WHERE uid IN (SELECT uid FROM activity WHERE at < now() - make_interval(days => $9::int) LIMIT $10)" +
      "), stale AS (" +
      "DELETE FROM kv WHERE (starts_with(key, 'history.day:') OR starts_with(key, 'history.read:')) AND split_part(key, ':', 2) < $11" +
      "), c AS (" +
      "SELECT (SELECT count(*) FROM activity WHERE session = $2)::int AS s, pg_total_relation_size('activity') >= $12::bigint AS full" +
      "), slot AS (" +
      // The day's counter: made at 1, or raised by one while below the cap. The row lock
      // makes racing inserts wait their turn, and the cap is checked again on the row as
      // it is then.
      "INSERT INTO kv (key, value, updated_at) SELECT $13, '1'::jsonb, now() FROM c WHERE c.s < $7 AND NOT c.full " +
      "ON CONFLICT (key) DO UPDATE SET value = to_jsonb((kv.value #>> '{}')::int + 1), updated_at = now() WHERE (kv.value #>> '{}')::int < $8 RETURNING 1" +
      "), ins AS (" +
      "INSERT INTO activity (uid, session, app, at, kind, data, line) SELECT $1, $2, $3, $4::timestamptz, $5, $6::jsonb, '' FROM slot " +
      "ON CONFLICT (uid) DO NOTHING RETURNING 1" +
      ") SELECT c.s, c.full, (SELECT count(*)::int FROM slot) AS slot, (SELECT count(*)::int FROM ins) AS added FROM c",
    [
      activityUid(key, APP, JSON.stringify(event)),
      key,
      APP,
      at,
      String(fields.kind),
      jsonParam(event),
      SESSION_CAP,
      DAILY_CAP,
      RETENTION_DAYS,
      PRUNE_ROWS,
      utcDay(-2),
      MAX_BYTES,
      `history.day:${utcDay()}`,
    ],
  );
  if (Number(r?.added) > 0) return "added";
  if (r?.full) return "store-full";
  if (Number(r?.s) >= SESSION_CAP) return "session-full";
  if (Number(r?.slot) === 0) return "day-full";
  return "added"; // the very same event twice in one millisecond: one row
}

export interface Visits {
  /** Each session's newest events within retention, oldest first. */
  sessions: Record<string, ActivityEvent[]>;
  /** How many events the database holds for each session asked about. */
  counts: Record<string, number>;
  /** True when it holds more than `sessions` returned (the read's caps). */
  limited: boolean;
}

/** These sessions' events within retention, bounded as the header says. Ids are checked by the route and again here. */
export async function readVisits(db: Db, ids: string[]): Promise<Visits> {
  neonOnly(db);
  const out: Visits = { sessions: {}, counts: {}, limited: false };
  const wanted = demoIds(ids);
  if (!wanted.length) return out;
  const byKey = new Map(wanted.map((id) => [sessionKey(id), id]));
  const keys = jsonParam([...byKey.keys()]);
  const budget = `history.read:${utcDay()}`;
  const [counts, rows] = await db.batch([
    {
      text:
        "SELECT session, count(*)::int AS n FROM activity WHERE session IN (SELECT jsonb_array_elements_text($1::jsonb)) " +
        "AND at > now() - make_interval(days => $2::int) GROUP BY session",
      params: [keys, RETENTION_DAYS],
    },
    {
      text:
        "WITH used AS (SELECT coalesce((SELECT (value #>> '{}')::int FROM kv WHERE key = $3), 0) AS n" +
        "), picked AS (" +
        "SELECT session, data, at, uid FROM (" +
        "SELECT session, data, at, uid, row_number() OVER (PARTITION BY session ORDER BY at DESC, uid DESC) AS k FROM activity " +
        "WHERE session IN (SELECT jsonb_array_elements_text($1::jsonb)) AND at > now() - make_interval(days => $2::int)" +
        ") AS t WHERE k <= $4 AND (SELECT n FROM used) < $5 ORDER BY at DESC, uid DESC LIMIT $6" +
        "), bump AS (" +
        "INSERT INTO kv (key, value, updated_at) SELECT $3, to_jsonb(c.n), now() FROM (SELECT count(*)::int AS n FROM picked) AS c WHERE c.n > 0 " +
        "ON CONFLICT (key) DO UPDATE SET value = to_jsonb((kv.value #>> '{}')::int + (excluded.value #>> '{}')::int), updated_at = now()" +
        ") SELECT session, data FROM picked ORDER BY session, at, uid",
      params: [keys, RETENTION_DAYS, budget, SESSION_CAP, READ_DAILY_CAP, READ_ROWS],
    },
  ]);
  let held = 0;
  for (const r of counts) {
    const id = byKey.get(String(r.session));
    if (!id) continue;
    out.counts[id] = Number(r.n);
    held += Number(r.n);
  }
  for (const r of rows) {
    const id = byKey.get(String(r.session));
    if (id && validEvent(r.data)) (out.sessions[id] ??= []).push({ ...r.data, app: APP });
  }
  out.limited = held > rows.length;
  return out;
}

/** Forget these sessions entirely. Returns how many events went. */
export async function forgetVisits(db: Db, ids: string[]): Promise<number> {
  neonOnly(db);
  const wanted = demoIds(ids);
  if (!wanted.length) return 0;
  const [r] = await db.query<{ n: number }>(
    "WITH gone AS (DELETE FROM activity WHERE session IN (SELECT jsonb_array_elements_text($1::jsonb)) RETURNING 1) SELECT count(*)::int AS n FROM gone",
    [jsonParam(wanted.map(sessionKey))],
  );
  return Number(r?.n ?? 0);
}
