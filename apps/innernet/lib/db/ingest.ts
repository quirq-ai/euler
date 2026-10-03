import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { APP_RE, SESSION_RE, sessionStart, toSession, validEvent, type ActivityEvent, type Session } from "@/components/activity/shared";
import { HISTORY_DIR, historyLabel, listSessions, sessionIds } from "../activity";
import type { SiteIndex } from "../types";
import { activityRow, insertActivity, type ActivityRow } from "./activity";
import { getDb } from "./index";
import { storedIndexInfo, storeIndex } from "./index-store";
import { errorText, say, sayOnce } from "./log";
import { jsonParam, noteChurn } from "./schema";
import type { Db, Row, Statement } from "./types";

// This machine's history in its database, kept in step with the folders.
//
// The folders stay the record and the interchange format: Innernet appends to
// <session>/innernet.jsonl, and any other app appends to a file of its own beside it.
// Reading them into the database is cheap because only what changed is read. For each
// file the database keeps a mark in kv (history.file:<session>/<app>): how many bytes it
// has read, the file's inode and mtime, and a hash of the bytes just before the mark.
//
//   size, inode and mtime as marked       not opened
//   grown, same bytes before the mark     read from the mark on
//   anything else                         read whole (shortened, edited in place,
//                                         replaced): its rows become exactly its lines
//
// The database follows the folders: a session folder, or an app's file, that has been
// deleted is forgotten there too. Unless the history folder itself was lost, moved or
// replaced: the database records which folder it read (its device, inode and birth
// time, in kv history.folder), and when a full pass finds a different one, every
// session it held that is not in the new folder is kept (kv history.kept) rather than
// forgotten, however many new sessions the new folder gains, so `pnpm db:load` can
// write them all back. A kept session that is back on disk is an ordinary one again.
//
// Lines are taken on readSession()'s terms (lib/activity.ts): links never followed, a
// line over 4 KB, not JSON, or without a time (in years 1 to 9999) and a kind skipped,
// and a file over 8 MB read from its end. Everything one pass writes is one
// transaction, so a mark never moves past rows that were not stored. Should the
// database refuse that transaction, the pass is made again a file at a time, and a file
// it still refuses a line at a time, so one odd line can never hold the rest back.
// Passes run one at a time.

const MARK = "history.file:";
const FOLDER = "history.folder";
const KEPT = "history.kept";
const MAX_READ = 8 * 1024 * 1024;
const CHECK_BYTES = 256;
/** Events per session held for the page, as readSession() holds them. */
const PER_SESSION = 5000;

interface Mark {
  bytes: number; // read up to here: the end of the last whole line
  ino: number;
  mtime: number;
  check: string; // hash of the CHECK_BYTES before `bytes`
}

const markKey = (session: string, app: string) => `${MARK}${session}/${app}`;

function parseMarkKey(key: string): { session: string; app: string } | null {
  const rest = key.slice(MARK.length);
  const slash = rest.indexOf("/");
  const session = rest.slice(0, slash);
  const app = rest.slice(slash + 1);
  return slash > 0 && SESSION_RE.test(session) && APP_RE.test(app) ? { session, app } : null;
}

function asMark(v: unknown): Mark | null {
  const m = v as Partial<Mark> | null;
  return m && typeof m.bytes === "number" && typeof m.ino === "number" && typeof m.mtime === "number" && typeof m.check === "string" ? (m as Mark) : null;
}

const hash = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 32);

interface OnDisk {
  session: string;
  app: string;
  file: string;
  size: number;
  ino: number;
  mtime: number;
}

/** Which folder the history is: the same path can be a new folder after it was lost. */
interface FolderId {
  dir: string;
  dev: number;
  ino: number;
  birth: number; // ms; 0 where the file system does not keep it
}

function asFolderId(v: unknown): FolderId | null {
  const f = v as Partial<FolderId> | null;
  return f && typeof f.dir === "string" && typeof f.dev === "number" && typeof f.ino === "number" && typeof f.birth === "number" ? (f as FolderId) : null;
}

