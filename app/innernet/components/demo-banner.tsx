import Link from "next/link";
import { demoKeepsHistory } from "@/lib/db";
import { RETENTION_DAYS } from "@/lib/db/demo-history";
import { DEMO_ORG, DEMO_ORG_URL, DEMO_REPO_URL } from "@/lib/mode";

// The one line every page of the demo opens with: what this is, whose folders these
// are, where your history goes, and where to get an Innernet of your own. Only rendered
// in the demo (lib/mode.ts). The history note says what the demo really does: with a
// database it keeps the pages and searches you open for 30 days, anonymously
// (lib/db/demo-history.ts), and says so at every width, shorter on a phone, where the
// link to the code gives way below 360 pixels instead; without one, as on a fork, they
// stay in your browser, and the note gives way on narrow screens, where /activity says
// the same at more length.

/** Its height, which pages that fill the window subtract (see app/layout.tsx). */
export const DEMO_BAR = "36px";

export function DemoBanner() {
  const org = DEMO_ORG_URL.replace(/^https:\/\//, "");
  const kept = demoKeepsHistory();
  // With the history note, the link to the code gives way on the narrowest phones.
  const narrowGoes = kept ? " max-[359px]:hidden" : "";
  return (
    <aside aria-label="About this demo" className="relative z-50 border-b border-line bg-bg-sunk text-[12.5px] text-muted" style={{ height: DEMO_BAR }}>
      <div className={`mx-auto flex h-full max-w-[1240px] items-center justify-center whitespace-nowrap px-4 sm:px-6 ${kept ? "gap-1.5 sm:gap-2.5" : "gap-2.5"}`}>
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden className="size-[7px] rounded-full" style={{ background: "linear-gradient(135deg, var(--aurora-1), var(--aurora-2) 55%, var(--aurora-3))" }} />
          <span className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-2">Demo</span>
        </span>
        <span aria-hidden className="text-faint">
          ·
        </span>
        {/* With the history note beside it, the long form waits for the widest screens. */}
        <span className="min-w-0 truncate">
          <span className={kept ? "hidden lg:inline" : "hidden sm:inline"}>an index of the open-source repos of </span>
          <span className={kept ? "hidden sm:inline lg:hidden" : "sm:hidden"}>public repos of </span>
          <a
            href={DEMO_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-2 decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            <span className={`hidden font-mono text-[11.5px] ${kept ? "lg:inline" : "sm:inline"}`}>{org}</span>
            <span className={kept ? "lg:hidden" : "sm:hidden"}>{DEMO_ORG}</span>
          </a>
        </span>
        <span aria-hidden className={kept ? "text-faint" : "hidden text-faint lg:inline"}>
          ·
        </span>
        <Link
          href="/activity"
          prefetch={false}
          className={`${kept ? "" : "hidden lg:inline "}shrink-0 text-ink-2 decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:underline`}
        >
          {kept ? (
            <>
              <span className="hidden lg:inline">Your pages and searches are kept {RETENTION_DAYS} days, anonymously</span>
              <span className="hidden sm:inline lg:hidden">History kept {RETENTION_DAYS} days</span>
              <span className="sm:hidden">{RETENTION_DAYS}-day history</span>
            </>
          ) : (
            "Your history stays in your browser"
          )}
        </Link>
        <span aria-hidden className={`text-faint${narrowGoes}`}>
          ·
        </span>
        <a href={DEMO_REPO_URL} target="_blank" rel="noopener noreferrer" className={`shrink-0 text-link transition-colors hover:text-link-hover hover:underline hover:underline-offset-4${narrowGoes}`}>
          <span className="hidden sm:inline">Run it on your own folders</span>
          <span className="sm:hidden">Run your own</span>
        </a>
      </div>
    </aside>
  );
}
