import Link from "next/link";
import { HistoryNav } from "@/components/activity/history-nav";

// The quirq mark and the small links every header carries: back and forward through
// this tab's trail and the way to its history, the field guide, quirq, and the code on
// GitHub. Plain links and buttons; nothing here fetches.

export const QUIRQ_URL = "https://quirq.ai";
export const GITHUB_URL = "https://github.com/quirq-ai/innernet";

/** The quirq mark (public/brand/quirq/app-icon.svg): the q on a tile, ink and paper swapping with the theme. */
export function QuirqMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className={className}>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <path
        transform="translate(15,9) scale(0.34)"
        className="fill-bg"
        d="M50 0A50 50 0 0 1 100 50V118A14 14 0 0 1 86 132A14 14 0 0 1 72 118V94.87A50 50 0 1 1 50 0ZM50 33A17 17 0 1 0 50 67A17 17 0 1 0 50 33Z"
      />
    </svg>
  );
}

/** The mark as the way home, at the far left of every header. */
export function QuirqHome({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" aria-label="Innernet home" title="Home" className="shrink-0 rounded-[9px] transition-opacity hover:opacity-80 focus-visible:rounded-[9px]">
      <QuirqMark size={size} />
    </Link>
  );
}

/**
 * The trail, then guide, quirq and GitHub. Below md quirq goes. In a header that also
 * holds the search box (`compact`) they give way sooner, so the box keeps its width:
 * quirq waits for lg, the guide is its icon below md, and GitHub goes on a phone.
 */
export function BrandLinks({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <nav aria-label="Guide and links" className={`flex items-center gap-1 ${className}`}>
      <HistoryNav compact={compact} className="mr-1 max-sm:mr-0" />
      <Link
        href="/#guide"
        aria-label={compact ? "Guide" : undefined}
        className={`flex items-center gap-1.5 rounded-full border border-line-strong py-1.5 text-[13px] text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:rounded-full ${
          compact ? "max-md:size-8 max-md:justify-center max-md:p-0 md:px-3" : "px-3"
        }`}
      >
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5.5c3-1.4 6-1.4 9 0v14c-3-1.4-6-1.4-9 0Z" />
          <path d="M12 5.5c3-1.4 6-1.4 9 0v14c-3-1.4-6-1.4-9 0" />
        </svg>
        <span className={compact ? "max-md:hidden" : ""}>Guide</span>
      </Link>
      <a
        href={QUIRQ_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="quirq.ai"
        className={`hidden rounded-full px-2.5 py-1.5 font-display text-[16px] leading-none text-muted transition-colors hover:bg-bg-sunk hover:text-ink focus-visible:rounded-full ${compact ? "lg:block" : "md:block"}`}
      >
        quirq
      </a>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Innernet on GitHub"
        title="Innernet on GitHub"
        className={`${compact ? "hidden sm:grid" : "grid"} size-9 place-items-center rounded-full text-muted transition-colors hover:bg-bg-sunk hover:text-ink focus-visible:rounded-full`}
      >
        <svg aria-hidden width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      </a>
    </nav>
  );
}
