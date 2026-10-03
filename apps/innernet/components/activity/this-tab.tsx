"use client";

import { useEffect, useState } from "react";
import { SESSION_RE } from "./shared";
import { currentSessionId } from "./trail";

// The server cannot know which session is this tab's (its id lives in sessionStorage),
// so once the page has loaded this marks it: the "This tab" badge shows, and the
// session opens if the newest one is not it.

export function ThisTab() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const mine = currentSessionId();
    if (!mine || !SESSION_RE.test(mine)) return;
    setId(mine);
    const el = document.getElementById(`s-${mine}`);
    if (el instanceof HTMLDetailsElement) el.open = true;
  }, []);

  // The id has passed SESSION_RE, so it is safe inside a selector.
  return id ? <style>{`#s-${id} .this-tab{display:inline-flex}`}</style> : null;
}
