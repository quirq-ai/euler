// Innernet's database from the terminal (lib/db).
//
//   pnpm db:status            where this machine's database lives, its size, what it holds
//   pnpm db:store             store data/index.json, and bring the history up to date with
//                             its folders (the history page's Store now does the same)
//   pnpm db:load              write the stored index and history back out as files
//
//   pnpm db:status --demo     the same three for the demo's Neon database, which holds
//   pnpm db:store --demo      data/demo/index.json and nothing else; storing runs the
//   pnpm db:load --demo       demo's leak checks first, loading writes data/demo/index.json
//
// --demo reads DATABASE_URL from the environment and never from a file of its own. Load
// the Neon file for that one command:  set -a; . ./.env.neon.local; set +a; pnpm db:store --demo
// --force lets db:load replace an index file newer than the stored copy.
//
// This machine's database is PGlite in a folder (~/.innernet/db, or INNERNET_DB_DIR) that
// one process opens at a time. While the server runs it has the folder, and stores each
// new index itself; stop it to load.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith("-")) ?? "status";
const demo = args.includes("--demo");
const force = args.includes("--force");

const USAGE = "Usage: pnpm db:status | db:store | db:load  [--demo] [--force]";
const NEON_HINT = "set -a; . ./.env.neon.local; set +a; pnpm db:" + command + " --demo";

/** Stop before anything is open. */
function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Refuse once the database may be open: main() closes it, then says why. */
class Refusal extends Error {}
function fail(message: string): never {
  throw new Refusal(message);
}

if (!["status", "store", "load"].includes(command)) stop(USAGE);
// Any of the three switches lib/mode.ts reads as the demo, so none can turn this
// machine's command into one against Neon.
const demoVars = ["INNERNET_DEMO", "INNERNET_DEMO_BUILD", "VERCEL"].filter((name) => process.env[name] === "1");
if (!demo && demoVars.length) {
  stop(`${demoVars.join(" and ")} ${demoVars.length === 1 ? "is" : "are"} set in this shell. Pass --demo to work on the demo's database, or unset it for this machine's.`);
}
// lib/mode.ts reads these as it loads, so they are settled before anything is imported.
process.env.INNERNET_DEMO = demo ? "1" : "";
process.env.INNERNET_DEMO_BUILD = "";
if (!demo) {
  // This machine's commands never see a connection string, whatever the shell holds.
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_UNPOOLED;
}
if (demo && !process.env.DATABASE_URL) {
  stop(`--demo needs DATABASE_URL in the environment. Run it with the Neon file loaded:\n  ${NEON_HINT}`);
}

/** This machine's own names, which must never reach the demo: the home folder (and where
 * it really lives), the user, this checkout and the demo's clone cache. Short ones would
 * match everywhere and are left to the path shapes lib/demo-check.ts refuses anyway. */
function machineNames(): string[] {
  const real = (p: string) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return p;
    }
  };
  let user = "";
  try {
    user = os.userInfo().username;
  } catch {
    /* no user name to give */
  }
  const home = os.homedir();
  const names = [home, real(home), projectDir, real(projectDir), path.join(projectDir, ".demo-cache"), ".demo-cache", "__dot__", user];
  return [...new Set(names)].filter((n) => n.length >= 4 && n !== "/");
}

