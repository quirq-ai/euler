import { CopyButton } from "./copy-button";
import type { GuideChapter } from "./chapters";
import { sourceLines } from "./source";

// The guide's typographic pieces: chapter openings, section heads, figures of
// numbers, commands with a copy button, and excerpts quoted from the code itself.

/** A chapter's title page, then its opening. The section around it is named by the
 * heading alone (`<id>-title`), not by everything the opening holds. */
export function ChapterHead({ chapter, kicker, children }: { chapter: GuideChapter; kicker: string; children: React.ReactNode }) {
  return (
    <div id={chapter.id} className="scroll-mt-12 pt-24 sm:pt-32 lg:scroll-mt-0">
      <header data-reveal>
        <div className="fg-smallcaps flex items-center gap-4">
          <span aria-hidden>Chapter {chapter.numeral}</span>
          <span aria-hidden className="h-px flex-1 bg-line-strong" />
          <span>{chapter.figs}</span>
        </div>
        <div className="mt-8 grid items-end gap-x-8 gap-y-3 sm:mt-10 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)]">
          <span aria-hidden className="fg-numeral">
            {chapter.numeral}
          </span>
          <div className="min-w-0 pb-1 sm:pb-3">
            <h2 id={`${chapter.id}-title`} className="font-display text-[44px] leading-[1.02] tracking-[-0.018em] text-ink sm:text-[58px]">
              <span className="sr-only">Chapter {chapter.numeral}: </span>
              {chapter.title}
            </h2>
          </div>
        </div>
        <p className="mt-6 max-w-[640px] font-serif text-[21px] italic leading-[1.5] text-ink-2 sm:text-[22px]">{kicker}</p>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** A numbered section inside a chapter: "II.3  A whole new root". */
export function SectionHead({ id, mark, title, aside }: { id: string; mark: string; title: string; aside?: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-12 pt-20 lg:scroll-mt-0" data-reveal>
      <div className="flex items-baseline gap-4 border-b border-line-strong pb-2.5">
        <span className="fg-smallcaps w-12 shrink-0 text-faint">{mark}</span>
        <h3 className="min-w-0 flex-1 font-display text-[30px] leading-[1.12] tracking-[-0.01em] text-ink sm:text-[34px]">{title}</h3>
        {aside && <span className="fg-smallcaps hidden shrink-0 sm:inline">{aside}</span>}
      </div>
    </div>
  );
}

/** Body text: Newsreader, a comfortable measure. */
export function Prose({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`fg-prose ${className}`} data-reveal>
      {children}
    </div>
  );
}

/** A row of figures set like an atlas's table of measurements. */
export function Figures({ items, className = "" }: { items: { value: React.ReactNode; label: React.ReactNode; note?: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={`fg-figures ${className}`} data-reveal>
      {items.map((it, i) => (
        <div key={i} className="fg-figures-cell">
          <dt className="mt-2.5 text-[12.5px] leading-snug text-muted">
            {it.label}
            {it.note && <span className="mt-0.5 block font-mono text-[11px] text-faint">{it.note}</span>}
          </dt>
          <dd className="font-display text-[34px] leading-none tabular-nums tracking-[-0.01em] text-ink sm:text-[40px]">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Inline code. */
export function C({ children }: { children: React.ReactNode }) {
  return <code className="fg-code">{children}</code>;
}

/** A shell command (one or more lines) with a copy button. */
export function Command({ code, caption, className = "" }: { code: string; caption?: React.ReactNode; className?: string }) {
  return (
    <div className={`fg-command group ${className}`}>
      {caption && <div className="fg-command-cap">{caption}</div>}
      <div className="flex items-start">
        {/* Where there is room, a long command wraps under its prompt rather than hide
            past the edge; on a phone it scrolls, so a path is never broken mid-word. */}
        <pre className="min-w-0 flex-1 py-3 pl-4 pr-3 font-mono text-[13px] leading-[1.65] text-ink max-sm:overflow-x-auto sm:whitespace-pre-wrap">
          <code>
            {code.split("\n").map((line, i) => (
              <span key={i} className="block pl-[2ch] -indent-[2ch]">
                <span aria-hidden className="select-none text-faint">
                  ${" "}
                </span>
                {line}
              </span>
            ))}
          </code>
        </pre>
        <CopyButton text={code} className="m-2.5 ml-0 shrink-0" />
      </div>
    </div>
  );
}

/**
 * A few lines of Innernet's own source, read from disk on each request so the guide
 * always quotes the code as it stands. Starts at the first line containing `from`,
 * and marks the lines containing any of `mark`. Renders nothing if the line moved.
 */
export function Excerpt({ file, from, lines = 6, mark = [], className = "" }: { file: string; from: string; lines?: number; mark?: string[]; className?: string }) {
  const all = sourceLines(file);
  if (!all) return null;
  const start = all.findIndex((l) => l.includes(from));
  if (start < 0) return null;
  const shown = all.slice(start, start + lines);
  // Drop the shared indent so a nested excerpt sits flush.
  const indent = Math.min(...shown.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length));
  const width = String(start + shown.length).length;
  return (
    <figure className={`fg-excerpt ${className}`}>
      <figcaption className="fg-excerpt-cap">
        <span className="text-ink-2">{file}</span>
        <span className="text-faint">
          :{start + 1}
          {shown.length > 1 ? `-${start + shown.length}` : ""}
        </span>
      </figcaption>
      <pre className="overflow-x-auto py-2.5 font-mono text-[12.5px] leading-[1.7]">
        <code>
          {shown.map((l, i) => {
            const on = mark.some((m) => l.includes(m));
            return (
              <span key={i} className={`flex pr-4 ${on ? "bg-[var(--mark-bg)]/40" : ""}`}>
                <span aria-hidden className="w-[calc(var(--w)*1ch+2rem)] shrink-0 select-none pl-3 pr-3 text-right text-faint" style={{ "--w": width } as React.CSSProperties}>
                  {start + i + 1}
                </span>
                <span className="whitespace-pre text-ink-2">{l.slice(indent) || " "}</span>
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}

/** Small print under a block: where the rule lives. */
export function Fine({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`fg-fine ${className}`}>{children}</p>;
}
