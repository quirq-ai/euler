import Link from "next/link";
import { getIndex } from "@/lib/data";
import { longDate, timeAgo } from "@/lib/format";
import { INDEX_PATH } from "@/lib/mode";
import { AddSite } from "./add-site";
import { CHAPTERS } from "./chapters";
import { Contribute } from "./contribute";
import { GuideMotion } from "./guide-motion";
import { GuideBar, GuideRail } from "./guide-ruler";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { hasPlate, PLATE_IDS } from "./plate";
import { Privacy } from "./privacy";
import { SearchPro } from "./search-pro";
import "./guide.css";

// The Innernet Field Guide, bound in one piece: the title page with its film and
// contents, then the five chapters beside their rail, then whatever the page adds at
// the end (`end`), then the colophon. It lives on the home page under the search box,
// at /#guide. Every number is read from the live index and every code excerpt from the
// code itself, so the guide never drifts from the app.

export function FieldGuide({ end }: { end?: React.ReactNode }) {
  return (
    <section id="guide" aria-labelledby="guide-title" className="relative">
      <Hero />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:grid lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        {/* The rail rises in with the first chapter, then holds to the window. */}
        <aside className="hidden lg:block" data-reveal>
          <GuideRail chapters={CHAPTERS} />
        </aside>
        <div id="guide-body" className="min-w-0 pb-8">
          <GuideBar chapters={CHAPTERS} />
          <div className="mx-auto max-w-[920px] lg:mx-0">
            <HowItWorks />
            <AddSite />
            <SearchPro />
            <Contribute />
            <Privacy />
            {end}
            <Colophon />
          </div>
        </div>
      </div>
      <GuideMotion />
    </section>
  );
}

function Colophon() {
  const { index, missing } = getIndex();
  const drawn = PLATE_IDS.filter(hasPlate).length;
  const plates =
    drawn === PLATE_IDS.length
      ? "The plates are engraved in SVG and draw themselves once; they keep still for readers who ask for less motion."
      : drawn > 0
        ? `${drawn} of the ${PLATE_IDS.length} plates are engraved in SVG and draw themselves once, keeping still for readers who ask for less motion; the rest are still at the engraver's.`
        : "The plates are still at the engraver's; until they arrive, each frame holds a first sketch of what it will show.";
  return (
    <aside aria-label="Colophon" className="mt-32 border-t border-line-strong pt-10 text-center" data-reveal>
      <svg aria-hidden width="44" height="44" viewBox="0 0 44 44" className="mx-auto text-faint" fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="22" cy="22" r="13" />
        <circle cx="22" cy="22" r="7" />
        <path d="M2 22h40M22 2v40" />
        <circle cx="22" cy="22" r="1.6" stroke="none" style={{ fill: "var(--link)" }} />
      </svg>
      <h2 className="fg-smallcaps mt-6">Colophon</h2>
      <p className="mx-auto mt-4 max-w-[560px] font-serif text-[16px] italic leading-[1.65] text-ink-2">
        Set in Instrument Serif, Newsreader, Inter and JetBrains Mono. Every number on this page was read from{" "}
        <span className="font-mono text-[0.85em] not-italic">{INDEX_PATH}</span>
        {missing ? "" : <>, indexed {timeAgo(index.meta.generatedAt)} on {longDate(index.meta.generatedAt)}</>}, and every excerpt from the code as it stands.{" "}
        {plates}
      </p>
      <p className="mt-6 text-[13.5px]">
        <Link href="/wiki" className="link">
          Continue to Innerpedia
        </Link>
        <span aria-hidden className="px-2.5 text-faint">
          ·
        </span>
        <a href="#top" className="link">
          Back to the search
        </a>
      </p>
    </aside>
  );
}
