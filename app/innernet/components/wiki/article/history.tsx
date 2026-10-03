import { monthYear, num, plural, shortMonth } from "@/lib/format";
import type { GitInfo } from "@/lib/types";
import { authorTotal, count } from "./lead";
import { LABEL, Sub } from "./parts";

// A repository's life: the headline numbers, commits per month as a quiet bar chart,
// who wrote it, and the last ten commits as a timeline.

const monthName = (key: string) => monthYear(`${key}-15T12:00:00Z`);

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-display text-[30px] leading-none tracking-[-0.01em] text-ink tabular-nums">{value}</div>
      <div className={`${LABEL} mt-2`}>{label}</div>
    </div>
  );
}

function shortDate(iso: string | null): string {
  if (!iso) return "unknown";
  return `${shortMonth(iso.slice(0, 7))} ${iso.slice(0, 4)}`;
}

function Sparkline({ git }: { git: GitInfo }) {
  const months = git.monthly;
  const max = Math.max(...months.map((m) => m.count));
  const W = 600;
  const H = 72;
  const gap = 6;
  const bw = (W - gap * (months.length - 1)) / months.length;
  const peak = months.reduce((a, b) => (b.count > a.count ? b : a), months[0]);
  const first = months[0]?.month;
  const last = months[months.length - 1]?.month;
  const older = git.firstCommit && first && git.firstCommit.slice(0, 7) < first;

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`Commits per month from ${monthName(first)} to ${monthName(last)}`}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-line-strong" strokeWidth="1" />
        {months.map((m, i) => {
          const h = m.count ? Math.max(3, (m.count / max) * (H - 4)) : 1.5;
          const isPeak = m.month === peak.month && m.count > 0;
          return (
            <rect
              key={m.month}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={h}
              rx={Math.min(3, bw / 4)}
              className={isPeak ? "fill-ink" : m.count ? "fill-muted/45" : "fill-faint/40"}
            >
              <title>{`${monthName(m.month)}: ${plural(m.count, "commit")}`}</title>
            </rect>
          );
        })}
      </svg>
      <div aria-hidden className="relative mt-2 h-4 font-mono text-[10.5px] text-muted">
        {months.map((m, i) => {
          const january = m.month.endsWith("-01");
          const nextJan = months.findIndex((x) => x.month.endsWith("-01"));
          const opening = i === 0 && !january && (nextJan < 0 || nextJan >= 4);
          if (!january && !opening) return null;
          return (
            <span key={m.month} className="absolute top-0 whitespace-nowrap" style={{ left: `${(i / months.length) * 100}%` }}>
              {opening ? `${shortMonth(m.month)} ${m.month.slice(0, 4)}` : m.month.slice(0, 4)}
            </span>
          );
        })}
      </div>
      <figcaption className="mt-2 text-[12.5px] leading-relaxed text-muted">
        Commits per month, {monthName(first)} to {monthName(last)}.
        {peak.count > 0 && (
          <>
            {" "}
            Busiest: {monthName(peak.month)}, with {plural(peak.count, "commit")}.
          </>
        )}
        {older && " Earlier commits fall outside the chart."}
      </figcaption>
    </figure>
  );
}

function Authors({ git }: { git: GitInfo }) {
  const max = Math.max(...git.authors.map((a) => a.commits), 1);
  return (
    <ul className="gap-x-8 sm:columns-2">
      {git.authors.map((a) => (
        <li key={a.name} className="flex break-inside-avoid items-center gap-3 py-[3px] text-[14px]">
          <span className="min-w-0 flex-1 truncate text-ink-2">{a.name}</span>
          <span aria-hidden className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-bg-sunk">
            <span className="block h-full rounded-full bg-muted/60" style={{ width: `${Math.max(6, (a.commits / max) * 100)}%` }} />
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-[12px] tabular-nums text-muted">{num(a.commits)}</span>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ git }: { git: GitInfo }) {
  // Newest first by date; git log order can disagree with author dates after a rebase.
  const commits = [...git.recent].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 10);
  return (
    <ol>
      {commits.map((c, i) => (
        <li key={c.hash + i} className="grid grid-cols-[78px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[92px_minmax(0,1fr)]">
          <time dateTime={c.date} className="pt-[2px] font-mono text-[12px] tabular-nums text-muted">
            {c.date.slice(0, 10)}
          </time>
          <div className={`relative border-l pl-5 ${i === commits.length - 1 ? "border-transparent" : "border-line-strong"} pb-4`}>
            <span
              aria-hidden
              className={`absolute -left-[4.5px] top-[6px] size-2 rounded-full border ${i === 0 ? "border-ink bg-ink" : "border-line-strong bg-bg"}`}
            />
            {i === commits.length - 1 && <span aria-hidden className="absolute -left-px top-0 h-[10px] w-px bg-line-strong" />}
            <p className="text-[14.5px] leading-snug text-ink [overflow-wrap:anywhere]">{c.subject}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {c.author}
              <span aria-hidden className="px-1.5 text-faint">·</span>
              <span className="font-mono text-[11.5px] text-muted">{c.hash}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function History({ git }: { git: GitInfo }) {
  const active = git.monthly.filter((m) => m.count > 0).length;
  const authors = authorTotal(git);
  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        <Figure value={num(git.commitCount)} label={git.commitCount === 1 ? "Commit" : "Commits"} />
        {authors.n > 0 && <Figure value={`${num(authors.n)}${authors.atLeast ? "+" : ""}`} label={authors.n === 1 ? "Author" : "Authors"} />}
        <Figure value={shortDate(git.firstCommit)} label="First commit" />
        <Figure value={shortDate(git.lastCommit)} label="Latest commit" />
      </div>
      {active >= 2 && (
        <Sub label="Activity" className="mt-10">
          <Sparkline git={git} />
        </Sub>
      )}
      {git.authors.length > 1 && (
        <Sub label="Authors" aside={authors.n > git.authors.length || authors.atLeast ? `the ${count(git.authors.length)} most active` : undefined} className="mt-10">
          <Authors git={git} />
        </Sub>
      )}
      {git.recent.length > 0 && (
        <Sub label="Recent commits" aside={git.branch ? <span>on <span className="font-mono">{git.branch}</span></span> : undefined} className="mt-10">
          <Timeline git={git} />
        </Sub>
      )}
    </>
  );
}
