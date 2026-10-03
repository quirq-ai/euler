import { PROJECT_ROOT } from "@/lib/project-root";
import fs from "node:fs";
import path from "node:path";

// The guide's figures. Every one sits in the same frame: printer's crop marks at the
// corners, a hairline border, a head line with its figure number and title, and a
// caption below, the way a plate is bound into a field atlas.
//
// <Plate> fills the frame with an engraved line drawing from public/guide/plates/<id>.svg.
// Those drawings are this project's own assets (the explainer film uses the same plates),
// so they are inlined, which lets the page colour them per theme and draw them on as
// they scroll into view. Until a drawing exists the frame holds a quiet placeholder.

const PLATES_DIR = path.join(PROJECT_ROOT, "public", "guide", "plates");

export const PLATE_IDS = ["pipeline", "crawl", "anatomy", "search", "names", "add-site", "codebase", "contribute", "privacy"] as const;
export type PlateId = (typeof PLATE_IDS)[number];

export function Figure({
  fig,
  title,
  caption,
  imprint,
  className = "",
  bodyClassName = "",
  children,
}: {
  fig: number | string;
  title: string;
  caption?: React.ReactNode;
  imprint?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const label = typeof fig === "number" ? `Fig. ${fig}` : fig;
  return (
    <figure className={`fg-figure ${className}`} data-reveal>
      <div className="fg-plate">
        <span aria-hidden className="fg-ticks" />
        <div className="fg-frame">
          <div className="fg-head">
            <span>{label}</span>
            <span className="fg-head-rule" aria-hidden />
            <span className="text-right">{title}</span>
          </div>
          <div className={bodyClassName}>{children}</div>
          {imprint && <div className="fg-imprint">{imprint}</div>}
        </div>
      </div>
      {caption && (
        <figcaption className="fg-caption">
          <span className="fg-caption-label">{label}.</span> {caption}
        </figcaption>
      )}
    </figure>
  );
}

let svgCache = new Map<string, { mtime: number; html: string | null }>();

/** Reads and prepares a plate drawing, or null when it has not been drawn yet. */
function plateSvg(id: PlateId): string | null {
  const file = path.join(PLATES_DIR, `${id}.svg`);
  let mtime: number;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
  const hit = svgCache.get(id);
  if (hit && hit.mtime === mtime) return hit.html;
  let html: string | null = null;
  try {
    html = prepareSvg(fs.readFileSync(file, "utf8"), id);
  } catch {
    html = null;
  }
  if (svgCache.size > 32) svgCache = new Map();
  svgCache.set(id, { mtime, html });
  return html;
}

/**
 * Our own drawing, but held to the page's rules anyway: no scripts, event handlers,
 * foreign objects, style sheets or outside references. Ids are prefixed with the plate
 * id, so two plates on one page never share a marker or gradient, and the root loses
 * its fixed size so it scales with the frame.
 */
function prepareSvg(raw: string, id: string): string | null {
  let s = raw
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|foreignObject)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|foreignObject)\b[^>]*\/>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Only same-document references survive: href="#arrow", not files or URLs.
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none")
    .trim();
  const open = s.match(/^<svg\b[^>]*>/i);
  if (!open || !/<\/svg>\s*$/i.test(s)) return null;
  const viewBox = open[0].match(/\bviewBox\s*=\s*("[^"]*"|'[^']*')/i)?.[1];
  if (!viewBox) return null;
  s = s
    .replace(/\bid\s*=\s*(["'])([^"']+)\1/g, (_, q: string, v: string) => `id=${q}${id}-${v}${q}`)
    .replace(/url\(\s*(['"]?)#([^)'"]+)\1\s*\)/g, (_, q: string, v: string) => `url(#${id}-${v})`)
    .replace(/(\s(?:xlink:)?href\s*=\s*)(["'])#([^"']+)\2/g, (_, a: string, q: string, v: string) => `${a}${q}#${id}-${v}${q}`);
  // Paint defaults set on the root (fill="none" stroke="currentColor"...) are kept.
  const keep = [...open[0].matchAll(/\s((?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|font-family|font-size|font-style|letter-spacing|text-rendering|shape-rendering)\s*=\s*(?:"[^"]*"|'[^']*'))/gi)]
    .map((m) => m[1])
    .join(" ");
  return s.replace(/^<svg\b[^>]*>/i, `<svg xmlns="http://www.w3.org/2000/svg" viewBox=${viewBox} ${keep} class="fg-svg" aria-hidden="true" focusable="false">`);
}

export function hasPlate(id: PlateId): boolean {
  return plateSvg(id) !== null;
}

/** What each plate will show, as an engraver's first sketch: the terms in order, joined
 * by arrows when they flow from one to the next. */
const SKETCHES: Record<PlateId, { terms: string[]; flow: boolean; loop?: boolean }> = {
  pipeline: { terms: ["your folders", "pnpm index", "data/index.json", "search", "Innerpedia", "you"], flow: true },
  crawl: { terms: ["a root", "walk, depth first", "prune", "read four files", "tally at depth 6"], flow: true },
  anatomy: { terms: ["README: lead and Overview", "package.json: infobox", ".git: History", "CLAUDE.md: a line for agents", "files: languages"], flow: false },
  search: { terms: ["query", "tokens", "inverted index", "field weight", "prior", "results"], flow: true },
  names: { terms: ["a name", "its slug", "a primary topic", "name (qualifier)", "name (disambiguation)"], flow: true },
  "add-site": { terms: ["folder", "README", "manifest", "git", "pnpm index", "article"], flow: true },
  codebase: { terms: ["scripts/", "data/index.json", "lib/", "app/", "components/", "your browser"], flow: true },
  contribute: { terms: ["edit", "typecheck", "crawl", "screenshot", "pull request"], flow: true, loop: true },
  privacy: { terms: ["this machine", "the index", "search", "Innerpedia", "one gate: 127.0.0.1", "0 bytes sent"], flow: false },
};

export function Plate({
  id,
  fig,
  title,
  caption,
  alt,
  imprint,
  className = "",
}: {
  id: PlateId;
  fig: number;
  title: string;
  caption: React.ReactNode;
  /** What the drawing shows, for screen readers. */
  alt: string;
  imprint?: React.ReactNode;
  className?: string;
}) {
  const svg = plateSvg(id);
  const n = PLATE_IDS.indexOf(id) + 1;
  return (
    <Figure
      fig={fig}
      title={title}
      caption={caption}
      className={className}
      imprint={
        imprint ?? (
          <>
            {/* On a phone a drawn plate keeps its size and scrolls inside the frame. */}
            {svg && <span className="sm:hidden">Swipe across the plate</span>}
            <span className={svg ? "max-sm:hidden" : ""}>The Innernet Field Guide</span>
            <span>
              Plate {n} of {PLATE_IDS.length}
            </span>
          </>
        )
      }
    >
      {/* The alt text describes the drawing, so it is read only when there is one; a
          sketch speaks for itself. */}
      {svg && <p className="sr-only">{alt}</p>}
      {svg ? (
        <div className="fg-art" data-draw="" data-plate={id} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <Sketch title={title} id={id} {...SKETCHES[id]} />
      )}
    </Figure>
  );
}

/** A plate still at the engraver's: a graduated neat line and a faint graticule, drawn
 * on like the real thing, with the plate's subject laid out as a first sketch. */
function Sketch({ title, id, terms, flow, loop }: { title: string; id: string; terms: string[]; flow: boolean; loop?: boolean }) {
  const W = 960;
  const H = 420;
  const step = 40;
  const ticks: React.ReactNode[] = [];
  for (let x = step; x < W; x += step) {
    const long = x % (step * 4) === 0;
    ticks.push(<line key={`t${x}`} x1={x} y1={0} x2={x} y2={long ? 10 : 5} />, <line key={`b${x}`} x1={x} y1={H} x2={x} y2={H - (long ? 10 : 5)} />);
  }
  for (let y = step; y < H; y += step) {
    const long = y % (step * 4) === 0;
    ticks.push(<line key={`l${y}`} x1={0} y1={y} x2={long ? 10 : 5} y2={y} />, <line key={`r${y}`} x1={W} y1={y} x2={W - (long ? 10 : 5)} y2={y} />);
  }
  const grid: React.ReactNode[] = [];
  for (let x = step * 2; x < W; x += step * 2) grid.push(<line key={`gx${x}`} x1={x} y1={18} x2={x} y2={H - 18} />);
  for (let y = step * 2; y < H; y += step * 2) grid.push(<line key={`gy${y}`} x1={18} y1={y} x2={W - 18} y2={y} />);
  return (
    <div className="fg-art fg-placeholder relative isolate" data-draw="" data-plate={id}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="fg-graticule absolute inset-0 -z-10 h-full w-full" aria-hidden focusable="false" fill="none" stroke="currentColor">
        <g className="L-con" strokeWidth={1}>
          {grid}
        </g>
        <g className="L-det" strokeWidth={1}>
          {ticks}
        </g>
        <g className="L-main" strokeWidth={1}>
          <circle cx={W - 64} cy={64} r={22} />
          <line x1={W - 98} y1={64} x2={W - 30} y2={64} />
          <line x1={W - 64} y1={30} x2={W - 64} y2={98} />
        </g>
        <g className="L-acc">
          <circle cx={W - 64} cy={64} r={2.5} fill="currentColor" stroke="none" />
        </g>
      </svg>
      <div className="flex min-h-[300px] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[340px] sm:px-6">
        <div className="fg-smallcaps">
          Plate in preparation<span className="max-sm:hidden"> · the engraver&apos;s sketch</span>
        </div>
        <div aria-hidden className="mt-3 font-display text-[30px] italic leading-tight text-ink-2 sm:text-[38px]">
          {title}
        </div>
        <ol className="mt-8 flex max-w-[800px] flex-col items-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-y-3">
          {terms.map((t, i) => (
            <li key={t} className="fg-node flex flex-col items-center sm:flex-row" style={{ "--i": i } as React.CSSProperties}>
              {i > 0 && (flow ? <Arrow /> : <span aria-hidden className="px-2.5 text-faint max-sm:leading-[1.4]">·</span>)}
              <span
                className={`whitespace-nowrap rounded-full border bg-surface px-2.5 py-[5px] font-mono text-[11.5px] leading-none ${
                  flow && i === terms.length - 1 ? "border-link/50 text-link" : "border-line-strong text-ink-2"
                }`}
              >
                {t}
              </span>
            </li>
          ))}
          {loop && (
            <li className="fg-node flex flex-col items-center sm:flex-row" style={{ "--i": terms.length } as React.CSSProperties}>
              <Arrow />
              <span className="font-serif text-[14px] italic text-muted">and round again</span>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg aria-hidden width="22" height="8" viewBox="0 0 22 8" className="mx-1 shrink-0 text-faint max-sm:my-1.5 max-sm:rotate-90" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
      <path d="M1 4h19M16 1l4 3-4 3" />
    </svg>
  );
}
