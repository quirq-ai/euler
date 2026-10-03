"use client";

import { useEffect, useRef, useState } from "react";
import type { GuideChapter } from "./chapters";

// The progress ruler: one segment per chapter, filling as the reader moves through it.
// On wide screens a sticky rail beside the text, with the open chapter's sections; on
// narrow ones a compact bar pinned to the top of the window that unfolds into the
// contents. The guide sits under the home page's search, which has no sticky header,
// so both hold to the top of the window itself.

interface Progress {
  chapter: number; // index of the chapter being read, -1 before the first
  section: string | null;
  fill: number[]; // 0 to 1 per chapter
}

const START: Progress = { chapter: -1, section: null, fill: [] };

function useProgress(chapters: GuideChapter[]): Progress {
  const [state, setState] = useState<Progress>(START);

  useEffect(() => {
    const heads = chapters.map((c) => document.getElementById(c.id));
    const sections = chapters.map((c) => c.sections.map((s) => document.getElementById(s.id)));
    const body = document.getElementById("guide-body");
    let raf = 0;

    const measure = () => {
      raf = 0;
      const line = window.innerHeight * 0.32;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const tops = heads.map((h) => h?.getBoundingClientRect().top ?? Infinity);
      const end = body ? body.getBoundingClientRect().bottom - window.innerHeight * 0.5 : Infinity;
      const fill = tops.map((top, i) => {
        if (atEnd) return 1;
        const next = i + 1 < tops.length ? tops[i + 1] : end;
        const span = next - top;
        return span > 0 ? Math.min(1, Math.max(0, (line - top) / span)) : 0;
      });
      let chapter = -1;
      tops.forEach((t, i) => {
        if (t <= line) chapter = i;
      });
      if (atEnd) chapter = chapters.length - 1;
      let section: string | null = null;
      if (chapter >= 0) {
        for (const el of sections[chapter]) if (el && el.getBoundingClientRect().top <= line) section = el.id;
      }
      setState((prev) =>
        prev.chapter === chapter && prev.section === section && prev.fill.length === fill.length && prev.fill.every((f, i) => Math.abs(f - fill[i]) < 0.004)
          ? prev
          : { chapter, section, fill },
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chapters]);

  return state;
}

export function GuideRail({ chapters }: { chapters: GuideChapter[] }) {
  const { chapter, section, fill } = useProgress(chapters);
  const total = fill.length ? fill.reduce((s, f) => s + f, 0) / fill.length : 0;
  return (
    <nav aria-label="Chapters" className="sticky top-10 max-h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain pb-8 pr-1 [scrollbar-width:none]">
      <div className="fg-smallcaps mb-4 flex items-baseline justify-between">
        <span>The field guide</span>
        <span className="tabular-nums text-faint">{Math.round(total * 100)}%</span>
      </div>
      <ol>
        {chapters.map((c, i) => {
          const on = i === chapter;
          return (
            <li key={c.id} className="relative pl-[22px]">
              {/* The ruler: a hairline per chapter with ticks, filled as it is read. */}
              <span aria-hidden className="absolute bottom-0 left-[3px] top-0 w-px bg-line-strong" />
              <span
                aria-hidden
                className="absolute bottom-0 left-[3px] top-0 w-px origin-top bg-ink transition-transform duration-150 ease-out motion-reduce:transition-none"
                style={{ transform: `scaleY(${fill[i] ?? 0})` }}
              />
              <span aria-hidden className="absolute left-0 top-[13px] h-px w-[7px] bg-ink-2" />
              <a
                href={`#${c.id}`}
                aria-current={on ? "location" : undefined}
                className={`group flex items-baseline gap-3 py-[7px] transition-colors ${on ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                <span className={`w-7 shrink-0 font-display text-[19px] leading-none ${on ? "text-ink" : "text-faint group-hover:text-ink-2"}`}>{c.numeral}</span>
                <span className={`text-[13.5px] leading-snug ${on ? "font-medium" : ""}`}>{c.title}</span>
              </a>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <ol className="overflow-hidden pb-1 pl-10" aria-hidden={!on}>
                  {c.sections.map((s) => {
                    const here = on && s.id === section;
                    return (
                      <li key={s.id} className="relative">
                        <span aria-hidden className="absolute -left-[37px] top-[11px] h-px w-[4px] bg-line-strong" />
                        <a
                          href={`#${s.id}`}
                          tabIndex={on ? undefined : -1}
                          className={`block py-[4px] text-[12.5px] leading-snug transition-colors ${here ? "text-ink" : "text-muted hover:text-ink"}`}
                        >
                          {s.label}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </li>
          );
        })}
      </ol>
      <a href="#top" className="fg-smallcaps mt-6 inline-block pl-[22px] transition-colors hover:text-ink">
        Back to the search
      </a>
    </nav>
  );
}

export function GuideBar({ chapters }: { chapters: GuideChapter[] }) {
  const { chapter, fill } = useProgress(chapters);
  const c = chapters[Math.max(0, chapter)];
  // Folds itself away once a chapter is chosen, so the page is not left under it.
  const fold = useRef<HTMLDetailsElement>(null);
  return (
    <nav aria-label="Chapters" className="sticky top-0 z-30 -mx-4 border-b border-line bg-bg/90 backdrop-blur-md sm:-mx-6 lg:hidden">
      <details ref={fold} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="w-8 font-display text-[20px] leading-none text-ink">{chapter >= 0 ? c.numeral : "§"}</span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">{chapter >= 0 ? c.title : "The field guide"}</span>
          <span className="fg-smallcaps">Contents</span>
          <svg aria-hidden width="11" height="11" viewBox="0 0 10 10" className="text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none">
            <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ol className="border-t border-line px-4 pb-3 pt-1.5 sm:px-6">
          {chapters.map((ch, i) => (
            <li key={ch.id}>
              <a
                href={`#${ch.id}`}
                aria-current={i === chapter ? "location" : undefined}
                onClick={() => fold.current?.removeAttribute("open")}
                className={`flex items-baseline gap-3 py-1.5 ${i === chapter ? "text-ink" : "text-ink-2"}`}
              >
                <span className="w-8 font-display text-[18px] leading-none text-muted">{ch.numeral}</span>
                <span className="text-[14px]">{ch.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>
      {/* Five segments, one per chapter, under the bar. */}
      <div aria-hidden className="flex gap-1 px-4 pb-2 sm:px-6">
        {chapters.map((ch, i) => (
          <span key={ch.id} className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-line-strong">
            <span className="absolute inset-0 origin-left bg-ink transition-transform duration-150 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${fill[i] ?? 0})` }} />
          </span>
        ))}
      </div>
    </nav>
  );
}
