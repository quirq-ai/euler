import Link from "next/link";
import { getIndex } from "@/lib/data";
import { longDate, num } from "@/lib/format";
import { searchHref, wikiHref } from "@/lib/links";
import { DEMO } from "@/lib/mode";
import { CHAPTERS } from "./chapters";
import { indexFacts } from "./data";
import { Figure, PLATE_IDS } from "./plate";
import { exists } from "./source";

// The title page: the aurora, the promise, the live counts, the explainer film as a
// frontispiece, and the contents. It opens the guide's half of the home page, so it is
// revealed as the reader scrolls down to it rather than on first paint.

// The film in full HD when it has been rendered here (it is gitignored), else the
// committed 720p copy, else a placeholder.
const FILMS = ["innernet-explainer.mp4", "innernet-explainer-720p.mp4"];
const POSTER = "film-poster.jpg";
const CAPTIONS = "innernet-explainer.vtt";

// What public/guide held when the app was built (next.config.ts). The deployed demo's
// server functions cannot see public/, which the CDN serves, so they trust this list.
const BUILT = new Set(DEMO ? (process.env.INNERNET_GUIDE_MEDIA ?? "").split(",").filter(Boolean) : []);

/** True when public/guide/<name> is there to be served. */
const has = (name: string) => exists(`public/guide/${name}`) || BUILT.has(name);

const AURORA_MASK = "radial-gradient(ellipse min(760px, 110vw) min(520px, 70vh) at 50% 30%, #000 18%, transparent 100%)";

/** A reveal that waits a beat behind the one before it. */
const after = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;

