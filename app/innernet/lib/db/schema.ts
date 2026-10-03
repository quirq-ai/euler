import "server-only";

import type { Db, Statement } from "./types";

// The schema, the same on both databases, made idempotently once per process.
//
//   kv        small named values: the index's meta and disambiguation, the schema version
//   pages     one row per page of the index, in the index's own order (pos)
//   activity  one row per line of the history, keyed by a hash of where the line came
//             from and the line itself, so storing the same line twice keeps one row;
//             `line` is that exact text, so loading writes back what was read (the
//             demo's visitor rows leave it empty and keep the event once, in `data`)
//
// A database written by a newer Innernet (a higher version) is left alone.

export const SCHEMA_VERSION = 1;

const CREATE: Statement[] = [
  { text: "CREATE TABLE IF NOT EXISTS kv (key text PRIMARY KEY, value jsonb, updated_at timestamptz NOT NULL DEFAULT now())" },
  {
    text: "CREATE TABLE IF NOT EXISTS pages (slug text PRIMARY KEY, pos integer NOT NULL DEFAULT 0, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())",
  },
  {
    text:
      "CREATE TABLE IF NOT EXISTS activity (uid text PRIMARY KEY, session text NOT NULL, app text NOT NULL, at timestamptz NOT NULL, " +
      "kind text NOT NULL, data jsonb NOT NULL, line text NOT NULL)",
  },
  { text: "CREATE INDEX IF NOT EXISTS activity_session_at ON activity (session, at)" },
  { text: "CREATE INDEX IF NOT EXISTS activity_at ON activity (at)" },
  { text: "INSERT INTO kv (key, value) VALUES ('schema.version', $1::jsonb) ON CONFLICT (key) DO NOTHING", params: [String(SCHEMA_VERSION)] },
  { text: "SELECT value FROM kv WHERE key = 'schema.version'" },
];

/**
 * A value as a JSON parameter for `$1::jsonb`. Postgres keeps no NUL character and no
 * half of a surrogate pair in jsonb, in a value or in a field's name, and one such string
 * would sink a whole statement, so they are dropped (or made U+FFFD) on the rare value
 * that has them. JSON.stringify writes a NUL as \u0000 and half a pair as \udXXX (a whole
 * pair it writes as itself), so mending the text is exact, and works at any depth. An
 * escaped backslash before them (\\u0000) is plain text, and stays.
 */
export function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null).replace(/(?<!\\)((?:\\\\)*)\\u(0000|d[89a-f][0-9a-f]{2})/gi, (_m, slashes: string, code: string) =>
    code === "0000" ? slashes : `${slashes}\\ufffd`,
  );
}

/** A timestamptz column as milliseconds since 1970, a plain number on both drivers. */
export const epochMs = (column: string) => `(extract(epoch from ${column}) * 1000)::float8`;

type Table = "kv" | "pages" | "activity";

const G = globalThis as typeof globalThis & { __innernetChurn?: Record<Table, number> };
const churn = (G.__innernetChurn ??= { kv: 0, pages: 0, activity: 0 });

/** Rows updated or deleted before a table is vacuumed. */
const CHURN_LIMIT = 500;

/**
 * Note rows that a statement updated or deleted, and tidy up once enough have piled up.
 * PGlite runs Postgres single-user, with no autovacuum and no checkpointer, so nothing
 * reuses the space an old row version holds, or recycles the write-ahead log, unless
 * something asks; without this the folder would grow by about an index's size with
 * every re-index. So: VACUUM the table, then CHECKPOINT, which lets go of the log
 * written so far (lib/db/pglite.ts keeps it under 64 MB). Neon does both itself. Never
 * throws: a tidy that fails is tried again on the next write.
 */
export async function noteChurn(db: Db, table: Table, rows: number, now = false): Promise<void> {
  if (db.kind !== "pglite" || rows <= 0) return;
  churn[table] += rows;
  if (!now && churn[table] < CHURN_LIMIT) return;
  churn[table] = 0;
  try {
    await db.query(`VACUUM ${table}`);
    await db.query("CHECKPOINT");
  } catch {
    churn[table] = CHURN_LIMIT;
  }
}

/** Make the tables if they are not there, and check the version. Throws on a newer schema. */
export async function bootstrap(db: Db): Promise<void> {
  const results = await db.batch(CREATE);
  const version = Number(results.at(-1)?.[0]?.value);
  if (Number.isFinite(version) && version > SCHEMA_VERSION) {
    throw new Error(`the database was written by a newer Innernet (schema ${version}, this one knows ${SCHEMA_VERSION})`);
  }
}