const sameFolder = (a: FolderId, b: FolderId) => a.dir === b.dir && a.dev === b.dev && a.ino === b.ino && a.birth === b.birth;

interface Scan {
  readable: boolean; // the history folder itself could be listed
  id: FolderId | null; // which folder it is
  sessions: Set<string>; // session folders found
  blind: Set<string>; // ...of which these could not be listed, so nothing in them counts as gone
  files: OnDisk[];
}

/** The session folders under `dir` (or only those named) and the app files in each, by
 * lstat: a link is neither a session nor a file. */
function scan(dir: string, only?: string[]): Scan {
  const out: Scan = { readable: true, id: null, sessions: new Set(), blind: new Set(), files: [] };
  let names: string[];
  if (only) names = only.filter((s) => SESSION_RE.test(s));
  else {
    try {
      const st = fs.lstatSync(dir);
      if (!st.isDirectory()) return { ...out, readable: false };
      out.id = { dir, dev: st.dev, ino: st.ino, birth: Math.round(st.birthtimeMs) || 0 };
      names = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && SESSION_RE.test(e.name))
        .map((e) => e.name);
    } catch {
      return { ...out, readable: false };
    }
  }
  for (const session of names) {
    const folder = path.join(dir, session);
    let entries: fs.Dirent[];
    try {
      if (!fs.lstatSync(folder).isDirectory()) continue;
    } catch {
      continue;
    }
    out.sessions.add(session);
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      out.blind.add(session);
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
      const app = e.name.slice(0, -".jsonl".length);
      if (!APP_RE.test(app)) continue;
      const file = path.join(folder, e.name);
      try {
        const st = fs.lstatSync(file);
        if (st.isFile()) out.files.push({ session, app, file, size: st.size, ino: st.ino, mtime: st.mtimeMs });
      } catch {
        /* gone since the listing */
      }
    }
  }
  return out;
}

function readRange(fd: number, start: number, end: number): Buffer {
  const buf = Buffer.alloc(Math.max(0, end - start));
  let off = 0;
  while (off < buf.length) {
    const n = fs.readSync(fd, buf, off, buf.length - off, start + off);
    if (n === 0) break;
    off += n;
  }
  return off === buf.length ? buf : buf.subarray(0, off);
}

interface FileRead {
  rows: ActivityRow[];
  mark: Mark;
  whole: boolean; // the rows are the whole file, so they replace whatever the database had for it
}