export function Hero() {
  const { index, missing } = getIndex();
  const { counts } = index.meta;
  const facts = indexFacts();

  return (
    <div className="relative isolate overflow-x-clip">
      <div className="aurora" aria-hidden style={{ maskImage: AURORA_MASK, WebkitMaskImage: AURORA_MASK }}>
        <span />
        <span />
        <span />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
        <p className="fg-smallcaps text-center" data-reveal>
          {missing ? (
            "A field guide in five chapters"
          ) : (
            <>
              {/* On a phone the edition takes its own line rather than breaking in two. */}
              A field guide in five chapters<span className="max-sm:hidden"> · </span>
              <span className="max-sm:block whitespace-nowrap">Edition of {longDate(index.meta.generatedAt)}</span>
            </>
          )}
        </p>
        <h2 id="guide-title" className="mt-6 text-center font-display text-[58px] leading-[0.92] tracking-[-0.025em] text-ink sm:text-[104px]" data-reveal style={after(80)}>
          The <em>Inner</em>net <span className="block">Field Guide</span>
        </h2>
        <p className="mx-auto mt-7 max-w-[600px] text-center font-serif text-[20px] leading-[1.5] text-ink-2 sm:text-[23px]" data-reveal style={after(160)}>
          How the folders on {DEMO ? "your machine" : "this machine"} become a search engine and an encyclopedia, and how to add to both.
        </p>
        <p className="mt-6 flex justify-center" data-reveal style={after(220)}>
          <a
            href="#privacy"
            className="inline-flex items-center gap-2.5 rounded-full border border-link/40 px-4 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.18em] text-link transition-colors hover:border-link hover:bg-link/5"
          >
            <svg aria-hidden width="11" height="13" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="8" width="12" height="9" rx="1.5" />
              <path d="M4.5 8V5.5a3.5 3.5 0 0 1 7 0V8" />
            </svg>
            Private · local · <span className="text-ink">0 B</span> sent
          </a>
        </p>

        {!missing && (
          <dl className="mx-auto mt-10 grid max-w-[860px] grid-cols-3 gap-y-6 text-center sm:flex sm:flex-wrap sm:justify-center sm:gap-y-5" data-reveal style={after(280)}>
            {[
              { n: counts.pages, label: "folders", href: wikiHref("Special:Statistics") },
              { n: counts.articles, label: "articles", href: wikiHref("Special:AllPages") },
              { n: counts.stubs, label: "stubs", href: searchHref("is:stub") },
              { n: counts.repos, label: "repositories", href: searchHref("kind:repo") },
              { n: facts.shared, label: "shared names", href: wikiHref("src") },
              { n: counts.categories, label: "categories", href: wikiHref("Special:Categories") },
            ].map((c, i) => (
              // The term comes first, as a list of terms must; the number is shown above it.
              <div key={c.label} className={`flex min-w-0 flex-col-reverse px-2 sm:min-w-[112px] sm:px-6 ${i > 0 ? "sm:border-l sm:border-line" : ""}`}>
                <dt className="fg-smallcaps mt-2">{c.label}</dt>
                <dd className="font-display text-[30px] leading-none tabular-nums text-ink sm:text-[34px]">
                  <Link href={c.href} className="transition-colors hover:text-link">
                    {num(c.n)}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mx-auto mt-14 max-w-[1000px] sm:mt-16">
          <Film />
        </div>

        <Contents />
      </div>
    </div>
  );
}

function Film() {
  const film = FILMS.find(has) ?? null;
  const captions = has(CAPTIONS);
  const caption = film ? (
    <>A short film of the whole guide, drawn from the same eight plates.{captions ? " Captions are on the player." : ""}</>
  ) : (
    <>A short film of the whole guide is being drawn from the same eight plates. It will play here when it is ready.</>
  );
  return (
    <Figure fig="Frontispiece" title="The film" caption={caption} imprint={<><span>public/guide/{film ?? FILMS[0]}</span><span>16 : 9</span></>}>
      {film ? (
        <video
          controls
          preload="metadata"
          playsInline
          poster={has(POSTER) ? `/guide/${POSTER}` : undefined}
          src={`/guide/${film}`}
          className="block aspect-video w-full bg-bg-sunk"
        >
          {/* The film carries its own captions; this track is there for players and readers
              that want them separately, so it starts switched off. */}
          {captions && <track kind="captions" src={`/guide/${CAPTIONS}`} srcLang="en" label="English" />}
        </video>
      ) : (
        <FilmPlaceholder />
      )}
    </Figure>
  );
}

/** A film still in the cutting room: a strip with sprocket holes, the reel of plates
 * it will be made from, and a quiet notice. */
function FilmPlaceholder() {
  return (
    <div className="fg-filmstrip relative isolate aspect-video w-full overflow-hidden">
      <div className="aurora opacity-60" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="absolute inset-x-0 top-[9%] bottom-[9%] grid place-items-center px-6 text-center">
        <div>
          <div className="fg-smallcaps">Reel one · in the cutting room</div>
          <div className="mt-3 font-display text-[34px] italic leading-[1.05] text-ink sm:mt-4 sm:text-[60px]">The film is being made</div>
          <ol className="mx-auto mt-6 hidden max-w-[560px] grid-cols-4 gap-x-6 gap-y-1.5 text-left font-mono text-[11.5px] text-muted sm:grid">
            {PLATE_IDS.map((id, i) => (
              <li key={id} className="whitespace-nowrap">
                <span className="text-faint">{String(i + 1).padStart(2, "0")}</span> {id}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Contents() {
  return (
    <nav aria-labelledby="contents-h" className="mx-auto mt-20 max-w-[860px] sm:mt-24">
      <h3 id="contents-h" className="fg-smallcaps text-center">
        Contents
      </h3>
      <ol className="mt-6 border-t border-line-strong">
        {CHAPTERS.map((c, i) => (
          <li key={c.id} className="border-b border-line" data-reveal style={after(i * 60)}>
            <a href={`#${c.id}`} className="group grid grid-cols-[52px_minmax(0,1fr)] items-baseline gap-x-4 py-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:py-5">
              <span className="font-display text-[30px] leading-none text-faint transition-colors group-hover:text-ink sm:text-[38px]">{c.numeral}</span>
              <span className="min-w-0">
                <span className="block font-display text-[26px] leading-tight text-ink transition-colors group-hover:text-link sm:text-[30px]">{c.title}</span>
                <span className="mt-1 block font-serif text-[16px] leading-snug text-muted">{c.blurb}</span>
              </span>
              <span className="fg-smallcaps col-start-2 mt-2 sm:col-start-auto sm:mt-0 sm:text-right">{c.figs}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
