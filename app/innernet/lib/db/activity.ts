import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { APP_RE, MAX_EVENT_BYTES, SESSION_RE, validEvent } from "@/components/activity/shared";
import { epochMs, jsonParam } from "./schema";
import type { Db, Statement } from "./types";

// The history in the database, one row per line. On this machine the folders stay the
// source (lib/activity.ts) and lib/db/ingest.ts keeps these rows in step with them; on
// the demo the rows are the visitors' own events (lib/db/demo-history.ts).
//
// A row's uid is a hash of its session, its app and the exact line, so storing a folder
// twice, or a line that is already there, keeps one row. The exact line is kept too
// (`line`), because jsonb reorders keys: loading writes back the very text that was
// read, and the hash still matches the next time it is stored. A line is taken on the
// same terms readSession() reads it: under 4 KB, JSON, with a real `at` and a `kind`; the
// app is the file's name, whatever the line says.

export interface ActivityRow {
  uid: string;
  session: string;
  app: string;
  at: string; // ISO
  kind: string;
  data: Record<string, unknown>;
  line: string;
}

/** The row's key: a hash of where the line lives and the line itself. */
export const activityUid = (session: string, app: string, line: string) =>
  createHash("sha256").update(`${session}\n${app}\n${line}`).digest("hex").slice(0, 32);

/** One line of <session>/<app>.jsonl as a row, or null when readSession() would skip it. */
export function activityRow(session: string, app: string, raw: string): ActivityRow | null {
  const line = raw.trim();
  if (!SESSION_RE.test(session) || !APP_RE.test(app)) return null;
  if (!line || Buffer.byteLength(line) > MAX_EVENT_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!validEvent(parsed)) return null;
  return { uid: activityUid(session, app, line), session, app, at: new Date(parsed.at).toISOString(), kind: parsed.kind, data: parsed, line };
}

const CHUNK = 1000;

/** Statements that insert rows, a thousand to each, sent as one JSON array apiece. Each
 * returns the uids it added: a row already there is left as it is. */
export function insertActivity(rows: ActivityRow[]): Statement[] {
  const out: Statement[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(({ uid, session, app, at, kind, data, line }) => ({ uid, session, app, at, kind, data, line }));
    out.push({
      text:
        "INSERT INTO activity (uid, session, app, at, kind, data, line) " +
        "SELECT x->>'uid', x->>'session', x->>'app', (x->>'at')::timestamptz, x->>'kind', x->'data', x->>'line' " +
        "FROM jsonb_array_elements($1::jsonb) AS x ON CONFLICT (uid) DO NOTHING RETURNING uid",
      params: [jsonParam(chunk)],
    });
  }
  return out;
}

/** Every stored line, by session and app, oldest first. */
export async function loadActivity(db: Db): Promise<{ session: string; app: string; line: string }[]> {
  return db.query<{ session: string; app: string; line: string }>("SELECT session, app, line FROM activity ORDER BY session, app, at, uid");
}

export interface ActivityCounts {
  lines: number;
  sessions: number;
  apps: number;
  first: number | null; // ms since 1970
  last: number | null;
}

export async function activityCounts(db: Db): Promise<ActivityCounts> {
  const [r] = await db.query<{ lines: number; sessions: number; apps: number; first: number | null; last: number | null }>(
    `SELECT count(*)::int AS lines, count(DISTINCT session)::int AS sessions, count(DISTINCT app)::int AS apps, ${epochMs("min(at)")} AS first, ${epochMs("max(at)")} AS last FROM activity`,
  );
  return { lines: Number(r?.lines ?? 0), sessions: Number(r?.sessions ?? 0), apps: Number(r?.apps ?? 0), first: r?.first ?? null, last: r?.last ?? null };
}

/**
 * Write stored lines back out as session folders under `dir`, adding only what is not
 * there: a missing folder or file is made, a missing line is appended, and nothing is
 * ever deleted or rewritten. Folders are 700 and files 600, and neither is reached
 * through a link, as in appendEvent().
 */
export function writeHistoryLines(dir: string, lines: { session: string; app: string; line: string }[]): { files: number; created: number; appended: number } {
  const groups = new Map<string, { session: string; app: string; lines: string[] }>();
  for (const l of lines) {
    if (!SESSION_RE.test(l.session) || !APP_RE.test(l.app)) continue;
    const key = `${l.session}/${l.app}`;
    const g = groups.get(key) ?? { session: l.session, app: l.app, lines: [] };
    g.lines.push(l.line.trim());
    groups.set(key, g);
  }
  let created = 0;
  let appended = 0;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const g of groups.values()) {
    const folder = path.join(dir, g.session);
    try {
      fs.mkdirSync(folder, { mode: 0o700 });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    if (!fs.lstatSync(folder).isDirectory()) continue;
    const file = path.join(folder, `${g.app}.jsonl`);
    let existing = "";
    let isNew = false;
    try {
      const st = fs.lstatSync(file);
      if (!st.isFile()) continue;
      existing = fs.readFileSync(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      isNew = true;
    }
    const have = new Set(existing.split("\n").map((l) => l.trim()));
    const missing = [...new Set(g.lines)].filter((l) => l && !have.has(l));
    if (!missing.length) continue;
    const text = (existing && !existing.endsWith("\n") ? "\n" : "") + missing.join("\n") + "\n";
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o600);
    try {
      fs.writeSync(fd, text);
    } finally {
      fs.closeSync(fd);
    }
    if (isNew) created++;
    appended += missing.length;
  }
  return { files: groups.size, created, appended };
}
