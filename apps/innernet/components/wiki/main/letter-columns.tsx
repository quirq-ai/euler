import Link from "next/link";
import { sigilDot } from "@/components/sigil";
import { letterGroups, type LetterGroup } from "@/components/wiki/main/insights";
import { Title } from "@/components/wiki/main/section";
import { wikiHref } from "@/lib/links";
import type { Page } from "@/lib/types";

// Pages under letter headings, set in balanced columns the way a printed index is.
// The split is worked out here rather than by CSS columns, so a letter that runs over
// into the next column can carry a "continued" heading. Roomy (three columns) for
// Category pages, dense (four) for Special:AllPages. On a phone it is one column and
// the continuations simply flow on.

interface Unit {
  g: number; // index into the groups
  page: Page | null; // null for the letter heading
  w: number; // height in rows
}

interface Slice {
  group: LetterGroup;
  pages: Page[];
  continued: boolean;
}

// Rough geometry, in rows of one single-line entry: a heading with the space above it,
// and how many characters fit on a line before a title wraps.
const GEOMETRY = {
  roomy: { head: 2.2, chars: 40, wrap: 0.76 },
  dense: { head: 2.15, chars: 33, wrap: 0.84 },
};

function units(groups: LetterGroup[], dense: boolean): Unit[] {
  const geo = dense ? GEOMETRY.dense : GEOMETRY.roomy;
  return groups.flatMap((group, g) => [
    { g, page: null, w: geo.head },
    ...group.pages.map((page) => ({ g, page, w: 1 + geo.wrap * (Math.ceil(page.title.length / geo.chars) - 1) })),
  ]);
}

/** Contiguous split into at most n columns with the shortest tallest column. */
function partition(list: Unit[], n: number): Unit[][] {
  const fill = (cap: number) => {
    const cols: Unit[][] = [[]];
    let acc = 0;
    for (const u of list) {
      if (acc + u.w > cap && acc > 0 && cols.length < n) {
        cols.push([]);
        acc = 0;
      }
      cols[cols.length - 1].push(u);
      acc += u.w;
    }
    return { cols, over: acc > cap };
  };
  let lo = Math.max(0, ...list.map((u) => u.w));
  let hi = list.reduce((a, u) => a + u.w, 0);
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (fill(mid).over) lo = mid;
    else hi = mid;
  }
  const cols = fill(hi).cols;

  // Keep a heading with at least two of its pages, and never strand one page alone at
  // the top of the next column.
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i];
    const b = cols[i + 1];
    const g = a[a.length - 1]?.g;
    if (g === undefined || b[0]?.g !== g) continue;
    const start = a.findIndex((u) => u.g === g);
    const tail = a.slice(start);
    if (!tail[0].page && tail.length - 1 < 2 && a.length > tail.length) {
      cols[i] = a.slice(0, start);
      cols[i + 1] = [...tail, ...b];
    } else if (b.filter((u) => u.g === g).length === 1) {
      cols[i] = [...a, b[0]];
      cols[i + 1] = b.slice(1);
    }
  }
  return cols.filter((c) => c.length);
}

function slices(col: Unit[], groups: LetterGroup[]): Slice[] {
  const out: Slice[] = [];
  for (const u of col) {
    let s = out[out.length - 1];
    if (!s || s.group !== groups[u.g]) {
      s = { group: groups[u.g], pages: [], continued: !!u.page };
      out.push(s);
    }
    if (u.page) s.pages.push(u.page);
  }
  return out;
}

const letterName = (l: string) => (l === "#" ? "0-9" : l);

export function LetterColumns({
  pages,
  groups,
  dense = false,
  anchors = false,
  level = 3,
}: {
  pages?: Page[];
  groups?: LetterGroup[];
  dense?: boolean;
  anchors?: boolean;
  level?: 2 | 3;
}) {
  const list = groups ?? letterGroups(pages ?? []);
  const columns = partition(units(list, dense), dense ? 4 : 3).map((c) => slices(c, list));
  const H = level === 2 ? "h2" : "h3";

  return (
    <div className={dense ? "ix-dense grid md:grid-cols-2 md:gap-x-10 md:gap-y-10 lg:grid-cols-4" : "grid md:grid-cols-3 md:gap-x-8 lg:gap-x-12"}>
      {columns.map((col, i) => (
        <div key={i} className={`min-w-0 ${i > 0 && !col[0].continued ? (dense ? "mt-6 md:mt-0" : "mt-8 md:mt-0") : ""}`}>
          {col.map((s) => {
            const name = letterName(s.group.letter);
            return (
              // A plain block, not a landmark: the letter headings carry the structure.
              <div
                key={s.group.letter}
                id={anchors && !s.continued ? `letter-${s.group.letter === "#" ? "0" : s.group.letter}` : undefined}
                className={`scroll-mt-32 last:mb-0 ${dense ? "mb-6" : "mb-8"}`}
              >
                {s.continued ? (
                  <H className="hidden items-baseline gap-3 pb-1.5 md:flex">
                    <span className={`font-display leading-none text-muted ${dense ? "text-[22px]" : "text-[26px]"}`}>{name}</span>
                    <span className="font-serif text-[13px] italic leading-none text-muted">continued</span>
                    <span aria-hidden className="h-px flex-1 -translate-y-1 bg-line" />
                  </H>
                ) : (
                  <H className="flex items-baseline gap-3 pb-1.5">
                    <span className={`font-display leading-none text-ink ${dense ? "text-[22px]" : "text-[26px]"}`}>{name}</span>
                    <span aria-hidden className="h-px flex-1 -translate-y-1 bg-line" />
                    <span className="text-[11px] tabular-nums text-muted">
                      {s.group.pages.length}
                      <span className="sr-only"> {s.group.pages.length === 1 ? "page" : "pages"}</span>
                    </span>
                  </H>
                )}
                <ul>
                  {s.pages.map((p) => {
                    const dot = sigilDot(p.slug, p.kind, !p.isArticle);
                    return (
                      <li key={p.slug}>
                        <Link href={wikiHref(p.slug)} className={`ix-entry${dot.className}`} style={dot.style}>
                          <Title page={p} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
