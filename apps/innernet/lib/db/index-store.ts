import "server-only";

import { demoIndexProblems } from "../demo-check";
import type { IndexMeta, Page, SiteIndex } from "../types";
import { epochMs, jsonParam, noteChurn } from "./schema";
import type { Db } from "./types";

// The index in the database: its meta and disambiguation as two kv rows, its pages as
// one row each in their own order. Storing is one transaction of four statements, the
// pages sent once as a JSON array and spread by jsonb_array_elements, so 5,000 pages are
// one round trip rather than 5,000. Rows that did not change are left alone, a page that
// only moved keeps its stored data as it is, and pages gone from the index are deleted.
// Loading reads the three back in one snapshot.
//
// Neon takes only a demo index that passes the demo's leak checks, whoever asks: this
// machine's index never reaches a server, even through a command run in the wrong shell.

export interface StoredIndexInfo {
  meta: IndexMeta;
  storedAt: number; // ms since 1970: when the meta row was last written
}

/** What the database holds, by its meta alone (cheap), or null when it holds no index. */
export async function storedIndexInfo(db: Db): Promise<StoredIndexInfo | null> {
  const rows = await db.query<{ value: IndexMeta | null; at: number }>(`SELECT value, ${epochMs("updated_at")} AS at FROM kv WHERE key = 'index.meta'`);
  const meta = rows[0]?.value;
  return meta && typeof meta.generatedAt === "string" ? { meta, storedAt: Number(rows[0].at) } : null;
}

/** Store an index in one transaction. Returns how many page rows were written and deleted. */
export async function storeIndex(db: Db, index: SiteIndex): Promise<{ written: number; deleted: number }> {
  if (db.kind === "neon") {
    const problems = demoIndexProblems(index);
    if (problems.length) throw new Error(`the demo's database takes only a public demo index (${problems[0]})`);
  }
  const slugs = index.pages.map((p) => p.slug);
  const [, , written, deleted] = await db.batch([
    {
      text: "INSERT INTO kv (key, value, updated_at) VALUES ('index.meta', $1::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      params: [jsonParam(index.meta)],
    },
    {
      text:
        "INSERT INTO kv (key, value, updated_at) VALUES ('index.disambiguation', $1::jsonb, now()) " +
        "ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE kv.value IS DISTINCT FROM excluded.value",
      params: [jsonParam(index.disambiguation ?? {})],
    },
    {
      text:
        "INSERT INTO pages (slug, pos, data, updated_at) " +
        "SELECT e->>'slug', (n - 1)::int, e, now() FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS x(e, n) " +
        // A page that only moved keeps its stored data, so its large value is not written again.
        "ON CONFLICT (slug) DO UPDATE SET pos = excluded.pos, updated_at = excluded.updated_at, " +
        "data = CASE WHEN pages.data IS DISTINCT FROM excluded.data THEN excluded.data ELSE pages.data END " +
        "WHERE pages.data IS DISTINCT FROM excluded.data OR pages.pos IS DISTINCT FROM excluded.pos RETURNING slug",
      params: [jsonParam(index.pages)],
    },
    {
      text: "DELETE FROM pages WHERE slug NOT IN (SELECT jsonb_array_elements_text($1::jsonb)) RETURNING slug",
      params: [jsonParam(slugs)],
    },
  ]);
  await noteChurn(db, "pages", written.length + deleted.length, written.length + deleted.length > 100);
  return { written: written.length, deleted: deleted.length };
}

/** The whole stored index, or null when there is none (or it does not hang together). */
export async function loadIndex(db: Db): Promise<SiteIndex | null> {
  const [metaRows, disRows, pageRows] = await db.batch(
    [
      { text: "SELECT value FROM kv WHERE key = 'index.meta'" },
      { text: "SELECT value FROM kv WHERE key = 'index.disambiguation'" },
      { text: "SELECT data FROM pages ORDER BY pos, slug" },
    ],
    { readOnly: true },
  );
  const meta = metaRows[0]?.value as IndexMeta | undefined;
  if (!meta || typeof meta.generatedAt !== "string") return null;
  const pages = pageRows.map((r) => r.data as Page);
  // A half-written index is never served: the pages must be the ones the meta counted.
  if (typeof meta.counts?.pages === "number" && meta.counts.pages !== pages.length) return null;
  const disambiguation = (disRows[0]?.value ?? {}) as SiteIndex["disambiguation"];
  return { meta, pages, disambiguation };
}

/** How many pages the database holds. */
export async function storedPageCount(db: Db): Promise<number> {
  const rows = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM pages");
  return Number(rows[0]?.n ?? 0);
}
