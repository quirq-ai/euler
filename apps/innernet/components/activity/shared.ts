// The activity history format, shared by the server (lib/activity.ts), the route that
// writes it (app/api/activity/route.ts) and the browser (the recorder, the demo's
// localStorage copy, the history page). Plain functions only: nothing here touches the
// file system or the window.
//
//   <history dir>/2026-10-03T05-12-07Z_k3f9a2/innernet.jsonl
//                                             <any-app>.jsonl
//
// One folder per session (its UTC start time, then a short random id), one JSON Lines
// file per app, one event per line: {"at":"<ISO time>","app":"<name>","kind":"<verb>", ...}.

/** A session folder's name: its start time (UTC, sortable) and a short id. */
export const SESSION_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_[a-z0-9]{4,16}$/;

/** A session id the public demo's server takes: the same shape, with at least 12 random
 * characters, so the hash it keeps in place of the id can never be guessed back. */
export const DEMO_SESSION_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z_[a-z0-9]{12,16}$/;

/** Days the public demo keeps a visitor's events (lib/db/demo-history.ts). */
export const DEMO_RETENTION_DAYS = 30;

/** Session ids one request to the demo may name, to read them or to clear them. */
export const DEMO_MAX_IDS = 50;

/** An app's file name, without .jsonl: lowercase letters, digits, - and _. No dots, so no "..". */
export const APP_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** What happened: a short lowercase verb such as visit, search, back, forward. */
export const KIND_RE = /^[a-z][a-z0-9_-]{0,31}$/;

/** The longest line, in bytes, that is written or read. */
export const MAX_EVENT_BYTES = 4096;

/** The largest event the public demo accepts from a browser, in bytes (app/api/activity/route.ts). */
export const MAX_DEMO_BODY = 2048;

/** Innernet's own name in the history. */
export const APP = "innernet";

export interface ActivityEvent {
  at: string; // ISO time
  app: string;
  kind: string;
  url?: string;
  title?: string;
  q?: string;
  [field: string]: unknown;
}

export interface Session {
  id: string;
  start: string; // ISO: the earlier of the folder's start time and its first event
  end: string; // ISO: its last event
  events: ActivityEvent[]; // every app's events, oldest first
  total: number; // events in the files, which may be more than `events` holds
  apps: string[]; // innernet first, then the rest A to Z
}

const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** "2026-10-03T05-12-07Z_k3f9a2", from the time a session starts. The demo asks for 12
 * random characters rather than 6 (DEMO_SESSION_RE). */
export function newSessionId(now = new Date(), chars = 6): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-") + "Z";
  const bytes = new Uint8Array(chars);
  globalThis.crypto.getRandomValues(bytes);
  return `${stamp}_${Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("")}`;
}

/** The start time written into a session id, as ISO. */
export function sessionStart(id: string): string {
  const [date, time] = id.slice(0, 20).split("T");
  return `${date}T${time.slice(0, 8).replace(/-/g, ":")}Z`;
}

/** The years a time may fall in, 1 to 9999: what Postgres and an ISO date can both hold. */
const FIRST_MS = Date.parse("0001-01-01T00:00:00Z");
const LAST_MS = Date.parse("+010000-01-01T00:00:00Z");

/** A line read back is kept only if it has a real time (in years 1 to 9999) and a kind. */
export function validEvent(v: unknown): v is ActivityEvent {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const e = v as Record<string, unknown>;
  if (typeof e.at !== "string") return false;
  const t = Date.parse(e.at);
  return t >= FIRST_MS && t < LAST_MS && typeof e.kind === "string" && e.kind.length > 0 && e.kind.length <= 64;
}

/** Innernet first, then the other apps A to Z. */
export function sortApps(apps: Iterable<string>): string[] {
  return [...new Set(apps)].sort((a, b) => (a === APP ? -1 : b === APP ? 1 : a.localeCompare(b)));
}

/** Gather one session's events, from however many apps, into time order. */
export function toSession(id: string, events: ActivityEvent[], total = events.length, apps?: string[]): Session {
  const sorted = events
    .map((e, i) => ({ e, i, t: Date.parse(e.at) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.e);
  const begun = sessionStart(id);
  const first = sorted[0]?.at;
  const start = first && Date.parse(first) < Date.parse(begun) ? first : begun;
  return {
    id,
    start,
    end: sorted.at(-1)?.at ?? start,
    events: sorted,
    total,
    apps: sortApps(apps ?? sorted.map((e) => e.app)),
  };
}

const FIXED: Record<string, string> = { "/": "Home", "/wiki": "Innerpedia", "/activity": "History", "/guide": "Field guide" };

/** A short name for one of Innernet's pages: "Home", "Innerpedia", an article's name, a search in quotes. */
export function pageLabel(url: string | undefined, title?: string, q?: string): string | undefined {
  if (q) return `“${q}”`;
  const fixed = url ? FIXED[url.split(/[?#]/)[0]] : undefined;
  return fixed ?? (title?.replace(/\s·\s(Innerpedia|Innernet)$/, "").trim() || url);
}

/** A link only for this app's own paths and ordinary web addresses: never javascript: and the like. */
export function safeHref(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 2048) return null;
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : null;
}

/** Control and formatting characters out, length capped: what a browser may send is kept short and printable. */
export function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[\u0000-\u001f\u007f\s]+/g, " ").replace(/\p{Cf}/gu, "").trim();
  return s ? s.slice(0, max).toWellFormed() : undefined;
}

/** One of this app's own paths, as the recorder sends it: one leading slash (never two, never
 * a backslash), no spaces, control or formatting characters, and at most `max` characters. */
export function sitePath(url: unknown, max = 2048): string | null {
  if (typeof url !== "string" || url.length > max) return null;
  return /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(url) && !/\p{Cf}/u.test(url) ? url : null;
}

/** The pages a demo event may name: the home page, search, the history and Innerpedia. */
const DEMO_ROUTE = /^\/(?:|search|activity|guide|wiki|wiki\/[^/]+)$/;

/** The longest path the demo keeps, in (ASCII) characters. */
export const DEMO_PATH_MAX = 400;

/**
 * A path as the public demo keeps it: one of its own pages, percent-encoded ASCII, with
 * no query at all except the search's own q, t and p. Whatever else an address carried
 * (a campaign tag, another site's click id) is dropped here, in the browser and again on
 * the server. Null for anything else, which the demo does not keep.
 */
export function demoPath(raw: unknown): string | null {
  const url = sitePath(raw);
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url, "https://demo.invalid");
  } catch {
    return null;
  }
  if (u.origin !== "https://demo.invalid" || !DEMO_ROUTE.test(u.pathname)) return null;
  let out = u.pathname;
  if (u.pathname === "/search") {
    const keep = new URLSearchParams();
    const q = u.searchParams.get("q")?.trim().slice(0, 120);
    const t = u.searchParams.get("t");
    const p = u.searchParams.get("p");
    if (q) keep.set("q", q);
    if (t && /^[a-z]{1,16}$/.test(t)) keep.set("t", t);
    if (p && /^[1-9]\d{0,3}$/.test(p)) keep.set("p", p);
    const query = keep.toString();
    if (query) out += `?${query}`;
  }
  return out.length <= DEMO_PATH_MAX ? out : null;
}
