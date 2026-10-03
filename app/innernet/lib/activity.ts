import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_RE, KIND_RE, MAX_EVENT_BYTES, SESSION_RE, toSession, validEvent, type ActivityEvent, type Session } from "@/components/activity/shared";

// The activity history: plain folders and JSON Lines files, no index. The folders are
// the record and the format every app shares; the database keeps a copy of their lines,
// read in as they change (lib/db/ingest.ts).
//
//   ~/.innernet/history/                  (INNERNET_HISTORY_DIR overrides it)
//     2026-10-03T05-12-07Z_k3f9a2/        one folder per session, named by its start
//       innernet.jsonl                    one event per line, appended by Innernet
//       <any-app>.jsonl                   any other app or tool adds its own file
//
// Reading a session is reading every *.jsonl in its folder and sorting by "at". Names
// are checked against fixed patterns before they touch a path, symlinks are never
// followed inside the folder, and a line that will not parse is skipped. Only the local
// app writes here; the demo keeps its visitors' history in their browsers, and for 30
// days in its own database when it has one (lib/db/demo-history.ts).

const HOME = os.homedir();

function resolveDir(raw: string | undefined): string {
  const dir = raw?.trim() || "~/.innernet/history";
  return path.resolve(dir.replace(/^~(?=$|[\\/])/, HOME));
}

export const HISTORY_DIR = resolveDir(process.env.INNERNET_HISTORY_DIR);

/** The folder as a person writes it: ~ for the home folder. */
export const historyLabel = (dir = HISTORY_DIR) => (dir === HOME ? "~" : dir.startsWith(HOME + path.sep) ? `~${dir.slice(HOME.length)}` : dir);

/** A file bigger than this is read from its end: the newest lines are the ones wanted. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** A session holds at most this many events in memory; the rest are counted. */
const MAX_SESSION_EVENTS = 5000;

export type AppendResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Append one event to <session>/<app>.jsonl, making the session folder the first time.
 * `at` defaults to now; `app` and `kind` lead the line, then the free fields.
 */
export function appendEvent(session: string, app: string, fields: Record<string, unknown>): AppendResult {
  if (!SESSION_RE.test(session)) return { ok: false, status: 400, error: "Bad session id." };
  if (!APP_RE.test(app)) return { ok: false, status: 400, error: "Bad app name." };
  const { at, kind, app: _ignored, ...rest } = fields;
  if (typeof kind !== "string" || !KIND_RE.test(kind)) return { ok: false, status: 400, error: "Bad kind." };
  const when = typeof at === "string" && Number.isFinite(Date.parse(at)) ? new Date(at).toISOString() : new Date().toISOString();

  const line = JSON.stringify({ at: when, app, kind, ...rest }) + "\n";
  if (Buffer.byteLength(line) > MAX_EVENT_BYTES) return { ok: false, status: 413, error: `Events are kept under ${MAX_EVENT_BYTES} bytes.` };

  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true, mode: 0o700 });
    const dir = path.join(HISTORY_DIR, session);
    try {
      fs.mkdirSync(dir, { mode: 0o700 });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    // The session must be a real folder, and the file is never reached through a link.
    if (!fs.lstatSync(dir).isDirectory()) return { ok: false, status: 409, error: "Session is not a folder." };
    const fd = fs.openSync(path.join(dir, `${app}.jsonl`), fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o600);
    try {
      fs.writeSync(fd, line);
    } finally {
      fs.closeSync(fd);
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: "Could not write the history." };
  }
}

/** A file's text, or its last MAX_FILE_BYTES starting at a whole line. */
function readTail(file: string, size: number): string {
  if (size <= MAX_FILE_BYTES) return fs.readFileSync(file, "utf8");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(MAX_FILE_BYTES);
    fs.readSync(fd, buf, 0, MAX_FILE_BYTES, size - MAX_FILE_BYTES);
    const text = buf.toString("utf8");
    return text.slice(text.indexOf("\n") + 1);
  } catch {
    return "";
  } finally {
    fs.closeSync(fd);
  }
}

/** One session: every app's file in its folder, merged into time order. Null if it is not there. */
export function readSession(id: string): Session | null {
  if (!SESSION_RE.test(id)) return null;
  const dir = path.join(HISTORY_DIR, id);
  let entries: fs.Dirent[];
  try {
    if (!fs.lstatSync(dir).isDirectory()) return null;
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const events: ActivityEvent[] = [];
  const apps: string[] = [];
  for (const entry of entries) {
    // Dirent.isFile() is false for a symlink, so a link out of the folder is never read.
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const app = entry.name.slice(0, -".jsonl".length);
    if (!APP_RE.test(app)) continue;
    let text = "";
    try {
      const file = path.join(dir, entry.name);
      text = readTail(file, fs.statSync(file).size);
    } catch {
      continue;
    }
    let wrote = false;
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.length > MAX_EVENT_BYTES || Buffer.byteLength(line) > MAX_EVENT_BYTES) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!validEvent(parsed)) continue;
      // The file names the app: whatever a line says, it is shown under the file it is in.
      events.push({ ...parsed, app });
      wrote = true;
    }
    if (wrote) apps.push(app);
  }

  const total = events.length;
  const session = toSession(id, events, total, apps);
  if (session.events.length > MAX_SESSION_EVENTS) session.events = session.events.slice(-MAX_SESSION_EVENTS);
  return session;
}

/** Every session folder's name, newest first. */
export function sessionIds(): string[] {
  try {
    return fs
      .readdirSync(HISTORY_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && SESSION_RE.test(e.name))
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** The newest sessions, read in full (empty ones left out), and how many older folders were not read. */
export function listSessions(limit = 60): { sessions: Session[]; older: number } {
  const ids = sessionIds();
  const sessions: Session[] = [];
  let read = 0;
  for (const id of ids) {
    if (sessions.length >= limit) break;
    read++;
    const s = readSession(id);
    if (s && s.total > 0) sessions.push(s);
  }
  return { sessions, older: ids.length - read };
}
