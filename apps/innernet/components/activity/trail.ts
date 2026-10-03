import {
  APP,
  DEMO_MAX_IDS,
  DEMO_RETENTION_DAYS,
  DEMO_SESSION_RE,
  MAX_DEMO_BODY,
  MAX_EVENT_BYTES,
  SESSION_RE,
  demoPath,
  newSessionId,
  sessionStart,
  type ActivityEvent,
} from "./shared";

// The browser side of the history, shared by the recorder and the header's back and
// forward buttons. One session per tab: its id lives in sessionStorage, made on first
// load from the start time and a random id (12 random characters on the demo). The
// trail is the tab's own stack of pages with a cursor, like a browser's: a normal
// navigation cuts off whatever lay ahead, and the buttons only move the cursor.
//
// On this machine each event goes to the app's own /api/activity route, which writes it
// to the history folder. On the demo the same events, under the same session ids, are
// kept in this browser's localStorage; when the demo has a database they also go to
// /api/activity, with the path cut down to one of the demo's own pages (demoPath), and
// the server keeps them for 30 days. Every id sent within those 30 days is remembered
// here, so the history page can read them back and the Clear button can delete them all.
// Ids go in request bodies, never in an address. Nothing else knows which sessions are
// this visitor's.

const SESSION_KEY = "innernet-session";
const TRAIL_KEY = "innernet-trail";
export const DEMO_KEY = "innernet-history";
const SENT_KEY = "innernet-history-sent";

/** Fired on window whenever the trail changes, so the buttons can follow. */
export const TRAIL_EVENT = "innernet:trail";

const MAX_TRAIL = 100;
const DEMO_SESSIONS = 40;
const DEMO_EVENTS = 400;
/** Ids sent to the demo's server are remembered while the server may still hold them
 * (its retention, and a day's grace), and never more than this many. */
const SENT_DAYS = DEMO_RETENTION_DAYS + 1;
const SENT_MAX = 1000;
/** Set when more than SENT_MAX ids would have been remembered, so Clear can say so. */
const SENT_DROPPED_KEY = "innernet-history-sent-dropped";

export interface TrailEntry {
  url: string;
  label?: string; // what the tooltip names: the page's title, or the search in quotes
}

export interface Trail {
  stack: TrailEntry[];
  cursor: number;
}

// If storage is blocked (a private window, a sandbox) the tab still works for as long
// as the page stays loaded.
let memorySession: string | null = null;
let memoryTrail: Trail = { stack: [], cursor: -1 };

/** This tab's session id, made on first use. The demo's ids carry 12 random characters
 * (DEMO_SESSION_RE), so a shorter one saved before is replaced there. */
export function sessionId(demo = false): string {
  const fits = (id: string | null): id is string => !!id && (demo ? DEMO_SESSION_RE : SESSION_RE).test(id);
  const make = () => newSessionId(new Date(), demo ? 12 : 6);
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (fits(saved)) return saved;
    const id = fits(memorySession) ? memorySession : make();
    sessionStorage.setItem(SESSION_KEY, id);
    memorySession = id;
    return id;
  } catch {
    if (!fits(memorySession)) memorySession = make();
    return memorySession;
  }
}

/** The id without making one: for pages that only want to know which session is theirs. */
export function currentSessionId(): string | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved && SESSION_RE.test(saved) ? saved : memorySession;
  } catch {
    return memorySession;
  }
}

export function readTrail(): Trail {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY);
    if (!raw) return memoryTrail;
    const t = JSON.parse(raw) as Trail;
    if (!Array.isArray(t.stack) || typeof t.cursor !== "number") return memoryTrail;
    const stack = t.stack.filter((e) => e && typeof e.url === "string" && e.url.startsWith("/") && !e.url.startsWith("//"));
    return { stack, cursor: Math.min(Math.max(t.cursor, stack.length ? 0 : -1), stack.length - 1) };
  } catch {
    return memoryTrail;
  }
}

export function writeTrail(t: Trail) {
  // Keep the newest pages; the cursor moves with them.
  const drop = Math.max(0, t.stack.length - MAX_TRAIL);
  memoryTrail = { stack: t.stack.slice(drop), cursor: Math.max(-1, t.cursor - drop) };
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(memoryTrail));
  } catch {
    /* kept in memory */
  }
  window.dispatchEvent(new CustomEvent(TRAIL_EVENT));
}

// A move made with the buttons, waiting for its route to arrive, so the recorder logs
// it as "back" or "forward" rather than as a new visit.
let pendingMove: { dir: "back" | "forward"; url: string; at: number } | null = null;

export function setPendingMove(dir: "back" | "forward", url: string) {
  pendingMove = { dir, url, at: Date.now() };
}

/** True while a step is on its way, so a quick second click cannot cross it. */
export function moving(): boolean {
  return !!pendingMove && Date.now() - pendingMove.at < 4000;
}

export function takePendingMove(url: string): "back" | "forward" | null {
  const move = pendingMove;
  pendingMove = null;
  return move && move.url === url ? move.dir : null;
}

export type Fields = { kind: "visit" | "search" | "back" | "forward"; url: string; title?: string; q?: string; via?: "buttons" | "browser" };

/**
 * Record one event: to this machine's history, or on the demo to this browser, and also
 * to the demo's database when `server` says it keeps one.
 */
