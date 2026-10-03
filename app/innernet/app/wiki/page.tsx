import type { Metadata } from "next";
import { WikiShell } from "@/components/wiki/wiki-shell";
import { BrowseByCategory, OtherAreas } from "@/components/wiki/main/browse";
import { DidYouKnow } from "@/components/wiki/main/did-you-know";
import { FeaturedArticle } from "@/components/wiki/main/featured";
import { InTheNews } from "@/components/wiki/main/in-the-news";
import { OnThisDay } from "@/components/wiki/main/on-this-day";
import { Reveal } from "@/components/wiki/main/reveal";
import { Welcome } from "@/components/wiki/main/welcome";
import { getIndex } from "@/lib/data";
import { INDEX_COMMAND } from "@/lib/mode";

// Innerpedia's front page, a love letter to Wikipedia's: the globe of every project as
// the whole first screen, then, as you scroll, the day's featured article, news, trivia
// and anniversaries, all computed from the index.

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Innerpedia, the encyclopedia of you" };

export default function WikiMain() {
  if (getIndex().missing) {
    return (
      <WikiShell>
        <main className="mx-auto max-w-[640px] py-20 text-center">
          <h1 className="font-display text-[48px] leading-tight">
            <em className="italic">Inner</em>pedia is still blank
          </h1>
          <p className="mt-4 font-serif text-[18px] text-ink-2">
            No index has been built yet. Run <code className="rounded-md bg-bg-sunk px-1.5 py-0.5 font-mono text-[14px]">{INDEX_COMMAND}</code> and every
            folder you keep will get a page.
          </p>
        </main>
      </WikiShell>
    );
  }

  return (
    <WikiShell>
      <main className="flex flex-col">
        <Welcome />
        <div id="today" className="flex scroll-mt-24 flex-col gap-12 pt-6 sm:gap-14 sm:pt-10">
          {/* Two columns on wide screens. On narrow ones the columns dissolve (display:
              contents) so the boxes read in Wikipedia's order: featured, news, trivia, then
              the long On this day. */}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-14">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-12">
              <Reveal className="order-1 lg:order-none">
                <FeaturedArticle />
              </Reveal>
              <Reveal className="order-4 lg:order-none" delay={60}>
                <OnThisDay />
              </Reveal>
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-12">
              <Reveal className="order-2 lg:order-none" delay={90}>
                <InTheNews />
              </Reveal>
              <Reveal className="order-3 lg:order-none" delay={60}>
                <DidYouKnow />
              </Reveal>
            </div>
          </div>
          <Reveal>
            <BrowseByCategory />
          </Reveal>
          <Reveal>
            <OtherAreas />
          </Reveal>
        </div>
      </main>
    </WikiShell>
  );
}
