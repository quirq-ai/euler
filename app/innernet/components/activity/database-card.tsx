import { appPath } from "@/lib/base-path";
import type { LastStore } from "@/lib/db/ingest";
import type { DbStatus } from "@/lib/db/status";
import { bytes, num, plural, timeAgo } from "@/lib/format";

// The history page's small Database card: where the history is kept besides its files
// (or the demo visitor's browser), what the database holds, and the ways to move it.
// Plain markup: Store now is an ordinary form posting to app/api/db/store/route.ts, so
// the card needs no script of its own.

const label = "text-[11px] font-medium uppercase tracking-[0.12em] text-muted";
const fine = "text-[12.5px] leading-[1.55] text-muted";
const code = "mt-2 overflow-x-auto rounded-[10px] border border-line bg-bg-sunk px-3 py-2 font-mono text-[11.5px] leading-[1.7] text-ink-2";
const card = "rounded-2xl border border-line bg-surface/70 px-5 py-5 shadow-[var(--shadow-sm)]";

const STATE: Record<DbStatus["state"], { word: string; on: boolean }> = {
  ready: { word: "Open", on: true },
  opening: { word: "Opening", on: false },
  idle: { word: "Not open yet", on: false },
  off: { word: "Off", on: false },
  building: { word: "Off while building", on: false },
  locked: { word: "In use elsewhere", on: false },
  failed: { word: "Not answering", on: false },
};

function Head({ word, on }: { word: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id="database-title" className={label}>
        Database
      </h2>
      <span className="flex items-center gap-1.5 text-[12px] text-muted">
        <span aria-hidden className={`size-[7px] rounded-full ${on ? "bg-good" : "border border-line-strong"}`} />
        {word}
      </span>
    </div>
  );
}

function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1 text-[12px] text-muted">{n === 1 ? one : many}</dt>
      <dd className="font-display text-[28px] leading-none text-ink tabular-nums">{num(n)}</dd>
    </div>
  );
}

/** What the last Store now did, while it is recent enough to matter. */
function storedNote(last: LastStore | null, now: number): string | null {
  if (!last || now - Date.parse(last.at) > 10 * 60_000) return null;
  const when = timeAgo(last.at, now);
  if (!last.summary) return `Store now, ${when}: ${last.error}`;
  const { index, history } = last.summary;
  const idx = index.state === "stored" ? `the index stored (${num(index.pages)} pages)` : index.state === "already" ? "the index already there" : "no index file to store";
  return `Stored ${when}: ${plural(history.added, "new line")}, ${num(history.forgotten)} forgotten, ${idx}.`;
}

export function DatabaseCard({
  status,
  source,
  last,
  now,
  retentionDays,
}: {
  status: DbStatus;
  source: "database" | "files";
  last: LastStore | null;
  now: number;
  retentionDays: number;
}) {
  const st = STATE[status.state];

  if (status.mode === "demo") {
    return status.kind ? (
      <section id="database" aria-labelledby="database-title" className={card}>
        <Head word="Keeps your history" on />
        <p className="mt-3 font-mono text-[13px] text-ink">Neon Postgres · US East</p>
        <p className={`mt-2 ${fine}`}>
          The pages and searches you open here are kept in it for {retentionDays} days, as well as in this browser: the page&apos;s path (no other part of its
          address), its title or the search words, whether you came by the back and forward buttons, and the server&apos;s time. Never your IP address, user agent,
          cookies or any other header.
        </p>
        <p className={`mt-2 ${fine}`}>
          Each tab makes its own id, the time it opened by your clock and twelve random characters. The database keeps only a hash of it, which tells neither, and
          only a browser holding the id can read the session back or delete it; the Clear button deletes every one this browser sent. Like any database, it can be
          read by the people who run the demo.
        </p>
      </section>
    ) : (
      <section id="database" aria-labelledby="database-title" className={card}>
        <Head word="None" on={false} />
        <p className={`mt-3 ${fine}`}>This demo has no database, so your history stays in this browser alone. The server is sent none of it and keeps none of it.</p>
      </section>
    );
  }

  const ready = status.state === "ready";
  const note = storedNote(last, now);
  return (
    <section id="database" aria-labelledby="database-title" className={card}>
      <Head word={st.word} on={st.on} />
      <p className="mt-3 font-mono text-[13px] text-ink">{status.kind ? status.label : "Files only"}</p>
      <p className={`mt-1 ${fine}`}>
        {ready ? (
          <>PGlite, a Postgres running inside this server on a folder of plain files. Nothing listens on a port, and nothing leaves this machine.</>
        ) : (
          status.note
        )}
      </p>

      {status.activity && (
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
          <Count n={status.activity.lines} one="line" many="lines" />
          <Count n={status.activity.sessions} one="session" many="sessions" />
          <Count n={status.activity.apps} one="app" many="apps" />
        </dl>
      )}

      <ul className={`mt-3 space-y-1 ${fine}`}>
        {status.index && (
          <li>
            The index: {status.index.pages != null ? `${num(status.index.pages)} pages, ` : ""}stored {timeAgo(status.index.storedAt, now)}
          </li>
        )}
        {status.activity?.last && <li>Newest line: {timeAgo(status.activity.last, now)}</li>}
        {!!status.activity?.kept && (
          <li>
            {plural(status.activity.kept, "session")} from a history folder that was lost or replaced, kept for{" "}
            <span className="font-mono text-[11.5px] text-ink-2">pnpm db:load</span>
          </li>
        )}
        {status.bytes != null && status.bytes > 0 && <li>{bytes(status.bytes)} on disk</li>}
        <li>This page read the history from {source === "database" ? "the database, after taking in every file that changed" : "its files"}.</li>
      </ul>

      {ready && (
        <form method="post" action={appPath("/api/db/store")} className="mt-4">
          <button
            type="submit"
            className="rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            Store now
          </button>
          <span className={`ml-3 ${fine}`}>
            the same as <span className="font-mono text-[11.5px] text-ink-2">pnpm db:store</span>
          </span>
        </form>
      )}
      {note && (
        <p className={`mt-2 ${fine}`} role="status">
          {note}
        </p>
      )}

      <p className={`mt-4 ${fine}`}>To write the stored index and history back out as files, stop the server and run:</p>
      <pre className={code}>pnpm db:load</pre>
      <p className={`mt-2 ${fine}`}>
        <span className="font-mono text-[11.5px] text-ink-2">pnpm db:status</span> says the same from a terminal.
      </p>
    </section>
  );
}