export function record(fields: Fields, demo: boolean, server = !demo) {
  const session = sessionId(demo);
  if (demo) keepInBrowser(session, { at: new Date().toISOString(), app: APP, ...fields });
  if (!server) return;
  // The demo's server keeps only its own pages' paths, and none of an address's tags.
  const url = demo ? demoPath(fields.url) : fields.url;
  if (!url) return;
  const body = JSON.stringify({ session, ...fields, url });
  if (new TextEncoder().encode(body).length > (demo ? MAX_DEMO_BODY : MAX_EVENT_BYTES)) return;
  if (demo) rememberSent(session);
  send("POST", body, true).catch(() => {
    /* offline or the server restarting; one missed line is not worth a retry */
  });
}

/** A JSON body to /api/activity: ids and events travel in bodies, never in the address. */
function send(method: "POST" | "DELETE", body: string, keepalive = false): Promise<Response> {
  return fetch("/api/activity", { method, headers: { "Content-Type": "application/json" }, body, keepalive, credentials: "same-origin", cache: "no-store" });
}

/** Whether a session id is recent enough that the demo's server may still hold it. */
const stillHeld = (id: string) => Date.now() - Date.parse(sessionStart(id)) < SENT_DAYS * 864e5;

/** The session ids this browser has sent to the demo's server and it may still hold, newest first. */
export function sentSessions(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && DEMO_SESSION_RE.test(id) && stillHeld(id)).reverse() : [];
  } catch {
    return [];
  }
}

/** True when this browser once had more ids to remember than it keeps. */
export function sentDropped(): boolean {
  try {
    return localStorage.getItem(SENT_DROPPED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSent(session: string) {
  const ids = sentSessions().reverse();
  if (ids.at(-1) === session) return;
  const all = [...ids.filter((id) => id !== session), session];
  try {
    if (all.length > SENT_MAX) localStorage.setItem(SENT_DROPPED_KEY, "1");
    localStorage.setItem(SENT_KEY, JSON.stringify(all.slice(-SENT_MAX)));
  } catch {
    /* blocked: the page can still show this browser's own copy */
  }
}

function chunks(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += DEMO_MAX_IDS) out.push(ids.slice(i, i + DEMO_MAX_IDS));
  return out;
}

export interface ServerHistory {
  sessions: BrowserHistory;
  /** Events the server holds for each session asked about. */
  counts: Record<string, number>;
}

/** The demo server's copy of these sessions (at most DEMO_MAX_IDS), or null when it could not be asked. */
export async function fetchServerHistory(ids: string[]): Promise<ServerHistory | null> {
  const out: ServerHistory = { sessions: {}, counts: {} };
  const wanted = ids.filter((id) => DEMO_SESSION_RE.test(id)).slice(0, DEMO_MAX_IDS);
  if (!wanted.length) return out;
  try {
    const res = await send("POST", JSON.stringify({ read: wanted }));
    if (!res.ok) return null;
    const got = (await res.json()) as { sessions?: BrowserHistory; counts?: Record<string, unknown> };
    for (const [id, events] of Object.entries(got.sessions ?? {})) if (DEMO_SESSION_RE.test(id) && Array.isArray(events)) out.sessions[id] = events;
    for (const [id, n] of Object.entries(got.counts ?? {})) if (DEMO_SESSION_RE.test(id) && typeof n === "number") out.counts[id] = n;
    return out;
  } catch {
    return null;
  }
}

/** Delete these sessions from the demo's server. True when every request was answered. */
export async function clearServerHistory(ids: string[]): Promise<boolean> {
  let ok = true;
  for (const batch of chunks([...new Set(ids.filter((id) => DEMO_SESSION_RE.test(id)))])) {
    try {
      const res = await send("DELETE", JSON.stringify({ sessions: batch }));
      if (!res.ok) ok = false;
    } catch {
      ok = false;
    }
  }
  if (ok) {
    try {
      localStorage.removeItem(SENT_KEY);
      localStorage.removeItem(SENT_DROPPED_KEY);
    } catch {
      /* nothing to forget */
    }
  }
  return ok;
}

export type BrowserHistory = Record<string, ActivityEvent[]>;

export function readBrowserHistory(): BrowserHistory {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const parsed = raw ? (JSON.parse(raw) as { sessions?: BrowserHistory }) : null;
    const sessions = parsed?.sessions;
    if (!sessions || typeof sessions !== "object") return {};
    const out: BrowserHistory = {};
    for (const [id, events] of Object.entries(sessions)) if (SESSION_RE.test(id) && Array.isArray(events)) out[id] = events;
    return out;
  } catch {
    return {};
  }
}

export function clearBrowserHistory() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* nothing to clear */
  }
}

function keepInBrowser(session: string, event: ActivityEvent) {
  if (JSON.stringify(event).length > MAX_EVENT_BYTES) return;
  const sessions = readBrowserHistory();
  sessions[session] = [...(sessions[session] ?? []), event].slice(-DEMO_EVENTS);
  // The newest sessions only: session ids sort by their start time.
  const keep = Object.keys(sessions).sort().slice(-DEMO_SESSIONS);
  const out: BrowserHistory = {};
  for (const id of keep) out[id] = sessions[id];
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify({ v: 1, sessions: out }));
  } catch {
    /* storage full or blocked; the history page says what it can */
  }
}