/** Write a file whole or not at all: a temporary file beside it, then a rename. */
function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function readIndexFile(file: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function main() {
  const { closeDb, dbState, getDb, setDbOwner } = await import("../lib/db");
  const { quietDb } = await import("../lib/db/log");
  const { loadIndex, storedIndexInfo, storedPageCount, storeIndex } = await import("../lib/db/index-store");
  const { activityCounts, loadActivity, writeHistoryLines } = await import("../lib/db/activity");
  const { storeLocal } = await import("../lib/db/ingest");
  const { folderBytes, lockHolder, resolveDbDir } = await import("../lib/db/pglite");
  const { demoIndexProblems } = await import("../lib/demo-check");
  const { HISTORY_DIR, historyLabel } = await import("../lib/activity");
  const { normalizeIndex } = await import("../lib/normalize");
  const { bytes, num, plural, timeAgo } = await import("../lib/format");
  type SiteIndex = import("../lib/types").SiteIndex;

  quietDb();
  setDbOwner(`pnpm db:${command}${demo ? " --demo" : ""}`);
  const when = (iso: string | null | undefined) => (iso ? `${iso.replace("T", " ").slice(0, 16)} UTC (${timeAgo(iso)})` : "never");
  const indexFile = path.join(projectDir, demo ? "data/demo/index.json" : "data/index.json");
  const rel = path.relative(projectDir, indexFile);

  const db = await getDb();
  try {
    // ------------------------------------------------ no database to open
    if (!db) {
      const st = dbState();
      if (demo) fail(`Could not reach the demo's database: ${st.note}`);
      const dir = resolveDbDir();
      const holder = st.state === "locked" ? (st.holder ?? lockHolder(dir)) : null;
      if (command === "status" && (holder || st.state === "off")) {
        console.log(`Innernet database (PGlite, this machine)`);
        console.log(`  where     ${st.label}${st.state === "off" ? "" : `, ${bytes(folderBytes(dir))} on disk`}`);
        if (holder) {
          console.log(`  open in   ${holder.by} (pid ${holder.pid}) since ${when(holder.since)}`);
          console.log(`            One process at a time may open it. The server stores each new index`);
          console.log(`            itself; stop it to see the counts here, or read them on /activity.`);
          console.log(`            With no Innernet running, the lock is stale: delete ${path.join(st.label, "owner.lock")}.`);
        } else console.log(`  state     ${st.note}`);
        return;
      }
      if (holder) {
        fail(
          `The database in ${st.label} is open in ${holder.by} (pid ${holder.pid}), and one process at a time may have it.\n` +
            (command === "store"
              ? "The server already stores the index on every reload. Stop it to store the history as well."
              : "The server already stores the index on every reload. Stop it to load.") +
            `\nWith no Innernet running, the lock is stale: delete ${path.join(st.label, "owner.lock")}.`,
        );
      }
      fail(st.note);
    }

    // The database must be the one asked for: PGlite for this machine, Neon for --demo.
    if (db.kind !== (demo ? "neon" : "pglite")) fail(`Stopped: expected ${demo ? "the demo's Neon database" : "this machine's database"}, and opened ${db.label}.`);

    // ------------------------------------------------ status
    if (command === "status") {
      const [info, pages, counts] = await Promise.all([storedIndexInfo(db), storedPageCount(db), activityCounts(db)]);
      let size: string;
      if (demo) {
        const [r] = await db.query<{ n: number }>("SELECT pg_database_size(current_database())::float8 AS n");
        size = `${bytes(Number(r?.n ?? 0))} in the database`;
      } else size = `${bytes(folderBytes(resolveDbDir()))} on disk`;
      console.log(demo ? "Innernet demo database (Neon Postgres, DATABASE_URL)" : "Innernet database (PGlite, this machine)");
      console.log(`  where     ${db.label}, ${size}`);
      console.log(
        info
          ? `  index     ${num(pages)} pages, ${info.meta.demo ? "the demo index" : "this machine's index"} generated ${when(info.meta.generatedAt)}\n            stored ${when(new Date(info.storedAt).toISOString())}`
          : "  index     none stored",
      );
      if (!demo || counts.lines) {
        console.log(
          counts.lines
            ? `  history   ${plural(counts.lines, "line")} in ${plural(counts.sessions, "session")} from ${plural(counts.apps, "app")}, newest ${when(counts.last ? new Date(counts.last).toISOString() : null)}`
            : "  history   none stored",
        );
      }
      const onDisk = readIndexFile(indexFile) as SiteIndex | null;
      const fileAt = onDisk?.meta?.generatedAt;
      console.log(`  file      ${rel} ${fileAt ? `generated ${when(fileAt)}${info && fileAt === info.meta.generatedAt ? ", the same as stored" : ""}` : "is missing"}`);
      return;
    }

    // ------------------------------------------------ store
    if (command === "store") {
      const raw = readIndexFile(indexFile);
      if (!demo) {
        // The same store as the history page's Store now (lib/db/ingest.ts).
        const r = await storeLocal(db, raw ? normalizeIndex(raw as SiteIndex) : null);
        if (r.index.state === "none") console.log(`index     there is no ${rel} to store (pnpm index builds it)`);
        else if (r.index.state === "already") console.log(`index     already stored in ${db.label} (generated ${when(r.index.generatedAt)})`);
        else {
          console.log(`index     stored in ${db.label}: ${num(r.index.pages)} pages (${num(r.index.written)} written, ${num(r.index.deleted)} removed) in ${r.index.ms} ms`);
          console.log(`          generated ${when(r.index.generatedAt)}${r.index.replacing ? `, replacing one generated ${when(r.index.replacing)}` : ""}`);
        }
        const h = r.history;
        console.log(
          `history   ${plural(h.sessions, "session")} and ${plural(h.files, "file")} in ${h.dir}: ${plural(h.read, "changed file")} read, ${num(h.added)} new ${h.added === 1 ? "line" : "lines"}, ${num(h.forgotten)} forgotten`,
        );
        if (h.kept) {
          console.log(`          ${plural(h.kept, "session")} kept for pnpm db:load: ${h.dir} is not the folder the database read before, and they are not in it`);
        }
        if (h.skipped) console.log(`          ${plural(h.skipped, "line")} the database would not take, skipped (the files still hold them)`);
        return;
      }

      if (!raw) fail(`There is no ${rel} to store. pnpm index:demo builds it.`);
      const problems = demoIndexProblems(raw, machineNames());
      if (problems.length) {
        fail(`Refusing to store ${rel} in the demo's database, ${plural(problems.length, "problem")}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
      }
      const index = raw as SiteIndex;
      const stored = await storedIndexInfo(db);
      if (stored?.meta.generatedAt === index.meta.generatedAt && !!stored.meta.demo === !!index.meta.demo) {
        console.log(`index     already stored in ${db.label} (generated ${when(index.meta.generatedAt)})`);
      } else {
        const t = Date.now();
        const r = await storeIndex(db, index);
        console.log(`index     stored in ${db.label}: ${num(index.pages.length)} pages (${num(r.written)} written, ${num(r.deleted)} removed) in ${Date.now() - t} ms`);
        console.log(`          generated ${when(index.meta.generatedAt)}${stored ? `, replacing one generated ${when(stored.meta.generatedAt)}` : ""}`);
      }
      return;
    }

    // ------------------------------------------------ load
    const index = await loadIndex(db);
    if (!index) console.log(`index     ${db.label} holds no index`);
    else {
      if (demo) {
        const problems = demoIndexProblems(index, machineNames());
        if (problems.length) fail(`Refusing to write Neon's index to ${rel}, ${plural(problems.length, "problem")}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
      }
      const onDisk = readIndexFile(indexFile) as SiteIndex | null;
      const fileAt = onDisk?.meta?.generatedAt;
      if (fileAt === index.meta.generatedAt) console.log(`index     ${rel} already matches (generated ${when(fileAt)})`);
      else if (fileAt && Date.parse(fileAt) > Date.parse(index.meta.generatedAt) && !force) {
        console.log(`index     ${rel} is newer (generated ${when(fileAt)}) than the stored copy (${when(index.meta.generatedAt)}); left alone. --force replaces it.`);
      } else {
        writeAtomic(indexFile, JSON.stringify(index));
        console.log(`index     wrote ${rel}: ${num(index.pages.length)} pages, generated ${when(index.meta.generatedAt)}`);
      }
    }
    if (!demo) {
      const lines = await loadActivity(db);
      const r = writeHistoryLines(HISTORY_DIR, lines);
      console.log(
        lines.length
          ? `history   ${plural(lines.length, "stored line")} across ${plural(r.files, "file")}: ${num(r.appended)} written back to ${historyLabel()}, ${num(r.created)} ${r.created === 1 ? "file" : "files"} made`
          : "history   none stored",
      );
    }
  } finally {
    await closeDb();
  }
}

main().catch(async (err) => {
  const { errorText } = await import("../lib/db/log");
  console.error(err instanceof Refusal ? err.message : `Stopped: ${errorText(err)}`);
  process.exitCode = 1;
});
