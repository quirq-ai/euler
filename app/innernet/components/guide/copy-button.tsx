"use client";

import { useEffect, useState } from "react";

// Copies a command (or a prompt) to the clipboard. localhost is a secure context, so the
// async clipboard works; if it is refused, the button says so and the text stays
// selectable. `quiet` drops the box, for a button that sits in a line of text.

export function CopyButton({
  text,
  label = "Copy",
  ariaLabel = "Copy command",
  quiet = false,
  className = "",
}: {
  text: string;
  /** What the button says before it is pressed. */
  label?: string;
  /** What it says to a screen reader before it is pressed. */
  ariaLabel?: string;
  quiet?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
  }

  const shown = state === "done" ? "Copied" : state === "failed" ? "Select and copy" : label;
  const look = quiet
    ? "-my-1 h-7 rounded-md px-1.5 text-muted hover:bg-bg-sunk hover:text-ink"
    : "h-7 rounded-md border border-line bg-surface px-2 text-[11.5px] text-muted shadow-[var(--shadow-sm)] hover:border-line-strong hover:text-ink";
  return (
    <button type="button" onClick={copy} aria-label={state === "idle" ? ariaLabel : shown} className={`inline-flex items-center gap-1.5 transition-colors ${look} ${className}`}>
      <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        {state === "done" ? (
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        ) : (
          <>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
            <path d="M10.5 5.5V3.9c0-.8-.6-1.4-1.4-1.4H3.9c-.8 0-1.4.6-1.4 1.4v5.2c0 .8.6 1.4 1.4 1.4h1.6" />
          </>
        )}
      </svg>
      <span aria-live="polite" className="whitespace-nowrap">
        {shown}
      </span>
    </button>
  );
}