/** What is new in one file since its mark: "same" when it has not changed, null when it cannot be read. */
function readFile(f: OnDisk, mark: Mark | null): FileRead | "same" | null {
  if (mark && mark.ino === f.ino && mark.bytes === f.size && mark.mtime === f.mtime) return "same";
  let fd: number;
  try {
    // O_NOFOLLOW: a file swapped for a link since the listing is not read through.
    fd = fs.openSync(f.file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch {
    return null;
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return null;
    const size = st.size;
    let start = 0;
    // Grown, with the bytes before the mark as they were: an append. The same size with a
    // new mtime is a file edited in place, and is read whole.
    if (mark && mark.ino === st.ino && mark.bytes > 0 && size > mark.bytes && hash(readRange(fd, Math.max(0, mark.bytes - CHECK_BYTES), mark.bytes)) === mark.check) {
      start = mark.bytes;
    }
    // More than 8 MB to read: its end only, from a whole line, as readSession() reads a big file.
    const tail = size - start > MAX_READ;
    if (tail) start = size - MAX_READ;
    const buf = readRange(fd, start, size);
    const skip = tail ? buf.indexOf(10) + 1 || buf.length : 0;
    const body = buf.subarray(skip);
    // The mark goes to the end of the last whole line. A last line still being written is
    // read now if it already parses, and read again next time (the same line keeps one row).
    const lastNewline = body.lastIndexOf(10);
    const bytes = start + skip + (lastNewline + 1);
    const rows: ActivityRow[] = [];
    for (const line of body.toString("utf8").split("\n")) {
      const row = activityRow(f.session, f.app, line);
      if (row) rows.push(row);
    }
    const check = hash(readRange(fd, Math.max(0, bytes - CHECK_BYTES), bytes));
    return { rows, mark: { bytes, ino: st.ino, mtime: st.mtimeMs, check }, whole: start === 0 && !tail };
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

export interface IngestResult {
  sessions: number; // session folders looked at
  files: number; // app files found in them
  read: number; // files that had changed and were read
  added: number; // rows added
  forgotten: number; // rows removed: lines gone from their file, files and folders deleted
  kept: number; // sessions held for `pnpm db:load` because the history folder was lost or replaced
  skipped: number; // lines the database would not take, even one at a time
}

const G = globalThis as typeof globalThis & { __innernetIngest?: Promise<unknown> };

/**
 * Bring the database up to date with the history folders: every session folder, or only
 * the ones named (the recorder's own session, after each event). Throws when the
 * database does; the caller falls back on the files.
 */
export function ingestHistory(db: Db, options: { dir?: string; only?: string[] } = {}): Promise<IngestResult> {
  const run = (G.__innernetIngest ?? Promise.resolve()).then(() => ingest(db, options.dir ?? HISTORY_DIR, options.only));
  G.__innernetIngest = run.catch(() => undefined);
  return run;
}

async function ingest(db: Db, dir: string, only?: string[]): Promise<IngestResult> {
  // Belt and braces: this machine's history is only ever stored in this machine's database.
  if (db.kind !== "pglite") throw new Error("this machine's history is stored only in this machine's database");
  const disk = scan(dir, only);
  const full = !only;
  const result: IngestResult = { sessions: disk.sessions.size, files: disk.files.length, read: 0, added: 0, forgotten: 0, kept: 0, skipped: 0 };

  // What the database knows: the files' marks and, on a full pass, which apps each
  // session has, which folder it read last time, and which sessions it is keeping.
  let markRows: Row[];
  let pairs: Row[] = [];
  let folderRows: Row[] = [];
  if (full) {
    [markRows, pairs, folderRows] = await db.batch(
      [
        { text: "SELECT key, value FROM kv WHERE starts_with(key, $1)", params: [MARK] },
        { text: "SELECT DISTINCT session, app FROM activity" },
        { text: "SELECT key, value FROM kv WHERE key IN ($1, $2)", params: [FOLDER, KEPT] },
      ],
      { readOnly: true },
    );
  } else {
    if (!disk.files.length) return result;
    markRows = await db.query("SELECT key, value FROM kv WHERE key IN (SELECT jsonb_array_elements_text($1::jsonb))", [
      jsonParam(disk.files.map((f) => markKey(f.session, f.app))),
    ]);
  }
  const marks = new Map<string, Mark>();
  for (const r of markRows) {
    const m = asMark(r.value);
    if (m) marks.set(String(r.key), m);
  }

  // Each changed file: its new rows, the uids it holds now when read whole, its new mark.
  const reads: { session: string; app: string; rows: ActivityRow[]; keep: string[] | null; mark: { key: string; value: Mark } | null }[] = [];
  for (const f of disk.files) {
    const key = markKey(f.session, f.app);
    const r = readFile(f, marks.get(key) ?? null);
    if (r === "same" || r === null) continue;
    result.read++;
    const was = marks.get(key);
    const moved = !was || was.bytes !== r.mark.bytes || was.ino !== r.mark.ino || was.mtime !== r.mark.mtime || was.check !== r.mark.check;
    reads.push({ session: f.session, app: f.app, rows: r.rows, keep: r.whole ? r.rows.map((x) => x.uid) : null, mark: moved ? { key, value: r.mark } : null });
  }

  // Deleted folders and files, forgotten, on a full pass of a folder that could be read.
  const gone: { session: string; app: string | null }[] = [];
  const goneMarks: string[] = [];
  const kvWrites: { key: string; value: unknown }[] = [];
  const kvDeletes: string[] = [];
  if (full && disk.readable && disk.id) {
    const present = new Map<string, Set<string>>();
    for (const s of disk.sessions) present.set(s, new Set());
    for (const f of disk.files) present.get(f.session)?.add(f.app);
    const known = new Map<string, Set<string>>();
    const know = (session: string, app: string) => {
      const apps = known.get(session) ?? new Set<string>();
      apps.add(app);
      known.set(session, apps);
    };
    for (const p of pairs) know(String(p.session), String(p.app));
    for (const key of marks.keys()) {
      const k = parseMarkKey(key);
      if (k) know(k.session, k.app);
    }
    const meta = new Map(folderRows.map((r) => [String(r.key), r.value]));
    const recorded = asFolderId(meta.get(FOLDER));
    const keptBefore = new Set(Array.isArray(meta.get(KEPT)) ? (meta.get(KEPT) as unknown[]).filter((x): x is string => typeof x === "string") : []);
    const missing = [...known.keys()].filter((s) => !present.has(s));

    // Was the folder lost or replaced since the last full pass? With a record, that is a
    // different folder. Without one (the first pass): none of the known sessions left, or
    // one that began more than a minute before this folder was made.
    const birth = disk.id.birth;
    const replaced = recorded
      ? !sameFolder(recorded, disk.id)
      : missing.length > 0 && (missing.length === known.size || (birth > 0 && missing.some((s) => Date.parse(sessionStart(s)) < birth - 60_000)));

    // Kept: what was kept before and is still not on disk, plus, when the folder changed,
    // every session that did not come with it.
    const kept = new Set([...keptBefore].filter((s) => known.has(s) && !present.has(s)));
    if (replaced) for (const s of missing) kept.add(s);
    result.kept = kept.size;
    if (replaced && missing.length) {
      sayOnce(
        `kept:${dir}:${disk.id.ino}`,
        `${historyLabel(dir)} is not the folder the database read before, so it keeps the ${missing.length} sessions that are not in it (pnpm db:load writes them back)`,
      );
    }

    const isGone = (session: string, app: string) => {
      const here = present.get(session);
      return here ? !disk.blind.has(session) && !here.has(app) : !kept.has(session);
    };
    for (const [session, apps] of known) {
      if (kept.has(session)) continue;
      if (!present.has(session)) gone.push({ session, app: null });
      else for (const app of apps) if (isGone(session, app)) gone.push({ session, app });
    }
    for (const key of marks.keys()) {
      const k = parseMarkKey(key);
      if (!k || isGone(k.session, k.app)) goneMarks.push(key);
    }
    if (!recorded || !sameFolder(recorded, disk.id)) kvWrites.push({ key: FOLDER, value: disk.id });
    const keptList = [...kept].sort();
    if (keptList.join() !== [...keptBefore].sort().join()) {
      if (keptList.length) kvWrites.push({ key: KEPT, value: keptList });
      else kvDeletes.push(KEPT);
    }
  }

  // What the pass writes. The forgetting comes first, as one group; then each file's rows
  // and mark, as a group of its own, so a file the database refuses can be set apart.
  type Count = "added" | "forgotten" | null;
  type Group = { statements: Statement[]; counts: Count[] };
  const forget: Group = { statements: [], counts: [] };
  const whole = reads.filter((r) => r.keep).map((r) => ({ session: r.session, app: r.app, keep: r.keep }));
  if (whole.length) {
    forget.statements.push({
      text:
        "DELETE FROM activity a USING jsonb_array_elements($1::jsonb) AS f " +
        "WHERE a.session = f->>'session' AND a.app = f->>'app' AND NOT (f->'keep' ? a.uid) RETURNING a.uid",
      params: [jsonParam(whole)],
    });
    forget.counts.push("forgotten");
  }
  if (gone.length) {
    forget.statements.push({
      text:
        "DELETE FROM activity a USING jsonb_array_elements($1::jsonb) AS g " +
        "WHERE a.session = g->>'session' AND (g->>'app' IS NULL OR a.app = g->>'app') RETURNING a.uid",
      params: [jsonParam(gone)],
    });
    forget.counts.push("forgotten");
  }
  const kvDrop = [...goneMarks, ...kvDeletes];
  if (kvDrop.length) {
    forget.statements.push({ text: "DELETE FROM kv WHERE key IN (SELECT jsonb_array_elements_text($1::jsonb))", params: [jsonParam(kvDrop)] });
    forget.counts.push(null);
  }
  if (kvWrites.length) {
    forget.statements.push(upsertKv(kvWrites));
    forget.counts.push(null);
  }
  const files = reads.map((r) => {
    const g: Group & { read: (typeof reads)[number] } = { statements: [], counts: [], read: r };
    for (const st of insertActivity(r.rows)) {
      g.statements.push(st);
      g.counts.push("added");
    }
    if (r.mark) {
      g.statements.push(upsertKv([r.mark]));
      g.counts.push(null);
    }
    return g;
  });

  const groups = [forget, ...files].filter((g) => g.statements.length);
  if (!groups.length) return result;
  const tally = (g: Group, rows: Row[][]) =>
    rows.forEach((r, i) => {
      const c = g.counts[i];
      if (c) result[c] += r.length;
    });

  try {
    const rows = await db.batch(groups.flatMap((g) => g.statements));
    let i = 0;
    for (const g of groups) {
      tally(g, rows.slice(i, i + g.statements.length));
      i += g.statements.length;
    }
  } catch (err) {
    // One group at a time, and a file still refused, one line at a time.
    sayOnce("ingest:apart", `the database would not take one pass of the history whole (${errorText(err)}); taking it a file at a time`);
    if (forget.statements.length) tally(forget, await db.batch(forget.statements));
    for (const g of files) {
      if (!g.statements.length) continue;
      try {
        tally(g, await db.batch(g.statements));
      } catch {
        for (const row of g.read.rows) {
          const one = insertActivity([row])[0];
          try {
            result.added += (await db.query(one.text, one.params)).length;
          } catch {
            result.skipped++;
          }
        }
        if (g.read.mark) {
          const mark = upsertKv([g.read.mark]);
          await db.query(mark.text, mark.params);
        }
        sayOnce(`ingest:skip:${g.read.session}/${g.read.app}`, `skipped lines of ${g.read.session}/${g.read.app}.jsonl that the database would not take`);
      }
    }
  }
  // Rows deleted and marks rewritten leave old row versions behind (see noteChurn).
  await noteChurn(db, "activity", result.forgotten);
  await noteChurn(db, "kv", reads.filter((r) => r.mark).length + kvDrop.length + kvWrites.length);
  return result;
}

/** One statement that writes these kv rows, replacing what was there. */
function upsertKv(rows: { key: string; value: unknown }[]): Statement {
  return {
    text:
      "INSERT INTO kv (key, value, updated_at) SELECT m->>'key', m->'value', now() FROM jsonb_array_elements($1::jsonb) AS m " +
      "ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    params: [jsonParam(rows)],
  };
}

/** Sessions as the history page shows them, read from the database: the newest 5,000
 * events of each, in time order, merged across apps. Ids with no rows are left out. */
export async function storedSessions(db: Db, ids: string[]): Promise<Map<string, Session>> {
  const out = new Map<string, Session>();
  if (!ids.length) return out;
  const rows = await db.query<{ session: string; app: string; line: string; total: number }>(
    "SELECT session, app, line, total::int AS total FROM (" +
      "SELECT session, app, line, at, uid, row_number() OVER (PARTITION BY session ORDER BY at DESC, uid DESC) AS n, count(*) OVER (PARTITION BY session) AS total " +
      "FROM activity WHERE session IN (SELECT jsonb_array_elements_text($1::jsonb))" +
      ") AS t WHERE n <= $2 ORDER BY session, at, uid",
    [jsonParam(ids), PER_SESSION],
  );
  const grouped = new Map<string, { events: ActivityEvent[]; total: number }>();
  for (const r of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.line);
    } catch {
      continue;
    }
    if (!validEvent(parsed)) continue;
    const g = grouped.get(r.session) ?? { events: [], total: Number(r.total) };
    // The file names the app, as readSession() has it.
    g.events.push({ ...parsed, app: r.app });
    grouped.set(r.session, g);
  }
  for (const [id, g] of grouped) out.set(id, toSession(id, g.events, g.total));
  return out;
}

export interface HistoryListing {
  sessions: Session[];
  older: number; // session folders not read
  source: "database" | "files";
}

/**
 * The newest sessions for the history page. With the database: every changed session
 * folder is read into it first (so another app's new lines show), then the sessions
 * whose folders are here are read back from it. Without one, or when it fails: the files,
 * as before. Never throws.
 */
export async function historySessions(limit = 60): Promise<HistoryListing> {
  const fromFiles = (): HistoryListing => ({ ...listSessions(limit), source: "files" });
  const db = await getDb();
  if (!db) return fromFiles();
  try {
    await ingestHistory(db);
    const ids = sessionIds();
    const sessions: Session[] = [];
    let read = 0;
    while (sessions.length < limit && read < ids.length) {
      const batch = ids.slice(read, read + limit - sessions.length);
      read += batch.length;
      const got = await storedSessions(db, batch);
      for (const id of batch) {
        const s = got.get(id);
        if (s && s.total > 0) sessions.push(s);
      }
    }
    return { sessions, older: ids.length - read, source: "database" };
  } catch (err) {
    sayOnce("history:read", `could not read the history through ${db.label} (${errorText(err)}); reading the files instead`);
    return fromFiles();
  }
}

/** One session's folder, read into the database after the recorder wrote to it. Never throws. */
export async function ingestSession(session: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await ingestHistory(db, { only: [session] });
  } catch (err) {
    sayOnce("history:ingest", `could not store the history in ${db.label} (${errorText(err)}); the files still hold it`);
  }
}

// ---------------------------------------------------------------- store now

export interface StoreSummary {
  at: string; // ISO
  label: string; // where: "~/.innernet/db"
  index: { state: "stored" | "already" | "none"; pages: number; written: number; deleted: number; generatedAt: string | null; replacing: string | null; ms: number };
  history: IngestResult & { dir: string };
}

/**
 * What `pnpm db:store` does, and the history page's Store now: the index (when there is
 * one and the database holds a different one), then every history folder.
 */
export async function storeLocal(db: Db, index: SiteIndex | null): Promise<StoreSummary> {
  // This machine's index and history go to this machine's database and nowhere else.
  if (db.kind !== "pglite") throw new Error("this machine's index and history are stored only in this machine's database");
  let indexPart: StoreSummary["index"] = { state: "none", pages: 0, written: 0, deleted: 0, generatedAt: null, replacing: null, ms: 0 };
  if (index) {
    const stored = await storedIndexInfo(db);
    const base = { pages: index.pages.length, generatedAt: index.meta.generatedAt, replacing: stored?.meta.generatedAt ?? null };
    if (stored?.meta.generatedAt === index.meta.generatedAt && !!stored.meta.demo === !!index.meta.demo) {
      indexPart = { ...base, state: "already", written: 0, deleted: 0, replacing: null, ms: 0 };
    } else {
      const t = Date.now();
      const r = await storeIndex(db, index);
      indexPart = { ...base, state: "stored", written: r.written, deleted: r.deleted, ms: Date.now() - t };
    }
  }
  const history = await ingestHistory(db);
  return { at: new Date().toISOString(), label: db.label, index: indexPart, history: { ...history, dir: historyLabel() } };
}

/** The last Store now in this process, for the history page to report. */
export type LastStore = { at: string; summary: StoreSummary; error?: undefined } | { at: string; summary?: undefined; error: string };

const S = globalThis as typeof globalThis & { __innernetLastStore?: LastStore };

export function rememberStore(last: LastStore): void {
  S.__innernetLastStore = last;
  if (last.summary) {
    const { index, history } = last.summary;
    say(`stored now: index ${index.state}, history ${history.added} new and ${history.forgotten} forgotten lines from ${history.read} changed files${history.kept ? `, ${history.kept} sessions kept for pnpm db:load` : ""}`);
  }
}

export const lastStore = (): LastStore | null => S.__innernetLastStore ?? null;
