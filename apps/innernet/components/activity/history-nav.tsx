"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { moving, readTrail, setPendingMove, TRAIL_EVENT, writeTrail, type Trail } from "./trail";

// Back and forward through this tab's trail, and the way to the full history. The
// buttons step the trail's cursor and navigate; the recorder logs the step as "back" or
// "forward". At either end the button is disabled. Rendered by every header, through
// <BrandLinks> (components/brand-nav.tsx).

const EMPTY: Trail = { stack: [], cursor: -1 };

export function HistoryNav({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [trail, setTrail] = useState<Trail>(EMPTY);
  const [stepping, startTransition] = useTransition();

  useEffect(() => {
    const sync = () => setTrail(readTrail());
    sync();
    window.addEventListener(TRAIL_EVENT, sync);
    return () => window.removeEventListener(TRAIL_EVENT, sync);
  }, []);

  const back = trail.cursor > 0 ? trail.stack[trail.cursor - 1] : null;
  const forward = trail.cursor >= 0 ? (trail.stack[trail.cursor + 1] ?? null) : null;

  function step(dir: "back" | "forward") {
    if (moving()) return;
    const t = readTrail();
    const to = dir === "back" ? t.cursor - 1 : t.cursor + 1;
    const entry = t.stack[to];
    if (!entry || to < 0) return;
    setPendingMove(dir, entry.url);
    writeTrail({ ...t, cursor: to });
    startTransition(() => router.push(entry.url));
  }

  return (
    <div role="group" aria-label="Your trail" className={`flex items-center ${className}`}>
      <StepButton dir="back" label={back?.label ?? back?.url} disabled={!back || stepping} compact={compact} onClick={() => step("back")} />
      <StepButton dir="forward" label={forward?.label ?? forward?.url} disabled={!forward || stepping} compact={compact} onClick={() => step("forward")} />
      <span className="relative">
        <Link
          href="/activity"
          aria-label="History"
          aria-current={pathname === "/activity" ? "page" : undefined}
          className={`peer grid place-items-center rounded-full ${compact ? "size-8 sm:size-9" : "size-9"} transition-colors hover:bg-bg-sunk hover:text-ink focus-visible:rounded-full ${
            pathname === "/activity" ? "bg-bg-sunk text-ink" : "text-muted"
          }`}
        >
          <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.2 12.6A7.9 7.9 0 1 0 6.6 6.3L4.4 8.4" />
            <path d="M4.2 4.6v3.9h3.9" />
            <path d="M12 8.2v4.1l2.7 1.6" />
          </svg>
        </Link>
        <Tip>History</Tip>
      </span>
    </div>
  );
}

function StepButton({ dir, label, disabled, compact, onClick }: { dir: "back" | "forward"; label?: string; disabled: boolean; compact: boolean; onClick: () => void }) {
  const word = dir === "back" ? "Back" : "Forward";
  const none = dir === "back" ? "Nothing earlier in this tab" : "Nothing ahead";
  return (
    <span className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label ? `${word} to ${label}` : `${word}: ${none.toLowerCase()}`}
        className={`peer grid place-items-center rounded-full ${compact ? "size-7 sm:size-8" : "size-8"} text-muted transition-colors enabled:hover:bg-bg-sunk enabled:hover:text-ink disabled:cursor-default disabled:text-faint disabled:opacity-70 focus-visible:rounded-full`}
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {dir === "back" ? <path d="M19 12H5.5M11 6l-6 6 6 6" /> : <path d="M5 12h13.5M13 6l6 6-6 6" />}
        </svg>
      </button>
      <Tip>
        {label ? (
          <>
            <span className="text-bg/70">{word} to </span>
            {label}
          </>
        ) : (
          none
        )}
      </Tip>
    </span>
  );
}

/** A small ink label under its control, on hover and on keyboard focus. Out of the
 * layout while hidden, and held to the right edge on a phone, so it never widens the page. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden max-w-[220px] -translate-x-1/2 truncate max-sm:left-auto max-sm:right-0 max-sm:translate-x-0 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11.5px] leading-tight text-bg shadow-soft peer-hover:block peer-focus-visible:block"
    >
      {children}
    </span>
  );
}
