import "server-only";

import { DEMO } from "../mode";
import type { Db, Row } from "./types";

// The demo's database: Neon serverless Postgres over HTTPS, through DATABASE_URL, which
// the Vercel Marketplace sets on the demo's project. Every query is one HTTPS request
// with nothing kept open, which suits short-lived server functions.
//
// Only the demo may come here. This machine's folders never go to a server, so local
// mode refuses before any client exists, whatever variables happen to be set.

const TIMEOUT_MS = 15_000;

export async function openNeon(): Promise<Db> {
  if (!DEMO) throw new Error("local mode never connects to Neon: this machine's data stays on this machine");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const signal = () => ({ fetchOptions: { signal: AbortSignal.timeout(TIMEOUT_MS) } });
  return {
    kind: "neon",
    label: "Neon Postgres",
    async query<T extends Row = Row>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params, signal())) as T[];
    },
    async batch(statements, options) {
      const queries = statements.map((s) => sql.query(s.text, s.params ?? []));
      const opts = options?.readOnly ? { ...signal(), isolationLevel: "RepeatableRead" as const, readOnly: true } : signal();
      return (await sql.transaction(queries, opts)) as Row[][];
    },
    async close() {
      /* nothing is held open between queries */
    },
  };
}
