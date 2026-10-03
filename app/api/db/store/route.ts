import { getIndex } from "@/lib/data";
import { dbState, getDb } from "@/lib/db";
import { rememberStore, storeLocal, type LastStore } from "@/lib/db/ingest";
import { errorText } from "@/lib/db/log";
import { DEMO } from "@/lib/mode";
import { sameOrigin } from "@/lib/same-origin";

// Store now, from the history page: what `pnpm db:store` does (lib/db/ingest.ts,
// storeLocal), run by the server, which already has this machine's database open. The
// index file is stored if the database holds a different one, and every history folder
// is read in. This machine only, from its own pages only; the demo has no such door.
//
// The page sends a plain form, so it works without JavaScript: a browser gets a 303 back
// to the page, which reports the result. Anything else gets the result as JSON.

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (DEMO) return Response.json({ error: "The demo stores nothing on request." }, { status: 404, headers });
  if (!sameOrigin(req)) return Response.json({ error: "Only Innernet's own pages may ask." }, { status: 403, headers });

  let last: LastStore;
  const db = await getDb();
  if (!db) last = { at: new Date().toISOString(), error: dbState().note };
  else {
    try {
      const loaded = getIndex();
      last = { at: new Date().toISOString(), summary: await storeLocal(db, loaded.source === "file" ? loaded.index : null) };
    } catch (err) {
      last = { at: new Date().toISOString(), error: `The database in ${db.label} did not finish (${errorText(err)}). The files are as they were.` };
    }
  }
  rememberStore(last);

  if (req.headers.get("sec-fetch-mode") === "navigate" || (req.headers.get("accept") ?? "").includes("text/html")) {
    return new Response(null, { status: 303, headers: { ...headers, Location: "/activity#database" } });
  }
  return Response.json(last, { status: last.error ? 503 : 200, headers });
}
