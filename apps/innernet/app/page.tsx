import type { Metadata } from "next";
import Link from "next/link";
import { BrandLinks, QuirqHome } from "@/components/brand-nav";
import { FieldGuide } from "@/components/guide/field-guide";
import { AskAnAiCard, AskAnAiRow } from "@/components/home/ask-an-ai";
import { ExampleQueries } from "@/components/home/example-queries";
import { GuideCue } from "@/components/home/guide-cue";
import { HeroSearch } from "@/components/home/hero-search";
import { HomeFooter } from "@/components/home/home-footer";
import { MissingIndex } from "@/components/home/missing-index";
import { RecentlyTouched, recentlyTouched } from "@/components/home/recently-touched";
import { ThemeToggle } from "@/components/theme-toggle";
import { getIndex } from "@/lib/data";
import { num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { DEMO, DEMO_ORG } from "@/lib/mode";

export const metadata: Metadata = DEMO
  ? {
      title: { absolute: "Innernet · a demo of your personal internet" },
      description: `A demo of Innernet: the open-source repositories of github.com/${DEMO_ORG}, searchable like the web and readable in Innerpedia, with the Innernet Field Guide to how it works and how to run it on your own folders.`,
    }
  : {
      title: { absolute: "Innernet · your personal internet" },
      description:
        "Search the folders on this machine like the web, read your projects in Innerpedia, and learn how both work in the Innernet Field Guide.",
    };

// Counts, "indexed N ago" and the guide's live numbers are read on every request.
export const dynamic = "force-dynamic";

// The shared .aurora mask is sized in percent, so on wide screens it washes the whole
// page. Here it is a fixed-size pool of light behind the wordmark and the box, and the
// paper shows around it at every width.
const AURORA_MASK = "radial-gradient(ellipse min(580px, 100vw) min(440px, 56vh) at 50% 38%, #000 22%, transparent 100%)";
const auroraStyle = { maskImage: AURORA_MASK, WebkitMaskImage: AURORA_MASK };

// One page in two movements. The first screen is the search engine: the wordmark, the
// box, the examples, the invitation to an AI, recently touched, and a cue at its foot.
// Below it the Innernet Field Guide (components/guide/field-guide.tsx) runs on as the
// reader scrolls, ending with the full invitation and the colophon.
export default function Home() {
  const { index, articles, missing } = getIndex();
  const { counts } = index.meta;
  const recent = missing ? [] : recentlyTouched(articles);

  return (
    <div className="relative overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-4 pt-5 sm:px-6">
          <QuirqHome size={30} />
          <div className="flex items-center gap-1 text-[13.5px]">
            {/* The way across stays on a phone too: the footer is a whole field guide away.
                The links beside it give way instead (the guide begins just below). */}
            <Link href="/wiki" className="block rounded-full px-2.5 py-1.5 text-muted transition-colors hover:bg-bg-sunk hover:text-ink sm:px-3">
              Innerpedia
            </Link>
            <BrandLinks compact />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="content">
        <div id="top" className="home-first relative isolate flex min-h-[calc(100dvh-var(--demo-bar,0px))] flex-col pt-14">
          <div className="aurora" aria-hidden style={auroraStyle}>
            <span />
            <span />
            <span />
          </div>

          <section className="flex flex-1 flex-col items-center justify-center px-4 pb-[5vh] pt-[11vh] sm:pt-[9vh]">
            <div className="home-lift flex flex-col items-center">
              <h1 className="rise font-display text-[64px] leading-[0.95] tracking-[-0.02em] text-ink sm:text-[96px]">
                <em>inner</em>net
              </h1>

              <p className="rise mt-4 text-center text-[15px] text-muted sm:mt-5" style={{ animationDelay: "60ms" }}>
                {missing ? (
                  DEMO ? "The demo, waiting to be indexed" : "Your personal internet, waiting to be indexed"
                ) : (
                  <>
                    <span className="block sm:inline">{DEMO ? `The open-source repos of ${DEMO_ORG}` : "Your personal internet"}</span>
                    <Count n={counts.pages} label="folders" href={wikiHref("Special:Statistics")} first />
                    <Count n={counts.articles} label="articles" href={wikiHref("Special:AllPages")} />
                    <Count n={counts.repos} label="repositories" href={searchHref("kind:repo")} className="hidden sm:inline" />
                  </>
                )}
              </p>
            </div>

            <div className="mt-9 flex w-full flex-col items-center sm:mt-10">
              {missing ? (
                <MissingIndex />
              ) : (
                <>
                  <HeroSearch />
                  <div className="rise mt-6" style={{ animationDelay: "240ms" }}>
                    <ExampleQueries pages={index.pages} />
                  </div>
                </>
              )}
              <div className="rise mt-5 w-full max-w-[620px]" style={{ animationDelay: "280ms" }}>
                <AskAnAiRow />
              </div>
            </div>
          </section>

          <RecentlyTouched pages={recent} delay={300} />
          <GuideCue delay={520} />
        </div>

        <FieldGuide end={<AskAnAiCard />} />
      </main>

      <HomeFooter meta={index.meta} missing={missing} />
    </div>
  );
}

/**
 * " · 958 articles". Like the article count on Wikipedia's front page, each count is a
 * quiet link to where those things are listed. On phones the line breaks before the
 * first count, so that middot hides.
 */
function Count({ n, label, href, first = false, className = "" }: { n: number; label: string; href: string; first?: boolean; className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden className={`mx-2 text-faint ${first ? "hidden sm:inline" : ""}`}>
        ·
      </span>
      <Link
        href={href}
        className="group decoration-line-strong underline-offset-[5px] transition-colors hover:text-ink hover:underline"
      >
        <span className="tabular-nums text-ink-2 transition-colors group-hover:text-ink">{num(n)}</span> {label}
      </Link>
    </span>
  );
}
