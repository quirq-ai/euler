"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { pageLabel } from "./shared";
import { readTrail, record, takePendingMove, writeTrail, type Fields } from "./trail";

// Mounted once, in the root layout. Every route change becomes one event: "search"
// for a results page, "back" or "forward" for a step along the trail (the header's
// buttons, or the browser's own when it lands on the neighbouring page), "visit" for
// everything else. A reload is not a new event. Automated browsers (screenshots, tests)
// are not recorded, so the history holds only what a person did. `server` says whether
// the event goes to the server: always on this machine, and on the demo only when it
// keeps a database (components/activity/trail.ts).

// Module state outlives React's double-run of effects in development, so a page is
// recorded once however many times its effect runs.
let lastUrl: string | null = null;
let poppedAt = 0;
let seenPop: Event | null = null;

const tidyTitle = (t: string) => t.replace(/\s·\sInnernet$/, "").trim().slice(0, 200);
const automated = () => typeof navigator !== "undefined" && navigator.webdriver === true;

export function ActivityRecorder({ demo, server }: { demo: boolean; server: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const titleBefore = useRef("");

  // A step with the browser's own buttons arrives as popstate. React renders Next.js's
  // route change inside that event, so this effect usually runs while it is still being
  // dispatched (window.event); the listener covers a render that comes later.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (e !== seenPop) poppedAt = Date.now();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (automated()) return;
    const url = pathname + (search ? `?${search}` : "");
    if (url === lastUrl) return;
    lastUrl = url;

    const q = pathname === "/search" ? new URLSearchParams(search).get("q")?.trim().slice(0, 300) || undefined : undefined;
    const trail = readTrail();
    const here = trail.cursor;
    const moved = takePendingMove(url);
    const during = window.event?.type === "popstate" ? window.event : null;
    if (during) seenPop = during;
    const popped = !!during || Date.now() - poppedAt < 2000;
    poppedAt = 0;

    let kind: Fields["kind"] = q ? "search" : "visit";
    let via: Fields["via"];
    if (moved && trail.stack[here]?.url === url) {
      // The buttons already moved the cursor.
      kind = moved;
      via = "buttons";
    } else if (popped && trail.stack[here - 1]?.url === url) {
      kind = "back";
      via = "browser";
      writeTrail({ ...trail, cursor: here - 1 });
    } else if (popped && trail.stack[here + 1]?.url === url) {
      kind = "forward";
      via = "browser";
      writeTrail({ ...trail, cursor: here + 1 });
    } else if (trail.stack[here]?.url === url) {
      // A reload, or a new tab with this one's storage: the trail is already here.
      return;
    } else {
      writeTrail({ stack: [...trail.stack.slice(0, here + 1), { url, label: pageLabel(url, undefined, q) }], cursor: here + 1 });
    }

    // The title arrives with the page's metadata, a moment after the route changes, so
    // wait for it to change (or 1.5s, for two pages that share a title).
    const before = titleBefore.current;
    let done = false;
    const finish = (title: string | undefined) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      clearTimeout(deadline);
      if (title) titleBefore.current = title;
      const tidy = title ? tidyTitle(title) : undefined;
      const label = pageLabel(url, tidy, q);
      const t = readTrail();
      const entry = t.stack[t.cursor];
      if (label && entry?.url === url && entry.label !== label) {
        entry.label = label;
        writeTrail(t);
      }
      record(kind === "search" ? { kind, q, url } : { kind, url, title: tidy, ...(q ? { q } : {}), ...(via ? { via } : {}) }, demo, server);
    };
    const check = () => {
      if (document.title && document.title !== before) finish(document.title);
    };
    const timer = setInterval(check, 80);
    const deadline = setTimeout(() => finish(document.title || undefined), 1500);
    check();
    // Left before the title came: record it without one rather than with the next page's.
    return () => finish(undefined);
  }, [pathname, search, demo, server]);

  return null;
}
