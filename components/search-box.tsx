"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Sigil, sigilGradient } from "@/components/sigil";
import { wikiHref } from "@/lib/links";
import type { Suggestion } from "@/lib/search";

// The one search box, in two sizes. Suggestions come from our own /api/suggest route
// handler (same origin, server-side search); nothing leaves this machine.

export function SearchBox({
  defaultValue = "",
  size = "compact",
  autoFocus = false,
  placeholder = "Search your internet",
  className = "",
}: {
  defaultValue?: string;
  size?: "hero" | "compact";
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => setValue(defaultValue), [defaultValue]);

  // "/" focuses the box from anywhere, like most search engines.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && t?.tagName !== "INPUT" && t?.tagName !== "TEXTAREA" && !t?.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) {
          setItems((await res.json()) as Suggestion[]);
          setActive(-1);
        }
      } catch {
        /* aborted or offline */
      }
    }, 90);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value]);

  // Every way the list closes forgets the highlighted option.
  function close() {
    setOpen(false);
    setActive(-1);
  }

  function go(q: string) {
    const text = q.trim();
    if (!text) return;
    close();
    router.push(`/search?q=${encodeURIComponent(text)}`);
  }

  function visit(s: Suggestion) {
    close();
    router.push(wikiHref(s.slug));
  }

  // The pages, then "Search everything" as the last option.
  const options = items.length + 1;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) {
      if (e.key === "ArrowDown" && items.length) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? options - 1 : a - 1));
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      if (active < items.length) visit(items[active]);
      else go(value);
    }
  }

  const hero = size === "hero";
  const showList = open && items.length > 0;
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className={`relative w-full ${className}`}
    >
      <div
        className={`group relative flex items-center border bg-surface transition-[box-shadow,border-color] duration-200 ${
          hero ? "h-[58px] rounded-[29px] pl-5 pr-2" : "h-11 rounded-[22px] pl-4 pr-1.5"
        } ${
          showList
            ? "rounded-b-none border-line-strong shadow-lift"
            : "border-line-strong shadow-[var(--shadow-sm)] hover:shadow-soft focus-within:border-link focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--link)_16%,transparent),var(--shadow)]"
        }`}
      >
        <svg className="shrink-0 text-faint" width={hero ? 19 : 16} height={hero ? 19 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
        <input
          ref={inputRef}
          name="q"
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-label="Search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(close, 120)}
          onKeyDown={onKeyDown}
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint focus:outline-none ${hero ? "px-3.5 text-[17px]" : "px-3 text-[15px]"}`}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-bg-sunk hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
        {!value && hero && (
          <kbd aria-hidden className="mr-3 hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline">/</kbd>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className={`absolute inset-x-0 top-full z-50 overflow-hidden border border-t-0 border-line-strong bg-surface pb-2 shadow-lift ${hero ? "rounded-b-[29px]" : "rounded-b-[22px]"}`}
        >
          <li aria-hidden role="presentation" className={`mb-1 h-px bg-line ${hero ? "mx-5" : "mx-4"}`} />
          {items.map((s, i) => (
            <li
              key={s.slug}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                visit(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 ${hero ? "px-5 py-2" : "px-4 py-1.5"} ${i === active ? "bg-bg-sunk" : ""}`}
            >
              {s.logo ? (
                <Sigil seed={s.slug} name={s.title} kind={s.kind} size={20} logo={s.logo} logoSurface={s.logoSurface} />
              ) : (
                <span
                  aria-hidden
                  className="size-5 shrink-0"
                  style={{ borderRadius: s.kind === "repo" ? 999 : 6, background: sigilGradient(s.slug, !s.isArticle) }}
                />
              )}
              <span className="min-w-0 flex-1 truncate">
                <span className="text-ink">{s.title}</span>
                <span className="ml-2 font-mono text-[11.5px] text-muted">{s.path}</span>
              </span>
              <span className="shrink-0 text-[11.5px] uppercase tracking-[0.08em] text-muted">{s.isArticle ? s.kind : "folder"}</span>
            </li>
          ))}
          <li
            id={optionId(items.length)}
            role="option"
            aria-selected={active === items.length}
            onMouseDown={(e) => {
              e.preventDefault();
              go(value);
            }}
            onMouseEnter={() => setActive(items.length)}
            className={`mt-1 flex cursor-pointer items-center gap-3 text-[13.5px] ${hero ? "px-5 py-1.5" : "px-4 py-1"} ${active === items.length ? "bg-bg-sunk text-ink" : "text-muted"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            Search everything for “{value.trim()}”
          </li>
        </ul>
      )}
    </form>
  );
}
