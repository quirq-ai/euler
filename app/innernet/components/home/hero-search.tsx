"use client";

import Link from "next/link";
import { useRef } from "react";
import { SearchBox } from "@/components/search-box";
import { wikiHref } from "@/lib/links";

// The hero search box and its two quiet buttons. SearchBox owns its form, so the
// Search button reaches in and submits it; with nothing typed it just hands focus back.

const pill =
  "inline-flex h-9 items-center rounded-full border border-transparent bg-bg-sunk px-[18px] text-[13.5px] text-ink-2 transition-[color,border-color,box-shadow] duration-150 hover:border-line hover:text-ink hover:shadow-[var(--shadow-sm)]";

export function HeroSearch() {
  const ref = useRef<HTMLDivElement>(null);

  function submit() {
    const form = ref.current?.querySelector("form");
    const input = form?.querySelector<HTMLInputElement>('input[name="q"]');
    if (!form || !input) return;
    if (input.value.trim()) form.requestSubmit();
    else input.focus();
  }

  return (
    <div ref={ref} className="w-full max-w-[620px]">
      {/* z-20 keeps the suggestion list above the rows that rise in after it. */}
      <div className="rise relative z-20" style={{ animationDelay: "120ms" }}>
        <SearchBox size="hero" autoFocus />
      </div>
      <div className="rise mt-7 flex justify-center gap-3" style={{ animationDelay: "180ms" }}>
        <button type="button" onClick={submit} className={pill}>
          Search
        </button>
        <Link href={wikiHref("Special:Random")} prefetch={false} className={pill}>
          I&rsquo;m feeling curious
        </Link>
      </div>
    </div>
  );
}
