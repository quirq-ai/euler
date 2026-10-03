"use client";

import { useEffect, useRef, useState } from "react";
import { num, plural } from "@/lib/format";
import { SessionList } from "./session-list";
import { APP, DEMO_MAX_IDS, toSession, validEvent, type Session } from "./shared";
import { ThisTab } from "./this-tab";
import {
  clearBrowserHistory,
  clearServerHistory,
  currentSessionId,
  fetchServerHistory,
  readBrowserHistory,
  sentDropped,
  sentSessions,
  type BrowserHistory as Saved,
} from "./trail";

// The demo's history: the same sessions and events a local Innernet writes to disk,
// read from this browser's localStorage, where the recorder keeps them. When the demo
// keeps a database (`server`), the newest sessions this browser sent there are read back
// too, by their ids, and for each session the fuller of the two copies is shown.
// Clearing clears both: every session this browser sent in the last 30 days.

/** Sessions asked of the server on load: the newest this browser knows, one request's worth. */
const ASK = DEMO_MAX_IDS;

const button =
  "rounded-full border border-line-strong px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink";

export function BrowserHistory({ server, retentionDays }: { server: boolean; retentionDays: number }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [now, setNow] = useState(0);
  const [held, setHeld] = useState<{ sessions: number; events: number; of: number | null } | null>(null);
  const [cleared, setCleared] = useState<"no" | "busy" | "both" | "here">("no");
  const [dropped, setDropped] = useState(false);
  const fromServer = useRef<Saved>({});
  const wiped = useRef(false);

  useEffect(() => {
    let live = true;
    const load = () => {
      const local = readBrowserHistory();
      const merged: Saved = { ...fromServer.current };
      for (const [id, events] of Object.entries(local)) if (events.length >= (merged[id]?.length ?? 0)) merged[id] = events;
      const list = Object.entries(merged)
        .map(([id, events]) => toSession(id, events.filter(validEvent).map((e) => ({ ...e, app: APP }))))
        .filter((s) => s.total > 0)
        .sort((a, b) => (a.id < b.id ? 1 : -1));
      setSessions(list);
      setNow(Date.now());
    };
    load();
    if (server) {
      const known = [...new Set([...sentSessions(), ...Object.keys(readBrowserHistory())])].sort().reverse();
      const ids = known.slice(0, ASK);
      if (ids.length) {
        void fetchServerHistory(ids).then((got) => {
          if (!live || !got || wiped.current) return;
          fromServer.current = got.sessions;
          const counts = Object.values(got.counts).filter((n) => n > 0);
          setHeld({ sessions: counts.length, events: counts.reduce((n, c) => n + c, 0), of: known.length > ASK ? ASK : null });
          load();
        });
      } else setHeld({ sessions: 0, events: 0, of: null });
    }
    // The recorder writes this page's own visit a moment after it loads.
    const again = setTimeout(load, 1800);
    return () => {
      live = false;
      clearTimeout(again);
    };
  }, [server]);

  async function clear() {
    const mine = currentSessionId();
    const ids = [...new Set([...sentSessions(), ...Object.keys(readBrowserHistory()), ...Object.keys(fromServer.current), ...(mine ? [mine] : [])])];
    clearBrowserHistory();
    wiped.current = true;
    fromServer.current = {};
    setSessions([]);
    if (!server) return;
    setCleared("busy");
    setDropped(sentDropped());
    const ok = await clearServerHistory(ids);
    setHeld({ sessions: 0, events: 0, of: null });
    setCleared(ok ? "both" : "here");
  }

  if (!sessions) return <div className="h-40" aria-hidden />;

  const where = server ? <>Kept in this browser, and for {retentionDays} days in the demo&apos;s database.</> : <>Kept in this browser only.</>;

  return (
    <div>
      {sessions.length ? (
        <>
          <SessionList sessions={sessions} now={now} />
          <ThisTab />
        </>
      ) : (
        <p className="font-serif text-[18px] leading-[1.6] text-ink-2">
          {cleared === "busy"
            ? "Clearing, here and in the demo's database."
            : cleared === "both"
              ? `Cleared, in this browser and in the demo's database: every session this browser sent there in the last ${retentionDays} days.${
                  dropped ? ` It remembers only the newest thousand, so any older ones go by themselves within ${retentionDays} days.` : ""
                } Pages you open from now on start a fresh history.`
              : cleared === "here"
                ? `Cleared in this browser. The demo's database could not be reached just now; its copy goes by itself within ${retentionDays} days.`
                : server
                  ? `Nothing yet. Open a few pages and they will appear here, kept in this browser and for ${retentionDays} days in the demo's database.`
                  : "Nothing yet. Open a few pages and they will appear here, kept in this browser alone."}
        </p>
      )}
      {sessions.length > 0 && (
        <p className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted" aria-live="polite">
          <span>
            {where}
            {server && held && held.sessions > 0 && (
              <>
                {" "}
                {held.of ? `Of the newest ${held.of} sessions this browser sent, the database holds ${num(held.sessions)}` : `The database holds ${plural(held.sessions, "session")} of yours`},{" "}
                {plural(held.events, "event")}.
              </>
            )}
          </span>
          <button type="button" onClick={clear} className={button}>
            {server ? "Clear my history, here and on the server" : "Clear this browser’s history"}
          </button>
        </p>
      )}
    </div>
  );
}
