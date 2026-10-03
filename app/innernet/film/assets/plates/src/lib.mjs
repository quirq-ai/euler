// Shared toolkit for the engraved plates. Plain Node, no dependencies, deterministic.
//
// A plate is a 1600x1000 line drawing in five layers, drawn on in this order by both the
// film and the /guide page:
//   L-con   construction: centre lines, dimension lines, guide circles, grids   (thin, 1.2)
//   L-main  the subject's main outlines                                         (2.6)
//   L-det   detail: hatching, ticks, inner parts, secondary shapes              (1.3)
//   L-acc   the one idea the plate is about, in the accent colour               (3.4)
//   L-lbl   text labels (class "mono" or "serif-i"; colour via currentColor)
// Every stroke uses currentColor; the host page colours the layers (ink on paper, paper
// on night, link blue for L-acc). Prefer many short separate paths over one long path so
// a layer draws on with a visible stagger.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const W = 1600;
export const H = 1000;

export const r1 = (n) => Math.round(n * 10) / 10;
export const P = (x, y) => `${r1(x)},${r1(y)}`;
const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${typeof v === "number" ? r1(v) : v}"`)
    .join(" ");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const line = (x1, y1, x2, y2) => `<line ${attrs({ x1, y1, x2, y2 })}/>`;
export const circle = (cx, cy, r) => `<circle ${attrs({ cx, cy, r })}/>`;
export const ellipse = (cx, cy, rx, ry) => `<ellipse ${attrs({ cx, cy, rx, ry })}/>`;
export const rect = (x, y, width, height, rx) => `<rect ${attrs({ x, y, width, height, rx })}/>`;
export const path_ = (d) => `<path d="${d}"/>`;
export const polyline = (pts) => `<polyline points="${pts.map(([x, y]) => P(x, y)).join(" ")}"/>`;

/** Mono label (small caps feel: pass upper-case text and letter-spacing). */
export const mono = (x, y, s, { anchor = "start", size = 18, ls = 2, weight } = {}) =>
  `<text ${attrs({ x, y, "text-anchor": anchor, "font-size": size, "letter-spacing": ls, "font-weight": weight })} class="mono" font-family="JetBrains Mono, ui-monospace, monospace" fill="currentColor">${esc(s)}</text>`;
/** Italic serif annotation. */
export const note = (x, y, s, { anchor = "start", size = 24 } = {}) =>
  `<text ${attrs({ x, y, "text-anchor": anchor, "font-size": size })} class="serif-i" font-family="Newsreader, Georgia, serif" font-style="italic" fill="currentColor">${esc(s)}</text>`;
/** Display serif (Instrument Serif) for numerals and plate titles. */
export const display = (x, y, s, { anchor = "start", size = 64 } = {}) =>
  `<text ${attrs({ x, y, "text-anchor": anchor, "font-size": size })} class="display" font-family="Instrument Serif, Georgia, serif" fill="currentColor">${esc(s)}</text>`;

/** Dash-dot centre line as one path. */
export function centreLine(x1, y1, x2, y2, pat = [26, 6, 4, 6]) {
  const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  let d = "", t = 0, i = 0;
  while (t < L) {
    const seg = Math.min(pat[i % pat.length], L - t);
    if (i % 2 === 0) d += `M${P(x1 + ux * t, y1 + uy * t)}L${P(x1 + ux * (t + seg), y1 + uy * (t + seg))}`;
    t += seg;
    i++;
  }
  return path_(d);
}

export function arrowHead(x, y, ang, s = 10) {
  const a1 = ang + Math.PI - 0.35, a2 = ang + Math.PI + 0.35;
  return `M${P(x + s * Math.cos(a1), y + s * Math.sin(a1))}L${P(x, y)}L${P(x + s * Math.cos(a2), y + s * Math.sin(a2))}`;
}

/** Arrow from (x1,y1) to (x2,y2), one path. */
export function arrow(x1, y1, x2, y2, s = 11) {
  return path_(`M${P(x1, y1)}L${P(x2, y2)}` + arrowHead(x2, y2, Math.atan2(y2 - y1, x2 - x1), s));
}

/** Curved arrow through a control point. */
export function curveArrow(x1, y1, cx, cy, x2, y2, s = 11) {
  return path_(`M${P(x1, y1)}Q${P(cx, cy)} ${P(x2, y2)}` + arrowHead(x2, y2, Math.atan2(y2 - cy, x2 - cx), s));
}

/** Dimension line with arrowheads at both ends, one path. */
export function dimLine(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  return path_(`M${P(x1, y1)}L${P(x2, y2)}` + arrowHead(x2, y2, a, 9) + arrowHead(x1, y1, a + Math.PI, 9));
}

