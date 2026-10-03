import { after } from "next/server";
import { appendEvent } from "@/lib/activity";
import { APP, DEMO_SESSION_RE, MAX_DEMO_BODY, MAX_EVENT_BYTES, SESSION_RE, clean, demoPath, sessionStart, sitePath } from "@/components/activity/shared";
import { demoKeepsHistory, getDb } from "@/lib/db";
import { addVisit, forgetVisits, MAX_IDS, readVisits, RETENTION_DAYS } from "@/lib/db/demo-history";
import { ingestSession } from "@/lib/db/ingest";
import { errorText, sayOnce } from "@/lib/db/log";
import { DEMO } from "@/lib/mode";
import { readCapped, sameOrigin } from "@/lib/same-origin";

// Where the history is written, and on the demo read back and cleared. Only Innernet's
// own pages may call it (lib/same-origin.ts), and every call is a small JSON body.
//
//   POST    {session, kind, url, ...}  one event from the recorder
//           (components/activity/recorder.tsx). On this machine it is appended to
//           <session>/innernet.jsonl, the format every app shares, and once the answer
//           is sent that session's files are read into the database (lib/db/ingest.ts).
//           On the demo with a database it is stored in Neon, stamped with the server's
//           time (lib/db/demo-history.ts).
//   POST    {read: [ids]}  the demo only: those sessions' events, for the visitor's own
//           history page, which knows its ids from localStorage. Nothing lists sessions.
//   DELETE  {sessions: [ids]}  the demo only: forget those sessions (the Clear button).
//
// Session ids travel only in bodies, never in an address, so no request log holds the
// key to anyone's history. On the demo this is a public endpoint, so it takes little and
// keeps less: a JSON body under 2 KB, four kinds of event, one of the demo's own pages
// (demoPath, in components/activity/shared.ts, drops any other query), short printable
// text, a session id of the exact shape the demo's recorder makes, and the caps in
// lib/db/demo-history.ts.
// No IP address, user agent, cookie or header is stored. A demo without a database
// refuses all of it with a 404, as it always has: there the history stays in the browser.

export const dynamic = "force-dynamic";

const KINDS = new Set(["visit", "search", "back", "forward"]);
const VIA = new Set(["buttons", "browser"]);
const NOT_HERE = "The demo keeps history in your browser, never on the server.";
const ON_THIS_MACHINE = "On this machine the history page reads the history itself.";

const headers = { "Cache-Control": "no-store" };
const refuse = (status: number, error: string, extra: Record<string, string> = {}) => Response.json({ error }, { status, headers: { ...headers, ...extra } });

/** A session the recorder could have made lately: its id's start no more than a day ahead
 * of the server's clock, and within the demo's retention. */
function recentSession(id: string): boolean {
  const t = Date.parse(sessionStart(id));
  return Number.isFinite(t) && t <= Date.now() + 864e5 && t >= Date.now() - (RETENTION_DAYS + 1) * 864e5;
}

/** One to MAX_IDS ids, every one of the demo's shape, or null. */
function idList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value)];
  return ids.length && ids.length <= MAX_IDS && ids.every((id) => typeof id === "string" && DEMO_SESSION_RE.test(id)) ? (ids as string[]) : null;
}

/** The same-origin, JSON and size checks every call passes, then its body as an object. */
async function readBody(req: Request, deny: string): Promise<Record<string, unknown> | Response> {
  if (!sameOrigin(req)) return refuse(403, deny);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return refuse(415, "Send JSON.");
  const text = await readCapped(req, DEMO ? MAX_DEMO_BODY : MAX_EVENT_BYTES);
  if (text === null) return refuse(413, "Too large.");
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    return refuse(400, "Bad JSON.");
  }
}

export async function POST(req: Request) {
  if (DEMO && !demoKeepsHistory()) return refuse(404, NOT_HERE);
  const body = await readBody(req, "History is written only by Innernet's own pages.");
  if (body instanceof Response) return body;
  if ("read" in body) return read(body.read);

  const session = typeof body.session === "string" ? body.session : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (DEMO ? !DEMO_SESSION_RE.test(session) || !recentSession(session) : !SESSION_RE.test(session)) return refuse(400, "Bad session id.");
  if (!KINDS.has(kind)) return refuse(400, "Bad kind.");
  const url = DEMO ? demoPath(body.url) : sitePath(body.url);
  if (!url) return refuse(400, "Bad url.");

  // Only the fields Innernet records, each short and printable. The time is the server's.
  const fields: Record<string, unknown> = { kind };
  if (kind === "search") fields.q = clean(body.q, DEMO ? 120 : 300);
  fields.url = url;
  if (kind !== "search") fields.title = clean(body.title, DEMO ? 120 : 200);
  if (typeof body.via === "string" && VIA.has(body.via)) fields.via = body.via;

  if (!DEMO) {
    const result = appendEvent(session, APP, fields);
    if (!result.ok) return refuse(result.status, result.error);
    after(() => ingestSession(session));
    return new Response(null, { status: 204 });
  }

  const db = await getDb();
  if (!db) return refuse(503, "The history could not be stored just now; your browser still has it.");
  try {
    const added = await addVisit(db, session, fields);
    if (added === "session-full") return refuse(429, "This session holds as many events as the demo keeps; your browser still has the rest.");
    if (added === "day-full") return refuse(429, "The demo has stored all the history it takes today; your browser still has it.");
    if (added === "store-full") return refuse(429, "The demo's database holds all the history it keeps just now; your browser still has it.");
    return new Response(null, { status: 204 });
  } catch (err) {
    sayOnce("history:add", `could not store a visitor's event (${errorText(err)})`);
    return refuse(503, "The history could not be stored just now; your browser still has it.");
  }
}

/** POST {read: [ids]}: the demo's copy of the visitor's own sessions. */
async function read(value: unknown): Promise<Response> {
  if (!DEMO) return refuse(404, ON_THIS_MACHINE);
  const ids = idList(value);
  if (!ids) return refuse(400, `Name one to ${MAX_IDS} sessions.`);
  const db = await getDb();
  if (!db) return refuse(503, "The history could not be read just now.");
  try {
    return Response.json({ ...(await readVisits(db, ids)), retentionDays: RETENTION_DAYS }, { headers });
  } catch (err) {
    sayOnce("history:read", `could not read visitor history (${errorText(err)})`);
    return refuse(503, "The history could not be read just now.");
  }
}

/** Reading is a POST, so that session ids never sit in an address. */
export async function GET() {
  if (!DEMO) return refuse(404, ON_THIS_MACHINE);
  if (!demoKeepsHistory()) return refuse(404, NOT_HERE);
  return refuse(405, 'Ask for your own sessions with a POST of {"read": [ids]}.', { Allow: "POST, DELETE" });
}

export async function DELETE(req: Request) {
  if (!DEMO) return refuse(404, "On this machine, delete a session's folder to forget it.");
  if (!demoKeepsHistory()) return refuse(404, NOT_HERE);
  const body = await readBody(req, "History is cleared only by Innernet's own pages.");
  if (body instanceof Response) return body;
  const ids = idList(body.sessions);
  if (!ids) return refuse(400, `Name one to ${MAX_IDS} sessions.`);
  const db = await getDb();
  if (!db) return refuse(503, "The history could not be cleared just now.");
  try {
    return Response.json({ forgotten: await forgetVisits(db, ids) }, { headers });
  } catch (err) {
    sayOnce("history:delete", `could not clear visitor history (${errorText(err)})`);
    return refuse(503, "The history could not be cleared just now.");
  }
}
