import Link from "next/link";
import { sigilGradient } from "@/components/sigil";
import { plural } from "@/lib/format";
import { APP, pageLabel, safeHref, type ActivityEvent, type Session } from "./shared";

// The sessions of the history page, newest first and grouped by day, each one a
// disclosure that opens onto its events merged across every app that wrote to it.
// Plain markup with no hooks, so the server renders it from the files on this machine
// and the demo's browser renders it from localStorage.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Events shown when a session opens; a longer session says how many more its files hold. */
const SHOWN = 300;

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (iso: string, seconds = false) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${seconds ? `:${pad(d.getSeconds())}` : ""}`;
};
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function dayHeading(iso: string, now: number): { name: string; date: string } {
  const d = new Date(iso);
  const date = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`}`;
  const key = dayKey(iso);
  if (key === dayKey(new Date(now).toISOString())) return { name: "Today", date };
  if (key === dayKey(new Date(now - 864e5).toISOString())) return { name: "Yesterday", date };
  return { name: DAYS[d.getDay()], date: `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`}` };
}

/** "under a minute", "12 min", "1 h 5 min" */
export function duration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return "under a minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** The folder a /wiki/ link names, for its sigil; null for anything else. */
function wikiSeed(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith("/wiki/")) return null;
  const slug = url.slice(6).split(/[?#]/)[0];
  if (!slug) return null;
  try {
    const s = decodeURIComponent(slug);
    return /^(special|category):/i.test(s) ? null : s;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** What a session was about: the pages and searches it went through, in order, once each. */
function highlights(s: Session): { lead: string[]; more: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of s.events) {
    const name =
      e.app !== APP ? (str(e.title) ?? str(e.q) ?? str(e.url)) : e.kind === "visit" || e.kind === "search" ? pageLabel(str(e.url), str(e.title), e.kind === "search" ? str(e.q) : undefined) : undefined;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return { lead: out.slice(0, 3), more: Math.max(0, out.length - 3) };
}

/** A small mark for each app: a dot of its own colour and its name in mono. */
export function AppBadge({ app }: { app: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-[1px] font-mono text-[11px] leading-[18px] text-ink-2">
      <span aria-hidden className="size-[7px] rounded-full" style={{ background: sigilGradient(`app:${app}`) }} />
      {app}
    </span>
  );
}

export function SessionList({ sessions, now }: { sessions: Session[]; now: number }) {
  const days: { key: string; sessions: Session[] }[] = [];
  for (const s of sessions) {
    const key = dayKey(s.start);
    const last = days.at(-1);
    if (last?.key === key) last.sessions.push(s);
    else days.push({ key, sessions: [s] });
  }

  let n = 0;
  return (
    <div className="space-y-12">
      {days.map((day) => {
        const h = dayHeading(day.sessions[0].start, now);
        return (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <h2 id={`day-${day.key}`} className="flex items-baseline gap-3 border-b border-line-strong pb-2.5">
              <span className="font-display text-[30px] leading-none tracking-[-0.01em] text-ink">{h.name}</span>
              <span className="text-[13px] text-muted">{h.date}</span>
            </h2>
            <ul>
              {day.sessions.map((s) => (
                <SessionItem key={s.id} session={s} open={n === 0} delay={Math.min(n++, 10) * 40} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SessionItem({ session: s, open, delay }: { session: Session; open: boolean; delay: number }) {
  const { lead, more } = highlights(s);
  const seeds = [...new Set(s.events.map((e) => wikiSeed(e.url)).filter((x): x is string => !!x))].slice(0, 9);
  const many = s.apps.length > 1;
  const shown = s.events.slice(-SHOWN);
  const hidden = s.total - shown.length;

  return (
    <li className="rise border-b border-line" style={{ animationDelay: `${delay}ms` }}>
      <details id={`s-${s.id}`} open={open} className="group/s">
        <summary className="-mx-3 flex cursor-pointer list-none items-start gap-3 rounded-xl px-3 py-4 transition-colors hover:bg-bg-sunk/70 sm:gap-5 [&::-webkit-details-marker]:hidden">
          <time dateTime={s.start} className="w-[46px] shrink-0 pt-[3px] font-mono text-[13px] tabular-nums text-ink-2">
            {clock(s.start)}
          </time>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] leading-snug text-ink">
              {lead.length ? (
                lead.map((name, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span aria-hidden className="px-1.5 text-faint">
                        ·
                      </span>
                    )}
                    {name.startsWith("“") ? <span className="font-serif italic">{name}</span> : name}
                  </span>
                ))
              ) : (
                <span className="text-muted">A quiet session</span>
              )}
              {more > 0 && <span className="text-muted"> and {more} more</span>}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] text-muted tabular-nums">
              <span>{duration(Date.parse(s.end) - Date.parse(s.start))}</span>
              <span aria-hidden className="text-faint">
                ·
              </span>
              <span>{plural(s.total, "event")}</span>
              <span className="ml-1 inline-flex flex-wrap gap-1.5">
                {s.apps.map((a) => (
                  <AppBadge key={a} app={a} />
                ))}
              </span>
              {/* Shown by <ThisTab> on the session this tab is writing. */}
              <span className="this-tab hidden items-center gap-1.5 rounded-full bg-ink px-2 py-[1px] text-[11px] leading-[18px] text-bg">
                <span aria-hidden className="size-[6px] rounded-full bg-good" />
                This tab
              </span>
            </span>
          </span>
          {seeds.length > 0 && (
            <span aria-hidden className="hidden shrink-0 items-center pt-1 sm:flex">
              {seeds.map((seed, i) => (
                <span
                  key={seed}
                  className="size-[14px] rounded-[4px] ring-2 ring-bg"
                  style={{ background: sigilGradient(seed), marginLeft: i ? -3 : 0, zIndex: seeds.length - i }}
                />
              ))}
            </span>
          )}
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-[5px] shrink-0 text-faint transition-transform group-open/s:rotate-90">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </summary>

        <div className="pb-6 pl-0 sm:pl-[66px]">
          {hidden > 0 && <p className="mb-3 text-[12.5px] text-muted">{plural(hidden, "earlier event")} not shown</p>}
          <ol className="relative ml-[5px] border-l border-line">
            {shown.map((e, i) => (
              <EventRow key={i} e={e} showApp={many || e.app !== APP} />
            ))}
          </ol>
          <p className="mt-3 pl-5 font-mono text-[11px] text-faint">{s.id}</p>
        </div>
      </details>
    </li>
  );
}

const KIND_GLYPH: Record<string, string> = { back: "←", forward: "→" };

function EventRow({ e, showApp }: { e: ActivityEvent; showApp: boolean }) {
  const href = safeHref(e.url);
  const seed = wikiSeed(e.url);
  const q = str(e.q);
  const title = str(e.title);
  const label = e.kind === "search" && q ? null : e.app === APP ? pageLabel(str(e.url), title) : (title ?? str(e.url));
  const extras = Object.entries(e)
    .filter(([k, v]) => !["at", "app", "kind", "url", "title", "q", "via"].includes(k) && v !== null && v !== undefined && v !== "")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);

  const content =
    e.kind === "search" && q ? (
      <>
        <span className="text-muted">searched for </span>
        {href ? (
          <Link href={href} prefetch={false} className="link font-serif text-[16px] italic">
            “{q}”
          </Link>
        ) : (
          <span className="font-serif text-[16px] italic">“{q}”</span>
        )}
      </>
    ) : label ? (
      href ? (
        href.startsWith("/") ? (
          <Link href={href} prefetch={false} className="link">
            {label}
          </Link>
        ) : (
          <a href={href} target="_blank" rel="noopener noreferrer" className="link">
            {label}
          </a>
        )
      ) : (
        <span className="text-ink">{label}</span>
      )
    ) : null;

  return (
    <li className="relative py-1.5 pl-5">
      <span
        aria-hidden
        className={`absolute -left-[5px] top-[13px] size-[9px] ${seed ? "rounded-[3px]" : "rounded-full border border-line-strong bg-bg"}`}
        style={seed ? { background: sigilGradient(seed) } : undefined}
      />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <time dateTime={e.at} className="font-mono text-[11.5px] tabular-nums text-faint">
          {clock(e.at, true)}
        </time>
        <span className="w-[84px] shrink-0 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted">
          {KIND_GLYPH[e.kind] && <span aria-hidden className="mr-1 font-sans normal-case tracking-normal">{KIND_GLYPH[e.kind]}</span>}
          {e.kind}
        </span>
        {showApp && <AppBadge app={e.app} />}
        <span className="min-w-0 max-sm:basis-full sm:flex-1">
          <span className="block truncate text-[14.5px] leading-relaxed">
            {content}
            {!content && extras.length === 0 && <span className="text-faint">no details</span>}
          </span>
          {href && e.kind !== "search" && label !== e.url && <span className="block truncate font-mono text-[11.5px] text-muted">{e.url as string}</span>}
          {extras.length > 0 && <span className="block truncate font-mono text-[11.5px] text-muted">{extras.join(" · ")}</span>}
        </span>
      </div>
    </li>
  );
}