/** Parallel hatching clipped to a rectangle (engraver's shading), one path. */
export function hatch(x, y, w, h, spacing = 9, angle = -45) {
  const a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  const nx = -dy, ny = dx;
  const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2;
  let d = "";
  for (let o = -R; o <= R; o += spacing) {
    const px = cx + nx * o, py = cy + ny * o;
    // clip the infinite line px+dx*t to the rect
    let t0 = -Infinity, t1 = Infinity;
    for (const [p, q, lo, hi] of [[px, dx, x, x + w], [py, dy, y, y + h]]) {
      if (Math.abs(q) < 1e-9) {
        if (p < lo || p > hi) { t0 = 1; t1 = 0; }
      } else {
        const a1 = (lo - p) / q, a2 = (hi - p) / q;
        t0 = Math.max(t0, Math.min(a1, a2));
        t1 = Math.min(t1, Math.max(a1, a2));
      }
    }
    if (t1 > t0) d += `M${P(px + dx * t0, py + dy * t0)}L${P(px + dx * t1, py + dy * t1)}`;
  }
  return path_(d);
}

/** Hatching inside a circle. */
export function hatchCircle(cx, cy, r, spacing = 8, angle = -45) {
  const a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  let d = "";
  for (let o = -r + spacing / 2; o < r; o += spacing) {
    const half = Math.sqrt(r * r - o * o);
    const px = cx + nx * o, py = cy + ny * o;
    d += `M${P(px - dx * half, py - dy * half)}L${P(px + dx * half, py + dy * half)}`;
  }
  return path_(d);
}

/** Tick marks along a straight edge (major every `every`). */
export function ticks(x1, y1, x2, y2, n, len = 8, every = 5, nrm = 1) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * nrm, ny = Math.cos(a) * nrm;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, L = i % every === 0 ? len * 1.9 : len;
    d += `M${P(x, y)}L${P(x + nx * L, y + ny * L)}`;
  }
  return path_(d);
}

/** Leader: a dot at the subject, an elbow, and a short shelf for a label. Returns [path, labelX, labelY]. */
export function leader(x1, y1, x2, y2, shelf = 60) {
  const dir = x2 >= x1 ? 1 : -1;
  return [`${circle(x1, y1, 4.5)}${path_(`M${P(x1, y1)}L${P(x2, y2)}L${P(x2 + dir * shelf, y2)}`)}`, x2 + dir * (shelf + 12), y2 + 7];
}

/** A folder glyph (tabbed outline) with optional depth offset. */
export function folder(x, y, w, h, tab = 0.32) {
  const tw = w * tab, th = h * 0.12;
  return path_(`M${P(x, y + th)}L${P(x, y + h)}L${P(x + w, y + h)}L${P(x + w, y + th)}L${P(x + tw + th, y + th)}L${P(x + tw, y)}L${P(x + 8, y)}Q${P(x, y)} ${P(x, y + 8)}Z`);
}

/** A file glyph with a folded corner. */
export function file(x, y, w, h, fold = 0.26) {
  const f = w * fold;
  return path_(`M${P(x, y)}L${P(x + w - f, y)}L${P(x + w, y + f)}L${P(x + w, y + h)}L${P(x, y + h)}ZM${P(x + w - f, y)}L${P(x + w - f, y + f)}L${P(x + w, y + f)}`);
}

/** Text lines drawn as ruled strokes (a page of writing, engraved). */
export function writing(x, y, w, rows, gap = 18, seed = 1) {
  let d = "";
  for (let i = 0; i < rows; i++) {
    const k = ((Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1;
    const len = i === rows - 1 ? w * (0.35 + 0.3 * k) : w * (0.82 + 0.18 * k);
    d += `M${P(x, y + i * gap)}L${P(x + len, y + i * gap)}`;
  }
  return path_(d);
}

/** Registration cross with a small circle, as on surveyor plates. */
export const register = (x, y, s = 16) => `${path_(`M${P(x - s, y)}L${P(x + s, y)}M${P(x, y - s)}L${P(x, y + s)}`)}${circle(x, y, s * 0.42)}`;

/** Deterministic pseudo-random in [0,1) from integers. */
export const rand = (i, seed = 0) => ((Math.sin(i * 127.1 + seed * 311.7) * 43758.5453) % 1 + 1) % 1;

/**
 * Write the plate. layers = { con, main, det, acc, lbl } (arrays of SVG strings).
 * Saves assets/plates/<id>.svg and the /guide copy at public/guide/plates/<id>.svg in the app (the repo root).
 */
export function writePlate(id, title, layers) {
  const g = (cls, w, items) => `<g class="${cls}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">\n${items.join("\n")}\n</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="currentColor" data-plate="${id}" aria-label="${esc(title)}">
${g("L-con", 1.2, layers.con || [])}
${g("L-main", 2.6, layers.main || [])}
${g("L-det", 1.3, layers.det || [])}
${g("L-acc", 3.4, layers.acc || [])}
<g class="L-lbl" stroke="none">
${(layers.lbl || []).join("\n")}
</g>
</svg>
`;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = path.resolve(here, "..", `${id}.svg`);
  fs.writeFileSync(out, svg);
  const guide = path.resolve(here, "../../../../public/guide/plates");
  fs.mkdirSync(guide, { recursive: true });
  fs.writeFileSync(path.join(guide, `${id}.svg`), svg);
  console.log(`${id}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}
