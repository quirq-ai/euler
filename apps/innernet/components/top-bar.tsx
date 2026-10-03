import Link from "next/link";
import { BrandLinks, QuirqHome } from "@/components/brand-nav";
import { SearchBox } from "@/components/search-box";
import { ThemeToggle } from "@/components/theme-toggle";
import { PediaMark, Wordmark } from "@/components/wordmark";

// Header for every page except home: the quirq mark home, the wordmark, compact search,
// the way across to the other half of the site, back and forward through this tab's
// trail with the way to its history, and the guide, quirq and GitHub links.

export function TopBar({ q = "", variant = "search" }: { q?: string; variant?: "search" | "wiki" }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <a
        href="#content"
        className="sr-only rounded-full bg-surface text-[13.5px] text-ink shadow-lift focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <div className="flex shrink-0 items-center gap-3">
          <QuirqHome />
          <span aria-hidden className="hidden h-6 w-px bg-line-strong sm:block" />
          <div className="hidden sm:block">{variant === "wiki" ? <PediaMark size={26} /> : <Wordmark size={27} />}</div>
        </div>
        <div className="min-w-0 max-w-[640px] flex-1">
          <SearchBox defaultValue={q} placeholder={variant === "wiki" ? "Search Innerpedia" : "Search your internet"} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 text-[13.5px]">
          {/* On a phone the way across moves to the footer. */}
          <nav aria-label="Site" className="hidden sm:block">
            {variant === "wiki" ? (
              <Link href="/" className="block rounded-full px-3 py-1.5 text-muted hover:bg-bg-sunk hover:text-ink">
                Search
              </Link>
            ) : (
              <Link href="/wiki" className="block rounded-full px-3 py-1.5 text-muted hover:bg-bg-sunk hover:text-ink">
                Innerpedia
              </Link>
            )}
          </nav>
          <BrandLinks compact />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
