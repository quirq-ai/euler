// The database contract, shared by both drivers (lib/db/pglite.ts on this machine,
// lib/db/neon.ts on the demo) and everything that talks to them. Same SQL for both: no
// ORM, just text with $1 placeholders and plain rows back.
//
// Values travel as text, numbers or booleans. JSON goes in as a string cast in the SQL
// ($1::jsonb) and comes back parsed. Times come back as numbers only when the SQL says so
// (see `epochMs` in lib/db/schema.ts), because the two drivers disagree on Date objects.

export type DbKind = "pglite" | "neon";

export type Row = Record<string, unknown>;

export interface Statement {
  text: string;
  params?: unknown[];
}

export interface Db {
  kind: DbKind;
  /** Where the data lives, for people: "~/.innernet/db" or "Neon Postgres". Never a secret. */
  label: string;
  /** One statement, its rows. */
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Several statements in one transaction, all or nothing: each statement's rows, in order.
   * `readOnly` asks for one consistent snapshot across them (Neon runs it REPEATABLE READ). */
  batch(statements: Statement[], options?: { readOnly?: boolean }): Promise<Row[][]>;
  /** Let go of the database: PGlite closes and gives up its folder; Neon has nothing to close. */
  close(): Promise<void>;
}

/** Where a process stands with its database, for logs, the CLI and /activity. */
export type DbStateName =
  | "idle" // not asked for yet
  | "opening"
  | "ready"
  | "off" // INNERNET_DB=off, or no DATABASE_URL on the demo
  | "building" // `next build`: pages are never stored or loaded while building
  | "locked" // another process has this machine's database open
  | "failed"; // it would not open, or a query failed while opening

export interface LockHolder {
  pid: number;
  by: string; // "next dev", "pnpm db:store"
  since: string; // ISO
}

export interface DbState {
  state: DbStateName;
  kind: DbKind | null;
  label: string;
  /** One plain sentence about the state, never holding a secret. */
  note: string;
  holder?: LockHolder;
}
