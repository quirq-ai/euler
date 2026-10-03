import { MAX_EVENT_BYTES } from "./shared";

// The side column of the history page, under the Database card: how the history is
// kept. The folder, a line, and how any other app joins in with one line of shell.

const label = "text-[11px] font-medium uppercase tracking-[0.12em] text-muted";
const code = "mt-2.5 overflow-x-auto rounded-[10px] border border-line bg-bg-sunk px-3.5 py-3 font-mono text-[11.5px] leading-[1.7] text-ink-2";

export function FormatNotes({ dir, session, demo, server, retentionDays }: { dir: string; session: string; demo: boolean; server: boolean; retentionDays: number }) {
  const root = dir.endsWith("/") ? dir.slice(0, -1) : dir;
  const name = root.split("/").pop() || root;
  const line = `{"at":"${sessionToIso(session)}","app":"innernet","kind":"visit","url":"/wiki/galileo","title":"galileo"}`;
  const shell = `echo '{"at":"'$(date -u +%FT%TZ)'","app":"notes","kind":"edit","file":"todo.md"}' >> "$(ls -d ${root}/*/ | tail -1)notes.jsonl"`;

  return (
    <div className="space-y-8">
      <section aria-labelledby="kept">
        <h2 id="kept" className={label}>
          How it is kept
        </h2>
        <p className="mt-3 font-serif text-[16px] leading-[1.6] text-ink-2">
          Plain files first. Each tab is a <em>session</em>, a folder named for the moment it began. Every app writes its own file of JSON Lines inside it, one event per line,
          and reading a session is reading them all in order of time. The database keeps a copy of the lines, never the other way round.
        </p>
        <pre className={code} aria-label="The history folder">
          <span className="text-ink">{root}/</span>
          {"\n"}
          {"└ "}
          <span className="text-ink">{session}/</span>
          {"\n"}
          {"    innernet.jsonl"}
          <span className="text-faint">{"   written here"}</span>
          {"\n"}
          {"    notes.jsonl"}
          <span className="text-faint">{"      any other app"}</span>
        </pre>
        {demo ? (
          <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted">
            A local Innernet writes this folder to <span className="font-mono text-[11.5px] text-ink-2">~/.innernet/history</span>, with its copy in{" "}
            <span className="font-mono text-[11.5px] text-ink-2">~/.innernet/db</span>.{" "}
            {server
              ? `The demo keeps the same events in your browser, and for ${retentionDays} days in its database.`
              : "The demo writes nothing anywhere: it keeps the same events in your browser."}
          </p>
        ) : (
          <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted">
            Set <span className="font-mono text-[11.5px] text-ink-2">INNERNET_HISTORY_DIR</span> to keep it somewhere else. Delete a folder to forget a session; the database
            forgets it too the next time this page is read.
          </p>
        )}
      </section>

      <section aria-labelledby="line">
        <h2 id="line" className={label}>
          One line, one event
        </h2>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-ink-2">
          A time, the app, a <span className="font-mono text-[12px]">kind</span> of event, and any fields it likes. Innernet writes <Kind>visit</Kind>, <Kind>search</Kind>,{" "}
          <Kind>back</Kind> and <Kind>forward</Kind>.
        </p>
        <pre className={`${code} whitespace-pre-wrap break-all`}>{line}</pre>
      </section>

      <section aria-labelledby="join">
        <h2 id="join" className={label}>
          Add your own
        </h2>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-ink-2">
          Any app or script joins the newest session by appending to a file of its own name:
        </p>
        <pre className={`${code} whitespace-pre-wrap break-all`}>{shell}</pre>
        <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted">
          App names are lowercase letters, digits, <span className="font-mono text-[11.5px]">-</span> and <span className="font-mono text-[11.5px]">_</span>. Lines over{" "}
          {MAX_EVENT_BYTES / 1024} KB, and lines that are not JSON, are skipped.
          {!demo && (
            <>
              {" "}
              There is nothing to register: the next visit to this page reads what changed in <span className="font-mono text-[11.5px]">{name}</span>.
            </>
          )}
        </p>
      </section>
    </div>
  );
}

function Kind({ children }: { children: string }) {
  return <span className="font-mono text-[12px] text-ink">{children}</span>;
}

/** "2026-10-03T05-12-07Z_k3f9a2" to "2026-10-03T05:12:09Z", a moment after it began. */
function sessionToIso(id: string): string {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/);
  if (!m) return "2026-10-03T05:12:09Z";
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
  d.setUTCSeconds(d.getUTCSeconds() + 2);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
